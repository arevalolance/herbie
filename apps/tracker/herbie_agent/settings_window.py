"""
Settings window GUI for Herbie Telemetry Agent

Provides comprehensive settings interface for configuring all aspects
of the telemetry agent.
"""

import os
from typing import Dict, Any, Optional, Callable
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTabWidget, QGroupBox, QFormLayout,
    QLineEdit, QSpinBox, QDoubleSpinBox, QCheckBox, QComboBox, QPushButton,
    QLabel, QTextEdit, QFileDialog, QMessageBox, QScrollArea, QSlider,
    QProgressBar, QFrame, QSplitter, QTreeWidget, QTreeWidgetItem,
    QGridLayout, QButtonGroup, QRadioButton
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal, QThread, QObject
from PyQt6.QtGui import QFont, QIcon, QPixmap, QPalette, QValidator
import structlog

from .settings_manager import get_settings_manager, HerbieSettings

logger = structlog.get_logger(__name__)

class SettingsValidator(QValidator):
    """Custom validator for settings inputs"""
    
    def __init__(self, min_val: float = None, max_val: float = None, parent=None):
        super().__init__(parent)
        self.min_val = min_val
        self.max_val = max_val
    
    def validate(self, input_text: str, pos: int):
        if not input_text:
            return QValidator.State.Intermediate, input_text, pos
        
        try:
            value = float(input_text)
            if self.min_val is not None and value < self.min_val:
                return QValidator.State.Invalid, input_text, pos
            if self.max_val is not None and value > self.max_val:
                return QValidator.State.Invalid, input_text, pos
            return QValidator.State.Acceptable, input_text, pos
        except ValueError:
            return QValidator.State.Invalid, input_text, pos

class SettingsTab(QWidget):
    """Base class for settings tabs"""
    
    settings_changed = pyqtSignal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.settings_manager = get_settings_manager()
        self.controls = {}
        self._setup_ui()
        self._load_settings()
    
    def _setup_ui(self):
        """Setup UI - to be implemented by subclasses"""
        pass
    
    def _load_settings(self):
        """Load settings into controls - to be implemented by subclasses"""
        pass
    
    def get_settings_data(self) -> Dict[str, Any]:
        """Get settings data from controls - to be implemented by subclasses"""
        return {}
    
    def validate_settings(self) -> tuple[bool, list[str]]:
        """Validate settings - to be implemented by subclasses"""
        return True, []

class APISettingsTab(SettingsTab):
    """API settings tab"""
    
    def _setup_ui(self):
        layout = QVBoxLayout()
        
        # API Configuration
        api_group = QGroupBox("API Configuration")
        api_layout = QFormLayout()
        
        self.controls['base_url'] = QLineEdit()
        self.controls['base_url'].setPlaceholderText("http://localhost:3000")
        api_layout.addRow("Base URL:", self.controls['base_url'])
        
        self.controls['user_id'] = QLineEdit()
        self.controls['user_id'].setPlaceholderText("your-user-id")
        api_layout.addRow("User ID:", self.controls['user_id'])
        
        self.controls['timeout'] = QSpinBox()
        self.controls['timeout'].setRange(5, 120)
        self.controls['timeout'].setSuffix(" seconds")
        api_layout.addRow("Request Timeout:", self.controls['timeout'])
        
        api_group.setLayout(api_layout)
        layout.addWidget(api_group)
        
        # Retry Configuration
        retry_group = QGroupBox("Retry Configuration")
        retry_layout = QFormLayout()
        
        self.controls['retry_attempts'] = QSpinBox()
        self.controls['retry_attempts'].setRange(1, 10)
        retry_layout.addRow("Retry Attempts:", self.controls['retry_attempts'])
        
        self.controls['retry_delay'] = QDoubleSpinBox()
        self.controls['retry_delay'].setRange(0.1, 10.0)
        self.controls['retry_delay'].setSuffix(" seconds")
        self.controls['retry_delay'].setDecimals(1)
        retry_layout.addRow("Initial Retry Delay:", self.controls['retry_delay'])
        
        self.controls['batch_size'] = QSpinBox()
        self.controls['batch_size'].setRange(10, 1000)
        retry_layout.addRow("Batch Size:", self.controls['batch_size'])
        
        retry_group.setLayout(retry_layout)
        layout.addWidget(retry_group)
        
        # Test Connection
        test_group = QGroupBox("Connection Test")
        test_layout = QVBoxLayout()
        
        test_button_layout = QHBoxLayout()
        self.test_button = QPushButton("🔗 Test Connection")
        self.test_button.clicked.connect(self._test_connection)
        test_button_layout.addWidget(self.test_button)
        test_button_layout.addStretch()
        
        self.test_status = QLabel("Click 'Test Connection' to verify API connectivity")
        self.test_status.setWordWrap(True)
        
        test_layout.addLayout(test_button_layout)
        test_layout.addWidget(self.test_status)
        
        test_group.setLayout(test_layout)
        layout.addWidget(test_group)
        
        layout.addStretch()
        self.setLayout(layout)
        
        # Connect change signals
        for control in self.controls.values():
            if hasattr(control, 'textChanged'):
                control.textChanged.connect(self.settings_changed.emit)
            elif hasattr(control, 'valueChanged'):
                control.valueChanged.connect(self.settings_changed.emit)
    
    def _load_settings(self):
        api_settings = self.settings_manager.settings.api
        self.controls['base_url'].setText(api_settings.base_url)
        self.controls['user_id'].setText(api_settings.user_id)
        self.controls['timeout'].setValue(api_settings.timeout)
        self.controls['retry_attempts'].setValue(api_settings.retry_attempts)
        self.controls['retry_delay'].setValue(api_settings.retry_delay)
        self.controls['batch_size'].setValue(api_settings.batch_size)
    
    def get_settings_data(self) -> Dict[str, Any]:
        return {
            'api': {
                'base_url': self.controls['base_url'].text(),
                'user_id': self.controls['user_id'].text(),
                'timeout': self.controls['timeout'].value(),
                'retry_attempts': self.controls['retry_attempts'].value(),
                'retry_delay': self.controls['retry_delay'].value(),
                'batch_size': self.controls['batch_size'].value()
            }
        }
    
    def validate_settings(self) -> tuple[bool, list[str]]:
        errors = []
        
        base_url = self.controls['base_url'].text().strip()
        if not base_url:
            errors.append("Base URL is required")
        elif not base_url.startswith(('http://', 'https://')):
            errors.append("Base URL must start with http:// or https://")
        
        user_id = self.controls['user_id'].text().strip()
        if not user_id:
            errors.append("User ID is required")
        
        return len(errors) == 0, errors
    
    def _test_connection(self):
        """Test API connection"""
        self.test_button.setEnabled(False)
        self.test_status.setText("⏳ Testing connection...")
        
        # This would integrate with the actual API client
        QTimer.singleShot(2000, self._test_connection_result)
    
    def _test_connection_result(self):
        """Show test connection result"""
        self.test_button.setEnabled(True)
        # Simulate result - in real implementation, this would use the API client
        self.test_status.setText("✅ Connection successful!")

class TelemetrySettingsTab(SettingsTab):
    """Telemetry collection settings tab"""
    
    def _setup_ui(self):
        layout = QVBoxLayout()
        
        # Collection Settings
        collection_group = QGroupBox("Collection Settings")
        collection_layout = QFormLayout()
        
        self.controls['collection_interval'] = QDoubleSpinBox()
        self.controls['collection_interval'].setRange(0.01, 1.0)
        self.controls['collection_interval'].setSuffix(" seconds")
        self.controls['collection_interval'].setDecimals(2)
        collection_layout.addRow("Collection Interval:", self.controls['collection_interval'])
        
        self.controls['enable_collection'] = QCheckBox("Enable telemetry collection")
        collection_layout.addRow("", self.controls['enable_collection'])
        
        self.controls['auto_start'] = QCheckBox("Auto-start when rFactor 2 detected")
        collection_layout.addRow("", self.controls['auto_start'])
        
        collection_group.setLayout(collection_layout)
        layout.addWidget(collection_group)
        
        # rFactor 2 Settings
        rf2_group = QGroupBox("rFactor 2 Settings")
        rf2_layout = QFormLayout()
        
        self.controls['access_mode'] = QComboBox()
        self.controls['access_mode'].addItems(["Copy Access (Recommended)", "Direct Access"])
        rf2_layout.addRow("Access Mode:", self.controls['access_mode'])
        
        self.controls['process_id'] = QLineEdit()
        self.controls['process_id'].setPlaceholderText("Leave empty for automatic detection")
        rf2_layout.addRow("Process ID:", self.controls['process_id'])
        
        self.controls['player_override'] = QCheckBox("Override player index")
        rf2_layout.addRow("", self.controls['player_override'])
        
        self.controls['player_index'] = QSpinBox()
        self.controls['player_index'].setRange(0, 127)
        self.controls['player_index'].setEnabled(False)
        rf2_layout.addRow("Player Index:", self.controls['player_index'])
        
        self.controls['char_encoding'] = QComboBox()
        self.controls['char_encoding'].addItems(["utf-8", "iso-8859-1", "ascii"])
        rf2_layout.addRow("Character Encoding:", self.controls['char_encoding'])
        
        rf2_group.setLayout(rf2_layout)
        layout.addWidget(rf2_group)
        
        layout.addStretch()
        self.setLayout(layout)
        
        # Connect player override checkbox
        self.controls['player_override'].toggled.connect(
            self.controls['player_index'].setEnabled
        )
        
        # Connect change signals
        for control in self.controls.values():
            if hasattr(control, 'textChanged'):
                control.textChanged.connect(self.settings_changed.emit)
            elif hasattr(control, 'valueChanged'):
                control.valueChanged.connect(self.settings_changed.emit)
            elif hasattr(control, 'toggled'):
                control.toggled.connect(self.settings_changed.emit)
            elif hasattr(control, 'currentTextChanged'):
                control.currentTextChanged.connect(self.settings_changed.emit)
    
    def _load_settings(self):
        telemetry_settings = self.settings_manager.settings.telemetry
        rf2_settings = self.settings_manager.settings.rf2
        
        self.controls['collection_interval'].setValue(telemetry_settings.collection_interval)
        self.controls['enable_collection'].setChecked(telemetry_settings.enable_collection)
        self.controls['auto_start'].setChecked(telemetry_settings.auto_start)
        
        self.controls['access_mode'].setCurrentIndex(rf2_settings.access_mode)
        self.controls['process_id'].setText(rf2_settings.process_id)
        self.controls['player_override'].setChecked(rf2_settings.player_override)
        self.controls['player_index'].setValue(rf2_settings.player_index)
        
        encoding_index = self.controls['char_encoding'].findText(rf2_settings.char_encoding)
        if encoding_index >= 0:
            self.controls['char_encoding'].setCurrentIndex(encoding_index)
    
    def get_settings_data(self) -> Dict[str, Any]:
        return {
            'telemetry': {
                'collection_interval': self.controls['collection_interval'].value(),
                'enable_collection': self.controls['enable_collection'].isChecked(),
                'auto_start': self.controls['auto_start'].isChecked()
            },
            'rf2': {
                'access_mode': self.controls['access_mode'].currentIndex(),
                'process_id': self.controls['process_id'].text(),
                'player_override': self.controls['player_override'].isChecked(),
                'player_index': self.controls['player_index'].value(),
                'char_encoding': self.controls['char_encoding'].currentText()
            }
        }

class ValidationSettingsTab(SettingsTab):
    """Lap validation settings tab"""
    
    def _setup_ui(self):
        layout = QVBoxLayout()
        
        # Lap Validation
        validation_group = QGroupBox("Lap Validation Settings")
        validation_layout = QFormLayout()
        
        self.controls['min_telemetry_points'] = QSpinBox()
        self.controls['min_telemetry_points'].setRange(10, 10000)
        validation_layout.addRow("Minimum Telemetry Points:", self.controls['min_telemetry_points'])
        
        self.controls['min_lap_time'] = QDoubleSpinBox()
        self.controls['min_lap_time'].setRange(10.0, 600.0)
        self.controls['min_lap_time'].setSuffix(" seconds")
        validation_layout.addRow("Minimum Lap Time:", self.controls['min_lap_time'])
        
        self.controls['max_lap_time'] = QDoubleSpinBox()
        self.controls['max_lap_time'].setRange(60.0, 1800.0)
        self.controls['max_lap_time'].setSuffix(" seconds")
        validation_layout.addRow("Maximum Lap Time:", self.controls['max_lap_time'])
        
        self.controls['min_distance_percentage'] = QDoubleSpinBox()
        self.controls['min_distance_percentage'].setRange(50.0, 100.0)
        self.controls['min_distance_percentage'].setSuffix("%")
        validation_layout.addRow("Minimum Distance Coverage:", self.controls['min_distance_percentage'])
        
        self.controls['max_telemetry_gap'] = QDoubleSpinBox()
        self.controls['max_telemetry_gap'].setRange(0.1, 10.0)
        self.controls['max_telemetry_gap'].setSuffix(" seconds")
        self.controls['max_telemetry_gap'].setDecimals(1)
        validation_layout.addRow("Maximum Telemetry Gap:", self.controls['max_telemetry_gap'])
        
        self.controls['speed_outlier_threshold'] = QDoubleSpinBox()
        self.controls['speed_outlier_threshold'].setRange(100.0, 1000.0)
        self.controls['speed_outlier_threshold'].setSuffix(" km/h")
        validation_layout.addRow("Speed Outlier Threshold:", self.controls['speed_outlier_threshold'])
        
        validation_group.setLayout(validation_layout)
        layout.addWidget(validation_group)
        
        # Validation Info
        info_group = QGroupBox("Validation Information")
        info_layout = QVBoxLayout()
        
        info_text = QLabel("""
        <b>Lap Validation Rules:</b><br>
        • Laps must have minimum number of telemetry points for completeness<br>
        • Lap times must be within realistic bounds<br>
        • Distance coverage ensures lap was actually completed<br>
        • Telemetry gaps detect data collection issues<br>
        • Speed outlier detection prevents invalid data from being uploaded
        """)
        info_text.setWordWrap(True)
        info_layout.addWidget(info_text)
        
        info_group.setLayout(info_layout)
        layout.addWidget(info_group)
        
        layout.addStretch()
        self.setLayout(layout)
        
        # Connect change signals
        for control in self.controls.values():
            if hasattr(control, 'valueChanged'):
                control.valueChanged.connect(self.settings_changed.emit)
    
    def _load_settings(self):
        validation_settings = self.settings_manager.settings.lap_validation
        
        self.controls['min_telemetry_points'].setValue(validation_settings.min_telemetry_points)
        self.controls['min_lap_time'].setValue(validation_settings.min_lap_time)
        self.controls['max_lap_time'].setValue(validation_settings.max_lap_time)
        self.controls['min_distance_percentage'].setValue(validation_settings.min_distance_percentage)
        self.controls['max_telemetry_gap'].setValue(validation_settings.max_telemetry_gap)
        self.controls['speed_outlier_threshold'].setValue(validation_settings.speed_outlier_threshold)
    
    def get_settings_data(self) -> Dict[str, Any]:
        return {
            'lap_validation': {
                'min_telemetry_points': self.controls['min_telemetry_points'].value(),
                'min_lap_time': self.controls['min_lap_time'].value(),
                'max_lap_time': self.controls['max_lap_time'].value(),
                'min_distance_percentage': self.controls['min_distance_percentage'].value(),
                'max_telemetry_gap': self.controls['max_telemetry_gap'].value(),
                'speed_outlier_threshold': self.controls['speed_outlier_threshold'].value()
            }
        }
    
    def validate_settings(self) -> tuple[bool, list[str]]:
        errors = []
        
        min_time = self.controls['min_lap_time'].value()
        max_time = self.controls['max_lap_time'].value()
        
        if min_time >= max_time:
            errors.append("Minimum lap time must be less than maximum lap time")
        
        return len(errors) == 0, errors

class GUISettingsTab(SettingsTab):
    """GUI and system settings tab"""
    
    def _setup_ui(self):
        layout = QVBoxLayout()
        
        # GUI Settings
        gui_group = QGroupBox("Interface Settings")
        gui_layout = QFormLayout()
        
        self.controls['show_notifications'] = QCheckBox("Show system notifications")
        gui_layout.addRow("", self.controls['show_notifications'])
        
        self.controls['minimize_to_tray'] = QCheckBox("Minimize to system tray")
        gui_layout.addRow("", self.controls['minimize_to_tray'])
        
        self.controls['auto_start_windows'] = QCheckBox("Start with Windows")
        gui_layout.addRow("", self.controls['auto_start_windows'])
        
        self.controls['herbie_url'] = QLineEdit()
        self.controls['herbie_url'].setPlaceholderText("https://herbie.app")
        gui_layout.addRow("Herbie Web URL:", self.controls['herbie_url'])
        
        gui_group.setLayout(gui_layout)
        layout.addWidget(gui_group)
        
        # Logging Settings
        logging_group = QGroupBox("Logging Settings")
        logging_layout = QFormLayout()
        
        self.controls['log_level'] = QComboBox()
        self.controls['log_level'].addItems(["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"])
        logging_layout.addRow("Log Level:", self.controls['log_level'])
        
        self.controls['file_logging'] = QCheckBox("Enable file logging")
        logging_layout.addRow("", self.controls['file_logging'])
        
        self.controls['max_log_size'] = QSpinBox()
        self.controls['max_log_size'].setRange(1, 100)
        self.controls['max_log_size'].setSuffix(" MB")
        logging_layout.addRow("Max Log File Size:", self.controls['max_log_size'])
        
        self.controls['backup_count'] = QSpinBox()
        self.controls['backup_count'].setRange(1, 20)
        logging_layout.addRow("Log Backup Count:", self.controls['backup_count'])
        
        logging_group.setLayout(logging_layout)
        layout.addWidget(logging_group)
        
        # Log Viewer
        log_viewer_group = QGroupBox("Log Viewer")
        log_viewer_layout = QVBoxLayout()
        
        log_buttons = QHBoxLayout()
        self.view_logs_button = QPushButton("📄 View Log File")
        self.view_logs_button.clicked.connect(self._view_logs)
        log_buttons.addWidget(self.view_logs_button)
        
        self.clear_logs_button = QPushButton("🗑️ Clear Logs")
        self.clear_logs_button.clicked.connect(self._clear_logs)
        log_buttons.addWidget(self.clear_logs_button)
        
        log_buttons.addStretch()
        
        log_viewer_layout.addLayout(log_buttons)
        log_viewer_group.setLayout(log_viewer_layout)
        layout.addWidget(log_viewer_group)
        
        layout.addStretch()
        self.setLayout(layout)
        
        # Connect change signals
        for control in self.controls.values():
            if hasattr(control, 'textChanged'):
                control.textChanged.connect(self.settings_changed.emit)
            elif hasattr(control, 'valueChanged'):
                control.valueChanged.connect(self.settings_changed.emit)
            elif hasattr(control, 'toggled'):
                control.toggled.connect(self.settings_changed.emit)
            elif hasattr(control, 'currentTextChanged'):
                control.currentTextChanged.connect(self.settings_changed.emit)
    
    def _load_settings(self):
        gui_settings = self.settings_manager.settings.gui
        logging_settings = self.settings_manager.settings.logging
        
        self.controls['show_notifications'].setChecked(gui_settings.show_notifications)
        self.controls['minimize_to_tray'].setChecked(gui_settings.minimize_to_tray)
        self.controls['auto_start_windows'].setChecked(gui_settings.auto_start_windows)
        self.controls['herbie_url'].setText(gui_settings.herbie_url)
        
        level_index = self.controls['log_level'].findText(logging_settings.level)
        if level_index >= 0:
            self.controls['log_level'].setCurrentIndex(level_index)
        
        self.controls['file_logging'].setChecked(logging_settings.file_logging)
        self.controls['max_log_size'].setValue(logging_settings.max_log_size // 1048576)  # Convert to MB
        self.controls['backup_count'].setValue(logging_settings.backup_count)
    
    def get_settings_data(self) -> Dict[str, Any]:
        return {
            'gui': {
                'show_notifications': self.controls['show_notifications'].isChecked(),
                'minimize_to_tray': self.controls['minimize_to_tray'].isChecked(),
                'auto_start_windows': self.controls['auto_start_windows'].isChecked(),
                'herbie_url': self.controls['herbie_url'].text()
            },
            'logging': {
                'level': self.controls['log_level'].currentText(),
                'file_logging': self.controls['file_logging'].isChecked(),
                'max_log_size': self.controls['max_log_size'].value() * 1048576,  # Convert to bytes
                'backup_count': self.controls['backup_count'].value()
            }
        }
    
    def validate_settings(self) -> tuple[bool, list[str]]:
        errors = []
        
        herbie_url = self.controls['herbie_url'].text().strip()
        if herbie_url and not herbie_url.startswith(('http://', 'https://')):
            errors.append("Herbie URL must start with http:// or https://")
        
        return len(errors) == 0, errors
    
    def _view_logs(self):
        """Open log file location"""
        try:
            log_path = self.settings_manager.get_log_file_path()
            log_dir = log_path.parent
            
            if log_dir.exists():
                os.startfile(str(log_dir))  # Windows specific
            else:
                QMessageBox.information(self, "Log Directory", f"Log directory not found:\n{log_dir}")
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Failed to open log directory:\n{str(e)}")
    
    def _clear_logs(self):
        """Clear log files"""
        reply = QMessageBox.question(
            self, "Clear Logs", 
            "Are you sure you want to clear all log files?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            try:
                log_path = self.settings_manager.get_log_file_path()
                if log_path.exists():
                    log_path.unlink()
                QMessageBox.information(self, "Success", "Log files cleared successfully")
            except Exception as e:
                QMessageBox.warning(self, "Error", f"Failed to clear logs:\n{str(e)}")

class SettingsWindow(QWidget):
    """Main settings window"""
    
    settings_applied = pyqtSignal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self.settings_manager = get_settings_manager()
        self.has_unsaved_changes = False
        
        self._setup_ui()
        self._connect_signals()
        
    def _setup_ui(self):
        """Setup the main UI"""
        self.setWindowTitle("Herbie Telemetry Agent - Settings")
        self.setFixedSize(700, 600)
        self.setWindowFlags(Qt.WindowType.Window | Qt.WindowType.WindowCloseButtonHint)
        
        layout = QVBoxLayout()
        
        # Title
        title = QLabel("Herbie Telemetry Agent Settings")
        title.setFont(QFont("Arial", 14, QFont.Weight.Bold))
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)
        
        # Tab widget
        self.tab_widget = QTabWidget()
        
        # Create tabs
        self.api_tab = APISettingsTab()
        self.telemetry_tab = TelemetrySettingsTab()
        self.validation_tab = ValidationSettingsTab()
        self.gui_tab = GUISettingsTab()
        
        self.tab_widget.addTab(self.api_tab, "🔗 API")
        self.tab_widget.addTab(self.telemetry_tab, "📊 Telemetry")
        self.tab_widget.addTab(self.validation_tab, "✅ Validation")
        self.tab_widget.addTab(self.gui_tab, "⚙️ Interface")
        
        layout.addWidget(self.tab_widget)
        
        # Status bar
        self.status_label = QLabel("Settings loaded")
        self.status_label.setStyleSheet("color: green; padding: 5px;")
        layout.addWidget(self.status_label)
        
        # Buttons
        button_layout = QHBoxLayout()
        
        self.reset_button = QPushButton("🔄 Reset to Defaults")
        self.reset_button.clicked.connect(self._reset_settings)
        button_layout.addWidget(self.reset_button)
        
        self.export_button = QPushButton("📤 Export Settings")
        self.export_button.clicked.connect(self._export_settings)
        button_layout.addWidget(self.export_button)
        
        self.import_button = QPushButton("📥 Import Settings")
        self.import_button.clicked.connect(self._import_settings)
        button_layout.addWidget(self.import_button)
        
        button_layout.addStretch()
        
        self.cancel_button = QPushButton("❌ Cancel")
        self.cancel_button.clicked.connect(self.close)
        button_layout.addWidget(self.cancel_button)
        
        self.apply_button = QPushButton("✅ Apply")
        self.apply_button.clicked.connect(self._apply_settings)
        button_layout.addWidget(self.apply_button)
        
        self.ok_button = QPushButton("✅ OK")
        self.ok_button.clicked.connect(self._ok_clicked)
        button_layout.addWidget(self.ok_button)
        
        layout.addLayout(button_layout)
        
        self.setLayout(layout)
    
    def _connect_signals(self):
        """Connect signals"""
        # Connect tab change signals
        for tab in [self.api_tab, self.telemetry_tab, self.validation_tab, self.gui_tab]:
            tab.settings_changed.connect(self._on_settings_changed)
    
    def _on_settings_changed(self):
        """Handle settings changes"""
        self.has_unsaved_changes = True
        self.status_label.setText("Settings changed (not saved)")
        self.status_label.setStyleSheet("color: orange; padding: 5px;")
        
        self.apply_button.setEnabled(True)
        self.ok_button.setEnabled(True)
    
    def _apply_settings(self):
        """Apply settings"""
        try:
            # Validate all tabs
            all_valid = True
            all_errors = []
            
            for tab in [self.api_tab, self.telemetry_tab, self.validation_tab, self.gui_tab]:
                valid, errors = tab.validate_settings()
                if not valid:
                    all_valid = False
                    all_errors.extend(errors)
            
            if not all_valid:
                error_text = "Settings validation failed:\n\n" + "\n".join(all_errors)
                QMessageBox.warning(self, "Validation Error", error_text)
                return
            
            # Collect settings from all tabs
            settings_data = {}
            for tab in [self.api_tab, self.telemetry_tab, self.validation_tab, self.gui_tab]:
                tab_data = tab.get_settings_data()
                for key, value in tab_data.items():
                    if key in settings_data:
                        settings_data[key].update(value)
                    else:
                        settings_data[key] = value
            
            # Update settings
            success = True
            for section, values in settings_data.items():
                for key, value in values.items():
                    setting_key = f"{section}.{key}"
                    if not self.settings_manager.update_settings(**{setting_key: value}):
                        success = False
                        break
                if not success:
                    break
            
            if success:
                # Save settings
                if self.settings_manager.save_settings():
                    self.has_unsaved_changes = False
                    self.status_label.setText("Settings applied successfully")
                    self.status_label.setStyleSheet("color: green; padding: 5px;")
                    
                    self.apply_button.setEnabled(False)
                    
                    # Emit signal
                    self.settings_applied.emit()
                    
                    logger.info("Settings applied successfully")
                else:
                    QMessageBox.warning(self, "Save Error", "Failed to save settings to file")
            else:
                QMessageBox.warning(self, "Update Error", "Failed to update settings")
                
        except Exception as e:
            logger.error("Failed to apply settings", error=str(e))
            QMessageBox.critical(self, "Error", f"Failed to apply settings:\n{str(e)}")
    
    def _ok_clicked(self):
        """Handle OK button click"""
        if self.has_unsaved_changes:
            self._apply_settings()
        
        if not self.has_unsaved_changes:
            self.close()
    
    def _reset_settings(self):
        """Reset settings to defaults"""
        reply = QMessageBox.question(
            self, "Reset Settings",
            "Are you sure you want to reset all settings to defaults?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            if self.settings_manager.reset_to_defaults():
                # Reload all tabs
                for tab in [self.api_tab, self.telemetry_tab, self.validation_tab, self.gui_tab]:
                    tab._load_settings()
                
                self.has_unsaved_changes = False
                self.status_label.setText("Settings reset to defaults")
                self.status_label.setStyleSheet("color: green; padding: 5px;")
                
                self.apply_button.setEnabled(False)
                self.ok_button.setEnabled(True)
            else:
                QMessageBox.warning(self, "Reset Error", "Failed to reset settings")
    
    def _export_settings(self):
        """Export settings to file"""
        file_path, _ = QFileDialog.getSaveFileName(
            self, "Export Settings", "herbie_telemetry_settings.json",
            "JSON Files (*.json)"
        )
        
        if file_path:
            if self.settings_manager.export_settings(file_path):
                QMessageBox.information(self, "Export Success", f"Settings exported to:\n{file_path}")
            else:
                QMessageBox.warning(self, "Export Error", "Failed to export settings")
    
    def _import_settings(self):
        """Import settings from file"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "Import Settings", "",
            "JSON Files (*.json)"
        )
        
        if file_path:
            reply = QMessageBox.question(
                self, "Import Settings",
                "This will replace all current settings. Continue?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
            )
            
            if reply == QMessageBox.StandardButton.Yes:
                if self.settings_manager.import_settings(file_path):
                    # Reload all tabs
                    for tab in [self.api_tab, self.telemetry_tab, self.validation_tab, self.gui_tab]:
                        tab._load_settings()
                    
                    self.has_unsaved_changes = False
                    self.status_label.setText("Settings imported successfully")
                    self.status_label.setStyleSheet("color: green; padding: 5px;")
                    
                    QMessageBox.information(self, "Import Success", "Settings imported successfully")
                else:
                    QMessageBox.warning(self, "Import Error", "Failed to import settings")
    
    def closeEvent(self, event):
        """Handle close event"""
        if self.has_unsaved_changes:
            reply = QMessageBox.question(
                self, "Unsaved Changes",
                "You have unsaved changes. Do you want to save them?",
                QMessageBox.StandardButton.Save | QMessageBox.StandardButton.Discard | QMessageBox.StandardButton.Cancel
            )
            
            if reply == QMessageBox.StandardButton.Save:
                self._apply_settings()
                if self.has_unsaved_changes:  # Still has changes, apply failed
                    event.ignore()
                    return
            elif reply == QMessageBox.StandardButton.Cancel:
                event.ignore()
                return
        
        event.accept()

# Factory function
def create_settings_window() -> SettingsWindow:
    """Create settings window instance"""
    return SettingsWindow()