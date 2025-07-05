# Turborepo Integration Guide

The Herbie Telemetry Agent is now fully integrated with your Turborepo setup! Here's how to use it:

## 🚀 Quick Commands

### Development (Both Apps)
```bash
# Start both web app and telemetry agent
pnpm dev

# Start only web app
pnpm dev:web

# Start only telemetry agent
pnpm dev:tracker
```

### Installation
```bash
# Install all dependencies (Node.js + Python)
pnpm install

# Check if tracker dependencies are installed
pnpm check:tracker
```

### Building
```bash
# Build everything (web + tracker executable)
pnpm build

# Build only tracker
pnpm build:tracker
```

## 📋 How It Works

### `pnpm install`
1. Installs Node.js dependencies normally
2. Automatically runs `pnpm setup:tracker` 
3. Installs Python dependencies from `requirements.txt`
4. Validates all dependencies are available

### `pnpm dev`
1. Starts the Next.js web app (as usual)
2. Starts the Herbie Telemetry Agent in development mode
3. Both run concurrently with live reload

### `pnpm build`
1. Builds the Next.js app for production
2. Creates `HerbieTelemetryAgent.exe` Windows executable
3. Ready for deployment

## 🔧 Turborepo Configuration

### Updated Files

**`turbo.json`**:
- Added `install`, `setup`, `check-deps` tasks
- Added `dist/**` to build outputs
- Configured tasks to not cache for Python operations

**`package.json` (root)**:
- Added `setup:tracker` script for Python dependencies
- Added convenience scripts for web/tracker development
- Added dependency checking

**`apps/tracker/package.json`**:
- Full npm-style scripts for all tracker operations
- Integrated with Turborepo task system
- Cross-platform script definitions

## 🎯 Development Workflow

### First-time Setup
```bash
git clone <your-repo>
pnpm install  # Installs everything automatically
```

### Daily Development
```bash
# Start everything
pnpm dev

# Or start individually
pnpm dev:web      # Just Next.js
pnpm dev:tracker  # Just Python agent
```

### Building for Production
```bash
pnpm build        # Builds web app + Windows executable
```

### Checking Status
```bash
pnpm check:tracker  # Verify Python dependencies
```

## 📁 What Runs Where

### Web App (`apps/web/`)
- Next.js development server
- Runs on `http://localhost:3000`
- Hot reload for TypeScript/React changes

### Tracker (`apps/tracker/`)
- Python telemetry agent
- System tray application on Windows
- Auto-connects to web app API

## 🔄 Integration Benefits

1. **Single Command**: `pnpm dev` starts everything
2. **Unified Dependencies**: `pnpm install` handles both ecosystems
3. **Consistent Tooling**: Same commands work across the monorepo
4. **Turborepo Caching**: Faster builds and better dependency management
5. **Cross-Platform**: Works on development machines, builds for Windows

## 🛠️ Available Scripts

### Root Level
```bash
pnpm dev              # Start both apps
pnpm build            # Build both apps
pnpm dev:web          # Web app only
pnpm dev:tracker      # Tracker only
pnpm build:tracker    # Build Windows executable
pnpm check:tracker    # Validate Python setup
pnpm setup:tracker    # Install Python dependencies
```

### Tracker Specific (`apps/tracker/`)
```bash
pnpm dev              # Start telemetry agent
pnpm build            # Build Windows executable
pnpm install          # Install Python dependencies
pnpm lint             # Lint Python code
pnpm test             # Run Python tests
pnpm clean            # Clean build artifacts
```

## 📋 Prerequisites

- **Node.js**: >=20 (for web app)
- **Python**: >=3.9 (for tracker)
- **pnpm**: 10.4.1+ (for package management)
- **Windows**: For running the telemetry agent

## 🎉 Result

You now have a **unified development experience** where:

✅ `pnpm install` installs everything (Node.js + Python)  
✅ `pnpm dev` starts both applications  
✅ `pnpm build` creates production builds  
✅ Turborepo manages the entire monorepo efficiently  
✅ Python telemetry agent integrates seamlessly with Next.js backend

The telemetry agent runs as a professional Windows application while your web app provides the analysis interface - all managed through your existing Turborepo workflow! 🏁