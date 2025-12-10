"""
API Client for Herbie Telemetry Agent

Handles all communication with the Herbie backend API following the
comprehensive 7-step telemetry workflow.
"""

import asyncio
import json
import time
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import httpx
import structlog

from .settings_manager import get_settings_manager, HerbieSettings
from .utils import ExponentialBackoff, RateLimiter, format_timestamp, performance_monitor

logger = structlog.get_logger(__name__)

class APIError(Exception):
    """Custom API error"""
    def __init__(self, message: str, status_code: Optional[int] = None, response_data: Optional[Dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data

class ConnectionStatus(Enum):
    """API connection status"""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"
    RATE_LIMITED = "rate_limited"

@dataclass
class APIResponse:
    """API response wrapper"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
    status_code: Optional[int] = None
    error: Optional[str] = None

@dataclass
class SessionData:
    """Session tracking data"""
    session_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    user_id: Optional[str] = None
    track_name: Optional[str] = None
    session_type: Optional[int] = None

class HerbieAPIClient:
    """Comprehensive API client for Herbie backend"""
    
    def __init__(self):
        self.settings_manager = get_settings_manager()
        self.settings = self.settings_manager.settings
        
        # HTTP client
        self.client: Optional[httpx.AsyncClient] = None
        
        # Connection management
        self.status = ConnectionStatus.DISCONNECTED
        self.last_error: Optional[str] = None
        self.last_successful_request = 0.0
        
        # Rate limiting
        self.rate_limiter = RateLimiter(
            max_calls=self.settings.api.batch_size,
            time_window=60.0
        )
        
        # Session tracking
        self.current_session = SessionData()
        
        # Statistics
        self.stats = {
            "requests_made": 0,
            "requests_successful": 0,
            "requests_failed": 0,
            "bytes_sent": 0,
            "bytes_received": 0,
            "total_retry_attempts": 0
        }
        
    async def initialize(self):
        """Initialize the API client"""
        try:
            timeout = httpx.Timeout(
                timeout=self.settings.api.timeout,
                connect=10.0,
                read=self.settings.api.timeout,
                write=10.0
            )
            
            self.client = httpx.AsyncClient(
                timeout=timeout,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "HerbieTelemetryAgent/1.0.0"
                },
                follow_redirects=True
            )
            
            # Test connection
            await self.test_connection()
            
            logger.info("API client initialized", base_url=self.settings.api.base_url)
            
        except Exception as e:
            self.status = ConnectionStatus.ERROR
            self.last_error = str(e)
            logger.error("Failed to initialize API client", error=str(e))
            raise APIError(f"Failed to initialize API client: {str(e)}")
    
    async def close(self):
        """Close the API client"""
        if self.client:
            await self.client.aclose()
            self.client = None
        
        self.status = ConnectionStatus.DISCONNECTED
        logger.info("API client closed")
    
    async def test_connection(self) -> bool:
        """Test API connection"""
        try:
            self.status = ConnectionStatus.CONNECTING
            
            # Try to reach the base URL
            response = await self._make_request("GET", "")
            
            if response.success:
                self.status = ConnectionStatus.CONNECTED
                self.last_successful_request = time.time()
                logger.info("API connection test successful")
                return True
            else:
                self.status = ConnectionStatus.ERROR
                self.last_error = response.error
                logger.warning("API connection test failed", error=response.error)
                return False
                
        except Exception as e:
            self.status = ConnectionStatus.ERROR
            self.last_error = str(e)
            logger.error("API connection test error", error=str(e))
            return False
    
    async def _make_request(self, method: str, endpoint: str, 
                           data: Optional[Dict] = None, 
                           retries: Optional[int] = None) -> APIResponse:
        """Make HTTP request with retry logic"""
        if not self.client:
            raise APIError("API client not initialized")
        
        if retries is None:
            retries = self.settings.api.retry_attempts
        
        url = self._build_url(endpoint)
        backoff = ExponentialBackoff(
            initial_delay=self.settings.api.retry_delay,
            max_delay=30.0
        )
        
        last_exception = None
        
        for attempt in range(retries + 1):
            try:
                # Rate limiting check
                if not self.rate_limiter.can_proceed():
                    wait_time = self.rate_limiter.time_until_next()
                    if wait_time > 0:
                        self.status = ConnectionStatus.RATE_LIMITED
                        logger.warning("Rate limited, waiting", wait_time=wait_time)
                        await asyncio.sleep(wait_time)
                
                # Make the request
                self.stats["requests_made"] += 1
                
                request_kwargs = {
                    "method": method,
                    "url": url
                }
                
                if data:
                    request_kwargs["json"] = data
                    self.stats["bytes_sent"] += len(json.dumps(data))
                
                logger.debug("Making API request", method=method, url=url, attempt=attempt + 1)
                
                response = await self.client.request(**request_kwargs)
                
                # Update stats
                self.stats["bytes_received"] += len(response.content)
                
                # Handle response
                if response.status_code >= 200 and response.status_code < 300:
                    self.stats["requests_successful"] += 1
                    self.status = ConnectionStatus.CONNECTED
                    self.last_successful_request = time.time()
                    
                    try:
                        response_data = response.json() if response.content else {}
                    except json.JSONDecodeError:
                        response_data = {"raw_response": response.text}
                    
                    return APIResponse(
                        success=True,
                        data=response_data,
                        status_code=response.status_code
                    )
                else:
                    # Handle HTTP error
                    error_msg = f"HTTP {response.status_code}"
                    try:
                        error_data = response.json()
                        error_msg = error_data.get("error", error_msg)
                    except:
                        error_msg = response.text[:200] if response.text else error_msg
                    
                    # Don't retry client errors (4xx) except 429 (rate limit)
                    if 400 <= response.status_code < 500 and response.status_code != 429:
                        self.stats["requests_failed"] += 1
                        return APIResponse(
                            success=False,
                            error=error_msg,
                            status_code=response.status_code
                        )
                    
                    raise httpx.HTTPStatusError(
                        f"HTTP {response.status_code}: {error_msg}",
                        request=response.request,
                        response=response
                    )
                    
            except Exception as e:
                last_exception = e
                self.stats["total_retry_attempts"] += 1
                
                if attempt < retries:
                    delay = backoff.get_delay()
                    logger.warning("Request failed, retrying", 
                                 attempt=attempt + 1, 
                                 delay=delay, 
                                 error=str(e))
                    await asyncio.sleep(delay)
                else:
                    logger.error("Request failed after all retries", 
                               attempts=retries + 1, 
                               error=str(e))
        
        # All retries failed
        self.stats["requests_failed"] += 1
        self.status = ConnectionStatus.ERROR
        self.last_error = str(last_exception)
        
        return APIResponse(
            success=False,
            error=f"Request failed after {retries + 1} attempts: {str(last_exception)}"
        )
    
    def _build_url(self, endpoint: str) -> str:
        """Build full URL for endpoint"""
        base_url = self.settings.api.base_url.rstrip('/')
        endpoint = endpoint.lstrip('/')
        
        if endpoint:
            return f"{base_url}/api/telemetry/{endpoint}"
        else:
            return base_url
    
    # API Workflow Methods (following TELEMETRY_API.md)
    
    @performance_monitor("create_session")
    async def create_session(self, session_data: Dict[str, Any]) -> APIResponse:
        """Create a new racing session (Step 1)"""
        required_fields = ["user_id", "session_type", "track_name"]
        
        # Validate required fields
        for field in required_fields:
            if field not in session_data:
                return APIResponse(
                    success=False,
                    error=f"Missing required field: {field}"
                )
        
        # Add timestamp if not provided
        if "session_stamp" not in session_data:
            session_data["session_stamp"] = int(time.time() * 1000)  # milliseconds
        
        response = await self._make_request("POST", "sessions", session_data)
        
        if response.success and response.data:
            # Store session info
            self.current_session.session_id = response.data.get("data", {}).get("id")
            self.current_session.user_id = session_data["user_id"]
            self.current_session.track_name = session_data["track_name"]
            self.current_session.session_type = session_data["session_type"]
            
            logger.info("Session created", session_id=self.current_session.session_id)
        
        return response
    
    @performance_monitor("create_vehicle")
    async def create_vehicle(self, vehicle_data: Dict[str, Any]) -> APIResponse:
        """Create a vehicle record (Step 2)"""
        required_fields = ["session_id", "slot_id", "driver_name", "vehicle_name"]
        
        # Validate required fields
        for field in required_fields:
            if field not in vehicle_data:
                return APIResponse(
                    success=False,
                    error=f"Missing required field: {field}"
                )
        
        response = await self._make_request("POST", "vehicles", vehicle_data)
        
        if response.success and response.data:
            # Store vehicle info
            self.current_session.vehicle_id = response.data.get("data", {}).get("id")
            logger.info("Vehicle created", vehicle_id=self.current_session.vehicle_id)
        
        return response
    
    @performance_monitor("create_lap")
    async def create_lap(self, lap_data: Dict[str, Any]) -> APIResponse:
        """Create a lap record (Step 3)"""
        required_fields = ["user_id", "session_id", "vehicle_id", "lap_number", "lap_start_time"]
        
        # Validate required fields
        for field in required_fields:
            if field not in lap_data:
                return APIResponse(
                    success=False,
                    error=f"Missing required field: {field}"
                )
        
        # Ensure proper timestamp format
        if "lap_start_time" in lap_data and isinstance(lap_data["lap_start_time"], (int, float)):
            lap_data["lap_start_time"] = format_timestamp(lap_data["lap_start_time"])
        
        if "lap_end_time" in lap_data and isinstance(lap_data["lap_end_time"], (int, float)):
            lap_data["lap_end_time"] = format_timestamp(lap_data["lap_end_time"])
        
        response = await self._make_request("POST", "laps", lap_data)
        
        if response.success:
            logger.info("Lap created", lap_id=response.data.get("data", {}).get("id"))
        
        return response
    
    @performance_monitor("create_timing")
    async def create_timing(self, timing_data: Dict[str, Any]) -> APIResponse:
        """Create timing data (Step 4)"""
        required_fields = ["lap_id"]
        
        # Validate required fields
        for field in required_fields:
            if field not in timing_data:
                return APIResponse(
                    success=False,
                    error=f"Missing required field: {field}"
                )
        
        response = await self._make_request("POST", "timing", timing_data)
        
        if response.success:
            logger.info("Timing data created", lap_id=timing_data["lap_id"])
        
        return response
    
    @performance_monitor("insert_telemetry_data")
    async def insert_telemetry_data(self, lap_id: int, telemetry_points: List[Dict[str, Any]]) -> APIResponse:
        """Bulk insert telemetry data (Step 5)"""
        if not telemetry_points:
            return APIResponse(
                success=False,
                error="No telemetry points provided"
            )
        
        # Prepare data payload
        data = {
            "lap_id": lap_id,
            "telemetry_points": telemetry_points
        }
        
        response = await self._make_request("POST", "data", data)
        
        if response.success:
            result_data = response.data.get("data", {})
            logger.info("Telemetry data inserted", 
                       lap_id=lap_id,
                       points=result_data.get("telemetry_count", 0))
        
        return response
    
    @performance_monitor("create_lap_summary")
    async def create_lap_summary(self, summary_data: Dict[str, Any]) -> APIResponse:
        """Create lap summary (Step 6)"""
        required_fields = ["lap_id"]
        
        # Validate required fields
        for field in required_fields:
            if field not in summary_data:
                return APIResponse(
                    success=False,
                    error=f"Missing required field: {field}"
                )
        
        response = await self._make_request("POST", "summary", summary_data)
        
        if response.success:
            logger.info("Lap summary created", lap_id=summary_data["lap_id"])
        
        return response
    
    @performance_monitor("create_session_conditions")
    async def create_session_conditions(self, conditions_data: Dict[str, Any]) -> APIResponse:
        """Create session conditions (Step 7)"""
        required_fields = ["session_id", "timestamp"]
        
        # Validate required fields
        for field in required_fields:
            if field not in conditions_data:
                return APIResponse(
                    success=False,
                    error=f"Missing required field: {field}"
                )
        
        # Ensure proper timestamp format
        if isinstance(conditions_data["timestamp"], (int, float)):
            conditions_data["timestamp"] = format_timestamp(conditions_data["timestamp"])
        
        response = await self._make_request("POST", "conditions", conditions_data)
        
        if response.success:
            logger.info("Session conditions created", session_id=conditions_data["session_id"])
        
        return response
    
    # Utility Methods
    
    def get_current_session(self) -> SessionData:
        """Get current session data"""
        return self.current_session
    
    def clear_session(self):
        """Clear current session data"""
        self.current_session = SessionData()
        logger.info("Session data cleared")
    
    def get_connection_status(self) -> ConnectionStatus:
        """Get current connection status"""
        return self.status
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get API client statistics"""
        total_requests = self.stats["requests_made"]
        success_rate = 0.0
        if total_requests > 0:
            success_rate = (self.stats["requests_successful"] / total_requests) * 100
        
        return {
            **self.stats,
            "success_rate": success_rate,
            "last_successful_request": self.last_successful_request,
            "connection_status": self.status.value,
            "last_error": self.last_error,
            "current_session": {
                "session_id": self.current_session.session_id,
                "vehicle_id": self.current_session.vehicle_id,
                "track_name": self.current_session.track_name
            }
        }
    
    def reset_statistics(self):
        """Reset statistics"""
        self.stats = {
            "requests_made": 0,
            "requests_successful": 0,
            "requests_failed": 0,
            "bytes_sent": 0,
            "bytes_received": 0,
            "total_retry_attempts": 0
        }
        logger.info("API statistics reset")
    
    def update_settings(self):
        """Update settings from configuration"""
        self.settings = self.settings_manager.settings
        
        # Update rate limiter
        self.rate_limiter = RateLimiter(
            max_calls=self.settings.api.batch_size,
            time_window=60.0
        )
        
        logger.info("API client settings updated")

# Factory function for creating API client
async def create_api_client() -> HerbieAPIClient:
    """Create and initialize API client"""
    client = HerbieAPIClient()
    await client.initialize()
    return client