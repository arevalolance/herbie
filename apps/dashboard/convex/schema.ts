import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,

  // Test table
  numbers: defineTable({
    value: v.number(),
  }),

  // Core tables for session-based telemetry hierarchy
  sessions: defineTable({
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
  }).index("by_user", ["userId"]),

  laps: defineTable({
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
  }).index("by_session", ["sessionId"]),

  // =============================================================================
  // HIGH-FREQUENCY PHYSICS TELEMETRY (~90Hz from rF2Telemetry buffer)
  // Updated every physics tick - written on every collection sample
  // Source: rF2VehicleTelemetry structure in shared memory
  // =============================================================================

  physicsSamples: defineTable({
    lapId: v.id("laps"),
    sampleTime: v.number(), // Microsecond precision elapsed time

    // =========== BRAKE DATA ===========
    // Source: rF2VehicleTelemetry.mRearBrakeBias + mWheels[].mBrakePressure/mBrakeTemp
    brakeBiasFront: v.number(),
    brakePressure_0: v.number(),
    brakePressure_1: v.number(),
    brakePressure_2: v.number(),
    brakePressure_3: v.number(),
    brakeTemperature_0: v.number(),
    brakeTemperature_1: v.number(),
    brakeTemperature_2: v.number(),
    brakeTemperature_3: v.number(),

    // =========== TYRE DATA ===========
    // Source: rF2VehicleTelemetry.mWheels[].mTemperature/mPressure/mWear/mTireLoad
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

    // =========== WHEEL & SUSPENSION DATA ===========
    // Source: rF2VehicleTelemetry.mWheels[].mRotation/mCamber/mRideHeight/etc
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

    // =========== ENGINE & POWERTRAIN DATA ===========
    // Source: rF2VehicleTelemetry.mEngineRPM/mEngineTorque/mGear/etc
    engineRpm: v.number(),
    engineRpmMax: v.number(),
    engineGear: v.number(),
    engineGearMax: v.number(),
    engineOilTemp: v.number(),
    engineWaterTemp: v.number(),
    engineTorque: v.number(),
    turboBoost: v.number(),

    // =========== ELECTRIC MOTOR DATA ===========
    // Source: rF2VehicleTelemetry.mElectricBoost* fields
    batteryCharge: v.number(),
    motorRpm: v.number(),
    motorTorque: v.number(),
    motorTemp: v.number(),
    motorWaterTemp: v.number(),
    motorState: v.number(),

    // =========== DRIVER INPUTS ===========
    // Source: rF2VehicleTelemetry.mFilteredThrottle/mUnfilteredThrottle/etc
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

    // =========== VEHICLE DYNAMICS ===========
    // Source: rF2VehicleTelemetry.mPos/mLocalVel/mLocalAccel/mLocalRot
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

    // =========== FUEL & DAMAGE ===========
    // Source: rF2VehicleTelemetry.mFuel/mDentSeverity
    fuel: v.number(),
    damageSeverity_0: v.number(),
    damageSeverity_1: v.number(),
    damageSeverity_2: v.number(),
    damageSeverity_3: v.number(),
    damageSeverity_4: v.number(),
    damageSeverity_5: v.number(),
    damageSeverity_6: v.number(),
    damageSeverity_7: v.number(),

    // =========== TRACK POSITION ===========
    // Source: rF2VehicleTelemetry.mLapDist + rF2VehicleScoring.mLapDist/mPathLateral
    distance: v.number(),
    progress: v.number(),
    pathLateral: v.number(),
    trackEdge: v.number(),
  })
    .index("by_lap_time", ["lapId", "sampleTime"])
    .index("by_lap", ["lapId"]),

  // =============================================================================
  // LOW-FREQUENCY SCORING SNAPSHOTS (~5Hz from rF2Scoring buffer)
  // Updated irregularly - only written when data actually changes
  // Source: rF2VehicleScoring structure in shared memory
  // =============================================================================

  scoringSnapshots: defineTable({
    lapId: v.id("laps"),
    snapshotTime: v.number(), // Microsecond precision elapsed time
    updateTrigger: v.string(), // "sector_complete", "lap_complete", "position_change", "periodic"

    // =========== TIMING DATA ===========
    // Source: rF2VehicleScoring.mLastLapTime/mBestLapTime/mTimeBehindLeader/etc
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

    // =========== LAP PROGRESS ===========
    // Source: rF2VehicleScoring.mSector/mLapDist + rF2ScoringInfo.mLapDist
    sectorIndex: v.number(),
    trackLength: v.number(),

    // =========== VEHICLE STATE (from scoring) ===========
    // Source: rF2VehicleScoring.mPlace/mInPits/mFinishStatus/etc
    positionLateral: v.number(), // from rF2VehicleScoring
    inGarage: v.boolean(),
    inPits: v.boolean(),
    isPlayer: v.boolean(),
    place: v.number(),
    finishState: v.number(),

    // =========== SESSION STATE ===========
    // Source: rF2ScoringInfo.mGamePhase/mSectorFlag/mRaining/etc
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

    // =========== SWITCHES (from extended) ===========
    // Source: rF2VehicleTelemetry switch states - technically 90Hz but rarely change
    autoClutch: v.boolean(),
    drsStatus: v.number(),
    headlights: v.boolean(),
    ignitionStarter: v.number(),
    speedLimiter: v.number(),
  })
    .index("by_lap_time", ["lapId", "snapshotTime"])
    .index("by_lap", ["lapId"])
    .index("by_lap_trigger", ["lapId", "updateTrigger"]),
});
