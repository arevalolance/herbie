#!/usr/bin/env python3
"""
Herbie Telemetry Agent Launcher

Simple launcher script for the Herbie Telemetry Agent that handles
proper module imports and error handling.
"""

import sys
import os
from pathlib import Path

def main():
    """Main launcher function"""
    try:
        # Add the current directory to Python path
        current_dir = Path(__file__).parent
        sys.path.insert(0, str(current_dir))
        
        # Import and run the telemetry agent
        from herbie_agent.telemetry_agent import main as agent_main
        
        return agent_main()
        
    except ImportError as e:
        print(f"Import Error: {e}")
        print("Please ensure all dependencies are installed:")
        print("pip install -r requirements.txt")
        return 1
    except Exception as e:
        print(f"Unexpected error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())