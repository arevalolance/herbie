import { InferSelectModel } from "drizzle-orm";
import { 
  pgTable, 
  serial, 
  text, 
  timestamp, 
  integer, 
  real, 
  boolean, 
  varchar,
  bigint,
  index,
  uuid
} from "drizzle-orm/pg-core";

// User management - WorkOS integration
export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(), // WorkOS user ID
  workosUserId: varchar("workos_user_id", { length: 255 }).notNull().unique(),
  organizationId: varchar("organization_id", { length: 255 }), // WorkOS organization ID
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  profilePictureUrl: varchar("profile_picture_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("workos_user_idx").on(table.workosUserId),
  index("organization_idx").on(table.organizationId),
]);

export type User = InferSelectModel<typeof users>;

// Session and identification tables
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).references(() => users.id).notNull(),
  sessionStamp: bigint("session_stamp", { mode: "number" }).notNull(),
  sessionType: integer("session_type").notNull(), // 0=TESTDAY, 1=PRACTICE, 2=QUALIFY, 3=WARMUP, 4=RACE
  trackName: varchar("track_name", { length: 255 }),
  comboId: varchar("combo_id", { length: 255 }),
  trackId: varchar("track_id", { length: 255 }),
  simName: varchar("sim_name", { length: 50 }),
  apiVersion: varchar("api_version", { length: 50 }),
  sessionLength: real("session_length"),
  maxLaps: integer("max_laps"),
  isLapType: boolean("is_lap_type"),
  title: varchar("title", { length: 255 }), // Custom session title
  description: text("description"), // Optional session description
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("user_session_idx").on(table.userId, table.sessionStamp),
]);

export type Session = InferSelectModel<typeof sessions>;

export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => sessions.id),
  slotId: integer("slot_id").notNull(),
  driverName: varchar("driver_name", { length: 255 }),
  vehicleName: varchar("vehicle_name", { length: 255 }),
  className: varchar("class_name", { length: 255 }),
  isPlayer: boolean("is_player").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("session_vehicle_idx").on(table.sessionId, table.slotId),
]);

export type Vehicle = InferSelectModel<typeof vehicles>;

// Lap-based organization
export const laps = pgTable("laps", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).references(() => users.id).notNull(),
  sessionId: integer("session_id").references(() => sessions.id).notNull(),
  vehicleId: integer("vehicle_id").references(() => vehicles.id).notNull(),
  lapNumber: integer("lap_number").notNull(),
  
  // Custom lap identification
  title: varchar("title", { length: 255 }), // e.g., "Qualifying Run", "Best Lap", "Race Start"
  description: text("description"), // Optional detailed description
  tags: varchar("tags", { length: 500 }), // Comma-separated tags for categorization
  
  // Lap timing data
  lapTime: real("lap_time"), // Total lap time in seconds
  sector1Time: real("sector1_time"),
  sector2Time: real("sector2_time"),
  sector3Time: real("sector3_time"),
  
  // Lap metadata
  isValid: boolean("is_valid").default(true), // Whether lap is considered valid
  isPersonalBest: boolean("is_personal_best").default(false),
  lapStartTime: timestamp("lap_start_time").notNull(),
  lapEndTime: timestamp("lap_end_time"),
  
  // Weather and track conditions during this lap
  trackTemp: real("track_temp"),
  ambientTemp: real("ambient_temp"),
  wetness: real("wetness"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("user_lap_idx").on(table.userId, table.sessionId, table.lapNumber),
  index("lap_lap_time_idx").on(table.sessionId, table.lapTime),
  index("personal_best_idx").on(table.userId, table.isPersonalBest),
]);

export type Lap = InferSelectModel<typeof laps>;

// Main telemetry log table - now lap-based
export const telemetryLogs = pgTable("telemetry_logs", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  lapId: integer("lap_id").references(() => laps.id).notNull(),
  timestamp: timestamp("timestamp").notNull(),
  sessionElapsed: real("session_elapsed"),
  lapProgress: real("lap_progress"), // 0.0 to 1.0 through the lap
  
  // Position and movement
  positionX: real("position_x"),
  positionY: real("position_y"),
  positionZ: real("position_z"),
  orientationYaw: real("orientation_yaw"),
  speed: real("speed"),
  
  // Acceleration
  accelLateral: real("accel_lateral"),
  accelLongitudinal: real("accel_longitudinal"),
  accelVertical: real("accel_vertical"),
  
  // Velocity
  velocityLateral: real("velocity_lateral"),
  velocityLongitudinal: real("velocity_longitudinal"),
  velocityVertical: real("velocity_vertical"),
  
  // Engine data
  gear: integer("gear"),
  rpm: real("rpm"),
  throttle: real("throttle"),
  brake: real("brake"),
  clutch: real("clutch"),
  steering: real("steering"),
  
  // Vehicle state
  fuel: real("fuel"),
  
}, (table) => [
  index("lap_progress_idx").on(table.lapId, table.lapProgress),
  index("telemetry_timestamp_idx").on(table.lapId, table.timestamp),
]);

export type TelemetryLog = InferSelectModel<typeof telemetryLogs>;

// Lap summary data - aggregated telemetry per lap
export const lapSummary = pgTable("lap_summary", {
  id: serial("id").primaryKey(),
  lapId: integer("lap_id").references(() => laps.id).notNull().unique(),
  
  // Speed statistics
  maxSpeed: real("max_speed"),
  avgSpeed: real("avg_speed"),
  minSpeed: real("min_speed"),
  
  // Engine statistics
  maxRpm: real("max_rpm"),
  avgRpm: real("avg_rpm"),
  maxThrottle: real("max_throttle"),
  avgThrottle: real("avg_throttle"),
  maxBrake: real("max_brake"),
  avgBrake: real("avg_brake"),
  
  // G-Force statistics
  maxLateralG: real("max_lateral_g"),
  maxLongitudinalG: real("max_longitudinal_g"),
  maxVerticalG: real("max_vertical_g"),
  
  // Tire statistics
  maxTireTemp: real("max_tire_temp"),
  avgTireTemp: real("avg_tire_temp"),
  maxTirePressure: real("max_tire_pressure"),
  avgTirePressure: real("avg_tire_pressure"),
  
  // Fuel consumption
  fuelUsed: real("fuel_used"),
  fuelStarting: real("fuel_starting"),
  fuelEnding: real("fuel_ending"),
  
  // Distance covered
  distanceCovered: real("distance_covered"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export type LapSummary = InferSelectModel<typeof lapSummary>;

// Timing data - per lap
export const timingData = pgTable("timing_data", {
  id: serial("id").primaryKey(),
  lapId: integer("lap_id").references(() => laps.id).notNull(),
  
  // Sector times for this lap
  sector1Time: real("sector1_time"),
  sector2Time: real("sector2_time"),  
  sector3Time: real("sector3_time"),
  
  // Best times comparison
  sector1Best: real("sector1_best"),
  sector2Best: real("sector2_best"),
  sector3Best: real("sector3_best"),
  
  // Delta to best lap
  deltaToPersonalBest: real("delta_to_personal_best"),
  deltaToSessionBest: real("delta_to_session_best"),
  
  // Position data
  startPosition: integer("start_position"),
  endPosition: integer("end_position"),
  
}, (table) => [
  index("lap_timing_idx").on(table.lapId),
]);

export type TimingData = InferSelectModel<typeof timingData>;

// Engine telemetry - sampled data per lap
export const engineData = pgTable("engine_data", {
  id: serial("id").primaryKey(),
  telemetryLogId: bigint("telemetry_log_id", { mode: "number" }).references(() => telemetryLogs.id),
  
  gear: integer("gear"),
  maxGear: integer("max_gear"),
  rpm: real("rpm"),
  maxRpm: real("max_rpm"),
  torque: real("torque"),
  turboBoost: real("turbo_boost"),
  oilTemperature: real("oil_temperature"),
  waterTemperature: real("water_temperature"),
});

export type EngineData = InferSelectModel<typeof engineData>;

// Electric motor data
export const electricMotorData = pgTable("electric_motor_data", {
  id: serial("id").primaryKey(),
  telemetryLogId: bigint("telemetry_log_id", { mode: "number" }).references(() => telemetryLogs.id),
  
  state: integer("state"), // 0=n/a, 1=off, 2=drain, 3=regen
  batteryCharge: real("battery_charge"),
  rpm: real("rpm"),
  torque: real("torque"),
  motorTemperature: real("motor_temperature"),
  waterTemperature: real("water_temperature"),
});

export type ElectricMotorData = InferSelectModel<typeof electricMotorData>;

// Driver inputs
export const inputData = pgTable("input_data", {
  id: serial("id").primaryKey(),
  telemetryLogId: bigint("telemetry_log_id", { mode: "number" }).references(() => telemetryLogs.id),
  
  throttle: real("throttle"),
  throttleRaw: real("throttle_raw"),
  brake: real("brake"),
  brakeRaw: real("brake_raw"),
  clutch: real("clutch"),
  clutchRaw: real("clutch_raw"),
  steering: real("steering"),
  steeringRaw: real("steering_raw"),
  steeringShaftTorque: real("steering_shaft_torque"),
  steeringRangePhysical: real("steering_range_physical"),
  steeringRangeVisual: real("steering_range_visual"),
  forceFeedback: real("force_feedback"),
});

export type InputData = InferSelectModel<typeof inputData>;

// Brake system data
export const brakeData = pgTable("brake_data", {
  id: serial("id").primaryKey(),
  telemetryLogId: bigint("telemetry_log_id", { mode: "number" }).references(() => telemetryLogs.id),
  
  biasFront: real("bias_front"),
  pressureFL: real("pressure_fl"),
  pressureFR: real("pressure_fr"),
  pressureRL: real("pressure_rl"),
  pressureRR: real("pressure_rr"),
  temperatureFL: real("temperature_fl"),
  temperatureFR: real("temperature_fr"),
  temperatureRL: real("temperature_rl"),
  temperatureRR: real("temperature_rr"),
});

export type BrakeData = InferSelectModel<typeof brakeData>;

// Tire data
export const tyreData = pgTable("tyre_data", {
  id: serial("id").primaryKey(),
  telemetryLogId: bigint("telemetry_log_id", { mode: "number" }).references(() => telemetryLogs.id),
  
  compoundFront: integer("compound_front"),
  compoundRear: integer("compound_rear"),
  compoundNameFront: varchar("compound_name_front", { length: 100 }),
  compoundNameRear: varchar("compound_name_rear", { length: 100 }),
  
  // Surface temperatures (average)
  surfaceTempFL: real("surface_temp_fl"),
  surfaceTempFR: real("surface_temp_fr"),
  surfaceTempRL: real("surface_temp_rl"),
  surfaceTempRR: real("surface_temp_rr"),
  
  // Inner temperatures (average)
  innerTempFL: real("inner_temp_fl"),
  innerTempFR: real("inner_temp_fr"),
  innerTempRL: real("inner_temp_rl"),
  innerTempRR: real("inner_temp_rr"),
  
  // Pressure
  pressureFL: real("pressure_fl"),
  pressureFR: real("pressure_fr"),
  pressureRL: real("pressure_rl"),
  pressureRR: real("pressure_rr"),
  
  // Load
  loadFL: real("load_fl"),
  loadFR: real("load_fr"),
  loadRL: real("load_rl"),
  loadRR: real("load_rr"),
  
  // Wear
  wearFL: real("wear_fl"),
  wearFR: real("wear_fr"),
  wearRL: real("wear_rl"),
  wearRR: real("wear_rr"),
  
  // Carcass temperature
  carcassTempFL: real("carcass_temp_fl"),
  carcassTempFR: real("carcass_temp_fr"),
  carcassTempRL: real("carcass_temp_rl"),
  carcassTempRR: real("carcass_temp_rr"),
});

export type TyreData = InferSelectModel<typeof tyreData>;

// Detailed tire temperature data (inner, center, outer)
export const tyreTemperatureDetail = pgTable("tyre_temperature_detail", {
  id: serial("id").primaryKey(),
  telemetryLogId: bigint("telemetry_log_id", { mode: "number" }).references(() => telemetryLogs.id),
  
  // Surface temps - FL
  surfaceTempFLInner: real("surface_temp_fl_inner"),
  surfaceTempFLCenter: real("surface_temp_fl_center"),
  surfaceTempFLOuter: real("surface_temp_fl_outer"),
  
  // Surface temps - FR
  surfaceTempFRInner: real("surface_temp_fr_inner"),
  surfaceTempFRCenter: real("surface_temp_fr_center"),
  surfaceTempFROuter: real("surface_temp_fr_outer"),
  
  // Surface temps - RL
  surfaceTempRLInner: real("surface_temp_rl_inner"),
  surfaceTempRLCenter: real("surface_temp_rl_center"),
  surfaceTempRLOuter: real("surface_temp_rl_outer"),
  
  // Surface temps - RR
  surfaceTempRRInner: real("surface_temp_rr_inner"),
  surfaceTempRRCenter: real("surface_temp_rr_center"),
  surfaceTempRROuter: real("surface_temp_rr_outer"),
  
  // Inner layer temps - FL
  innerTempFLInner: real("inner_temp_fl_inner"),
  innerTempFLCenter: real("inner_temp_fl_center"),
  innerTempFLOuter: real("inner_temp_fl_outer"),
  
  // Inner layer temps - FR
  innerTempFRInner: real("inner_temp_fr_inner"),
  innerTempFRCenter: real("inner_temp_fr_center"),
  innerTempFROuter: real("inner_temp_fr_outer"),
  
  // Inner layer temps - RL
  innerTempRLInner: real("inner_temp_rl_inner"),
  innerTempRLCenter: real("inner_temp_rl_center"),
  innerTempRLOuter: real("inner_temp_rl_outer"),
  
  // Inner layer temps - RR
  innerTempRRInner: real("inner_temp_rr_inner"),
  innerTempRRCenter: real("inner_temp_rr_center"),
  innerTempRROuter: real("inner_temp_rr_outer"),
});

export type TyreTemperatureDetail = InferSelectModel<typeof tyreTemperatureDetail>;

// Wheel and suspension data
export const wheelData = pgTable("wheel_data", {
  id: serial("id").primaryKey(),
  telemetryLogId: bigint("telemetry_log_id", { mode: "number" }).references(() => telemetryLogs.id),
  
  // Camber
  camberFL: real("camber_fl"),
  camberFR: real("camber_fr"),
  camberRL: real("camber_rl"),
  camberRR: real("camber_rr"),
  
  // Toe
  toeFL: real("toe_fl"),
  toeFR: real("toe_fr"),
  toeRL: real("toe_rl"),
  toeRR: real("toe_rr"),
  
  // Rotation
  rotationFL: real("rotation_fl"),
  rotationFR: real("rotation_fr"),
  rotationRL: real("rotation_rl"),
  rotationRR: real("rotation_rr"),
  
  // Velocities
  velLateralFL: real("vel_lateral_fl"),
  velLateralFR: real("vel_lateral_fr"),
  velLateralRL: real("vel_lateral_rl"),
  velLateralRR: real("vel_lateral_rr"),
  
  velLongitudinalFL: real("vel_longitudinal_fl"),
  velLongitudinalFR: real("vel_longitudinal_fr"),
  velLongitudinalRL: real("vel_longitudinal_rl"),
  velLongitudinalRR: real("vel_longitudinal_rr"),
  
  // Slip angles
  slipAngleFL: real("slip_angle_fl"),
  slipAngleFR: real("slip_angle_fr"),
  slipAngleRL: real("slip_angle_rl"),
  slipAngleRR: real("slip_angle_rr"),
  
  // Ride height
  rideHeightFL: real("ride_height_fl"),
  rideHeightFR: real("ride_height_fr"),
  rideHeightRL: real("ride_height_rl"),
  rideHeightRR: real("ride_height_rr"),
  
  // Suspension
  suspensionDeflectionFL: real("suspension_deflection_fl"),
  suspensionDeflectionFR: real("suspension_deflection_fr"),
  suspensionDeflectionRL: real("suspension_deflection_rl"),
  suspensionDeflectionRR: real("suspension_deflection_rr"),
  
  suspensionForceFL: real("suspension_force_fl"),
  suspensionForceFR: real("suspension_force_fr"),
  suspensionForceRL: real("suspension_force_rl"),
  suspensionForceRR: real("suspension_force_rr"),
  
  // Third spring deflection
  thirdSpringDeflectionFL: real("third_spring_deflection_fl"),
  thirdSpringDeflectionFR: real("third_spring_deflection_fr"),
  thirdSpringDeflectionRL: real("third_spring_deflection_rl"),
  thirdSpringDeflectionRR: real("third_spring_deflection_rr"),
  
  // Wheel position
  positionVerticalFL: real("position_vertical_fl"),
  positionVerticalFR: real("position_vertical_fr"),
  positionVerticalRL: real("position_vertical_rl"),
  positionVerticalRR: real("position_vertical_rr"),
  
  // Detachment status
  isDetachedFL: boolean("is_detached_fl"),
  isDetachedFR: boolean("is_detached_fr"),
  isDetachedRL: boolean("is_detached_rl"),
  isDetachedRR: boolean("is_detached_rr"),
  
  // Offroad status
  isOffroad: boolean("is_offroad"),
});

export type WheelData = InferSelectModel<typeof wheelData>;

// Vehicle state and damage
export const vehicleState = pgTable("vehicle_state", {
  id: serial("id").primaryKey(),
  telemetryLogId: bigint("telemetry_log_id", { mode: "number" }).references(() => telemetryLogs.id),
  
  // Position
  place: integer("place"),
  qualification: integer("qualification"),
  
  // Pit and garage status
  inPits: boolean("in_pits"),
  inGarage: boolean("in_garage"),
  numPitstops: integer("num_pitstops"),
  pitRequest: boolean("pit_request"),
  
  // Penalties and finish
  numPenalties: integer("num_penalties"),
  finishState: integer("finish_state"), // 0=none, 1=finished, 2=DNF, 3=DQ
  
  // Fuel
  fuel: real("fuel"),
  tankCapacity: real("tank_capacity"),
  
  // Downforce
  downforceFront: real("downforce_front"),
  downforceRear: real("downforce_rear"),
  
  // Damage (8 damage zones)
  damageSeverity1: integer("damage_severity_1"),
  damageSeverity2: integer("damage_severity_2"),
  damageSeverity3: integer("damage_severity_3"),
  damageSeverity4: integer("damage_severity_4"),
  damageSeverity5: integer("damage_severity_5"),
  damageSeverity6: integer("damage_severity_6"),
  damageSeverity7: integer("damage_severity_7"),
  damageSeverity8: integer("damage_severity_8"),
  
  isDetached: boolean("is_detached"),
  
  // Impact data
  lastImpactTime: real("last_impact_time"),
  lastImpactMagnitude: real("last_impact_magnitude"),
  lastImpactPositionX: real("last_impact_position_x"),
  lastImpactPositionY: real("last_impact_position_y"),
});

export type VehicleState = InferSelectModel<typeof vehicleState>;

// Switch states
export const switchStates = pgTable("switch_states", {
  id: serial("id").primaryKey(),
  telemetryLogId: bigint("telemetry_log_id", { mode: "number" }).references(() => telemetryLogs.id),
  
  headlights: integer("headlights"),
  ignitionStarter: integer("ignition_starter"),
  speedLimiter: integer("speed_limiter"),
  drsStatus: integer("drs_status"), // 0=not_available, 1=available, 2=allowed, 3=activated
  autoClutch: boolean("auto_clutch"),
});

// Session conditions - per session
export const sessionConditions = pgTable("session_conditions", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => sessions.id),
  timestamp: timestamp("timestamp").notNull(),
  
  trackTemperature: real("track_temperature"),
  ambientTemperature: real("ambient_temperature"),
  raininess: real("raininess"),
  wetnessMinimum: real("wetness_minimum"),
  wetnessMaximum: real("wetness_maximum"),
  wetnessAverage: real("wetness_average"),
  
  // Session phase info
  gamePhase: integer("game_phase"),
  inCountdown: boolean("in_countdown"),
  inFormation: boolean("in_formation"),
  pitOpen: boolean("pit_open"),
  greenFlag: boolean("green_flag"),
  yellowFlag: boolean("yellow_flag"),
  startLights: integer("start_lights"),
}, (table) => [
  index("session_conditions_idx").on(table.sessionId, table.timestamp),
]);

export type SessionConditions = InferSelectModel<typeof sessionConditions>;

// Lap comparisons for analysis
export const lapComparisons = pgTable("lap_comparisons", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).references(() => users.id).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  lapIds: varchar("lap_ids", { length: 1000 }).notNull(), // JSON array of lap IDs
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("user_comparisons_idx").on(table.userId),
]);

export type LapComparison = InferSelectModel<typeof lapComparisons>;