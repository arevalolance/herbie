# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Herbie is a racing telemetry analysis application that consists of:

1. **Python Tracker (`apps/tracker/`)**: Connects to rFactor 2 racing simulator to collect telemetry data and save it as CSV files
2. **Next.js Web App (`apps/web/`)**: Displays and analyzes the collected telemetry data with interactive charts and visualizations
3. **Shared UI Components (`packages/ui/`)**: shadcn/ui-based component library used across applications

The system captures detailed racing telemetry (engine, brakes, tires, suspension, etc.) from rFactor 2 and stores it in a PostgreSQL database for analysis.

**Key Features:**
- Real-time telemetry collection from rFactor 2 shared memory
- Comprehensive racing data analysis with 15+ telemetry categories
- Interactive lap comparison and performance visualization
- Track map visualization with racing line analysis
- User authentication and session management

## Development Commands

### Root Level Commands
```bash
# Install dependencies
pnpm install

# Start all applications in development mode
pnpm dev

# Build all applications
pnpm build

# Lint all applications
pnpm lint

# Format code across the entire monorepo
pnpm format
```

### Web App Commands (`apps/web/`)
```bash
# Start development server with turbopack
cd apps/web && pnpm dev

# Build the application (includes Prisma generation)
cd apps/web && pnpm build

# Run type checking
cd apps/web && pnpm typecheck

# Lint and fix code
cd apps/web && pnpm lint:fix

# Generate Prisma client
cd apps/web && prisma generate

# Seed database from CSV files
cd apps/web && pnpm seed:csv
```

### Python Tracker (`apps/tracker/`)
```bash
# Setup environment and install dependencies
cd apps/tracker && uv sync

# Run the telemetry tracker
cd apps/tracker && uv run python -m tracker.main

# Or using the CLI script
cd apps/tracker && uv run tracker

# Add a dependency
cd apps/tracker && uv add <package>

# Update dependencies
cd apps/tracker && uv lock --upgrade

# On Windows: Install rFactor 2 shared memory dependency
cd apps/tracker && uv pip install ../../../pyRfactor2SharedMemory
```

## Architecture

### Data Flow
1. **Telemetry Collection**: Python tracker connects to rFactor 2's shared memory and collects real-time telemetry data
2. **CSV Export**: Data is automatically saved to CSV files per lap in `apps/tracker/tracker/telemetry_logs/`
3. **Database Import**: CSV data is imported into PostgreSQL using the seed script
4. **Web Visualization**: Next.js app queries database and displays telemetry with interactive charts

### Database Schema
The PostgreSQL database contains comprehensive racing telemetry tables:
- `telemetry_logs`: Core telemetry data with position, speed, inputs, etc. (BigInt IDs for performance)
- `laps`: Lap information with timing and session details
- `sessions`: Race session metadata
- `lap_summary`: Pre-calculated lap statistics for performance
- `lap_comparisons`: User-created lap comparison sets
- Detailed component data: `brake_data`, `engine_data`, `tyre_data`, `wheel_data`, `input_data`, `switch_states`, `vehicle_state`
- Performance tables: `timing_data`, `tyre_temperature_detail`, `session_conditions`

### Authentication
- Uses WorkOS AuthKit for authentication
- User management through `users` table
- Environment variables: `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_COOKIE_PASSWORD`

### Key Technologies
- **Frontend**: Next.js 15, React 19, TypeScript, shadcn/ui, Recharts for data visualization
- **Backend**: Prisma ORM with PostgreSQL, Server Actions for mutations
- **Monorepo**: pnpm workspace with Turbo for build orchestration
- **Python**: rFactor 2 shared memory integration for telemetry collection
- **Styling**: Tailwind CSS v4 with CSS-in-JS support
- **Development**: Turbopack for fast dev builds, react-scan for performance monitoring

### Component Architecture
- `packages/ui/`: Shared component library using shadcn/ui
- `apps/web/components/`: App-specific components including metrics visualization
- Chart components use Recharts for telemetry data visualization
- Track map visualization in `components/metrics/track-map.tsx`

## Environment Setup
Requires:
- Node.js >=20
- pnpm 10.4.1+
- PostgreSQL database
- rFactor 2 for telemetry collection

Essential environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_COOKIE_PASSWORD`: Authentication

## Important File Locations
- **Python Telemetry Data**: `apps/tracker/tracker/telemetry_logs/` - CSV files generated per lap
- **Prisma Schema**: `apps/web/prisma/schema.prisma` - Complete database schema
- **Database Seed Script**: `apps/web/scripts/seed-csv.ts` - Imports CSV data to PostgreSQL
- **Component Library**: `packages/ui/src/components/` - Shared UI components
- **Track Map Component**: `apps/web/components/metrics/track-map.tsx` - Custom track visualization
- **Generated Prisma Client**: `apps/web/generated/prisma/` - Auto-generated database client

## Common Workflows
- **Adding new telemetry data**: Modify Python tracker, update CSV structure, adjust Prisma schema, regenerate client
- **Adding UI components**: Add to `packages/ui/src/components/`, export from index, use in web app
- **Database changes**: Update Prisma schema, run `prisma generate`, update seed script if needed
- **Performance optimization**: Check indexes in schema, use `lap_summary` for aggregated data
- Never use `any` type