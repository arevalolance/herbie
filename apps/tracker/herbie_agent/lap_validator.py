"""
Lap validation system for Herbie Telemetry Agent

Provides comprehensive validation of lap data to ensure only complete,
valid laps are sent to the API.
"""

import time
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import structlog

from .utils import (
    calculate_speed_kmh, 
    calculate_distance, 
    is_valid_position, 
    is_valid_telemetry_value,
    detect_outliers,
    moving_average
)
from .settings_manager import get_settings

logger = structlog.get_logger(__name__)

class ValidationResult(Enum):
    """Validation result types"""
    VALID = "valid"
    INVALID_INSUFFICIENT_DATA = "insufficient_data"
    INVALID_DURATION = "invalid_duration"
    INVALID_DISTANCE = "invalid_distance"
    INVALID_DATA_GAPS = "data_gaps"
    INVALID_OUTLIERS = "outliers"
    INVALID_INCOMPLETE = "incomplete"
    INVALID_POSITION = "invalid_position"

@dataclass
class ValidationReport:
    """Detailed validation report"""
    result: ValidationResult
    lap_number: int
    telemetry_points: int
    duration: float
    distance: float
    max_gap: float
    outlier_count: int
    issues: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    
    def is_valid(self) -> bool:
        """Check if lap is valid"""
        return self.result == ValidationResult.VALID
    
    def get_summary(self) -> str:
        """Get validation summary"""
        status = "VALID" if self.is_valid() else "INVALID"
        return f"Lap {self.lap_number}: {status} - {len(self.issues)} issues"

@dataclass
class TelemetryPoint:
    """Single telemetry data point"""
    timestamp: float
    session_elapsed: float
    lap_progress: float
    position: Tuple[float, float, float]
    speed: float
    rpm: float
    gear: int
    throttle: float
    brake: float
    fuel: float
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TelemetryPoint':
        """Create TelemetryPoint from dictionary"""
        return cls(
            timestamp=data.get('timestamp', 0.0),
            session_elapsed=data.get('session_elapsed', 0.0),
            lap_progress=data.get('lap_progress', 0.0),
            position=(
                data.get('position_x', 0.0),
                data.get('position_y', 0.0),
                data.get('position_z', 0.0)
            ),
            speed=data.get('speed', 0.0),
            rpm=data.get('rpm', 0.0),
            gear=data.get('gear', 0),
            throttle=data.get('throttle', 0.0),
            brake=data.get('brake', 0.0),
            fuel=data.get('fuel', 0.0)
        )

class LapValidator:
    """Comprehensive lap validation system"""
    
    def __init__(self):
        self.settings = get_settings()
        self.validation_history: List[ValidationReport] = []
        self.track_length_cache: Dict[str, float] = {}
        
    def validate_lap(self, lap_data: Dict[str, Any], 
                    telemetry_points: List[Dict[str, Any]]) -> ValidationReport:
        """
        Validate a complete lap with telemetry data
        
        Args:
            lap_data: Lap information (lap_number, start_time, end_time, etc.)
            telemetry_points: List of telemetry data points
            
        Returns:
            ValidationReport with detailed results
        """
        lap_number = lap_data.get('lap_number', 0)
        report = ValidationReport(
            result=ValidationResult.VALID,
            lap_number=lap_number,
            telemetry_points=len(telemetry_points),
            duration=0.0,
            distance=0.0,
            max_gap=0.0,
            outlier_count=0
        )
        
        logger.info("Starting lap validation", lap_number=lap_number, 
                   points=len(telemetry_points))
        
        # Convert telemetry points to structured data
        try:
            points = [TelemetryPoint.from_dict(point) for point in telemetry_points]
        except Exception as e:
            report.result = ValidationResult.INVALID_INCOMPLETE
            report.issues.append(f"Failed to parse telemetry data: {str(e)}")
            return report
        
        # Run validation checks
        self._validate_data_sufficiency(points, report)
        self._validate_lap_duration(points, report)
        self._validate_positions(points, report)
        self._validate_data_gaps(points, report)
        self._validate_outliers(points, report)
        self._validate_distance_coverage(points, report)
        self._validate_data_completeness(points, report)
        
        # Calculate metrics
        report.duration = self._calculate_lap_duration(points)
        report.distance = self._calculate_lap_distance(points)
        report.max_gap = self._calculate_max_gap(points)
        
        # Set final result
        if report.result == ValidationResult.VALID and report.issues:
            # If we have issues but haven't set a specific failure reason
            report.result = ValidationResult.INVALID_INCOMPLETE
        
        # Add to history
        self.validation_history.append(report)
        
        # Log results
        if report.is_valid():
            logger.info("Lap validation passed", lap_number=lap_number,
                       duration=report.duration, distance=report.distance,
                       points=report.telemetry_points)
        else:
            logger.warning("Lap validation failed", lap_number=lap_number,
                          result=report.result.value, issues=report.issues)
        
        return report
    
    def _validate_data_sufficiency(self, points: List[TelemetryPoint], 
                                  report: ValidationReport):
        """Check if we have enough telemetry points"""
        min_points = self.settings.lap_validation.min_telemetry_points
        
        if len(points) < min_points:
            report.result = ValidationResult.INVALID_INSUFFICIENT_DATA
            report.issues.append(f"Insufficient telemetry points: {len(points)} < {min_points}")
            report.recommendations.append(f"Need at least {min_points} telemetry points per lap")
    
    def _validate_lap_duration(self, points: List[TelemetryPoint], 
                              report: ValidationReport):
        """Validate lap duration is within reasonable bounds"""
        if len(points) < 2:
            return
        
        duration = points[-1].timestamp - points[0].timestamp
        min_time = self.settings.lap_validation.min_lap_time
        max_time = self.settings.lap_validation.max_lap_time
        
        if duration < min_time:
            report.result = ValidationResult.INVALID_DURATION
            report.issues.append(f"Lap too short: {duration:.1f}s < {min_time}s")
            report.recommendations.append("Check if lap timing is correct")
        elif duration > max_time:
            report.result = ValidationResult.INVALID_DURATION
            report.issues.append(f"Lap too long: {duration:.1f}s > {max_time}s")
            report.recommendations.append("Check for pit stops or track incidents")
    
    def _validate_positions(self, points: List[TelemetryPoint], 
                           report: ValidationReport):
        """Validate position data quality"""
        invalid_positions = 0
        
        for i, point in enumerate(points):
            if not is_valid_position(point.position):
                invalid_positions += 1
        
        # Allow up to 5% invalid positions
        invalid_percentage = (invalid_positions / len(points)) * 100
        if invalid_percentage > 5.0:
            report.result = ValidationResult.INVALID_POSITION
            report.issues.append(f"Too many invalid positions: {invalid_percentage:.1f}%")
            report.recommendations.append("Check GPS/position data quality")
    
    def _validate_data_gaps(self, points: List[TelemetryPoint], 
                           report: ValidationReport):
        """Check for excessive gaps in telemetry data"""
        if len(points) < 2:
            return
        
        max_allowed_gap = self.settings.lap_validation.max_telemetry_gap
        large_gaps = []
        
        for i in range(1, len(points)):
            gap = points[i].timestamp - points[i-1].timestamp
            if gap > max_allowed_gap:
                large_gaps.append(gap)
        
        if large_gaps:
            report.result = ValidationResult.INVALID_DATA_GAPS
            max_gap = max(large_gaps)
            report.issues.append(f"Large data gaps found: max {max_gap:.1f}s")
            report.recommendations.append("Check telemetry collection frequency")
    
    def _validate_outliers(self, points: List[TelemetryPoint], 
                          report: ValidationReport):
        """Detect and validate outliers in telemetry data"""
        if len(points) < 10:  # Need enough data for statistical analysis
            return
        
        # Check speed outliers
        speeds = [point.speed for point in points]
        speed_outliers = detect_outliers(speeds, threshold=2.5)
        extreme_speeds = [speeds[i] for i, is_outlier in enumerate(speed_outliers) 
                         if is_outlier and speeds[i] > self.settings.lap_validation.speed_outlier_threshold]
        
        if extreme_speeds:
            report.outlier_count = len(extreme_speeds)
            # Only fail if we have excessive outliers
            if report.outlier_count > len(points) * 0.1:  # >10% outliers
                report.result = ValidationResult.INVALID_OUTLIERS
                report.issues.append(f"Excessive speed outliers: {report.outlier_count}")
                report.recommendations.append("Check for data corruption or unrealistic speeds")
    
    def _validate_distance_coverage(self, points: List[TelemetryPoint], 
                                   report: ValidationReport):
        """Validate lap distance coverage"""
        if len(points) < 2:
            return
        
        total_distance = self._calculate_lap_distance(points)
        
        # Estimate expected lap distance (rough approximation)
        # This would ideally come from track database
        estimated_distance = self._estimate_track_length(points)
        
        if estimated_distance > 0:
            coverage_percentage = (total_distance / estimated_distance) * 100
            min_coverage = self.settings.lap_validation.min_distance_percentage
            
            if coverage_percentage < min_coverage:
                report.result = ValidationResult.INVALID_DISTANCE
                report.issues.append(f"Insufficient distance coverage: {coverage_percentage:.1f}%")
                report.recommendations.append("Check if lap was completed")
    
    def _validate_data_completeness(self, points: List[TelemetryPoint], 
                                   report: ValidationReport):
        """Check data completeness and quality"""
        missing_data_count = 0
        
        for point in points:
            # Check for missing critical data
            if (point.speed < 0 or point.rpm < 0 or 
                not is_valid_telemetry_value(point.throttle, 0, 1) or
                not is_valid_telemetry_value(point.brake, 0, 1)):
                missing_data_count += 1
        
        # Allow up to 2% missing data
        missing_percentage = (missing_data_count / len(points)) * 100
        if missing_percentage > 2.0:
            report.result = ValidationResult.INVALID_INCOMPLETE
            report.issues.append(f"Incomplete data: {missing_percentage:.1f}% missing")
            report.recommendations.append("Check telemetry data collection")
    
    def _calculate_lap_duration(self, points: List[TelemetryPoint]) -> float:
        """Calculate lap duration"""
        if len(points) < 2:
            return 0.0
        return points[-1].timestamp - points[0].timestamp
    
    def _calculate_lap_distance(self, points: List[TelemetryPoint]) -> float:
        """Calculate total lap distance"""
        if len(points) < 2:
            return 0.0
        
        total_distance = 0.0
        for i in range(1, len(points)):
            if (is_valid_position(points[i].position) and 
                is_valid_position(points[i-1].position)):
                distance = calculate_distance(points[i-1].position, points[i].position)
                total_distance += distance
        
        return total_distance
    
    def _calculate_max_gap(self, points: List[TelemetryPoint]) -> float:
        """Calculate maximum gap between telemetry points"""
        if len(points) < 2:
            return 0.0
        
        max_gap = 0.0
        for i in range(1, len(points)):
            gap = points[i].timestamp - points[i-1].timestamp
            max_gap = max(max_gap, gap)
        
        return max_gap
    
    def _estimate_track_length(self, points: List[TelemetryPoint]) -> float:
        """Estimate track length from telemetry data"""
        if len(points) < 10:
            return 0.0
        
        # Use the total distance traveled as a rough estimate
        # This is a simplified approach - ideally would use track database
        return self._calculate_lap_distance(points)
    
    def get_validation_stats(self) -> Dict[str, Any]:
        """Get validation statistics"""
        if not self.validation_history:
            return {}
        
        total_validations = len(self.validation_history)
        valid_laps = sum(1 for report in self.validation_history if report.is_valid())
        
        # Calculate failure reasons
        failure_reasons = {}
        for report in self.validation_history:
            if not report.is_valid():
                reason = report.result.value
                failure_reasons[reason] = failure_reasons.get(reason, 0) + 1
        
        return {
            "total_validations": total_validations,
            "valid_laps": valid_laps,
            "invalid_laps": total_validations - valid_laps,
            "success_rate": (valid_laps / total_validations) * 100,
            "failure_reasons": failure_reasons,
            "average_points": sum(r.telemetry_points for r in self.validation_history) / total_validations,
            "average_duration": sum(r.duration for r in self.validation_history) / total_validations,
            "average_distance": sum(r.distance for r in self.validation_history) / total_validations
        }
    
    def clear_history(self):
        """Clear validation history"""
        self.validation_history.clear()
        logger.info("Validation history cleared")
    
    def update_settings(self):
        """Update settings from configuration"""
        self.settings = get_settings()
        logger.info("Lap validator settings updated")

# Factory function for creating lap validator
def create_lap_validator() -> LapValidator:
    """Create a new lap validator instance"""
    return LapValidator()