"""
Main Herbie Telemetry Agent Application

Orchestrates all components to provide a complete Windows telemetry agent
for rFactor 2 that runs in the system tray and sends data to the Herbie backend.
"""

import sys
import asyncio
import signal
import logging
from typing import Optional, Dict, Any
from pathlib import Path

from PyQt6.QtWidgets import QApplication, QMessageBox
from PyQt6.QtCore import QTimer, QThread, pyqtSignal, QObject
from PyQt6.QtGui import QIcon
import structlog

from .settings_manager import get_settings_manager, SettingsManager
from .telemetry_collector import TelemetryCollector, CollectorState, create_telemetry_collector
from .tray_gui import TrayGUI, create_tray_gui
from .settings_window import SettingsWindow, create_settings_window
from .utils import ensure_directory, get_system_info, PerformanceMonitor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = structlog.get_logger(__name__)

class AsyncWorker(QObject):
    """Worker thread for async operations"""
    
    finished = pyqtSignal()
    error = pyqtSignal(str)
    status_update = pyqtSignal(object, object)  # state, stats
    
    def __init__(self, collector: TelemetryCollector):
        super().__init__()
        self.collector = collector
        self.running = False
    
    async def run_async(self):
        """Run async operations"""
        try:
            self.running = True
            
            # Initialize collector
            await self.collector.initialize()
            
            # Start collector if auto-start is enabled
            settings = get_settings_manager().settings
            if settings.telemetry.auto_start:
                await self.collector.start()
            
            # Main loop
            while self.running:
                # Emit status update
                state = self.collector.get_state()
                stats = self.collector.get_statistics()
                self.status_update.emit(state, stats)
                
                await asyncio.sleep(1.0)
                
        except Exception as e:
            logger.error("Async worker error", error=str(e))
            self.error.emit(str(e))
        finally:
            if self.collector:
                await self.collector.stop()
            self.finished.emit()
    
    def stop(self):
        """Stop the worker"""
        self.running = False

class TelemetryAgentApp:
    """Main Telemetry Agent Application"""
    
    def __init__(self):
        # Core components
        self.app: Optional[QApplication] = None
        self.settings_manager: Optional[SettingsManager] = None
        self.telemetry_collector: Optional[TelemetryCollector] = None
        self.tray_gui: Optional[TrayGUI] = None
        self.settings_window: Optional[SettingsWindow] = None
        
        # Async components
        self.async_thread: Optional[QThread] = None
        self.async_worker: Optional[AsyncWorker] = None
        
        # State
        self.is_initialized = False
        self.shutdown_requested = False
        
        # Performance monitoring
        self.startup_monitor = PerformanceMonitor("Application Startup")
        
    def initialize(self, argv: list = None) -> bool:
        """Initialize the application"""
        try:
            self.startup_monitor.start()
            
            if argv is None:
                argv = sys.argv
            
            logger.info("Initializing Herbie Telemetry Agent")
            
            # Log system info
            system_info = get_system_info()
            logger.info("System information", **system_info)
            
            # Initialize Qt Application
            self.app = QApplication(argv)
            self.app.setQuitOnLastWindowClosed(False)  # Keep running in tray
            self.app.setApplicationName("Herbie Telemetry Agent")
            self.app.setApplicationVersion("1.0.0")
            
            # Initialize settings
            self.settings_manager = get_settings_manager()
            
            # Ensure directories exist
            log_dir = self.settings_manager.get_log_file_path().parent
            ensure_directory(str(log_dir))
            ensure_directory(str(self.settings_manager.get_cache_dir()))
            
            # Configure structured logging
            self._setup_logging()
            
            # Initialize components
            self._initialize_components()
            
            # Setup signal handlers
            self._setup_signal_handlers()
            
            self.is_initialized = True
            
            self.startup_monitor.stop()
            self.startup_monitor.log_results()
            
            logger.info("Herbie Telemetry Agent initialized successfully")
            return True
            
        except Exception as e:
            logger.error("Failed to initialize application", error=str(e))
            self._show_error_message("Initialization Error", 
                                   f"Failed to initialize Herbie Telemetry Agent:\n{str(e)}")
            return False
    
    def _setup_logging(self):
        """Setup structured logging"""
        try:
            settings = self.settings_manager.settings.logging
            
            # Configure structlog
            structlog.configure(
                processors=[
                    structlog.stdlib.filter_by_level,
                    structlog.stdlib.add_logger_name,
                    structlog.stdlib.add_log_level,
                    structlog.stdlib.PositionalArgumentsFormatter(),
                    structlog.processors.TimeStamper(fmt="iso"),
                    structlog.processors.StackInfoRenderer(),
                    structlog.processors.format_exc_info,
                    structlog.processors.UnicodeDecoder(),
                    structlog.processors.JSONRenderer()
                ],
                context_class=dict,
                logger_factory=structlog.stdlib.LoggerFactory(),
                wrapper_class=structlog.stdlib.BoundLogger,
                cache_logger_on_first_use=True,
            )
            
            # Setup file logging if enabled
            if settings.file_logging:
                log_file = self.settings_manager.get_log_file_path()
                file_handler = logging.handlers.RotatingFileHandler(
                    log_file,
                    maxBytes=settings.max_log_size,
                    backupCount=settings.backup_count
                )
                file_handler.setLevel(getattr(logging, settings.level))
                
                formatter = logging.Formatter(
                    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
                )
                file_handler.setFormatter(formatter)
                
                root_logger = logging.getLogger()
                root_logger.addHandler(file_handler)
                root_logger.setLevel(getattr(logging, settings.level))
            
            logger.info("Logging configured", level=settings.level, 
                       file_logging=settings.file_logging)
                       
        except Exception as e:
            logger.warning("Failed to setup advanced logging", error=str(e))
    
    def _initialize_components(self):
        """Initialize all application components"""
        # Create telemetry collector
        self.telemetry_collector = create_telemetry_collector()
        
        # Setup collector callbacks
        self.telemetry_collector.set_status_callback(self._on_collector_status_change)
        self.telemetry_collector.set_lap_completed_callback(self._on_lap_completed)
        self.telemetry_collector.set_error_callback(self._on_collector_error)
        
        # Create tray GUI
        self.tray_gui = create_tray_gui()
        if not self.tray_gui.initialize(self.app):
            raise RuntimeError("Failed to initialize system tray")
        
        # Setup tray callbacks
        self.tray_gui.set_control_callback(self._on_control_action)
        self.tray_gui.set_settings_callback(self._show_settings_window)
        self.tray_gui.set_status_request_callback(self._update_tray_status)
        
        # Create settings window
        self.settings_window = create_settings_window()
        self.settings_window.settings_applied.connect(self._on_settings_applied)
        
        # Setup async worker
        self._setup_async_worker()
        
        logger.info("Application components initialized")
    
    def _setup_async_worker(self):
        """Setup async worker thread"""
        self.async_thread = QThread()
        self.async_worker = AsyncWorker(self.telemetry_collector)
        self.async_worker.moveToThread(self.async_thread)
        
        # Connect signals
        self.async_thread.started.connect(
            lambda: asyncio.run(self.async_worker.run_async())
        )
        self.async_worker.finished.connect(self.async_thread.quit)
        self.async_worker.error.connect(self._on_async_error)
        self.async_worker.status_update.connect(self._on_status_update)
        
        logger.info("Async worker setup complete")
    
    def _setup_signal_handlers(self):
        """Setup system signal handlers"""
        def signal_handler(signum, frame):
            logger.info("Received shutdown signal", signal=signum)
            self.shutdown()
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        if hasattr(signal, 'SIGBREAK'):  # Windows
            signal.signal(signal.SIGBREAK, signal_handler)
    
    def run(self) -> int:
        """Run the application"""
        if not self.is_initialized:
            logger.error("Application not initialized")
            return 1
        
        try:
            logger.info("Starting Herbie Telemetry Agent")
            
            # Show tray icon
            self.tray_gui.show()
            
            # Start async worker
            self.async_thread.start()
            
            # Show startup notification
            self.tray_gui.show_notification(
                "Herbie Telemetry Agent",
                "Agent started successfully and is ready to collect telemetry data"
            )
            
            # Run Qt event loop
            exit_code = self.app.exec()
            
            logger.info("Application exiting", exit_code=exit_code)
            return exit_code
            
        except Exception as e:
            logger.error("Application runtime error", error=str(e))
            self._show_error_message("Runtime Error", 
                                   f"Application encountered an error:\n{str(e)}")
            return 1
        finally:
            self._cleanup()
    
    def shutdown(self):
        """Graceful shutdown"""
        if self.shutdown_requested:
            return
        
        self.shutdown_requested = True
        logger.info("Initiating graceful shutdown")
        
        try:
            # Stop async worker
            if self.async_worker:
                self.async_worker.stop()
            
            # Wait for async thread to finish
            if self.async_thread and self.async_thread.isRunning():
                self.async_thread.quit()
                self.async_thread.wait(5000)  # Wait up to 5 seconds
            
            # Hide tray
            if self.tray_gui:
                self.tray_gui.hide()
            
            # Close windows
            if self.settings_window and self.settings_window.isVisible():
                self.settings_window.close()
            
            # Quit application
            if self.app:
                self.app.quit()
                
        except Exception as e:
            logger.error("Error during shutdown", error=str(e))
    
    def _cleanup(self):
        """Cleanup resources"""
        try:
            logger.info("Cleaning up resources")
            
            if self.tray_gui:
                self.tray_gui.cleanup()
            
            if self.telemetry_collector:
                # This would need to be handled differently for async cleanup
                pass
            
            logger.info("Cleanup completed")
            
        except Exception as e:
            logger.error("Error during cleanup", error=str(e))
    
    # Event Handlers
    
    def _on_collector_status_change(self, state: CollectorState):
        """Handle collector status change"""
        logger.info("Collector status changed", state=state.value)
        self._update_tray_status()
        
        # Show notifications for important state changes
        if self.settings_manager.settings.gui.show_notifications:
            if state == CollectorState.COLLECTING:
                self.tray_gui.show_notification(
                    "Telemetry Collection",
                    "Started collecting telemetry data from rFactor 2"
                )
            elif state == CollectorState.ERROR:
                self.tray_gui.show_notification(
                    "Collection Error",
                    "Telemetry collection encountered an error",
                    self.tray_gui.tray_icon.MessageIcon.Warning
                )
    
    def _on_lap_completed(self, lap_data):
        """Handle completed lap"""
        logger.info("Lap completed", lap_number=lap_data.lap_number, 
                   valid=lap_data.valid, uploaded=lap_data.uploaded)
        
        if self.settings_manager.settings.gui.show_notifications and lap_data.valid:
            self.tray_gui.show_notification(
                "Lap Completed",
                f"Lap {lap_data.lap_number} collected and validated successfully"
            )
    
    def _on_collector_error(self, error: str):
        """Handle collector error"""
        logger.error("Collector error", error=error)
        
        if self.settings_manager.settings.gui.show_notifications:
            self.tray_gui.show_notification(
                "Collection Error",
                f"Error: {error}",
                self.tray_gui.tray_icon.MessageIcon.Critical
            )
    
    def _on_control_action(self, action: str):
        """Handle control action from tray"""
        logger.info("Control action requested", action=action)
        
        try:
            if action == "start":
                asyncio.create_task(self.telemetry_collector.start())
            elif action == "stop":
                asyncio.create_task(self.telemetry_collector.stop())
            elif action == "pause":
                asyncio.create_task(self.telemetry_collector.pause())
            elif action == "resume":
                asyncio.create_task(self.telemetry_collector.resume())
                
        except Exception as e:
            logger.error("Control action failed", action=action, error=str(e))
    
    def _on_status_update(self, state: CollectorState, stats: Dict[str, Any]):
        """Handle status update from async worker"""
        if self.tray_gui:
            self.tray_gui.update_status(state, stats)
    
    def _on_async_error(self, error: str):
        """Handle async worker error"""
        logger.error("Async worker error", error=error)
        self._show_error_message("Worker Error", f"Background worker error:\n{error}")
    
    def _show_settings_window(self):
        """Show settings window"""
        if self.settings_window:
            self.settings_window.show()
            self.settings_window.raise_()
            self.settings_window.activateWindow()
    
    def _on_settings_applied(self):
        """Handle settings applied"""
        logger.info("Settings applied, updating components")
        
        # Update collector settings
        if self.telemetry_collector:
            self.telemetry_collector.update_settings()
        
        # Reconfigure logging
        self._setup_logging()
        
        # Show notification
        if self.settings_manager.settings.gui.show_notifications:
            self.tray_gui.show_notification(
                "Settings Updated",
                "Settings have been applied successfully"
            )
    
    def _update_tray_status(self):
        """Update tray status"""
        if self.telemetry_collector and self.tray_gui:
            state = self.telemetry_collector.get_state()
            stats = self.telemetry_collector.get_statistics()
            self.tray_gui.update_status(state, stats)
    
    def _show_error_message(self, title: str, message: str):
        """Show error message dialog"""
        try:
            if self.app:
                QMessageBox.critical(None, title, message)
        except Exception:
            # Fallback to console if GUI is not available
            print(f"ERROR: {title}: {message}")

def create_application() -> TelemetryAgentApp:
    """Create application instance"""
    return TelemetryAgentApp()

def main(argv: list = None) -> int:
    """Main entry point"""
    app = None
    
    try:
        # Create and initialize application
        app = create_application()
        
        if not app.initialize(argv):
            return 1
        
        # Run application
        return app.run()
        
    except KeyboardInterrupt:
        logger.info("Application interrupted by user")
        return 0
    except Exception as e:
        logger.error("Unhandled application error", error=str(e))
        return 1
    finally:
        if app:
            app.shutdown()

if __name__ == "__main__":
    sys.exit(main())