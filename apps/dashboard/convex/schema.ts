import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,

  numbers: defineTable({
    value: v.number(),
  }),

  // 1:1 mapping of DuckDB tables
  abs: defineTable({
    ts: v.number(),
    value: v.boolean(),
  }),

  absLevel: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  ambientTemperature: defineTable({
    value: v.number(),
  }),

  antiStallActivated: defineTable({
    ts: v.number(),
    value: v.boolean(),
  }),

  bestLapTime: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  bestSector1: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  bestSector2: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  brakeBiasRear: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  brakeMigration: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  brakePos: defineTable({
    value: v.number(),
  }),

  brakePosUnfiltered: defineTable({
    value: v.number(),
  }),

  brakeThickness: defineTable({
    value1: v.number(),
    value2: v.number(),
    value3: v.number(),
    value4: v.number(),
  }),

  brakesAirTemp: defineTable({
    value1: v.number(),
    value2: v.number(),
    value3: v.number(),
    value4: v.number(),
  }),

  brakesForce: defineTable({
    value1: v.number(),
    value2: v.number(),
    value3: v.number(),
    value4: v.number(),
  }),

  brakesTemp: defineTable({
    value1: v.number(),
    value2: v.number(),
    value3: v.number(),
    value4: v.number(),
  }),

  cloudDarkness: defineTable({
    ts: v.number(),
    value: v.boolean(),
  }),

  clutchPos: defineTable({
    value: v.number(),
  }),

  clutchPosUnfiltered: defineTable({
    value: v.number(),
  }),

  clutchRpm: defineTable({
    value: v.number(),
  }),

  currentLapTime: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  currentSector: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  currentSector1: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  currentSector2: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  drag: defineTable({
    value: v.number(),
  }),

  engineMaxRpm: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  engineOilTemp: defineTable({
    value: v.number(),
  }),

  engineRpm: defineTable({
    value: v.number(),
  }),

  engineWaterTemp: defineTable({
    value: v.number(),
  }),

  ffbOutput: defineTable({
    value: v.number(),
  }),

  finishStatus: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  front3rdDeflection: defineTable({
    value: v.number(),
  }),

  frontDownForce: defineTable({
    value: v.number(),
  }),

  frontFlapActivated: defineTable({
    ts: v.number(),
    value: v.boolean(),
  }),

  frontRideHeight: defineTable({
    value: v.number(),
  }),

  frontWingHeight: defineTable({
    value: v.number(),
  }),

  fuelLevel: defineTable({
    value: v.number(),
  }),

  fuelMixtureMap: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  gForceLat: defineTable({
    value: v.number(),
  }),

  gForceLong: defineTable({
    value: v.number(),
  }),

  gForceVert: defineTable({
    value: v.number(),
  }),

  gpsLatitude: defineTable({
    value: v.number(),
  }),

  gpsLongitude: defineTable({
    value: v.number(),
  }),

  gpsSpeed: defineTable({
    value: v.number(),
  }),

  gpsTime: defineTable({
    value: v.number(),
  }),

  gear: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  groundSpeed: defineTable({
    value: v.number(),
  }),

  headlightsState: defineTable({
    ts: v.number(),
    value: v.boolean(),
  }),

  inPits: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  lap: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  lapDist: defineTable({
    value: v.number(),
  }),

  lapTime: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  lastSector1: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  lastSector2: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  lastImpactMagnitude: defineTable({
    ts: v.number(),
    value: v.boolean(),
  }),

  lateralAcceleration: defineTable({
    value: v.number(),
  }),

  launchControlActive: defineTable({
    ts: v.number(),
    value: v.boolean(),
  }),

  longitudinalAcceleration: defineTable({
    value: v.number(),
  }),

  minimumPathWetness: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  offpathWetness: defineTable({
    ts: v.number(),
    value: v.boolean(),
  }),

  overheatingState: defineTable({
    value: v.boolean(),
  }),

  pathLateral: defineTable({
    value: v.number(),
  }),

  readDownForce: defineTable({
    value: v.number(),
  }),

  rear3rdDeflection: defineTable({
    value: v.number(),
  }),

  rearFlapActivated: defineTable({
    ts: v.number(),
    value: v.boolean(),
  }),

  rearFlapLegalStatus: defineTable({
    ts: v.number(),
    value: v.boolean(),
  }),

  rearRideHeight: defineTable({
    value: v.number(),
  }),

  regenRate: defineTable({
    value: v.number(),
  }),

  rideHeights: defineTable({
    value1: v.number(),
    value2: v.number(),
    value3: v.number(),
    value4: v.number(),
  }),

  sector1Flag: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  sector2Flag: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  sector3Flag: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  soC: defineTable({
    value: v.number(),
  }),

  speedLimiter: defineTable({
    ts: v.number(),
    value: v.boolean(),
  }),

  steeredAngle: defineTable({
    value: v.number(),
  }),

  steeringPos: defineTable({
    value: v.number(),
  }),

  steeringPosUnfiltered: defineTable({
    value: v.number(),
  }),

  steeringShaftTorque: defineTable({
    value: v.number(),
  }),

  surfaceTypes: defineTable({
    ts: v.number(),
    value1: v.number(),
    value2: v.number(),
    value3: v.number(),
    value4: v.number(),
  }),

  suspPos: defineTable({
    value1: v.number(),
    value2: v.number(),
    value3: v.number(),
    value4: v.number(),
  }),

  tc: defineTable({
    ts: v.number(),
    value: v.boolean(),
  }),

  tcCut: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  tcLevel: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  tcSlipAngle: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  throttlePos: defineTable({
    value: v.number(),
  }),

  throttlePosUnfiltered: defineTable({
    value: v.number(),
  }),

  timeBehindNext: defineTable({
    value: v.number(),
  }),

  totalDist: defineTable({
    value: v.number(),
  }),

  trackEdge: defineTable({
    value: v.number(),
  }),

  trackTemperature: defineTable({
    value: v.number(),
  }),

  turboBoostPressure: defineTable({
    value: v.number(),
  }),

  tyresWear: defineTable({
    value1: v.number(),
    value2: v.number(),
    value3: v.number(),
    value4: v.number(),
  }),

  tyresCarcassTemp: defineTable({
    value1: v.number(),
    value2: v.number(),
    value3: v.number(),
    value4: v.number(),
  }),

  tyresCompound: defineTable({
    ts: v.number(),
    value1: v.number(),
    value2: v.number(),
    value3: v.number(),
    value4: v.number(),
  }),

  tyresPressure: defineTable({
    value1: v.number(),
    value2: v.number(),
    value3: v.number(),
    value4: v.number(),
  }),

  tyresRimTemp: defineTable({
    value1: v.number(),
    value2: v.number(),
    value3: v.number(),
    value4: v.number(),
  }),

  tyresRubberTemp: defineTable({
    value1: v.number(),
    value2: v.number(),
    value3: v.number(),
    value4: v.number(),
  }),

  tyresTempCentre: defineTable({
    value1: v.number(),
    value2: v.number(),
    value3: v.number(),
    value4: v.number(),
  }),

  tyresTempLeft: defineTable({
    value1: v.number(),
    value2: v.number(),
    value3: v.number(),
    value4: v.number(),
  }),

  tyresTempRight: defineTable({
    value1: v.number(),
    value2: v.number(),
    value3: v.number(),
    value4: v.number(),
  }),

  virtualEnergy: defineTable({
    value: v.number(),
  }),

  wheelSpeed: defineTable({
    value1: v.number(),
    value2: v.number(),
    value3: v.number(),
    value4: v.number(),
  }),

  wheelsDetached: defineTable({
    ts: v.number(),
    value1: v.number(),
    value2: v.number(),
    value3: v.number(),
    value4: v.number(),
  }),

  windHeading: defineTable({
    value: v.number(),
  }),

  windSpeed: defineTable({
    value: v.number(),
  }),

  yawRate: defineTable({
    value: v.number(),
  }),

  yellowFlagState: defineTable({
    ts: v.number(),
    value: v.number(),
  }),

  channelsList: defineTable({
    channelName: v.string(),
    frequency: v.optional(v.number()),
    unit: v.optional(v.string()),
  }),

  eventsList: defineTable({
    eventName: v.string(),
    unit: v.optional(v.string()),
  }),

  metadata: defineTable({
    key: v.string(),
    value: v.optional(v.string()),
  }),
});
