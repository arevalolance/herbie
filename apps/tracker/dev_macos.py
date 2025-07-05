#!/usr/bin/env python3
"""
macOS Development Fallback for Herbie Telemetry Agent

This script provides a development mode that works on macOS when the full
Windows GUI application cannot run.
"""

import sys
import os
import time
from pathlib import Path

def main():
    """Main development function for macOS"""
    print("🍎 Herbie Telemetry Agent - macOS Development Mode")
    print("=" * 50)
    print()
    
    # Check if we're on macOS
    if sys.platform != "darwin":
        print("This script is designed for macOS development only.")
        print("Use the regular launcher for other platforms.")
        return 1
    
    print("ℹ️  Note: This is a development fallback for macOS.")
    print("   The full GUI application is designed for Windows.")
    print()
    
    # Check Python dependencies
    print("🔍 Checking Python dependencies...")
    
    required_packages = [
        'httpx', 'pydantic', 'structlog', 'appdirs', 'psutil', 'orjson'
    ]
    
    missing_packages = []
    available_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
            available_packages.append(package)
        except ImportError:
            missing_packages.append(package)
    
    if available_packages:
        print(f"✅ Available: {', '.join(available_packages)}")
    
    if missing_packages:
        print(f"❌ Missing: {', '.join(missing_packages)}")
        print("   Install with: pip3 install -r requirements.txt")
    else:
        print("✅ All core dependencies available!")
    
    # Check GUI dependencies (expected to fail on macOS without special setup)
    print()
    print("🖥️  Checking GUI dependencies (Windows-specific)...")
    
    gui_packages = ['PyQt6', 'pystray']
    gui_available = []
    gui_missing = []
    
    for package in gui_packages:
        try:
            __import__(package)
            gui_available.append(package)
        except ImportError:
            gui_missing.append(package)
    
    if gui_available:
        print(f"✅ Available: {', '.join(gui_available)}")
    
    if gui_missing:
        print(f"⚠️  Missing GUI packages: {', '.join(gui_missing)}")
        print("   These are Windows-specific and not required for development")
    
    print()
    print("🔧 Development Environment Status:")
    print(f"   Platform: {sys.platform}")
    print(f"   Python: {sys.version}")
    print(f"   Working Directory: {os.getcwd()}")
    
    # Try to import and test core components
    print()
    print("🧪 Testing Core Components...")
    
    try:
        # Add the current directory to Python path
        current_dir = Path(__file__).parent
        sys.path.insert(0, str(current_dir))
        
        # Test settings manager
        from herbie_agent.settings_manager import get_settings_manager
        settings_manager = get_settings_manager()
        print("✅ Settings Manager: OK")
        
        # Test API client creation (without actually connecting)
        from herbie_agent.api_client import HerbieAPIClient
        api_client = HerbieAPIClient()
        print("✅ API Client: OK")
        
        # Test lap validator
        from herbie_agent.lap_validator import create_lap_validator
        validator = create_lap_validator()
        print("✅ Lap Validator: OK")
        
        print()
        print("🎉 Core telemetry components are working!")
        print("   Ready for backend development and testing.")
        
    except ImportError as e:
        print(f"❌ Import Error: {e}")
        print("   Some components may need Windows-specific dependencies")
    except Exception as e:
        print(f"⚠️  Component Test Error: {e}")
    
    print()
    print("💡 Development Tips:")
    print("   • Use this for backend API development")
    print("   • Test telemetry validation logic")
    print("   • Develop settings and configuration")
    print("   • Use Windows VM/machine for full GUI testing")
    print()
    print("🚀 To start the web app: pnpm dev:web")
    print("🔧 To test on Windows: python herbie_agent_launcher.py")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())