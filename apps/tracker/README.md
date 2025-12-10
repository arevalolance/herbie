# Herbie Telemetry Agent

A professional Windows telemetry agent for collecting rFactor 2 telemetry data and sending it to the Herbie backend API.

## Overview

The Herbie Telemetry Agent is a complete rewrite of the original POC tracker, designed as a production-ready Windows application that:

- Runs silently in the system tray
- Automatically detects rFactor 2 sessions
- Validates telemetry data comprehensively before upload
- Provides a professional GUI for configuration and monitoring
- Handles errors gracefully with retry logic and offline queuing

## Architecture

### Core Components

- **`telemetry_collector.py`**: Main telemetry collection and processing engine
- **`api_client.py`**: HTTP client with comprehensive retry logic and error handling
- **`lap_validator.py`**: Robust lap validation system with multiple quality checks
- **`settings_manager.py`**: Pydantic-based configuration management
- **`tray_gui.py`**: PyQt6-based system tray interface
- **`settings_window.py`**: Comprehensive settings configuration GUI
- **`telemetry_agent.py`**: Main application orchestrator

### Key Features

#### 🔍 Robust Lap Validation
- **Minimum Points Threshold**: Ensures complete data (100+ points per lap)
- **Duration Validation**: Realistic lap times (30s-300s configurable)
- **Distance Validation**: Minimum track coverage (80% configurable)
- **Data Quality Checks**: No gaps >2 seconds in telemetry
- **Outlier Detection**: Filters invalid speed/position data

#### 🌐 Complete API Integration
- **7-Step Workflow**: Sessions → Vehicles → Laps → Timing → Data → Summary → Conditions
- **Batch Processing**: Efficient bulk telemetry submission
- **Error Handling**: Exponential backoff with comprehensive retry logic
- **Offline Mode**: Local queuing when backend unavailable
- **Rate Limiting**: Respects API limits and prevents flooding

#### 🖥️ Professional GUI
- **System Tray**: Unobtrusive background operation
- **Status Indicators**: Real-time connection and collection status
- **Launch Herbie**: Direct link to web application
- **Settings Management**: Complete configuration interface
- **Auto-start**: Optional Windows startup integration

## Quick Start

### For End Users (Windows Executable)

1. **Download**: Get `HerbieTelemetryAgent.exe` from releases
2. **Install**: Copy to desired location
3. **Run**: Double-click the executable
4. **Configure**: Right-click system tray icon → Settings
5. **Setup**: Enter your Herbie user ID and API endpoint

### For Developers

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Development Run**:
   ```bash
   python herbie_agent_launcher.py
   ```

3. **Build Windows Executable**:
   ```bash
   python build_windows.py
   ```

## Project Structure

```
apps/tracker/
├── herbie_agent/              # Main application package
│   ├── telemetry_agent.py     # Application entry point
│   ├── telemetry_collector.py # Core collection engine
│   ├── api_client.py          # HTTP API client
│   ├── lap_validator.py       # Validation system
│   ├── settings_manager.py    # Configuration management
│   ├── tray_gui.py           # System tray interface
│   ├── settings_window.py    # Settings GUI
│   └── utils.py              # Shared utilities
├── tracker/                   # Original rF2 integration (POC)
├── assets/                    # Application assets
├── requirements.txt           # Python dependencies
├── build_windows.py          # Build script
├── herbie_agent_launcher.py  # Development launcher
└── README.md                 # This file
```

## Key Improvements Over POC

| Feature | POC | Herbie Agent |
|---------|-----|--------------|
| **Storage** | CSV files | Direct API integration |
| **Validation** | Basic time check | Comprehensive 6-layer validation |
| **Interface** | Console only | Professional Windows GUI |
| **Error Handling** | Basic | Exponential backoff + offline queue |
| **Configuration** | Hardcoded | User-configurable with GUI |
| **Reliability** | Script-level | Production service-level |
| **Monitoring** | Print statements | Structured logging + metrics |

## System Tray Interface

- **🚀 Launch Herbie**: Opens web application
- **▶️ Start/Stop Collection**: Control telemetry gathering
- **📊 Show Status**: Detailed performance metrics
- **⚙️ Settings**: Configuration interface
- **Status Colors**: Gray (stopped), Yellow (connected), Green (collecting), Red (error)

## Settings Categories

### 🔗 API Settings
- Base URL and user authentication
- Timeout and retry configuration
- Batch processing options

### 📊 Telemetry Settings
- Collection intervals and rF2 integration
- Auto-start and process detection
- Access mode configuration

### ✅ Validation Settings
- Lap quality thresholds
- Data completeness requirements
- Outlier detection parameters

### ⚙️ Interface Settings
- Notification preferences
- Auto-start with Windows
- Logging configuration

## Troubleshooting

### Common Issues

- **Agent Won't Start**: Check dependencies with `pip install -r requirements.txt`
- **rFactor 2 Not Detected**: Ensure shared memory is enabled in rF2
- **API Connection Issues**: Verify endpoint URL and network connectivity
- **Validation Failures**: Adjust thresholds in validation settings

### Log Files
Located at: `%APPDATA%\Herbie\HerbieTelemetryAgent\logs\herbie_agent.log`

## Development

The agent follows modern Python practices:
- **Async/Await**: Non-blocking operations
- **Type Hints**: Full type safety
- **Pydantic**: Settings validation
- **Structured Logging**: JSON-formatted logs
- **Error Resilience**: Comprehensive exception handling
- **Performance Monitoring**: Built-in metrics collection

---

**Version**: 1.0.0  
**Compatibility**: Windows 10/11, rFactor 2  
**License**: Part of Herbie telemetry platform