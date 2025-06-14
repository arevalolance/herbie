-- CreateTable
CREATE TABLE "brake_data" (
    "id" SERIAL NOT NULL,
    "telemetry_log_id" BIGINT,
    "bias_front" REAL,
    "pressure_fl" REAL,
    "pressure_fr" REAL,
    "pressure_rl" REAL,
    "pressure_rr" REAL,
    "temperature_fl" REAL,
    "temperature_fr" REAL,
    "temperature_rl" REAL,
    "temperature_rr" REAL,

    CONSTRAINT "brake_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "electric_motor_data" (
    "id" SERIAL NOT NULL,
    "telemetry_log_id" BIGINT,
    "state" INTEGER,
    "battery_charge" REAL,
    "rpm" REAL,
    "torque" REAL,
    "motor_temperature" REAL,
    "water_temperature" REAL,

    CONSTRAINT "electric_motor_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engine_data" (
    "id" SERIAL NOT NULL,
    "telemetry_log_id" BIGINT,
    "gear" INTEGER,
    "max_gear" INTEGER,
    "rpm" REAL,
    "max_rpm" REAL,
    "torque" REAL,
    "turbo_boost" REAL,
    "oil_temperature" REAL,
    "water_temperature" REAL,

    CONSTRAINT "engine_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "input_data" (
    "id" SERIAL NOT NULL,
    "telemetry_log_id" BIGINT,
    "throttle" REAL,
    "throttle_raw" REAL,
    "brake" REAL,
    "brake_raw" REAL,
    "clutch" REAL,
    "clutch_raw" REAL,
    "steering" REAL,
    "steering_raw" REAL,
    "steering_shaft_torque" REAL,
    "steering_range_physical" REAL,
    "steering_range_visual" REAL,
    "force_feedback" REAL,

    CONSTRAINT "input_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lap_comparisons" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "lap_ids" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lap_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lap_summary" (
    "id" SERIAL NOT NULL,
    "lap_id" INTEGER NOT NULL,
    "max_speed" REAL,
    "avg_speed" REAL,
    "min_speed" REAL,
    "max_rpm" REAL,
    "avg_rpm" REAL,
    "max_throttle" REAL,
    "avg_throttle" REAL,
    "max_brake" REAL,
    "avg_brake" REAL,
    "max_lateral_g" REAL,
    "max_longitudinal_g" REAL,
    "max_vertical_g" REAL,
    "max_tire_temp" REAL,
    "avg_tire_temp" REAL,
    "max_tire_pressure" REAL,
    "avg_tire_pressure" REAL,
    "fuel_used" REAL,
    "fuel_starting" REAL,
    "fuel_ending" REAL,
    "distance_covered" REAL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lap_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laps" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "session_id" INTEGER NOT NULL,
    "vehicle_id" INTEGER NOT NULL,
    "lap_number" INTEGER NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "tags" VARCHAR(500),
    "lap_time" REAL,
    "sector1_time" REAL,
    "sector2_time" REAL,
    "sector3_time" REAL,
    "is_valid" BOOLEAN DEFAULT true,
    "is_personal_best" BOOLEAN DEFAULT false,
    "lap_start_time" TIMESTAMP(6) NOT NULL,
    "lap_end_time" TIMESTAMP(6),
    "track_temp" REAL,
    "ambient_temp" REAL,
    "wetness" REAL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "laps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_conditions" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER,
    "timestamp" TIMESTAMP(6) NOT NULL,
    "track_temperature" REAL,
    "ambient_temperature" REAL,
    "raininess" REAL,
    "wetness_minimum" REAL,
    "wetness_maximum" REAL,
    "wetness_average" REAL,
    "game_phase" INTEGER,
    "in_countdown" BOOLEAN,
    "in_formation" BOOLEAN,
    "pit_open" BOOLEAN,
    "green_flag" BOOLEAN,
    "yellow_flag" BOOLEAN,
    "start_lights" INTEGER,

    CONSTRAINT "session_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "session_stamp" BIGINT NOT NULL,
    "session_type" INTEGER NOT NULL,
    "track_name" VARCHAR(255),
    "combo_id" VARCHAR(255),
    "track_id" VARCHAR(255),
    "sim_name" VARCHAR(50),
    "api_version" VARCHAR(50),
    "session_length" REAL,
    "max_laps" INTEGER,
    "is_lap_type" BOOLEAN,
    "title" VARCHAR(255),
    "description" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "switch_states" (
    "id" SERIAL NOT NULL,
    "telemetry_log_id" BIGINT,
    "headlights" INTEGER,
    "ignition_starter" INTEGER,
    "speed_limiter" INTEGER,
    "drs_status" INTEGER,
    "auto_clutch" BOOLEAN,

    CONSTRAINT "switch_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetry_logs" (
    "id" BIGINT NOT NULL,
    "lap_id" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(6) NOT NULL,
    "session_elapsed" REAL,
    "lap_progress" REAL,
    "position_x" REAL,
    "position_y" REAL,
    "position_z" REAL,
    "orientation_yaw" REAL,
    "speed" REAL,
    "accel_lateral" REAL,
    "accel_longitudinal" REAL,
    "accel_vertical" REAL,
    "velocity_lateral" REAL,
    "velocity_longitudinal" REAL,
    "velocity_vertical" REAL,
    "gear" INTEGER,
    "rpm" REAL,
    "throttle" REAL,
    "brake" REAL,
    "clutch" REAL,
    "steering" REAL,
    "fuel" REAL,

    CONSTRAINT "telemetry_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timing_data" (
    "id" SERIAL NOT NULL,
    "lap_id" INTEGER NOT NULL,
    "sector1_time" REAL,
    "sector2_time" REAL,
    "sector3_time" REAL,
    "sector1_best" REAL,
    "sector2_best" REAL,
    "sector3_best" REAL,
    "delta_to_personal_best" REAL,
    "delta_to_session_best" REAL,
    "start_position" INTEGER,
    "end_position" INTEGER,

    CONSTRAINT "timing_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tyre_data" (
    "id" SERIAL NOT NULL,
    "telemetry_log_id" BIGINT,
    "compound_front" INTEGER,
    "compound_rear" INTEGER,
    "compound_name_front" VARCHAR(100),
    "compound_name_rear" VARCHAR(100),
    "surface_temp_fl" REAL,
    "surface_temp_fr" REAL,
    "surface_temp_rl" REAL,
    "surface_temp_rr" REAL,
    "inner_temp_fl" REAL,
    "inner_temp_fr" REAL,
    "inner_temp_rl" REAL,
    "inner_temp_rr" REAL,
    "pressure_fl" REAL,
    "pressure_fr" REAL,
    "pressure_rl" REAL,
    "pressure_rr" REAL,
    "load_fl" REAL,
    "load_fr" REAL,
    "load_rl" REAL,
    "load_rr" REAL,
    "wear_fl" REAL,
    "wear_fr" REAL,
    "wear_rl" REAL,
    "wear_rr" REAL,
    "carcass_temp_fl" REAL,
    "carcass_temp_fr" REAL,
    "carcass_temp_rl" REAL,
    "carcass_temp_rr" REAL,

    CONSTRAINT "tyre_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tyre_temperature_detail" (
    "id" SERIAL NOT NULL,
    "telemetry_log_id" BIGINT,
    "surface_temp_fl_inner" REAL,
    "surface_temp_fl_center" REAL,
    "surface_temp_fl_outer" REAL,
    "surface_temp_fr_inner" REAL,
    "surface_temp_fr_center" REAL,
    "surface_temp_fr_outer" REAL,
    "surface_temp_rl_inner" REAL,
    "surface_temp_rl_center" REAL,
    "surface_temp_rl_outer" REAL,
    "surface_temp_rr_inner" REAL,
    "surface_temp_rr_center" REAL,
    "surface_temp_rr_outer" REAL,
    "inner_temp_fl_inner" REAL,
    "inner_temp_fl_center" REAL,
    "inner_temp_fl_outer" REAL,
    "inner_temp_fr_inner" REAL,
    "inner_temp_fr_center" REAL,
    "inner_temp_fr_outer" REAL,
    "inner_temp_rl_inner" REAL,
    "inner_temp_rl_center" REAL,
    "inner_temp_rl_outer" REAL,
    "inner_temp_rr_inner" REAL,
    "inner_temp_rr_center" REAL,
    "inner_temp_rr_outer" REAL,

    CONSTRAINT "tyre_temperature_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" VARCHAR(255) NOT NULL,
    "workos_user_id" VARCHAR(255) NOT NULL,
    "organization_id" VARCHAR(255),
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "first_name" VARCHAR(255),
    "last_name" VARCHAR(255),
    "profile_picture_url" VARCHAR(500),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_state" (
    "id" SERIAL NOT NULL,
    "telemetry_log_id" BIGINT,
    "place" INTEGER,
    "qualification" INTEGER,
    "in_pits" BOOLEAN,
    "in_garage" BOOLEAN,
    "num_pitstops" INTEGER,
    "pit_request" BOOLEAN,
    "num_penalties" INTEGER,
    "finish_state" INTEGER,
    "fuel" REAL,
    "tank_capacity" REAL,
    "downforce_front" REAL,
    "downforce_rear" REAL,
    "damage_severity_1" INTEGER,
    "damage_severity_2" INTEGER,
    "damage_severity_3" INTEGER,
    "damage_severity_4" INTEGER,
    "damage_severity_5" INTEGER,
    "damage_severity_6" INTEGER,
    "damage_severity_7" INTEGER,
    "damage_severity_8" INTEGER,
    "is_detached" BOOLEAN,
    "last_impact_time" REAL,
    "last_impact_magnitude" REAL,
    "last_impact_position_x" REAL,
    "last_impact_position_y" REAL,

    CONSTRAINT "vehicle_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER,
    "slot_id" INTEGER NOT NULL,
    "driver_name" VARCHAR(255),
    "vehicle_name" VARCHAR(255),
    "class_name" VARCHAR(255),
    "is_player" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wheel_data" (
    "id" SERIAL NOT NULL,
    "telemetry_log_id" BIGINT,
    "camber_fl" REAL,
    "camber_fr" REAL,
    "camber_rl" REAL,
    "camber_rr" REAL,
    "toe_fl" REAL,
    "toe_fr" REAL,
    "toe_rl" REAL,
    "toe_rr" REAL,
    "rotation_fl" REAL,
    "rotation_fr" REAL,
    "rotation_rl" REAL,
    "rotation_rr" REAL,
    "vel_lateral_fl" REAL,
    "vel_lateral_fr" REAL,
    "vel_lateral_rl" REAL,
    "vel_lateral_rr" REAL,
    "vel_longitudinal_fl" REAL,
    "vel_longitudinal_fr" REAL,
    "vel_longitudinal_rl" REAL,
    "vel_longitudinal_rr" REAL,
    "slip_angle_fl" REAL,
    "slip_angle_fr" REAL,
    "slip_angle_rl" REAL,
    "slip_angle_rr" REAL,
    "ride_height_fl" REAL,
    "ride_height_fr" REAL,
    "ride_height_rl" REAL,
    "ride_height_rr" REAL,
    "suspension_deflection_fl" REAL,
    "suspension_deflection_fr" REAL,
    "suspension_deflection_rl" REAL,
    "suspension_deflection_rr" REAL,
    "suspension_force_fl" REAL,
    "suspension_force_fr" REAL,
    "suspension_force_rl" REAL,
    "suspension_force_rr" REAL,
    "third_spring_deflection_fl" REAL,
    "third_spring_deflection_fr" REAL,
    "third_spring_deflection_rl" REAL,
    "third_spring_deflection_rr" REAL,
    "position_vertical_fl" REAL,
    "position_vertical_fr" REAL,
    "position_vertical_rl" REAL,
    "position_vertical_rr" REAL,
    "is_detached_fl" BOOLEAN,
    "is_detached_fr" BOOLEAN,
    "is_detached_rl" BOOLEAN,
    "is_detached_rr" BOOLEAN,
    "is_offroad" BOOLEAN,

    CONSTRAINT "wheel_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_comparisons_idx" ON "lap_comparisons"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lap_summary_lap_id_unique" ON "lap_summary"("lap_id");

-- CreateIndex
CREATE INDEX "lap_lap_time_idx" ON "laps"("session_id", "lap_time");

-- CreateIndex
CREATE INDEX "personal_best_idx" ON "laps"("user_id", "is_personal_best");

-- CreateIndex
CREATE INDEX "user_lap_idx" ON "laps"("user_id", "session_id", "lap_number");

-- CreateIndex
CREATE INDEX "session_conditions_idx" ON "session_conditions"("session_id", "timestamp");

-- CreateIndex
CREATE INDEX "user_session_idx" ON "sessions"("user_id", "session_stamp");

-- CreateIndex
CREATE INDEX "lap_progress_idx" ON "telemetry_logs"("lap_id", "lap_progress");

-- CreateIndex
CREATE INDEX "telemetry_timestamp_idx" ON "telemetry_logs"("lap_id", "timestamp");

-- CreateIndex
CREATE INDEX "lap_timing_idx" ON "timing_data"("lap_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_workos_user_id_unique" ON "users"("workos_user_id");

-- CreateIndex
CREATE INDEX "organization_idx" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "workos_user_idx" ON "users"("workos_user_id");

-- CreateIndex
CREATE INDEX "session_vehicle_idx" ON "vehicles"("session_id", "slot_id");

-- AddForeignKey
ALTER TABLE "brake_data" ADD CONSTRAINT "brake_data_telemetry_log_id_telemetry_logs_id_fk" FOREIGN KEY ("telemetry_log_id") REFERENCES "telemetry_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "electric_motor_data" ADD CONSTRAINT "electric_motor_data_telemetry_log_id_telemetry_logs_id_fk" FOREIGN KEY ("telemetry_log_id") REFERENCES "telemetry_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "engine_data" ADD CONSTRAINT "engine_data_telemetry_log_id_telemetry_logs_id_fk" FOREIGN KEY ("telemetry_log_id") REFERENCES "telemetry_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "input_data" ADD CONSTRAINT "input_data_telemetry_log_id_telemetry_logs_id_fk" FOREIGN KEY ("telemetry_log_id") REFERENCES "telemetry_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lap_comparisons" ADD CONSTRAINT "lap_comparisons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lap_summary" ADD CONSTRAINT "lap_summary_lap_id_laps_id_fk" FOREIGN KEY ("lap_id") REFERENCES "laps"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "laps" ADD CONSTRAINT "laps_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "laps" ADD CONSTRAINT "laps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "laps" ADD CONSTRAINT "laps_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "session_conditions" ADD CONSTRAINT "session_conditions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "switch_states" ADD CONSTRAINT "switch_states_telemetry_log_id_telemetry_logs_id_fk" FOREIGN KEY ("telemetry_log_id") REFERENCES "telemetry_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "telemetry_logs" ADD CONSTRAINT "telemetry_logs_lap_id_laps_id_fk" FOREIGN KEY ("lap_id") REFERENCES "laps"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "timing_data" ADD CONSTRAINT "timing_data_lap_id_laps_id_fk" FOREIGN KEY ("lap_id") REFERENCES "laps"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tyre_data" ADD CONSTRAINT "tyre_data_telemetry_log_id_telemetry_logs_id_fk" FOREIGN KEY ("telemetry_log_id") REFERENCES "telemetry_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tyre_temperature_detail" ADD CONSTRAINT "tyre_temperature_detail_telemetry_log_id_telemetry_logs_id_fk" FOREIGN KEY ("telemetry_log_id") REFERENCES "telemetry_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "vehicle_state" ADD CONSTRAINT "vehicle_state_telemetry_log_id_telemetry_logs_id_fk" FOREIGN KEY ("telemetry_log_id") REFERENCES "telemetry_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wheel_data" ADD CONSTRAINT "wheel_data_telemetry_log_id_telemetry_logs_id_fk" FOREIGN KEY ("telemetry_log_id") REFERENCES "telemetry_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
