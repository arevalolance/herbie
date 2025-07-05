"""
Core telemetry collection system for Herbie Telemetry Agent

Integrates with rFactor 2 shared memory, validates telemetry data,
and sends it to the Herbie backend API following the complete workflow.
"""

import asyncio
import time
import threading
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
import structlog

# Import existing RF2 components
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'tracker'))

from tracker.api_connector import SimRF2
from tracker.adapter import rf2_data

from .api_client import HerbieAPIClient, create_api_client, SessionData
from .lap_validator import LapValidator, ValidationResult, create_lap_validator
from .settings_manager import get_settings_manager
from .utils import AsyncTimer, TelemetryBuffer, format_timestamp, performance_monitor

logger = structlog.get_logger(__name__)

class CollectorState(Enum):
    """Telemetry collector states"""
    STOPPED = "stopped"
    STARTING = "starting"
    CONNECTED = "connected"
    COLLECTING = "collecting"
    ERROR = "error"
    PAUSED = "paused"

class LapState(Enum):
    """Lap collection states"""
    WAITING = "waiting"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    VALIDATING = "validating"
    UPLOADING = "uploading"
    FAILED = "failed"

@dataclass
class CollectionStats:
    """Collection statistics"""
    sessions_created: int = 0
    laps_collected: int = 0
    laps_valid: int = 0
    laps_uploaded: int = 0
    telemetry_points_collected: int = 0
    telemetry_points_uploaded: int = 0
    collection_start_time: float = 0.0
    last_lap_time: float = 0.0
    current_session_id: Optional[int] = None
    current_vehicle_id: Optional[int] = None
    errors: List[str] = field(default_factory=list)

@dataclass
class LapData:
    """Lap data container"""
    lap_number: int
    start_time: float
    end_time: Optional[float] = None
    telemetry_points: List[Dict[str, Any]] = field(default_factory=list)
    state: LapState = LapState.WAITING
    lap_time: Optional[float] = None
    valid: bool = False
    uploaded: bool = False
    error: Optional[str] = None

class TelemetryCollector:
    """Core telemetry collection and processing system"""
    
    def __init__(self):
        self.settings_manager = get_settings_manager()
        self.settings = self.settings_manager.settings
        
        # Core components
        self.rf2_sim: Optional[SimRF2] = None
        self.api_client: Optional[HerbieAPIClient] = None
        self.lap_validator: LapValidator = create_lap_validator()
        
        # State management
        self.state = CollectorState.STOPPED
        self.current_lap: Optional[LapData] = None
        self.pending_laps: List[LapData] = []
        self.stats = CollectionStats()
        
        # Threading
        self.collection_task: Optional[asyncio.Task] = None
        self.processing_task: Optional[asyncio.Task] = None
        self.upload_task: Optional[asyncio.Task] = None
        self._stop_event = asyncio.Event()
        
        # Buffers and timers
        self.telemetry_buffer = TelemetryBuffer(
            max_size=self.settings.api.batch_size,
            flush_interval=self.settings.telemetry.collection_interval * 10
        )
        
        # Callbacks
        self.status_callback: Optional[Callable] = None
        self.lap_completed_callback: Optional[Callable] = None
        self.error_callback: Optional[Callable] = None
        
        # Session management
        self.current_session_data: Optional[Dict[str, Any]] = None
        self.session_initialized = False
        
    async def initialize(self):
        """Initialize the telemetry collector"""
        try:
            logger.info("Initializing telemetry collector")
            
            # Initialize RF2 connection
            self.rf2_sim = SimRF2()
            self.rf2_sim.setup(
                self.settings.rf2.access_mode,
                self.settings.rf2.process_id,
                self.settings.rf2.player_override,
                self.settings.rf2.player_index,
                self.settings.rf2.char_encoding
            )
            
            # Initialize API client
            self.api_client = await create_api_client()
            
            # Set telemetry buffer callback
            self.telemetry_buffer.set_flush_callback(self._on_telemetry_buffer_flush)
            
            self.stats.collection_start_time = time.time()
            
            logger.info("Telemetry collector initialized successfully")
            
        except Exception as e:
            self.state = CollectorState.ERROR
            self._add_error(f"Initialization failed: {str(e)}")
            logger.error("Failed to initialize telemetry collector", error=str(e))
            raise
    
    async def start(self):
        """Start telemetry collection"""
        if self.state != CollectorState.STOPPED:
            logger.warning("Collector already running")
            return
        
        try:
            self.state = CollectorState.STARTING
            self._notify_status_change()
            
            logger.info("Starting telemetry collection")
            
            # Start RF2 connection
            self.rf2_sim.start()
            
            # Wait for RF2 connection
            await self._wait_for_rf2_connection()
            
            # Start async tasks
            self._stop_event.clear()
            self.collection_task = asyncio.create_task(self._collection_loop())
            self.processing_task = asyncio.create_task(self._processing_loop())
            self.upload_task = asyncio.create_task(self._upload_loop())
            
            self.state = CollectorState.CONNECTED
            self._notify_status_change()
            
            logger.info("Telemetry collection started")
            
        except Exception as e:
            self.state = CollectorState.ERROR
            self._add_error(f"Failed to start collector: {str(e)}")
            logger.error("Failed to start telemetry collection", error=str(e))
            await self.stop()
            raise
    
    async def stop(self):
        """Stop telemetry collection"""
        if self.state == CollectorState.STOPPED:
            return
        
        logger.info("Stopping telemetry collection")
        
        # Signal stop
        self._stop_event.set()
        
        # Cancel tasks
        if self.collection_task:
            self.collection_task.cancel()
        if self.processing_task:
            self.processing_task.cancel()
        if self.upload_task:
            self.upload_task.cancel()
        
        # Wait for tasks to complete
        for task in [self.collection_task, self.processing_task, self.upload_task]:
            if task:
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        
        # Stop RF2 connection
        if self.rf2_sim:
            self.rf2_sim.stop()
        
        # Close API client
        if self.api_client:
            await self.api_client.close()
        
        # Flush any remaining data
        self.telemetry_buffer.manual_flush()
        
        self.state = CollectorState.STOPPED
        self._notify_status_change()
        
        logger.info("Telemetry collection stopped")
    
    async def pause(self):
        """Pause telemetry collection"""
        if self.state == CollectorState.COLLECTING:
            self.state = CollectorState.PAUSED
            self._notify_status_change()
            logger.info("Telemetry collection paused")
    
    async def resume(self):
        """Resume telemetry collection"""
        if self.state == CollectorState.PAUSED:
            self.state = CollectorState.COLLECTING
            self._notify_status_change()
            logger.info("Telemetry collection resumed")
    
    async def _wait_for_rf2_connection(self, timeout: float = 30.0):
        """Wait for RF2 connection to be established"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            if not self.rf2_sim.info.isPaused:
                # Check if we have valid data
                try:
                    vehicle_info = self.rf2_sim.info.rf2ScorVeh()
                    if vehicle_info and hasattr(vehicle_info, 'mDriverName'):
                        logger.info("RF2 connection established")
                        return
                except:
                    pass
            
            await asyncio.sleep(0.5)
        
        raise TimeoutError("Failed to connect to rFactor 2 within timeout")
    
    async def _collection_loop(self):
        """Main collection loop"""
        logger.info("Starting collection loop")
        
        last_lap_number = None
        
        while not self._stop_event.is_set():
            try:
                if self.rf2_sim.info.isPaused:
                    await asyncio.sleep(0.1)
                    continue
                
                # Get current telemetry data
                telemetry_data = self._collect_telemetry_point()
                
                if not telemetry_data:
                    await asyncio.sleep(0.1)
                    continue
                
                current_lap_number = telemetry_data.get('lap_number', 0)
                
                # Handle lap changes
                if last_lap_number is not None and current_lap_number != last_lap_number:
                    await self._handle_lap_change(last_lap_number, current_lap_number)
                
                # Initialize session if needed
                if not self.session_initialized:
                    await self._initialize_session(telemetry_data)
                
                # Add telemetry to current lap
                if self.current_lap and self.current_lap.state == LapState.IN_PROGRESS:
                    self.current_lap.telemetry_points.append(telemetry_data)
                    self.stats.telemetry_points_collected += 1
                
                last_lap_number = current_lap_number
                
                # Check state
                if self.state == CollectorState.CONNECTED:
                    self.state = CollectorState.COLLECTING
                    self._notify_status_change()
                
                await asyncio.sleep(self.settings.telemetry.collection_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in collection loop", error=str(e))
                self._add_error(f"Collection error: {str(e)}")
                await asyncio.sleep(1.0)
        
        logger.info("Collection loop stopped")
    
    def _collect_telemetry_point(self) -> Optional[Dict[str, Any]]:
        """Collect a single telemetry point"""
        try:
            # Get telemetry and scoring data
            tele_veh = self.rf2_sim.info.rf2TeleVeh()
            scor_veh = self.rf2_sim.info.rf2ScorVeh()
            
            if not tele_veh or not scor_veh:
                return None
            
            # Check if we should record (not in pits, valid lap)
            in_pits = scor_veh.mInPits
            last_lap_time = scor_veh.mLastLapTime
            
            if in_pits or (last_lap_time is not None and last_lap_time <= 0):
                return None
            
            # Build telemetry data point
            telemetry_point = {
                # Timestamps
                'timestamp': format_timestamp(),
                'session_elapsed': tele_veh.mElapsedTime,
                'lap_progress': tele_veh.mLapDist / max(tele_veh.mLapDist + 1, 1),  # Avoid division by zero
                'lap_number': tele_veh.mLapNumber,
                
                # Position and orientation
                'position_x': tele_veh.mPos.x,
                'position_y': tele_veh.mPos.y,
                'position_z': tele_veh.mPos.z,
                'orientation_yaw': tele_veh.mOri[1].x,  # Yaw component
                
                # Vehicle dynamics
                'speed': self._calculate_speed(tele_veh.mLocalVel),
                'accel_lateral': tele_veh.mLocalAccel.x,
                'accel_longitudinal': tele_veh.mLocalAccel.z,
                'accel_vertical': tele_veh.mLocalAccel.y,
                'velocity_lateral': tele_veh.mLocalVel.x,
                'velocity_longitudinal': tele_veh.mLocalVel.z,
                'velocity_vertical': tele_veh.mLocalVel.y,
                
                # Engine data
                'gear': tele_veh.mGear,
                'rpm': tele_veh.mEngineRPM,
                'throttle': tele_veh.mUnfilteredThrottle,
                'brake': tele_veh.mUnfilteredBrake,
                'clutch': tele_veh.mUnfilteredClutch,
                'steering': tele_veh.mUnfilteredSteering,
                'fuel': tele_veh.mFuel,
                
                # Track position
                'track_edge': getattr(tele_veh, 'mTrackEdge', 0.0),
                'path_lateral': getattr(tele_veh, 'mPathLateral', 0.0),
                
                # Additional nested data structures (following API format)
                'engine': self._extract_engine_data(tele_veh),
                'input': self._extract_input_data(tele_veh),
                'brake_data': self._extract_brake_data(tele_veh),
                'tyre': self._extract_tyre_data(tele_veh),
                'wheel': self._extract_wheel_data(tele_veh),
                'vehicle_state': self._extract_vehicle_state(scor_veh, tele_veh),
                'switch_states': self._extract_switch_states(tele_veh)
            }
            
            return telemetry_point
            
        except Exception as e:
            logger.warning("Failed to collect telemetry point", error=str(e))
            return None
    
    def _calculate_speed(self, velocity_vector) -> float:
        """Calculate speed from velocity vector"""
        if hasattr(velocity_vector, 'x') and hasattr(velocity_vector, 'y') and hasattr(velocity_vector, 'z'):
            return ((velocity_vector.x ** 2 + velocity_vector.y ** 2 + velocity_vector.z ** 2) ** 0.5) * 3.6  # km/h
        return 0.0
    
    def _extract_engine_data(self, tele_veh) -> Dict[str, Any]:
        """Extract engine data"""
        return {
            'gear': tele_veh.mGear,
            'max_gear': getattr(tele_veh, 'mMaxGears', 6),
            'rpm': tele_veh.mEngineRPM,
            'max_rpm': getattr(tele_veh, 'mEngineMaxRPM', 9000.0),
            'torque': getattr(tele_veh, 'mEngineTorque', 0.0),
            'turbo_boost': getattr(tele_veh, 'mTurboBoostPressure', 0.0),
            'oil_temperature': getattr(tele_veh, 'mEngineOilTemp', 0.0),
            'water_temperature': getattr(tele_veh, 'mEngineWaterTemp', 0.0)
        }
    
    def _extract_input_data(self, tele_veh) -> Dict[str, Any]:
        """Extract input data"""
        return {
            'throttle': tele_veh.mUnfilteredThrottle,
            'throttle_raw': getattr(tele_veh, 'mFilteredThrottle', tele_veh.mUnfilteredThrottle),
            'brake': tele_veh.mUnfilteredBrake,
            'brake_raw': getattr(tele_veh, 'mFilteredBrake', tele_veh.mUnfilteredBrake),
            'clutch': tele_veh.mUnfilteredClutch,
            'clutch_raw': getattr(tele_veh, 'mFilteredClutch', tele_veh.mUnfilteredClutch),
            'steering': tele_veh.mUnfilteredSteering,
            'steering_raw': getattr(tele_veh, 'mFilteredSteering', tele_veh.mUnfilteredSteering),
            'steering_shaft_torque': getattr(tele_veh, 'mSteeringShaftTorque', 0.0),
            'steering_range_physical': getattr(tele_veh, 'mPhysicalSteeringWheelRange', 900.0),
            'steering_range_visual': getattr(tele_veh, 'mVisualSteeringWheelRange', 360.0),
            'force_feedback': getattr(tele_veh, 'mForceOnSteering', 0.0)
        }
    
    def _extract_brake_data(self, tele_veh) -> Dict[str, Any]:
        """Extract brake data"""
        try:
            wheels = tele_veh.mWheels
            return {
                'bias_front': getattr(tele_veh, 'mFrontBrakeBias', 0.6),
                'pressure_fl': getattr(wheels[0], 'mBrakePressure', 0.0) if len(wheels) > 0 else 0.0,
                'pressure_fr': getattr(wheels[1], 'mBrakePressure', 0.0) if len(wheels) > 1 else 0.0,
                'pressure_rl': getattr(wheels[2], 'mBrakePressure', 0.0) if len(wheels) > 2 else 0.0,
                'pressure_rr': getattr(wheels[3], 'mBrakePressure', 0.0) if len(wheels) > 3 else 0.0,
                'temperature_fl': getattr(wheels[0], 'mBrakeTemp', 0.0) if len(wheels) > 0 else 0.0,
                'temperature_fr': getattr(wheels[1], 'mBrakeTemp', 0.0) if len(wheels) > 1 else 0.0,
                'temperature_rl': getattr(wheels[2], 'mBrakeTemp', 0.0) if len(wheels) > 2 else 0.0,
                'temperature_rr': getattr(wheels[3], 'mBrakeTemp', 0.0) if len(wheels) > 3 else 0.0
            }
        except:
            return {'bias_front': 0.6, 'pressure_fl': 0.0, 'pressure_fr': 0.0, 'pressure_rl': 0.0, 'pressure_rr': 0.0,
                   'temperature_fl': 0.0, 'temperature_fr': 0.0, 'temperature_rl': 0.0, 'temperature_rr': 0.0}
    
    def _extract_tyre_data(self, tele_veh) -> Dict[str, Any]:
        """Extract tyre data"""
        try:
            wheels = tele_veh.mWheels
            return {
                'compound_front': getattr(tele_veh, 'mFrontTireCompoundIndex', 1),
                'compound_rear': getattr(tele_veh, 'mRearTireCompoundIndex', 1),
                'compound_name_front': getattr(tele_veh, 'mFrontTireCompoundName', b'Medium').decode('utf-8', errors='ignore'),
                'compound_name_rear': getattr(tele_veh, 'mRearTireCompoundName', b'Medium').decode('utf-8', errors='ignore'),
                'surface_temp_fl': getattr(wheels[0], 'mTemperature', [0.0, 0.0, 0.0])[1] if len(wheels) > 0 else 0.0,
                'surface_temp_fr': getattr(wheels[1], 'mTemperature', [0.0, 0.0, 0.0])[1] if len(wheels) > 1 else 0.0,
                'surface_temp_rl': getattr(wheels[2], 'mTemperature', [0.0, 0.0, 0.0])[1] if len(wheels) > 2 else 0.0,
                'surface_temp_rr': getattr(wheels[3], 'mTemperature', [0.0, 0.0, 0.0])[1] if len(wheels) > 3 else 0.0,
                'inner_temp_fl': getattr(wheels[0], 'mTemperature', [0.0, 0.0, 0.0])[0] if len(wheels) > 0 else 0.0,
                'inner_temp_fr': getattr(wheels[1], 'mTemperature', [0.0, 0.0, 0.0])[0] if len(wheels) > 1 else 0.0,
                'inner_temp_rl': getattr(wheels[2], 'mTemperature', [0.0, 0.0, 0.0])[0] if len(wheels) > 2 else 0.0,
                'inner_temp_rr': getattr(wheels[3], 'mTemperature', [0.0, 0.0, 0.0])[0] if len(wheels) > 3 else 0.0,
                'pressure_fl': getattr(wheels[0], 'mPressure', 0.0) if len(wheels) > 0 else 0.0,
                'pressure_fr': getattr(wheels[1], 'mPressure', 0.0) if len(wheels) > 1 else 0.0,
                'pressure_rl': getattr(wheels[2], 'mPressure', 0.0) if len(wheels) > 2 else 0.0,
                'pressure_rr': getattr(wheels[3], 'mPressure', 0.0) if len(wheels) > 3 else 0.0,
                'load_fl': getattr(wheels[0], 'mVerticalTireLoad', 0.0) if len(wheels) > 0 else 0.0,
                'load_fr': getattr(wheels[1], 'mVerticalTireLoad', 0.0) if len(wheels) > 1 else 0.0,
                'load_rl': getattr(wheels[2], 'mVerticalTireLoad', 0.0) if len(wheels) > 2 else 0.0,
                'load_rr': getattr(wheels[3], 'mVerticalTireLoad', 0.0) if len(wheels) > 3 else 0.0,
                'wear_fl': getattr(wheels[0], 'mWear', 0.0) if len(wheels) > 0 else 0.0,
                'wear_fr': getattr(wheels[1], 'mWear', 0.0) if len(wheels) > 1 else 0.0,
                'wear_rl': getattr(wheels[2], 'mWear', 0.0) if len(wheels) > 2 else 0.0,
                'wear_rr': getattr(wheels[3], 'mWear', 0.0) if len(wheels) > 3 else 0.0,
                'carcass_temp_fl': getattr(wheels[0], 'mTemperature', [0.0, 0.0, 0.0])[2] if len(wheels) > 0 else 0.0,
                'carcass_temp_fr': getattr(wheels[1], 'mTemperature', [0.0, 0.0, 0.0])[2] if len(wheels) > 1 else 0.0,
                'carcass_temp_rl': getattr(wheels[2], 'mTemperature', [0.0, 0.0, 0.0])[2] if len(wheels) > 2 else 0.0,
                'carcass_temp_rr': getattr(wheels[3], 'mTemperature', [0.0, 0.0, 0.0])[2] if len(wheels) > 3 else 0.0
            }
        except:
            return {k: 0.0 for k in ['surface_temp_fl', 'surface_temp_fr', 'surface_temp_rl', 'surface_temp_rr',
                                    'inner_temp_fl', 'inner_temp_fr', 'inner_temp_rl', 'inner_temp_rr',
                                    'pressure_fl', 'pressure_fr', 'pressure_rl', 'pressure_rr',
                                    'load_fl', 'load_fr', 'load_rl', 'load_rr',
                                    'wear_fl', 'wear_fr', 'wear_rl', 'wear_rr',
                                    'carcass_temp_fl', 'carcass_temp_fr', 'carcass_temp_rl', 'carcass_temp_rr']}
    
    def _extract_wheel_data(self, tele_veh) -> Dict[str, Any]:
        """Extract wheel data"""
        try:
            wheels = tele_veh.mWheels
            return {
                'camber_fl': getattr(wheels[0], 'mCamber', 0.0) if len(wheels) > 0 else 0.0,
                'camber_fr': getattr(wheels[1], 'mCamber', 0.0) if len(wheels) > 1 else 0.0,
                'camber_rl': getattr(wheels[2], 'mCamber', 0.0) if len(wheels) > 2 else 0.0,
                'camber_rr': getattr(wheels[3], 'mCamber', 0.0) if len(wheels) > 3 else 0.0,
                'toe_fl': getattr(wheels[0], 'mToe', 0.0) if len(wheels) > 0 else 0.0,
                'toe_fr': getattr(wheels[1], 'mToe', 0.0) if len(wheels) > 1 else 0.0,
                'toe_rl': getattr(wheels[2], 'mToe', 0.0) if len(wheels) > 2 else 0.0,
                'toe_rr': getattr(wheels[3], 'mToe', 0.0) if len(wheels) > 3 else 0.0,
                'rotation_fl': getattr(wheels[0], 'mRotation', 0.0) if len(wheels) > 0 else 0.0,
                'rotation_fr': getattr(wheels[1], 'mRotation', 0.0) if len(wheels) > 1 else 0.0,
                'rotation_rl': getattr(wheels[2], 'mRotation', 0.0) if len(wheels) > 2 else 0.0,
                'rotation_rr': getattr(wheels[3], 'mRotation', 0.0) if len(wheels) > 3 else 0.0,
                'vel_lateral_fl': getattr(wheels[0], 'mLateralPatchVel', 0.0) if len(wheels) > 0 else 0.0,
                'vel_lateral_fr': getattr(wheels[1], 'mLateralPatchVel', 0.0) if len(wheels) > 1 else 0.0,
                'vel_lateral_rl': getattr(wheels[2], 'mLateralPatchVel', 0.0) if len(wheels) > 2 else 0.0,
                'vel_lateral_rr': getattr(wheels[3], 'mLateralPatchVel', 0.0) if len(wheels) > 3 else 0.0,
                'vel_longitudinal_fl': getattr(wheels[0], 'mLongitudinalPatchVel', 0.0) if len(wheels) > 0 else 0.0,
                'vel_longitudinal_fr': getattr(wheels[1], 'mLongitudinalPatchVel', 0.0) if len(wheels) > 1 else 0.0,
                'vel_longitudinal_rl': getattr(wheels[2], 'mLongitudinalPatchVel', 0.0) if len(wheels) > 2 else 0.0,
                'vel_longitudinal_rr': getattr(wheels[3], 'mLongitudinalPatchVel', 0.0) if len(wheels) > 3 else 0.0,
                'ride_height_fl': getattr(wheels[0], 'mRideHeight', 0.0) if len(wheels) > 0 else 0.0,
                'ride_height_fr': getattr(wheels[1], 'mRideHeight', 0.0) if len(wheels) > 1 else 0.0,
                'ride_height_rl': getattr(wheels[2], 'mRideHeight', 0.0) if len(wheels) > 2 else 0.0,
                'ride_height_rr': getattr(wheels[3], 'mRideHeight', 0.0) if len(wheels) > 3 else 0.0,
                'suspension_deflection_fl': getattr(wheels[0], 'mSuspensionDeflection', 0.0) if len(wheels) > 0 else 0.0,
                'suspension_deflection_fr': getattr(wheels[1], 'mSuspensionDeflection', 0.0) if len(wheels) > 1 else 0.0,
                'suspension_deflection_rl': getattr(wheels[2], 'mSuspensionDeflection', 0.0) if len(wheels) > 2 else 0.0,
                'suspension_deflection_rr': getattr(wheels[3], 'mSuspensionDeflection', 0.0) if len(wheels) > 3 else 0.0,
                'suspension_force_fl': getattr(wheels[0], 'mSuspensionForce', 0.0) if len(wheels) > 0 else 0.0,
                'suspension_force_fr': getattr(wheels[1], 'mSuspensionForce', 0.0) if len(wheels) > 1 else 0.0,
                'suspension_force_rl': getattr(wheels[2], 'mSuspensionForce', 0.0) if len(wheels) > 2 else 0.0,
                'suspension_force_rr': getattr(wheels[3], 'mSuspensionForce', 0.0) if len(wheels) > 3 else 0.0,
                'third_spring_deflection_fl': 0.0,
                'third_spring_deflection_fr': 0.0,
                'third_spring_deflection_rl': 0.0,
                'third_spring_deflection_rr': 0.0,
                'position_vertical_fl': getattr(wheels[0], 'mPos', {'y': 0.0}).get('y', 0.0) if len(wheels) > 0 else 0.0,
                'position_vertical_fr': getattr(wheels[1], 'mPos', {'y': 0.0}).get('y', 0.0) if len(wheels) > 1 else 0.0,
                'position_vertical_rl': getattr(wheels[2], 'mPos', {'y': 0.0}).get('y', 0.0) if len(wheels) > 2 else 0.0,
                'position_vertical_rr': getattr(wheels[3], 'mPos', {'y': 0.0}).get('y', 0.0) if len(wheels) > 3 else 0.0,
                'is_detached_fl': getattr(wheels[0], 'mDetached', 0) > 0 if len(wheels) > 0 else False,
                'is_detached_fr': getattr(wheels[1], 'mDetached', 0) > 0 if len(wheels) > 1 else False,
                'is_detached_rl': getattr(wheels[2], 'mDetached', 0) > 0 if len(wheels) > 2 else False,
                'is_detached_rr': getattr(wheels[3], 'mDetached', 0) > 0 if len(wheels) > 3 else False,
                'is_offroad': getattr(tele_veh, 'mOffRoad', 0) > 0
            }
        except:
            return {k: 0.0 if not k.startswith('is_') else False for k in [
                'camber_fl', 'camber_fr', 'camber_rl', 'camber_rr',
                'toe_fl', 'toe_fr', 'toe_rl', 'toe_rr',
                'rotation_fl', 'rotation_fr', 'rotation_rl', 'rotation_rr',
                'vel_lateral_fl', 'vel_lateral_fr', 'vel_lateral_rl', 'vel_lateral_rr',
                'vel_longitudinal_fl', 'vel_longitudinal_fr', 'vel_longitudinal_rl', 'vel_longitudinal_rr',
                'ride_height_fl', 'ride_height_fr', 'ride_height_rl', 'ride_height_rr',
                'suspension_deflection_fl', 'suspension_deflection_fr', 'suspension_deflection_rl', 'suspension_deflection_rr',
                'suspension_force_fl', 'suspension_force_fr', 'suspension_force_rl', 'suspension_force_rr',
                'third_spring_deflection_fl', 'third_spring_deflection_fr', 'third_spring_deflection_rl', 'third_spring_deflection_rr',
                'position_vertical_fl', 'position_vertical_fr', 'position_vertical_rl', 'position_vertical_rr',
                'is_detached_fl', 'is_detached_fr', 'is_detached_rl', 'is_detached_rr', 'is_offroad'
            ]}
    
    def _extract_vehicle_state(self, scor_veh, tele_veh) -> Dict[str, Any]:
        """Extract vehicle state data"""
        return {
            'place': scor_veh.mPlace,
            'qualification': getattr(scor_veh, 'mQualification', 0),
            'in_pits': scor_veh.mInPits,
            'in_garage': getattr(scor_veh, 'mInGarageStall', False),
            'num_pitstops': getattr(scor_veh, 'mNumPitstops', 0),
            'pit_request': getattr(tele_veh, 'mPitRequest', 0) > 0,
            'num_penalties': getattr(scor_veh, 'mNumPenalties', 0),
            'finish_state': getattr(scor_veh, 'mFinishStatus', 0),
            'fuel': tele_veh.mFuel,
            'tank_capacity': getattr(tele_veh, 'mFuelCapacity', 100.0),
            'downforce_front': getattr(tele_veh, 'mFrontDownforce', 0.0),
            'downforce_rear': getattr(tele_veh, 'mRearDownforce', 0.0),
            'is_detached': getattr(tele_veh, 'mDetached', 0) > 0,
            'last_impact_time': getattr(tele_veh, 'mLastImpactTime', 0.0),
            'last_impact_magnitude': getattr(tele_veh, 'mLastImpactMagnitude', 0.0)
        }
    
    def _extract_switch_states(self, tele_veh) -> Dict[str, Any]:
        """Extract switch states"""
        return {
            'headlights': getattr(tele_veh, 'mHeadlights', 0),
            'ignition_starter': getattr(tele_veh, 'mIgnitionStarter', 1),
            'speed_limiter': getattr(tele_veh, 'mSpeedLimiter', 0),
            'drs_status': getattr(tele_veh, 'mDRS', 0),
            'auto_clutch': getattr(tele_veh, 'mAutoClutch', False)
        }
    
    async def _initialize_session(self, telemetry_data: Dict[str, Any]):
        """Initialize session with the backend"""
        try:
            scor_info = self.rf2_sim.info.rf2ScorInfo
            scor_veh = self.rf2_sim.info.rf2ScorVeh()
            
            # Extract session data
            session_data = {
                'user_id': self.settings.api.user_id,
                'session_type': getattr(scor_info, 'mSession', 1),
                'track_name': getattr(scor_info, 'mTrackName', b'Unknown').decode('utf-8', errors='ignore'),
                'session_stamp': int(time.time() * 1000),
                'combo_id': f"{getattr(scor_info, 'mTrackName', b'unknown').decode('utf-8', errors='ignore').lower().replace(' ', '_')}",
                'track_id': getattr(scor_info, 'mTrackName', b'unknown').decode('utf-8', errors='ignore').lower().replace(' ', '_'),
                'sim_name': 'rFactor 2',
                'api_version': '1.0',
                'session_length': getattr(scor_info, 'mMaxLaps', 0),
                'max_laps': getattr(scor_info, 'mMaxLaps', 0),
                'is_lap_type': True,
                'title': f"Session - {getattr(scor_info, 'mTrackName', b'Unknown').decode('utf-8', errors='ignore')}",
                'description': f"Telemetry session on {getattr(scor_info, 'mTrackName', b'Unknown').decode('utf-8', errors='ignore')}"
            }
            
            # Create session
            session_response = await self.api_client.create_session(session_data)
            if not session_response.success:
                raise APIError(f"Failed to create session: {session_response.error}")
            
            session_id = session_response.data['data']['id']
            self.stats.current_session_id = session_id
            
            # Create vehicle
            vehicle_data = {
                'session_id': session_id,
                'slot_id': getattr(scor_veh, 'mID', 0),
                'driver_name': getattr(scor_veh, 'mDriverName', b'Unknown Driver').decode('utf-8', errors='ignore'),
                'vehicle_name': getattr(scor_veh, 'mVehicleName', b'Unknown Vehicle').decode('utf-8', errors='ignore'),
                'class_name': getattr(scor_veh, 'mVehicleClass', b'Unknown Class').decode('utf-8', errors='ignore'),
                'is_player': getattr(scor_veh, 'mIsPlayer', True)
            }
            
            vehicle_response = await self.api_client.create_vehicle(vehicle_data)
            if not vehicle_response.success:
                raise APIError(f"Failed to create vehicle: {vehicle_response.error}")
            
            vehicle_id = vehicle_response.data['data']['id']
            self.stats.current_vehicle_id = vehicle_id
            
            self.current_session_data = {
                'session_id': session_id,
                'vehicle_id': vehicle_id,
                **session_data,
                **vehicle_data
            }
            
            self.session_initialized = True
            self.stats.sessions_created += 1
            
            logger.info("Session initialized", session_id=session_id, vehicle_id=vehicle_id,
                       track=session_data['track_name'])
            
        except Exception as e:
            self._add_error(f"Session initialization failed: {str(e)}")
            logger.error("Failed to initialize session", error=str(e))
            raise
    
    async def _handle_lap_change(self, old_lap: int, new_lap: int):
        """Handle lap number change"""
        logger.info("Lap change detected", old_lap=old_lap, new_lap=new_lap)
        
        # Complete current lap
        if self.current_lap and self.current_lap.state == LapState.IN_PROGRESS:
            self.current_lap.end_time = time.time()
            self.current_lap.lap_time = self.current_lap.end_time - self.current_lap.start_time
            self.current_lap.state = LapState.COMPLETED
            
            # Add to pending laps for processing
            self.pending_laps.append(self.current_lap)
            self.stats.laps_collected += 1
            self.stats.last_lap_time = self.current_lap.lap_time
            
            if self.lap_completed_callback:
                try:
                    self.lap_completed_callback(self.current_lap)
                except Exception as e:
                    logger.warning("Lap completed callback error", error=str(e))
        
        # Start new lap
        self.current_lap = LapData(
            lap_number=new_lap,
            start_time=time.time(),
            state=LapState.IN_PROGRESS
        )
        
        logger.info("Started new lap", lap_number=new_lap)
    
    async def _processing_loop(self):
        """Process completed laps (validation and preparation)"""
        logger.info("Starting processing loop")
        
        while not self._stop_event.is_set():
            try:
                # Process pending laps
                laps_to_process = [lap for lap in self.pending_laps 
                                 if lap.state == LapState.COMPLETED]
                
                for lap in laps_to_process:
                    await self._process_lap(lap)
                
                await asyncio.sleep(1.0)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in processing loop", error=str(e))
                self._add_error(f"Processing error: {str(e)}")
                await asyncio.sleep(1.0)
        
        logger.info("Processing loop stopped")
    
    async def _process_lap(self, lap: LapData):
        """Process a single lap (validate and prepare for upload)"""
        try:
            lap.state = LapState.VALIDATING
            
            # Validate lap
            lap_data = {
                'lap_number': lap.lap_number,
                'start_time': lap.start_time,
                'end_time': lap.end_time,
                'lap_time': lap.lap_time
            }
            
            validation_report = self.lap_validator.validate_lap(lap_data, lap.telemetry_points)
            
            if validation_report.is_valid():
                lap.valid = True
                lap.state = LapState.UPLOADING
                self.stats.laps_valid += 1
                logger.info("Lap validated successfully", lap_number=lap.lap_number,
                           points=len(lap.telemetry_points), duration=lap.lap_time)
            else:
                lap.valid = False
                lap.state = LapState.FAILED
                lap.error = f"Validation failed: {validation_report.result.value}"
                logger.warning("Lap validation failed", lap_number=lap.lap_number,
                              reason=validation_report.result.value,
                              issues=validation_report.issues)
                
                # Remove from pending list
                if lap in self.pending_laps:
                    self.pending_laps.remove(lap)
                
        except Exception as e:
            lap.state = LapState.FAILED
            lap.error = f"Processing error: {str(e)}"
            logger.error("Lap processing failed", lap_number=lap.lap_number, error=str(e))
            
            # Remove from pending list
            if lap in self.pending_laps:
                self.pending_laps.remove(lap)
    
    async def _upload_loop(self):
        """Upload validated laps to API"""
        logger.info("Starting upload loop")
        
        while not self._stop_event.is_set():
            try:
                # Find laps ready for upload
                laps_to_upload = [lap for lap in self.pending_laps 
                                if lap.state == LapState.UPLOADING and lap.valid]
                
                for lap in laps_to_upload:
                    await self._upload_lap(lap)
                
                await asyncio.sleep(2.0)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in upload loop", error=str(e))
                self._add_error(f"Upload error: {str(e)}")
                await asyncio.sleep(2.0)
        
        logger.info("Upload loop stopped")
    
    @performance_monitor("upload_lap")
    async def _upload_lap(self, lap: LapData):
        """Upload a single lap following the complete API workflow"""
        try:
            if not self.session_initialized or not self.current_session_data:
                logger.warning("Cannot upload lap - session not initialized")
                return
            
            # Step 3: Create lap
            lap_data = {
                'user_id': self.settings.api.user_id,
                'session_id': self.current_session_data['session_id'],
                'vehicle_id': self.current_session_data['vehicle_id'],
                'lap_number': lap.lap_number,
                'title': f"Lap {lap.lap_number}",
                'description': f"Telemetry lap {lap.lap_number}",
                'tags': 'telemetry,auto-collected',
                'lap_time': lap.lap_time,
                'is_valid': lap.valid,
                'is_personal_best': False,  # Would need to calculate this
                'lap_start_time': format_timestamp(lap.start_time),
                'lap_end_time': format_timestamp(lap.end_time) if lap.end_time else None
            }
            
            lap_response = await self.api_client.create_lap(lap_data)
            if not lap_response.success:
                raise APIError(f"Failed to create lap: {lap_response.error}")
            
            lap_id = lap_response.data['data']['id']
            
            # Step 4: Create timing data (optional - calculated from telemetry)
            if lap.lap_time:
                timing_data = {
                    'lap_id': lap_id,
                    'sector1_time': lap.lap_time / 3,  # Rough approximation
                    'sector2_time': lap.lap_time / 3,
                    'sector3_time': lap.lap_time / 3
                }
                await self.api_client.create_timing(timing_data)
            
            # Step 5: Insert telemetry data (bulk)
            telemetry_response = await self.api_client.insert_telemetry_data(
                lap_id, lap.telemetry_points
            )
            if not telemetry_response.success:
                raise APIError(f"Failed to insert telemetry data: {telemetry_response.error}")
            
            # Step 6: Create lap summary
            summary_data = self._calculate_lap_summary(lap)
            summary_data['lap_id'] = lap_id
            await self.api_client.create_lap_summary(summary_data)
            
            # Step 7: Create session conditions (optional)
            if lap.telemetry_points:
                conditions_data = self._extract_session_conditions(lap.telemetry_points[0])
                conditions_data['session_id'] = self.current_session_data['session_id']
                conditions_data['timestamp'] = format_timestamp(lap.start_time)
                await self.api_client.create_session_conditions(conditions_data)
            
            # Mark as uploaded
            lap.uploaded = True
            lap.state = LapState.COMPLETED
            self.stats.laps_uploaded += 1
            self.stats.telemetry_points_uploaded += len(lap.telemetry_points)
            
            # Remove from pending list
            if lap in self.pending_laps:
                self.pending_laps.remove(lap)
            
            logger.info("Lap uploaded successfully", lap_number=lap.lap_number,
                       lap_id=lap_id, points=len(lap.telemetry_points))
            
        except Exception as e:
            lap.state = LapState.FAILED
            lap.error = f"Upload error: {str(e)}"
            self._add_error(f"Lap {lap.lap_number} upload failed: {str(e)}")
            logger.error("Lap upload failed", lap_number=lap.lap_number, error=str(e))
            
            # Remove from pending list
            if lap in self.pending_laps:
                self.pending_laps.remove(lap)
    
    def _calculate_lap_summary(self, lap: LapData) -> Dict[str, Any]:
        """Calculate lap summary statistics"""
        if not lap.telemetry_points:
            return {}
        
        speeds = [point.get('speed', 0) for point in lap.telemetry_points]
        rpms = [point.get('rpm', 0) for point in lap.telemetry_points]
        throttles = [point.get('throttle', 0) for point in lap.telemetry_points]
        brakes = [point.get('brake', 0) for point in lap.telemetry_points]
        
        # Extract tire temperatures from nested data
        tire_temps = []
        for point in lap.telemetry_points:
            tyre_data = point.get('tyre', {})
            if tyre_data:
                tire_temps.extend([
                    tyre_data.get('surface_temp_fl', 0),
                    tyre_data.get('surface_temp_fr', 0),
                    tyre_data.get('surface_temp_rl', 0),
                    tyre_data.get('surface_temp_rr', 0)
                ])
        
        # Calculate fuel usage
        fuel_start = lap.telemetry_points[0].get('fuel', 0) if lap.telemetry_points else 0
        fuel_end = lap.telemetry_points[-1].get('fuel', 0) if lap.telemetry_points else 0
        fuel_used = max(0, fuel_start - fuel_end)
        
        # Calculate distance (rough approximation)
        distance = len(lap.telemetry_points) * 0.1 * 50  # Assuming 50 km/h average over collection intervals
        
        return {
            'max_speed': max(speeds) if speeds else 0,
            'avg_speed': sum(speeds) / len(speeds) if speeds else 0,
            'min_speed': min(speeds) if speeds else 0,
            'max_rpm': max(rpms) if rpms else 0,
            'avg_rpm': sum(rpms) / len(rpms) if rpms else 0,
            'max_throttle': max(throttles) if throttles else 0,
            'avg_throttle': sum(throttles) / len(throttles) if throttles else 0,
            'max_brake': max(brakes) if brakes else 0,
            'avg_brake': sum(brakes) / len(brakes) if brakes else 0,
            'max_lateral_g': 0,  # Would need to calculate from acceleration data
            'max_longitudinal_g': 0,
            'max_vertical_g': 0,
            'max_tire_temp': max(tire_temps) if tire_temps else 0,
            'avg_tire_temp': sum(tire_temps) / len(tire_temps) if tire_temps else 0,
            'max_tire_pressure': 0,  # Would extract from tire data
            'avg_tire_pressure': 0,
            'fuel_used': fuel_used,
            'fuel_starting': fuel_start,
            'fuel_ending': fuel_end,
            'distance_covered': distance
        }
    
    def _extract_session_conditions(self, telemetry_point: Dict[str, Any]) -> Dict[str, Any]:
        """Extract session conditions from telemetry point"""
        return {
            'track_temperature': 25.0,  # Would need to extract from RF2 data
            'ambient_temperature': 20.0,
            'raininess': 0.0,
            'wetness_minimum': 0.0,
            'wetness_maximum': 0.0,
            'wetness_average': 0.0,
            'game_phase': 1,  # Racing
            'in_countdown': False,
            'in_formation': False,
            'pit_open': True,
            'green_flag': True,
            'yellow_flag': False,
            'start_lights': 0
        }
    
    def _on_telemetry_buffer_flush(self, data: List[Dict[str, Any]]):
        """Handle telemetry buffer flush"""
        logger.debug("Telemetry buffer flushed", points=len(data))
    
    def _add_error(self, error: str):
        """Add error to stats"""
        self.stats.errors.append(error)
        if len(self.stats.errors) > 50:  # Keep only last 50 errors
            self.stats.errors = self.stats.errors[-50:]
        
        if self.error_callback:
            try:
                self.error_callback(error)
            except Exception as e:
                logger.warning("Error callback failed", error=str(e))
    
    def _notify_status_change(self):
        """Notify status change"""
        if self.status_callback:
            try:
                self.status_callback(self.state)
            except Exception as e:
                logger.warning("Status callback failed", error=str(e))
    
    # Public interface methods
    
    def get_state(self) -> CollectorState:
        """Get current collector state"""
        return self.state
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get collection statistics"""
        uptime = time.time() - self.stats.collection_start_time if self.stats.collection_start_time > 0 else 0
        
        return {
            'state': self.state.value,
            'uptime': uptime,
            'sessions_created': self.stats.sessions_created,
            'laps_collected': self.stats.laps_collected,
            'laps_valid': self.stats.laps_valid,
            'laps_uploaded': self.stats.laps_uploaded,
            'telemetry_points_collected': self.stats.telemetry_points_collected,
            'telemetry_points_uploaded': self.stats.telemetry_points_uploaded,
            'last_lap_time': self.stats.last_lap_time,
            'current_session_id': self.stats.current_session_id,
            'current_vehicle_id': self.stats.current_vehicle_id,
            'pending_laps': len(self.pending_laps),
            'current_lap_points': len(self.current_lap.telemetry_points) if self.current_lap else 0,
            'error_count': len(self.stats.errors),
            'latest_errors': self.stats.errors[-5:] if self.stats.errors else [],
            'api_stats': self.api_client.get_statistics() if self.api_client else {},
            'validation_stats': self.lap_validator.get_validation_stats()
        }
    
    def set_status_callback(self, callback: Callable):
        """Set status change callback"""
        self.status_callback = callback
    
    def set_lap_completed_callback(self, callback: Callable):
        """Set lap completed callback"""
        self.lap_completed_callback = callback
    
    def set_error_callback(self, callback: Callable):
        """Set error callback"""
        self.error_callback = callback
    
    def update_settings(self):
        """Update settings from configuration"""
        self.settings = self.settings_manager.settings
        
        # Update components
        if self.api_client:
            self.api_client.update_settings()
        
        self.lap_validator.update_settings()
        
        # Update buffer settings
        self.telemetry_buffer = TelemetryBuffer(
            max_size=self.settings.api.batch_size,
            flush_interval=self.settings.telemetry.collection_interval * 10
        )
        
        logger.info("Telemetry collector settings updated")

# Factory function
def create_telemetry_collector() -> TelemetryCollector:
    """Create a new telemetry collector instance"""
    return TelemetryCollector()