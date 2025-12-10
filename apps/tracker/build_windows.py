"""
Enhanced build script for creating Windows executable of Herbie Telemetry Agent
"""

import PyInstaller.__main__
import os
import sys
import shutil
import subprocess
from pathlib import Path

def check_dependencies():
    """Check if all required dependencies are available"""
    required_packages = [
        'PyQt6', 'pystray', 'httpx', 'pydantic', 'structlog', 
        'pillow', 'appdirs', 'psutil', 'orjson'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"Missing required packages: {', '.join(missing_packages)}")
        print("Please install them with: pip install -r requirements.txt")
        return False
    
    return True

def clean_build_directories():
    """Clean previous build artifacts"""
    directories_to_clean = ['build', 'dist', '__pycache__']
    
    for directory in directories_to_clean:
        if os.path.exists(directory):
            print(f"Cleaning {directory}...")
            shutil.rmtree(directory)

def create_spec_file():
    """Create PyInstaller spec file for advanced configuration"""
    current_dir = Path(__file__).parent
    
    spec_content = f'''
# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['{current_dir / "herbie_agent_launcher.py"}'],
    pathex=['{current_dir}'],
    binaries=[],
    datas=[
        ('{current_dir / "assets"}', 'assets'),
        ('{current_dir / "tracker"}', 'tracker'),
    ],
    hiddenimports=[
        'PyQt6.QtCore',
        'PyQt6.QtGui', 
        'PyQt6.QtWidgets',
        'PyQt6.sip',
        'pystray',
        'httpx',
        'pydantic',
        'structlog',
        'pillow',
        'appdirs',
        'psutil',
        'orjson',
        'asyncio',
        'threading',
        'json',
        'pathlib',
        'dataclasses',
        'enum',
        'typing',
        'abc',
        'functools',
        'time',
        'datetime',
        'ctypes',
        'sys',
        'os',
        'signal',
    ],
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='HerbieTelemetryAgent',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='{current_dir / "assets" / "icon.ico"}' if (current_dir / "assets" / "icon.ico").exists() else None,
    version_file=None,
)
'''
    
    spec_file = current_dir / "herbie_agent.spec"
    with open(spec_file, 'w') as f:
        f.write(spec_content)
    
    return spec_file

def build_windows_executable():
    """Build Windows executable using PyInstaller"""
    
    print("=" * 60)
    print("Building Herbie Telemetry Agent for Windows")
    print("=" * 60)
    
    # Check dependencies
    print("\\n1. Checking dependencies...")
    if not check_dependencies():
        return False
    print("✅ All dependencies found")
    
    # Clean build directories
    print("\\n2. Cleaning build directories...")
    clean_build_directories()
    print("✅ Build directories cleaned")
    
    # Create spec file
    print("\\n3. Creating PyInstaller spec file...")
    spec_file = create_spec_file()
    print(f"✅ Spec file created: {spec_file}")
    
    # Build executable
    print("\\n4. Building executable...")
    try:
        PyInstaller.__main__.run([
            str(spec_file),
            "--clean",
            "--noconfirm",
        ])
        print("✅ Build completed successfully!")
    except Exception as e:
        print(f"❌ Build failed: {e}")
        return False
    
    # Verify build
    print("\\n5. Verifying build...")
    exe_path = Path("dist") / "HerbieTelemetryAgent.exe"
    if exe_path.exists():
        size_mb = exe_path.stat().st_size / (1024 * 1024)
        print(f"✅ Executable created: {exe_path}")
        print(f"✅ File size: {size_mb:.1f} MB")
        
        # Create installer info
        create_installer_info()
        
        return True
    else:
        print("❌ Executable not found in dist directory")
        return False

def create_installer_info():
    """Create installation instructions"""
    info_content = '''
# Herbie Telemetry Agent - Installation Guide

## What you've built:
- **HerbieTelemetryAgent.exe**: Complete Windows application
- **Self-contained**: No additional installations required
- **System Tray**: Runs in Windows system tray

## Installation:
1. Copy HerbieTelemetryAgent.exe to your desired location
2. Create a desktop shortcut (optional)
3. Run the executable to start the agent

## First-time setup:
1. Right-click the system tray icon
2. Click "Settings" to configure:
   - Your Herbie user ID
   - API endpoint URL
   - Collection preferences
3. Ensure rFactor 2 is installed and configured

## Usage:
- The agent automatically detects rFactor 2 sessions
- Telemetry data is validated and uploaded to Herbie
- Right-click tray icon for controls and status
- Double-click tray icon to view detailed status

## Auto-start (optional):
- Enable "Start with Windows" in settings
- Or add to Windows startup folder

## Troubleshooting:
- Check the log files in %APPDATA%\\Herbie\\HerbieTelemetryAgent\\logs
- Verify rFactor 2 shared memory is enabled
- Check network connectivity to Herbie API

For support, visit the Herbie documentation or GitHub repository.
'''
    
    with open("dist/INSTALLATION.md", "w") as f:
        f.write(info_content)
    
    print("✅ Installation guide created: dist/INSTALLATION.md")

def create_development_launcher():
    """Create development launcher for testing"""
    launcher_content = '''@echo off
echo Starting Herbie Telemetry Agent (Development Mode)
echo ================================================
python herbie_agent_launcher.py
pause
'''
    
    with open("run_dev.bat", "w") as f:
        f.write(launcher_content)
    
    print("✅ Development launcher created: run_dev.bat")

def main():
    """Main build function"""
    try:
        # Create development launcher
        create_development_launcher()
        
        # Build Windows executable
        success = build_windows_executable()
        
        if success:
            print("\\n" + "=" * 60)
            print("🎉 BUILD SUCCESSFUL!")
            print("=" * 60)
            print("Your Windows executable is ready in the 'dist' directory.")
            print("\\nNext steps:")
            print("1. Test the executable: dist/HerbieTelemetryAgent.exe")
            print("2. Read installation guide: dist/INSTALLATION.md")
            print("3. Distribute to Windows users")
            print("\\nFor development testing, use: run_dev.bat")
        else:
            print("\\n" + "=" * 60)
            print("❌ BUILD FAILED!")
            print("=" * 60)
            print("Check the error messages above and fix any issues.")
            
        return 0 if success else 1
        
    except KeyboardInterrupt:
        print("\\n❌ Build interrupted by user")
        return 1
    except Exception as e:
        print(f"\\n❌ Unexpected error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())