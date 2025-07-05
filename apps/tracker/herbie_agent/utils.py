"""
Utility functions for Herbie Telemetry Agent
"""

import time
import asyncio
import threading
from typing import Optional, Callable, Any, Dict, List
from datetime import datetime, timezone
from pathlib import Path
import structlog

logger = structlog.get_logger(__name__)

class AsyncTimer:
    """Async timer for periodic tasks"""
    
    def __init__(self, interval: float, callback: Callable, *args, **kwargs):
        self.interval = interval
        self.callback = callback
        self.args = args
        self.kwargs = kwargs
        self.task: Optional[asyncio.Task] = None
        self.running = False
    
    async def start(self):
        """Start the timer"""
        if self.running:
            return
        
        self.running = True
        self.task = asyncio.create_task(self._run())
    
    async def stop(self):
        """Stop the timer"""
        if not self.running:
            return
        
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
    
    async def _run(self):
        """Timer loop"""
        while self.running:
            try:
                await asyncio.sleep(self.interval)
                if self.running:
                    if asyncio.iscoroutinefunction(self.callback):
                        await self.callback(*self.args, **self.kwargs)
                    else:
                        self.callback(*self.args, **self.kwargs)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Timer callback error", error=str(e))

class ExponentialBackoff:
    """Exponential backoff for retry logic"""
    
    def __init__(self, initial_delay: float = 1.0, max_delay: float = 60.0, 
                 multiplier: float = 2.0, jitter: bool = True):
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.multiplier = multiplier
        self.jitter = jitter
        self.current_delay = initial_delay
        self.attempt = 0
    
    def get_delay(self) -> float:
        """Get the current delay and increment for next attempt"""
        delay = min(self.current_delay, self.max_delay)
        
        if self.jitter:
            import random
            delay = delay * (0.5 + random.random() * 0.5)  # 50-100% of delay
        
        self.current_delay *= self.multiplier
        self.attempt += 1
        
        return delay
    
    def reset(self):
        """Reset backoff to initial state"""
        self.current_delay = self.initial_delay
        self.attempt = 0

class RateLimiter:
    """Rate limiter for API calls"""
    
    def __init__(self, max_calls: int = 10, time_window: float = 60.0):
        self.max_calls = max_calls
        self.time_window = time_window
        self.calls = []
        self.lock = threading.Lock()
    
    def can_proceed(self) -> bool:
        """Check if we can make another call"""
        with self.lock:
            now = time.time()
            
            # Remove old calls outside the time window
            self.calls = [call_time for call_time in self.calls 
                         if now - call_time < self.time_window]
            
            # Check if we're under the limit
            if len(self.calls) < self.max_calls:
                self.calls.append(now)
                return True
            
            return False
    
    def time_until_next(self) -> float:
        """Get time until next call is allowed"""
        with self.lock:
            if len(self.calls) < self.max_calls:
                return 0.0
            
            oldest_call = min(self.calls)
            return max(0.0, self.time_window - (time.time() - oldest_call))

class TelemetryBuffer:
    """Buffer for telemetry data with automatic flushing"""
    
    def __init__(self, max_size: int = 100, flush_interval: float = 5.0):
        self.max_size = max_size
        self.flush_interval = flush_interval
        self.buffer: List[Dict[str, Any]] = []
        self.lock = threading.Lock()
        self.last_flush = time.time()
        self.flush_callback: Optional[Callable] = None
    
    def add_data(self, data: Dict[str, Any]):
        """Add data to buffer"""
        with self.lock:
            self.buffer.append(data)
            
            # Auto-flush if buffer is full or time interval exceeded
            should_flush = (len(self.buffer) >= self.max_size or 
                          time.time() - self.last_flush >= self.flush_interval)
            
            if should_flush and self.flush_callback:
                self._flush()
    
    def _flush(self):
        """Flush the buffer"""
        if not self.buffer:
            return
        
        data_to_flush = self.buffer.copy()
        self.buffer.clear()
        self.last_flush = time.time()
        
        # Call flush callback with data
        if self.flush_callback:
            try:
                self.flush_callback(data_to_flush)
            except Exception as e:
                logger.error("Buffer flush callback error", error=str(e))
    
    def set_flush_callback(self, callback: Callable):
        """Set callback function for flushing"""
        self.flush_callback = callback
    
    def manual_flush(self):
        """Manually flush the buffer"""
        with self.lock:
            self._flush()
    
    def get_size(self) -> int:
        """Get current buffer size"""
        with self.lock:
            return len(self.buffer)

def format_timestamp(timestamp: Optional[float] = None) -> str:
    """Format timestamp for API calls"""
    if timestamp is None:
        timestamp = time.time()
    
    dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
    return dt.isoformat()

def calculate_speed_kmh(velocity_vector: tuple) -> float:
    """Calculate speed in km/h from velocity vector"""
    if len(velocity_vector) != 3:
        return 0.0
    
    x, y, z = velocity_vector
    speed_ms = (x**2 + y**2 + z**2) ** 0.5
    return speed_ms * 3.6  # Convert m/s to km/h

def calculate_distance(pos1: tuple, pos2: tuple) -> float:
    """Calculate distance between two 3D positions"""
    if len(pos1) != 3 or len(pos2) != 3:
        return 0.0
    
    dx = pos2[0] - pos1[0]
    dy = pos2[1] - pos1[1]
    dz = pos2[2] - pos1[2]
    
    return (dx**2 + dy**2 + dz**2) ** 0.5

def is_valid_position(position: tuple) -> bool:
    """Check if position is valid (not at origin or extreme values)"""
    if len(position) != 3:
        return False
    
    x, y, z = position
    
    # Check for origin (usually invalid)
    if x == 0 and y == 0 and z == 0:
        return False
    
    # Check for extreme values (likely invalid)
    max_coord = 1000000.0  # 1 million units
    if abs(x) > max_coord or abs(y) > max_coord or abs(z) > max_coord:
        return False
    
    return True

def is_valid_telemetry_value(value: Any, min_val: float = -1e6, max_val: float = 1e6) -> bool:
    """Check if telemetry value is within reasonable bounds"""
    if value is None:
        return False
    
    try:
        float_val = float(value)
        return min_val <= float_val <= max_val
    except (ValueError, TypeError):
        return False

def safe_divide(numerator: float, denominator: float, default: float = 0.0) -> float:
    """Safe division with default value for zero division"""
    if denominator == 0:
        return default
    return numerator / denominator

def clamp(value: float, min_val: float, max_val: float) -> float:
    """Clamp value between min and max"""
    return max(min_val, min(value, max_val))

def moving_average(values: List[float], window_size: int = 5) -> float:
    """Calculate moving average of values"""
    if not values:
        return 0.0
    
    window_size = min(window_size, len(values))
    return sum(values[-window_size:]) / window_size

def detect_outliers(values: List[float], threshold: float = 2.0) -> List[bool]:
    """Detect outliers using standard deviation"""
    if len(values) < 3:
        return [False] * len(values)
    
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / len(values)
    std_dev = variance ** 0.5
    
    outliers = []
    for value in values:
        is_outlier = abs(value - mean) > threshold * std_dev
        outliers.append(is_outlier)
    
    return outliers

def ensure_directory(path: str) -> bool:
    """Ensure directory exists, create if not"""
    try:
        Path(path).mkdir(parents=True, exist_ok=True)
        return True
    except Exception as e:
        logger.error("Failed to create directory", path=path, error=str(e))
        return False

def format_file_size(size_bytes: int) -> str:
    """Format file size in human readable format"""
    if size_bytes == 0:
        return "0 B"
    
    units = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while size_bytes >= 1024 and i < len(units) - 1:
        size_bytes /= 1024
        i += 1
    
    return f"{size_bytes:.1f} {units[i]}"

def get_process_memory_usage() -> Optional[float]:
    """Get current process memory usage in MB"""
    try:
        import psutil
        process = psutil.Process()
        return process.memory_info().rss / 1024 / 1024  # Convert to MB
    except Exception:
        return None

def get_system_info() -> Dict[str, Any]:
    """Get system information"""
    info = {
        "platform": "unknown",
        "python_version": "unknown",
        "cpu_count": 0,
        "memory_total": 0,
        "memory_available": 0
    }
    
    try:
        import platform
        import sys
        import psutil
        
        info["platform"] = platform.system()
        info["python_version"] = sys.version
        info["cpu_count"] = psutil.cpu_count()
        
        memory = psutil.virtual_memory()
        info["memory_total"] = memory.total / 1024 / 1024  # MB
        info["memory_available"] = memory.available / 1024 / 1024  # MB
        
    except Exception as e:
        logger.warning("Failed to get system info", error=str(e))
    
    return info

class PerformanceMonitor:
    """Monitor performance metrics"""
    
    def __init__(self, name: str = "Unknown"):
        self.name = name
        self.start_time = None
        self.end_time = None
        self.metrics = {}
    
    def start(self):
        """Start monitoring"""
        self.start_time = time.perf_counter()
        self.metrics["memory_start"] = get_process_memory_usage()
    
    def stop(self):
        """Stop monitoring"""
        self.end_time = time.perf_counter()
        self.metrics["memory_end"] = get_process_memory_usage()
    
    def get_duration(self) -> float:
        """Get duration in seconds"""
        if self.start_time is None or self.end_time is None:
            return 0.0
        return self.end_time - self.start_time
    
    def get_memory_delta(self) -> float:
        """Get memory usage delta in MB"""
        start_mem = self.metrics.get("memory_start", 0) or 0
        end_mem = self.metrics.get("memory_end", 0) or 0
        return end_mem - start_mem
    
    def log_results(self):
        """Log performance results"""
        duration = self.get_duration()
        memory_delta = self.get_memory_delta()
        
        logger.info("Performance monitoring result",
                   name=self.name,
                   duration=f"{duration:.3f}s",
                   memory_delta=f"{memory_delta:.1f}MB")

def performance_monitor(name: str = "Unknown"):
    """Decorator for performance monitoring"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            monitor = PerformanceMonitor(name)
            monitor.start()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                monitor.stop()
                monitor.log_results()
        return wrapper
    return decorator