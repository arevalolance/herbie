# Herbie Tracker Usage Guide

## Running with UV

UV is configured to run the tracker commands through `pyproject.toml` scripts.

### Available Commands

#### 1. Snapshot CSV Tracker (NEW - Recommended for Windows)
Collects tick-aligned telemetry and exports to 2 CSVs per lap.

```bash
cd apps/tracker
uv run herbie-tracker-snapshot
```

**Exports:**
- `lap_X_physics.csv` - High-frequency physics data (~90Hz)
- `lap_X_scoring.csv` - Low-frequency scoring data (~5Hz)

**Perfect for:**
- Windows development (collect on Windows, import on Mac)
- Tick-aligned data from the source
- 85% smaller than old format

#### 2. Legacy CSV Tracker (Old Format)
Collects telemetry and saves to 11 separate CSVs per lap.

```bash
cd apps/tracker
uv run herbie-tracker
```

**Exports:** `lap_X_brake.csv`, `lap_X_tyre.csv`, `lap_X_wheel.csv`, etc.

#### 3. Snapshot Collector (Real-time to Convex)
Real-time collection with direct Convex upload (no CSV).

```bash
cd apps/tracker
uv run snapshot-collector
```

**Features:**
- Separates 90Hz physics data from 5Hz scoring data
- Smart change detection for scoring snapshots
- Direct upload to Convex (no CSV intermediary)
- Requires Convex client setup

#### 4. Import Telemetry from CSV
Import existing CSV files into Convex database.

```bash
cd apps/tracker
uv run import-telemetry \
  --user-id <USER_ID> \
  --logs-dir tracker/telemetry_logs \
  --convex-url https://your-deployment.convex.cloud \
  --admin-key <TOKEN>
```

**Auto-detects format:**
- Snapshot format: `lap_X_physics.csv` + `lap_X_scoring.csv`
- Legacy format: `lap_X_brake.csv`, `lap_X_tyre.csv`, etc.

#### 5. Herbie Agent (Full UI)
Complete GUI application with system tray.

```bash
cd apps/tracker
uv run herbie-agent
```

## Development Commands

### Install Dependencies
```bash
cd apps/tracker
uv sync
```

### Run Tests
```bash
cd apps/tracker
uv run pytest
```

### Format Code
```bash
cd apps/tracker
uv run black .
```

## Architecture Comparison

### Old Approach (CSV-based)
```
rF2 → Collector → CSV Files → Import Script → Database
      (merged)    (7 files)   (batch)         (7 tables)
```

**Issues:**
- Temporal misalignment (90Hz + 5Hz merged)
- Redundant scoring data (18x duplication)
- Manual CSV import step

### New Approach (Snapshot-based)
```
rF2 Telemetry (~90Hz) → Physics Samples → physicsSamples table
rF2 Scoring (~5Hz)    → Scoring Snapshots → scoringSnapshots table
                        (only on changes)
```

**Benefits:**
- ✅ Tick-aligned data collection
- ✅ 85% storage reduction
- ✅ Real-time upload to Convex
- ✅ No temporal misalignment

## Configuration

### For Snapshot Collector

Edit or create configuration in your code:

```python
from herbie_agent.snapshot_collector import SnapshotTelemetryCollector

# Configure batch sizes
collector = SnapshotTelemetryCollector(convex_client)
collector.physics_batch_size = 100  # ~1 sec at 90Hz
collector.scoring_batch_size = 20   # ~4 sec at 5Hz

# Start collection
await collector.start()
```

### For Import Script

Environment variables:
```bash
export CONVEX_ADMIN_KEY=your_admin_key
export CONVEX_URL=https://your-deployment.convex.cloud
```

Or pass as arguments:
```bash
uv run import-telemetry \
  --admin-key $CONVEX_ADMIN_KEY \
  --convex-url $CONVEX_URL \
  --user-id <USER_ID> \
  --logs-dir tracker/telemetry_logs
```

## Troubleshooting

### "No module named 'pyRfactor2SharedMemory'"

On Windows, install the rF2 shared memory library:
```bash
cd apps/tracker
uv pip install ../../../pyRfactor2SharedMemory
```

### "Failed to connect to rFactor 2"

Ensure:
1. rFactor 2 is running
2. You're in a session (not main menu)
3. Shared memory is enabled in rF2 settings

### Collection seems slow

Check your collection interval and batch sizes:
- Physics should collect ~90 samples/second
- Scoring should snapshot ~5 times/second (or when changed)

Use `uv run snapshot-collector` with debug logging to verify rates.

## Migration from Old to New

### Step 1: Test with Existing Data
```bash
# Import your existing CSV files with new schema
uv run import-telemetry \
  --user-id <USER_ID> \
  --logs-dir tracker/telemetry_logs \
  --convex-url $CONVEX_URL
```

### Step 2: Try New Collector
```bash
# Run new snapshot collector
uv run snapshot-collector
```

### Step 3: Compare Results
- Check Convex dashboard for data
- Verify physicsSamples has ~90 rows/second
- Verify scoringSnapshots has ~5 rows/second
- Compare storage usage

### Step 4: Update Production
Once validated, integrate `SnapshotTelemetryCollector` into your production code.

## Performance Metrics

Expected rates per 90-second lap:

| Metric | Old (CSV) | New (Snapshot) |
|--------|-----------|----------------|
| Total rows | ~6,300 | ~950 |
| Physics samples | N/A | ~900 (90Hz × 10s) |
| Scoring snapshots | N/A | ~50 (5Hz avg) |
| Storage reduction | - | **85%** |
| Upload latency | Batch (post-lap) | Real-time |

## Next Steps

1. ✅ Test import script with existing CSVs
2. ✅ Run snapshot collector in test session
3. ✅ Verify data in Convex dashboard
4. 🔄 Integrate into production agent
5. 🔄 Update dashboard queries for new schema

See `SCHEMA_REFACTOR_NOTES.md` for complete technical details.
