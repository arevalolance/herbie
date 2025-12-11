# Schema Refactor: Tick Rate Alignment

## Problem Identified

The original schema merged data from rFactor 2's three separate shared memory buffers with different update frequencies:

1. **rF2Telemetry** (~90Hz) - Physics data
2. **rF2Scoring** (~5Hz) - Lap times, positions
3. **rF2Extended** (variable) - Session conditions

Storing all data in the same row created **temporal misalignment** - engine RPM, lap times, and session conditions weren't captured at the same instant.

## Solution: Snapshot Architecture

Separated data into two tables based on actual update frequencies:

### `physicsSamples` (HIGH-FREQUENCY ~90Hz)
**Source:** `rF2VehicleTelemetry` structure
**Written:** Every collection sample

Contains:
- Brake data (pressure, temperature)
- Tyre data (temperature, pressure, wear, load)
- Wheel & suspension (camber, ride height, deflection)
- Engine & powertrain (RPM, torque, gear)
- Electric motor (battery, motor state)
- Driver inputs (throttle, brake, steering)
- Vehicle dynamics (position, velocity, acceleration)
- Fuel & damage
- Track position

**Indexes:**
- `by_lap_time` - Query by lap + time
- `by_lap` - Get all samples for a lap

### `scoringSnapshots` (LOW-FREQUENCY ~5Hz)
**Source:** `rF2VehicleScoring` + `rF2ScoringInfo` structures
**Written:** Only when data changes (sector complete, lap complete, position change, periodic)

Contains:
- Timing data (lap times, sector times, deltas)
- Lap progress (sector, track length)
- Vehicle state from scoring (place, in pits, finish state)
- Session state (flags, weather, session time)
- Switches (rarely change despite being technically 90Hz)

**Indexes:**
- `by_lap_time` - Query by lap + time
- `by_lap` - Get all snapshots for a lap
- `by_lap_trigger` - Query by specific trigger events

## Benefits

1. ✅ **Temporal Accuracy** - Data captured at correct tick rates
2. ✅ **Storage Efficiency** - ~18x less data for scoring fields (90 samples vs 5)
3. ✅ **Query Flexibility** - Join by timestamp when needed
4. ✅ **Matches rF2 Architecture** - Aligns with actual shared memory buffers
5. ✅ **Performance** - Less write overhead for slow-changing data

## Next Steps

### 1. Update Python Collector (`telemetry_collector.py`)

Current code merges everything into one dict. Need to split:

```python
# HIGH-FREQUENCY: Collect every sample (~90Hz)
def _collect_physics_sample(self):
    tele_veh = self.rf2_sim.info.rf2TeleVeh()
    return {
        'sample_time': tele_veh.mElapsedTime,
        'brake_bias_front': ...,
        'engine_rpm': ...,
        # ... all physics fields
    }

# LOW-FREQUENCY: Collect only when changed (~5Hz)
def _collect_scoring_snapshot(self, trigger: str):
    scor_veh = self.rf2_sim.info.rf2ScorVeh()
    scor_info = self.rf2_sim.info.rf2ScorInfo

    # Only call when trigger occurs (sector/lap complete, etc)
    return {
        'snapshot_time': scor_veh.mElapsedTime,
        'update_trigger': trigger,
        'behind_leader': ...,
        # ... all scoring fields
    }
```

### 2. Update API Client

Modify `api_client.py` to have separate endpoints:
- `insert_physics_samples()` - Batch insert high-freq data
- `insert_scoring_snapshot()` - Single snapshot insert

### 3. Create Convex Mutations

```typescript
// convex/telemetry.ts
export const insertPhysicsSamples = mutation({
  args: {
    lapId: v.id("laps"),
    samples: v.array(v.object({ /* physics fields */ }))
  },
  handler: async (ctx, { lapId, samples }) => {
    // Bulk insert physics samples
  }
});

export const insertScoringSnapshot = mutation({
  args: {
    lapId: v.id("laps"),
    snapshot: v.object({ /* scoring fields */ })
  },
  handler: async (ctx, { lapId, snapshot }) => {
    // Insert single scoring snapshot
  }
});
```

### 4. Update Queries

When analyzing, join tables by timestamp:

```typescript
// Get lap data with nearest scoring snapshot
const physicsSamples = await ctx.db
  .query("physicsSamples")
  .withIndex("by_lap", q => q.eq("lapId", lapId))
  .collect();

const scoringSnapshots = await ctx.db
  .query("scoringSnapshots")
  .withIndex("by_lap", q => q.eq("lapId", lapId))
  .collect();

// Join by finding nearest snapshot for each physics sample
const enrichedData = physicsSamples.map(sample => {
  const nearestSnapshot = findNearest(scoringSnapshots, sample.sampleTime);
  return { ...sample, scoring: nearestSnapshot };
});
```

## Migration Strategy

1. Deploy new schema alongside old tables
2. Update collector to write to both (temporarily)
3. Verify data quality in new tables
4. Switch queries to new tables
5. Archive/delete old tables after validation period

## Field Mapping Reference

### From Old Schema → New Schema

**Old `chassisData`** → `physicsSamples` (all fields)
**Old `powertrainData`** → `physicsSamples` (all fields)
**Old `inputsData`** → `physicsSamples` (all fields)
**Old `vehicleStateData`** → Split:
  - Position/velocity/acceleration → `physicsSamples`
  - place/inPits/finishState → `scoringSnapshots`

**Old `timingData`** → `scoringSnapshots` (all fields)
**Old `sessionData`** → `scoringSnapshots` (all fields)
**Old `lapProgressData`** → Split:
  - distance/progress → `physicsSamples`
  - sectorIndex/trackLength → `scoringSnapshots`

## Python Collector Implementation

### New Snapshot Collector

Created `herbie_agent/snapshot_collector.py` - tick-aligned collector:

**Key Features:**
- **Separate collection methods:**
  - `_collect_physics_sample()` - Called ~90Hz, collects from rF2Telemetry
  - `_collect_scoring_snapshot()` - Only when data changes, from rF2Scoring

- **Change detection:**
  - Tracks scoring state (sector, lap time, position)
  - Only creates snapshots when data actually changes
  - Periodic fallback ensures ~5Hz minimum

- **Batch uploads:**
  - Physics: 100 samples (~1 sec at 90Hz)
  - Scoring: 20 snapshots (~4 sec at 5Hz)

- **Update triggers:**
  - `sector_complete` - Sector index changed
  - `lap_complete` - Lap time updated
  - `position_change` - Race position changed
  - `periodic` - Timed fallback (1 second)

### Migration from Old Collector

Old collector (`telemetry_collector.py`):
- Merged all data in `_collect_telemetry_point()`
- Stored in buffers by data type
- Exported to CSV files

New collector (`snapshot_collector.py`):
- Separates physics and scoring collection
- Detects scoring changes before collecting
- Uploads directly to Convex (no CSV intermediary)

### Usage Example

```python
from herbie_agent.snapshot_collector import SnapshotTelemetryCollector

# Create with Convex client
collector = SnapshotTelemetryCollector(convex_client)

# Initialize and start
await collector.initialize()
await collector.start()

# Stop and flush
await collector.stop()
```

See `examples/snapshot_collector_example.py` for complete usage.

## Testing Checklist

- [ ] Schema validates in Convex
- [ ] Python collector writes to both tables
- [ ] Verify physicsSamples has ~90 samples per second
- [ ] Verify scoringSnapshots has ~5 snapshots per second (only on changes)
- [ ] Query performance acceptable
- [ ] Charts/visualizations work with new structure
- [ ] No data loss during collection
- [ ] Lap transitions flush buffers correctly
- [ ] Change detection triggers snapshots appropriately
