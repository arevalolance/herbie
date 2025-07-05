"""
System tray GUI for Herbie Telemetry Agent

Provides Windows system tray interface with status indicators,
Launch Herbie button, and settings access.
"""

import sys
import webbrowser
from typing import Optional, Callable, Dict, Any
from PyQt6.QtWidgets import (
    QApplication, QSystemTrayIcon, QMenu, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QTextEdit, QScrollArea, QGroupBox, QGridLayout,
    QProgressBar, QFrame
)
from PyQt6.QtCore import QTimer, QThread, pyqtSignal, Qt, QSize
from PyQt6.QtGui import QIcon, QPixmap, QAction, QFont, QCursor
import structlog

from .settings_manager import get_settings_manager
from .telemetry_collector import CollectorState

logger = structlog.get_logger(__name__)

class TrayIcon(QSystemTrayIcon):
    """Custom system tray icon with enhanced functionality"""
    
    # Signals
    status_clicked = pyqtSignal()
    settings_clicked = pyqtSignal()
    launch_herbie_clicked = pyqtSignal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self.settings_manager = get_settings_manager()
        self.settings = self.settings_manager.settings
        
        # State
        self.collector_state = CollectorState.STOPPED
        self.is_collecting = False
        self.lap_count = 0
        self.error_count = 0
        
        # Setup UI
        self._setup_icon()
        self._setup_menu()
        self._setup_timer()
        
        # Connect signals
        self.activated.connect(self._on_activated)
        
    def _setup_icon(self):
        """Setup system tray icon"""
        try:
            # Create a simple colored icon based on status
            self._update_icon_for_status(CollectorState.STOPPED)
            self.setVisible(True)
        except Exception as e:
            logger.error("Failed to setup tray icon", error=str(e))
            # Fallback to default icon
            self.setIcon(self.style().standardIcon(self.style().StandardPixmap.SP_ComputerIcon))
    
    def _setup_menu(self):
        """Setup context menu"""
        menu = QMenu()
        
        # Status section
        self.status_action = QAction("Status: Stopped", self)
        self.status_action.setEnabled(False)
        menu.addAction(self.status_action)
        
        menu.addSeparator()
        
        # Main actions
        self.launch_herbie_action = QAction("🚀 Launch Herbie", self)
        self.launch_herbie_action.triggered.connect(self.launch_herbie_clicked.emit)
        menu.addAction(self.launch_herbie_action)
        
        menu.addSeparator()
        
        # Control actions
        self.start_action = QAction("▶️ Start Collection", self)
        self.start_action.triggered.connect(lambda: self._emit_control_signal('start'))
        menu.addAction(self.start_action)
        
        self.stop_action = QAction("⏹️ Stop Collection", self)
        self.stop_action.triggered.connect(lambda: self._emit_control_signal('stop'))
        self.stop_action.setEnabled(False)
        menu.addAction(self.stop_action)
        
        self.pause_action = QAction("⏸️ Pause Collection", self)
        self.pause_action.triggered.connect(lambda: self._emit_control_signal('pause'))
        self.pause_action.setEnabled(False)
        menu.addAction(self.pause_action)
        
        menu.addSeparator()
        
        # Settings and info
        self.show_status_action = QAction("📊 Show Status", self)
        self.show_status_action.triggered.connect(self.status_clicked.emit)
        menu.addAction(self.show_status_action)
        
        self.settings_action = QAction("⚙️ Settings", self)
        self.settings_action.triggered.connect(self.settings_clicked.emit)
        menu.addAction(self.settings_action)
        
        menu.addSeparator()
        
        # Exit
        self.exit_action = QAction("❌ Exit", self)
        self.exit_action.triggered.connect(lambda: QApplication.quit())
        menu.addAction(self.exit_action)
        
        self.setContextMenu(menu)
    
    def _setup_timer(self):
        """Setup update timer"""
        self.update_timer = QTimer()
        self.update_timer.timeout.connect(self._update_tooltip)
        self.update_timer.start(2000)  # Update every 2 seconds
    
    def _emit_control_signal(self, action: str):
        """Emit control signal"""
        # This would be connected to the main application
        logger.info("Control action requested", action=action)
    
    def _on_activated(self, reason):
        """Handle tray icon activation"""
        if reason == QSystemTrayIcon.ActivationReason.DoubleClick:
            self.status_clicked.emit()
        elif reason == QSystemTrayIcon.ActivationReason.MiddleClick:
            self.launch_herbie_clicked.emit()
    
    def _update_icon_for_status(self, state: CollectorState):
        """Update icon based on collector state"""
        # Create simple colored icons for different states
        pixmap = QPixmap(16, 16)
        
        if state == CollectorState.STOPPED:
            pixmap.fill(Qt.GlobalColor.gray)
            self.setToolTip("Herbie Telemetry Agent - Stopped")
        elif state == CollectorState.CONNECTED:
            pixmap.fill(Qt.GlobalColor.yellow)
            self.setToolTip("Herbie Telemetry Agent - Connected")
        elif state == CollectorState.COLLECTING:
            pixmap.fill(Qt.GlobalColor.green)
            self.setToolTip("Herbie Telemetry Agent - Collecting")
        elif state == CollectorState.ERROR:
            pixmap.fill(Qt.GlobalColor.red)
            self.setToolTip("Herbie Telemetry Agent - Error")
        elif state == CollectorState.PAUSED:
            pixmap.fill(Qt.GlobalColor.blue)
            self.setToolTip("Herbie Telemetry Agent - Paused")
        else:
            pixmap.fill(Qt.GlobalColor.gray)
            self.setToolTip("Herbie Telemetry Agent")
        
        self.setIcon(QIcon(pixmap))
    
    def _update_tooltip(self):
        """Update tooltip with current stats"""
        status_text = f"Herbie Telemetry Agent\n"
        status_text += f"Status: {self.collector_state.value.title()}\n"
        
        if self.is_collecting:
            status_text += f"Laps: {self.lap_count}\n"
        
        if self.error_count > 0:
            status_text += f"Errors: {self.error_count}\n"
        
        status_text += f"\nDouble-click to show status\nMiddle-click to launch Herbie"
        
        self.setToolTip(status_text)
    
    def update_status(self, state: CollectorState, stats: Optional[Dict[str, Any]] = None):
        """Update tray icon status"""
        self.collector_state = state
        
        if stats:
            self.lap_count = stats.get('laps_collected', 0)
            self.error_count = stats.get('error_count', 0)
            self.is_collecting = state == CollectorState.COLLECTING
        
        # Update icon
        self._update_icon_for_status(state)
        
        # Update menu items
        self.status_action.setText(f"Status: {state.value.title()}")
        
        # Update control buttons
        is_running = state in [CollectorState.CONNECTED, CollectorState.COLLECTING, CollectorState.PAUSED]
        self.start_action.setEnabled(not is_running)
        self.stop_action.setEnabled(is_running)
        self.pause_action.setEnabled(state == CollectorState.COLLECTING)
        
        # Update tooltip
        self._update_tooltip()

class StatusWindow(QWidget):
    """Status display window"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self.settings_manager = get_settings_manager()
        self.stats_data = {}
        
        self._setup_ui()
        self._setup_timer()
        
    def _setup_ui(self):
        """Setup status window UI"""
        self.setWindowTitle("Herbie Telemetry Agent - Status")
        self.setFixedSize(600, 500)
        self.setWindowFlags(Qt.WindowType.Window | Qt.WindowType.WindowCloseButtonHint)
        
        layout = QVBoxLayout()
        
        # Title
        title = QLabel("Herbie Telemetry Agent Status")
        title.setFont(QFont("Arial", 14, QFont.Weight.Bold))
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)
        
        # Status sections
        scroll_area = QScrollArea()
        scroll_widget = QWidget()
        scroll_layout = QVBoxLayout(scroll_widget)
        
        # Collection Status
        self.collection_group = self._create_status_group("Collection Status")
        scroll_layout.addWidget(self.collection_group)
        
        # Statistics
        self.stats_group = self._create_status_group("Statistics")
        scroll_layout.addWidget(self.stats_group)
        
        # API Status
        self.api_group = self._create_status_group("API Status")
        scroll_layout.addWidget(self.api_group)
        
        # Recent Errors
        self.errors_group = self._create_status_group("Recent Errors")
        scroll_layout.addWidget(self.errors_group)
        
        scroll_area.setWidget(scroll_widget)
        scroll_area.setWidgetResizable(True)
        layout.addWidget(scroll_area)
        
        # Buttons
        button_layout = QHBoxLayout()
        
        self.refresh_button = QPushButton("🔄 Refresh")
        self.refresh_button.clicked.connect(self.refresh_status)
        button_layout.addWidget(self.refresh_button)
        
        self.launch_herbie_button = QPushButton("🚀 Launch Herbie")
        self.launch_herbie_button.clicked.connect(self._launch_herbie)
        button_layout.addWidget(self.launch_herbie_button)
        
        self.close_button = QPushButton("❌ Close")
        self.close_button.clicked.connect(self.close)
        button_layout.addWidget(self.close_button)
        
        layout.addLayout(button_layout)
        
        self.setLayout(layout)
    
    def _create_status_group(self, title: str) -> QGroupBox:
        """Create a status group widget"""
        group = QGroupBox(title)
        layout = QVBoxLayout()
        
        # Add a label for content
        content_label = QLabel("Loading...")
        content_label.setWordWrap(True)
        content_label.setStyleSheet("padding: 10px; background-color: #f0f0f0; border-radius: 4px;")
        layout.addWidget(content_label)
        
        group.setLayout(layout)
        return group
    
    def _setup_timer(self):
        """Setup auto-refresh timer"""
        self.refresh_timer = QTimer()
        self.refresh_timer.timeout.connect(self.refresh_status)
        self.refresh_timer.start(5000)  # Refresh every 5 seconds
    
    def _launch_herbie(self):
        """Launch Herbie web application"""
        try:
            herbie_url = self.settings_manager.settings.gui.herbie_url
            webbrowser.open(herbie_url)
            logger.info("Launched Herbie web application", url=herbie_url)
        except Exception as e:
            logger.error("Failed to launch Herbie", error=str(e))
    
    def update_status(self, stats: Dict[str, Any]):
        """Update status display"""
        self.stats_data = stats
        
        # Update collection status
        self._update_collection_status(stats)
        
        # Update statistics
        self._update_statistics(stats)
        
        # Update API status
        self._update_api_status(stats)
        
        # Update errors
        self._update_errors(stats)
    
    def _update_collection_status(self, stats: Dict[str, Any]):
        """Update collection status section"""
        state = stats.get('state', 'unknown')
        uptime = stats.get('uptime', 0)
        current_lap_points = stats.get('current_lap_points', 0)
        
        content = f"""
        <b>Current State:</b> {state.title()}<br>
        <b>Uptime:</b> {self._format_duration(uptime)}<br>
        <b>Current Lap Points:</b> {current_lap_points}<br>
        <b>Pending Laps:</b> {stats.get('pending_laps', 0)}<br>
        """
        
        layout = self.collection_group.layout()
        if layout.count() > 0:
            label = layout.itemAt(0).widget()
            label.setText(content)
    
    def _update_statistics(self, stats: Dict[str, Any]):
        """Update statistics section"""
        content = f"""
        <b>Sessions Created:</b> {stats.get('sessions_created', 0)}<br>
        <b>Laps Collected:</b> {stats.get('laps_collected', 0)}<br>
        <b>Laps Valid:</b> {stats.get('laps_valid', 0)}<br>
        <b>Laps Uploaded:</b> {stats.get('laps_uploaded', 0)}<br>
        <b>Telemetry Points Collected:</b> {stats.get('telemetry_points_collected', 0):,}<br>
        <b>Telemetry Points Uploaded:</b> {stats.get('telemetry_points_uploaded', 0):,}<br>
        <b>Last Lap Time:</b> {self._format_lap_time(stats.get('last_lap_time', 0))}<br>
        """
        
        layout = self.stats_group.layout()
        if layout.count() > 0:
            label = layout.itemAt(0).widget()
            label.setText(content)
    
    def _update_api_status(self, stats: Dict[str, Any]):
        """Update API status section"""
        api_stats = stats.get('api_stats', {})
        
        content = f"""
        <b>Connection Status:</b> {api_stats.get('connection_status', 'unknown').title()}<br>
        <b>Requests Made:</b> {api_stats.get('requests_made', 0)}<br>
        <b>Success Rate:</b> {api_stats.get('success_rate', 0):.1f}%<br>
        <b>Failed Requests:</b> {api_stats.get('requests_failed', 0)}<br>
        <b>Bytes Sent:</b> {self._format_bytes(api_stats.get('bytes_sent', 0))}<br>
        <b>Bytes Received:</b> {self._format_bytes(api_stats.get('bytes_received', 0))}<br>
        """
        
        if api_stats.get('last_error'):
            content += f"<b>Last Error:</b> {api_stats['last_error']}<br>"
        
        layout = self.api_group.layout()
        if layout.count() > 0:
            label = layout.itemAt(0).widget()
            label.setText(content)
    
    def _update_errors(self, stats: Dict[str, Any]):
        """Update errors section"""
        errors = stats.get('latest_errors', [])
        
        if not errors:
            content = "<i>No recent errors</i>"
        else:
            content = "<b>Recent Errors:</b><br>"
            for i, error in enumerate(errors[-5:], 1):  # Show last 5 errors
                content += f"{i}. {error}<br>"
        
        layout = self.errors_group.layout()
        if layout.count() > 0:
            label = layout.itemAt(0).widget()
            label.setText(content)
    
    def _format_duration(self, seconds: float) -> str:
        """Format duration in human readable format"""
        if seconds < 60:
            return f"{seconds:.0f}s"
        elif seconds < 3600:
            return f"{seconds/60:.1f}m"
        else:
            return f"{seconds/3600:.1f}h"
    
    def _format_lap_time(self, seconds: float) -> str:
        """Format lap time"""
        if seconds <= 0:
            return "N/A"
        
        minutes = int(seconds // 60)
        seconds = seconds % 60
        return f"{minutes}:{seconds:06.3f}"
    
    def _format_bytes(self, bytes_count: int) -> str:
        """Format bytes in human readable format"""
        if bytes_count == 0:
            return "0 B"
        
        units = ["B", "KB", "MB", "GB"]
        i = 0
        while bytes_count >= 1024 and i < len(units) - 1:
            bytes_count /= 1024
            i += 1
        
        return f"{bytes_count:.1f} {units[i]}"
    
    def refresh_status(self):
        """Refresh status (signal for external update)"""
        # This will be connected to the main application to request fresh data
        pass
    
    def closeEvent(self, event):
        """Handle close event"""
        self.hide()
        event.ignore()  # Don't actually close, just hide

class TrayGUI:
    """Main tray GUI controller"""
    
    def __init__(self):
        self.app = None
        self.tray_icon = None
        self.status_window = None
        self.settings_window = None
        
        # Callbacks
        self.control_callback: Optional[Callable] = None
        self.settings_callback: Optional[Callable] = None
        self.status_request_callback: Optional[Callable] = None
        
    def initialize(self, app: QApplication):
        """Initialize the tray GUI"""
        self.app = app
        
        # Check if system tray is available
        if not QSystemTrayIcon.isSystemTrayAvailable():
            logger.error("System tray is not available")
            return False
        
        # Create tray icon
        self.tray_icon = TrayIcon()
        
        # Create status window
        self.status_window = StatusWindow()
        
        # Connect signals
        self.tray_icon.status_clicked.connect(self._show_status_window)
        self.tray_icon.settings_clicked.connect(self._show_settings_window)
        self.tray_icon.launch_herbie_clicked.connect(self._launch_herbie)
        
        # Setup periodic status updates
        self.status_timer = QTimer()
        self.status_timer.timeout.connect(self._request_status_update)
        self.status_timer.start(5000)  # Request updates every 5 seconds
        
        logger.info("Tray GUI initialized")
        return True
    
    def show(self):
        """Show the tray icon"""
        if self.tray_icon:
            self.tray_icon.show()
    
    def hide(self):
        """Hide the tray icon"""
        if self.tray_icon:
            self.tray_icon.hide()
    
    def update_status(self, state: CollectorState, stats: Optional[Dict[str, Any]] = None):
        """Update tray status"""
        if self.tray_icon:
            self.tray_icon.update_status(state, stats)
        
        if self.status_window and stats:
            self.status_window.update_status(stats)
    
    def show_notification(self, title: str, message: str, icon: QSystemTrayIcon.MessageIcon = QSystemTrayIcon.MessageIcon.Information):
        """Show system tray notification"""
        if self.tray_icon:
            self.tray_icon.showMessage(title, message, icon, 5000)
    
    def _show_status_window(self):
        """Show status window"""
        if self.status_window:
            self.status_window.show()
            self.status_window.raise_()
            self.status_window.activateWindow()
    
    def _show_settings_window(self):
        """Show settings window"""
        if self.settings_callback:
            self.settings_callback()
    
    def _launch_herbie(self):
        """Launch Herbie web application"""
        try:
            settings = get_settings_manager().settings
            herbie_url = settings.gui.herbie_url
            webbrowser.open(herbie_url)
            logger.info("Launched Herbie web application", url=herbie_url)
            
            # Show notification
            self.show_notification(
                "Herbie Launched",
                f"Opened {herbie_url} in your default browser",
                QSystemTrayIcon.MessageIcon.Information
            )
            
        except Exception as e:
            logger.error("Failed to launch Herbie", error=str(e))
            self.show_notification(
                "Launch Failed",
                f"Failed to open Herbie: {str(e)}",
                QSystemTrayIcon.MessageIcon.Critical
            )
    
    def _request_status_update(self):
        """Request status update from main application"""
        if self.status_request_callback:
            self.status_request_callback()
    
    # Callback setters
    
    def set_control_callback(self, callback: Callable):
        """Set control action callback"""
        self.control_callback = callback
    
    def set_settings_callback(self, callback: Callable):
        """Set settings window callback"""
        self.settings_callback = callback
    
    def set_status_request_callback(self, callback: Callable):
        """Set status request callback"""
        self.status_request_callback = callback
    
    def cleanup(self):
        """Cleanup resources"""
        if self.status_timer:
            self.status_timer.stop()
        
        if self.status_window:
            self.status_window.close()
        
        if self.tray_icon:
            self.tray_icon.hide()
        
        logger.info("Tray GUI cleaned up")

# Factory function
def create_tray_gui() -> TrayGUI:
    """Create tray GUI instance"""
    return TrayGUI()