"""
Settings management for Herbie Telemetry Agent

Handles configuration persistence, validation, and defaults using Pydantic.
"""

import os
import json
from typing import Optional, Dict, Any
from pathlib import Path
from pydantic import BaseModel, Field, validator
from appdirs import user_data_dir, user_config_dir
import structlog

logger = structlog.get_logger(__name__)

class APISettings(BaseModel):
    """API-related settings"""
    base_url: str = Field(default="http://localhost:3000", description="Base URL for Herbie API")
    user_id: str = Field(default="", description="User ID for telemetry data")
    timeout: int = Field(default=30, ge=5, le=120, description="Request timeout in seconds")
    retry_attempts: int = Field(default=3, ge=1, le=10, description="Number of retry attempts")
    retry_delay: float = Field(default=1.0, ge=0.1, le=10.0, description="Initial retry delay in seconds")
    batch_size: int = Field(default=100, ge=10, le=1000, description="Telemetry batch size")
    
    @validator('base_url')
    def validate_base_url(cls, v):
        if not v.startswith(('http://', 'https://')):
            raise ValueError('Base URL must start with http:// or https://')
        return v.rstrip('/')

class TelemetrySettings(BaseModel):
    """Telemetry collection settings"""
    collection_interval: float = Field(default=0.1, ge=0.01, le=1.0, description="Collection interval in seconds")
    enable_collection: bool = Field(default=True, description="Enable telemetry collection")
    auto_start: bool = Field(default=True, description="Auto-start collection when RF2 is detected")
    
class LapValidationSettings(BaseModel):
    """Lap validation settings"""
    min_telemetry_points: int = Field(default=100, ge=10, le=10000, description="Minimum telemetry points per lap")
    min_lap_time: float = Field(default=30.0, ge=10.0, le=600.0, description="Minimum lap time in seconds")
    max_lap_time: float = Field(default=300.0, ge=60.0, le=1800.0, description="Maximum lap time in seconds")
    min_distance_percentage: float = Field(default=80.0, ge=50.0, le=100.0, description="Minimum distance coverage percentage")
    max_telemetry_gap: float = Field(default=2.0, ge=0.1, le=10.0, description="Maximum gap between telemetry points in seconds")
    speed_outlier_threshold: float = Field(default=400.0, ge=100.0, le=1000.0, description="Speed outlier threshold in km/h")
    
class RF2Settings(BaseModel):
    """rFactor 2 specific settings"""
    access_mode: int = Field(default=0, ge=0, le=1, description="rF2 access mode (0=copy, 1=direct)")
    process_id: str = Field(default="", description="rF2 process ID for server data")
    player_override: bool = Field(default=False, description="Override player index")
    player_index: int = Field(default=0, ge=0, le=127, description="Player index")
    char_encoding: str = Field(default="utf-8", description="Character encoding")
    
class GUISettings(BaseModel):
    """GUI and system tray settings"""
    show_notifications: bool = Field(default=True, description="Show system notifications")
    minimize_to_tray: bool = Field(default=True, description="Minimize to system tray")
    auto_start_windows: bool = Field(default=False, description="Auto-start with Windows")
    herbie_url: str = Field(default="https://herbie.app", description="Herbie web application URL")
    
class LoggingSettings(BaseModel):
    """Logging configuration"""
    level: str = Field(default="INFO", description="Logging level")
    file_logging: bool = Field(default=True, description="Enable file logging")
    max_log_size: int = Field(default=10485760, ge=1048576, le=104857600, description="Maximum log file size in bytes")
    backup_count: int = Field(default=5, ge=1, le=20, description="Number of backup log files")
    
    @validator('level')
    def validate_level(cls, v):
        valid_levels = {'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'}
        if v.upper() not in valid_levels:
            raise ValueError(f'Log level must be one of {valid_levels}')
        return v.upper()

class HerbieSettings(BaseModel):
    """Main settings model for Herbie Telemetry Agent"""
    
    # Version tracking
    version: str = Field(default="1.0.0", description="Settings version")
    
    # Sub-settings
    api: APISettings = Field(default_factory=APISettings)
    telemetry: TelemetrySettings = Field(default_factory=TelemetrySettings)
    lap_validation: LapValidationSettings = Field(default_factory=LapValidationSettings)
    rf2: RF2Settings = Field(default_factory=RF2Settings)
    gui: GUISettings = Field(default_factory=GUISettings)
    logging: LoggingSettings = Field(default_factory=LoggingSettings)
    
    class Config:
        """Pydantic configuration"""
        validate_assignment = True
        extra = "forbid"

class SettingsManager:
    """Manages application settings persistence and validation"""
    
    def __init__(self, app_name: str = "HerbieTelemetryAgent"):
        self.app_name = app_name
        self.config_dir = Path(user_config_dir(app_name, "Herbie"))
        self.data_dir = Path(user_data_dir(app_name, "Herbie"))
        self.settings_file = self.config_dir / "settings.json"
        
        # Create directories if they don't exist
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # Load settings
        self.settings = self._load_settings()
        
        logger.info("Settings manager initialized", 
                   config_dir=str(self.config_dir),
                   data_dir=str(self.data_dir))
    
    def _load_settings(self) -> HerbieSettings:
        """Load settings from file or create defaults"""
        if self.settings_file.exists():
            try:
                with open(self.settings_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                settings = HerbieSettings(**data)
                logger.info("Settings loaded from file", file=str(self.settings_file))
                return settings
            except Exception as e:
                logger.warning("Failed to load settings, using defaults", 
                             error=str(e), file=str(self.settings_file))
                return HerbieSettings()
        else:
            logger.info("No settings file found, using defaults")
            return HerbieSettings()
    
    def save_settings(self) -> bool:
        """Save current settings to file"""
        try:
            with open(self.settings_file, 'w', encoding='utf-8') as f:
                json.dump(self.settings.dict(), f, indent=2, ensure_ascii=False)
            logger.info("Settings saved", file=str(self.settings_file))
            return True
        except Exception as e:
            logger.error("Failed to save settings", error=str(e), file=str(self.settings_file))
            return False
    
    def update_settings(self, **kwargs) -> bool:
        """Update settings with new values"""
        try:
            # Create new settings object with updated values
            current_dict = self.settings.dict()
            
            # Update nested values
            for key, value in kwargs.items():
                if '.' in key:
                    # Handle nested keys like "api.base_url"
                    parts = key.split('.')
                    current = current_dict
                    for part in parts[:-1]:
                        if part not in current:
                            current[part] = {}
                        current = current[part]
                    current[parts[-1]] = value
                else:
                    current_dict[key] = value
            
            # Validate and update
            new_settings = HerbieSettings(**current_dict)
            self.settings = new_settings
            
            logger.info("Settings updated", changes=kwargs)
            return True
            
        except Exception as e:
            logger.error("Failed to update settings", error=str(e), changes=kwargs)
            return False
    
    def get_log_file_path(self) -> Path:
        """Get the path for log files"""
        return self.data_dir / "logs" / "herbie_agent.log"
    
    def get_cache_dir(self) -> Path:
        """Get the cache directory"""
        cache_dir = self.data_dir / "cache"
        cache_dir.mkdir(exist_ok=True)
        return cache_dir
    
    def reset_to_defaults(self) -> bool:
        """Reset settings to default values"""
        try:
            self.settings = HerbieSettings()
            logger.info("Settings reset to defaults")
            return True
        except Exception as e:
            logger.error("Failed to reset settings", error=str(e))
            return False
    
    def export_settings(self, file_path: str) -> bool:
        """Export settings to a file"""
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(self.settings.dict(), f, indent=2, ensure_ascii=False)
            logger.info("Settings exported", file=file_path)
            return True
        except Exception as e:
            logger.error("Failed to export settings", error=str(e), file=file_path)
            return False
    
    def import_settings(self, file_path: str) -> bool:
        """Import settings from a file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Validate imported settings
            imported_settings = HerbieSettings(**data)
            self.settings = imported_settings
            
            logger.info("Settings imported", file=file_path)
            return True
        except Exception as e:
            logger.error("Failed to import settings", error=str(e), file=file_path)
            return False
    
    def get_api_endpoint(self, endpoint: str) -> str:
        """Get full API endpoint URL"""
        return f"{self.settings.api.base_url}/api/telemetry/{endpoint.lstrip('/')}"
    
    def is_valid_configuration(self) -> tuple[bool, list[str]]:
        """Check if current configuration is valid for operation"""
        errors = []
        
        # Check required fields
        if not self.settings.api.user_id:
            errors.append("User ID is required")
        
        if not self.settings.api.base_url:
            errors.append("API base URL is required")
        
        # Check lap validation settings consistency
        if self.settings.lap_validation.min_lap_time >= self.settings.lap_validation.max_lap_time:
            errors.append("Minimum lap time must be less than maximum lap time")
        
        return len(errors) == 0, errors

# Global settings manager instance
_settings_manager: Optional[SettingsManager] = None

def get_settings_manager() -> SettingsManager:
    """Get the global settings manager instance"""
    global _settings_manager
    if _settings_manager is None:
        _settings_manager = SettingsManager()
    return _settings_manager

def get_settings() -> HerbieSettings:
    """Get the current settings"""
    return get_settings_manager().settings