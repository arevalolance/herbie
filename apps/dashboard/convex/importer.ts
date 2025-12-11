import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Creates a session document.
 */
export const createSession = mutation({
  args: {
    userId: v.id("users"),
    trackName: v.string(),
    vehicleName: v.string(),
    className: v.string(),
    driverName: v.string(),
    sessionType: v.number(),
    ambientTemperature: v.number(),
    trackTemperature: v.number(),
    startTime: v.number(),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("sessions", args);
  },
});

/**
 * Creates a lap document.
 */
export const createLap = mutation({
  args: {
    sessionId: v.id("sessions"),
    lapNumber: v.number(),
    lapTime: v.optional(v.number()),
    bestSector1: v.optional(v.number()),
    bestSector2: v.optional(v.number()),
    sector1Time: v.optional(v.number()),
    sector2Time: v.optional(v.number()),
    isValid: v.boolean(),
    startTime: v.number(),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("laps", args);
  },
});

// =============================================================================
// PHYSICS SAMPLES (HIGH-FREQUENCY ~90Hz)
// Batch insert high-frequency telemetry data from rF2Telemetry buffer
// =============================================================================

/**
 * Batch insert physics samples (high-frequency telemetry data ~90Hz).
 * Merges brake, tyre, wheel, engine, motor, inputs, vehicle dynamics, and track position data.
 */
export const batchInsertPhysicsSamples = mutation({
  args: {
    rows: v.array(
      v.object({
        lapId: v.id("laps"),
        sampleTime: v.number(),

        // Brake data
        brakeBiasFront: v.number(),
        brakePressure_0: v.number(),
        brakePressure_1: v.number(),
        brakePressure_2: v.number(),
        brakePressure_3: v.number(),
        brakeTemperature_0: v.number(),
        brakeTemperature_1: v.number(),
        brakeTemperature_2: v.number(),
        brakeTemperature_3: v.number(),

        // Tyre data
        tyreCarcassTemp_0: v.number(),
        tyreCarcassTemp_1: v.number(),
        tyreCarcassTemp_2: v.number(),
        tyreCarcassTemp_3: v.number(),
        tyreCompound_0: v.number(),
        tyreCompound_1: v.number(),
        tyreCompound_2: v.number(),
        tyreCompound_3: v.number(),
        tyreCompoundNameFront: v.string(),
        tyreCompoundNameRear: v.string(),
        tyrePressure_0: v.number(),
        tyrePressure_1: v.number(),
        tyrePressure_2: v.number(),
        tyrePressure_3: v.number(),
        tyreSurfaceTempAvg_0: v.number(),
        tyreSurfaceTempAvg_1: v.number(),
        tyreSurfaceTempAvg_2: v.number(),
        tyreSurfaceTempAvg_3: v.number(),
        tyreSurfaceTempLeft_0: v.number(),
        tyreSurfaceTempLeft_1: v.number(),
        tyreSurfaceTempLeft_2: v.number(),
        tyreSurfaceTempLeft_3: v.number(),
        tyreSurfaceTempCenter_0: v.number(),
        tyreSurfaceTempCenter_1: v.number(),
        tyreSurfaceTempCenter_2: v.number(),
        tyreSurfaceTempCenter_3: v.number(),
        tyreSurfaceTempRight_0: v.number(),
        tyreSurfaceTempRight_1: v.number(),
        tyreSurfaceTempRight_2: v.number(),
        tyreSurfaceTempRight_3: v.number(),
        tyreInnerTempAvg_0: v.number(),
        tyreInnerTempAvg_1: v.number(),
        tyreInnerTempAvg_2: v.number(),
        tyreInnerTempAvg_3: v.number(),
        tyreWear_0: v.number(),
        tyreWear_1: v.number(),
        tyreWear_2: v.number(),
        tyreWear_3: v.number(),
        tyreLoad_0: v.number(),
        tyreLoad_1: v.number(),
        tyreLoad_2: v.number(),
        tyreLoad_3: v.number(),

        // Wheel & suspension data
        wheelSpeed_0: v.number(),
        wheelSpeed_1: v.number(),
        wheelSpeed_2: v.number(),
        wheelSpeed_3: v.number(),
        suspensionDeflection_0: v.number(),
        suspensionDeflection_1: v.number(),
        suspensionDeflection_2: v.number(),
        suspensionDeflection_3: v.number(),
        rideHeight_0: v.number(),
        rideHeight_1: v.number(),
        rideHeight_2: v.number(),
        rideHeight_3: v.number(),
        camber_0: v.number(),
        camber_1: v.number(),
        camber_2: v.number(),
        camber_3: v.number(),
        slipAngleFl: v.number(),
        slipAngleFr: v.number(),
        slipAngleRl: v.number(),
        slipAngleRr: v.number(),
        isDetached_0: v.boolean(),
        isDetached_1: v.boolean(),
        isDetached_2: v.boolean(),
        isDetached_3: v.boolean(),
        surfaceType_0: v.number(),
        surfaceType_1: v.number(),
        surfaceType_2: v.number(),
        surfaceType_3: v.number(),

        // Engine & powertrain data
        engineRpm: v.number(),
        engineRpmMax: v.number(),
        engineGear: v.number(),
        engineGearMax: v.number(),
        engineOilTemp: v.number(),
        engineWaterTemp: v.number(),
        engineTorque: v.number(),
        turboBoost: v.number(),

        // Electric motor data
        batteryCharge: v.number(),
        motorRpm: v.number(),
        motorTorque: v.number(),
        motorTemp: v.number(),
        motorWaterTemp: v.number(),
        motorState: v.number(),

        // Driver inputs
        throttle: v.number(),
        throttleRaw: v.number(),
        brake: v.number(),
        brakeRaw: v.number(),
        clutch: v.number(),
        clutchRaw: v.number(),
        steering: v.number(),
        steeringRaw: v.number(),
        steeringRangePhysical: v.number(),
        steeringRangeVisual: v.number(),
        steeringShaftTorque: v.number(),
        forceFeedback: v.number(),

        // Vehicle dynamics
        positionX: v.number(),
        positionY: v.number(),
        positionZ: v.number(),
        velocityLateral: v.number(),
        velocityLongitudinal: v.number(),
        velocityVertical: v.number(),
        speed: v.number(),
        accelLateral: v.number(),
        accelLongitudinal: v.number(),
        accelVertical: v.number(),
        orientationYaw: v.number(),
        rotationLateral: v.number(),
        rotationLongitudinal: v.number(),
        rotationVertical: v.number(),

        // Fuel & damage
        fuel: v.number(),
        damageSeverity_0: v.number(),
        damageSeverity_1: v.number(),
        damageSeverity_2: v.number(),
        damageSeverity_3: v.number(),
        damageSeverity_4: v.number(),
        damageSeverity_5: v.number(),
        damageSeverity_6: v.number(),
        damageSeverity_7: v.number(),

        // Track position
        distance: v.number(),
        progress: v.number(),
        pathLateral: v.number(),
        trackEdge: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await ctx.db.insert("physicsSamples", row);
    }
    return { inserted: args.rows.length };
  },
});

// =============================================================================
// SCORING SNAPSHOTS (LOW-FREQUENCY ~5Hz)
// Batch insert low-frequency scoring data from rF2Scoring buffer
// =============================================================================

/**
 * Batch insert scoring snapshots (low-frequency scoring data ~5Hz).
 * Contains timing, lap progress, vehicle state, session state, and switch data.
 * Only written when data actually changes (sector complete, lap complete, etc.)
 */
export const batchInsertScoringSnapshots = mutation({
  args: {
    rows: v.array(
      v.object({
        lapId: v.id("laps"),
        snapshotTime: v.number(),
        updateTrigger: v.string(),

        // Timing data
        behindLeader: v.number(),
        behindNext: v.number(),
        bestLaptime: v.number(),
        bestSector1: v.number(),
        bestSector2: v.number(),
        currentLaptime: v.number(),
        currentSector1: v.number(),
        currentSector2: v.number(),
        lastLaptime: v.number(),
        lastSector1: v.number(),
        lastSector2: v.number(),
        deltaBest: v.number(),
        estimatedLaptime: v.number(),
        estimatedTimeInto: v.number(),

        // Lap progress
        sectorIndex: v.number(),
        trackLength: v.number(),

        // Vehicle state (from scoring)
        positionLateral: v.number(),
        inGarage: v.boolean(),
        inPits: v.boolean(),
        isPlayer: v.boolean(),
        place: v.number(),
        finishState: v.number(),

        // Session state
        greenFlag: v.boolean(),
        yellowFlag: v.boolean(),
        blueFlag: v.boolean(),
        inRace: v.boolean(),
        inCountdown: v.boolean(),
        inFormation: v.boolean(),
        pitOpen: v.boolean(),
        raininess: v.number(),
        wetnessAverage: v.number(),
        wetnessMinimum: v.number(),
        wetnessMaximum: v.number(),
        sessionElapsed: v.number(),
        sessionRemaining: v.number(),

        // Switches (rarely change)
        autoClutch: v.boolean(),
        drsStatus: v.number(),
        headlights: v.boolean(),
        ignitionStarter: v.number(),
        speedLimiter: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await ctx.db.insert("scoringSnapshots", row);
    }
    return { inserted: args.rows.length };
  },
});
