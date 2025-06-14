CREATE TABLE "brake_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"telemetry_log_id" bigint,
	"bias_front" real,
	"pressure_fl" real,
	"pressure_fr" real,
	"pressure_rl" real,
	"pressure_rr" real,
	"temperature_fl" real,
	"temperature_fr" real,
	"temperature_rl" real,
	"temperature_rr" real
);
--> statement-breakpoint
CREATE TABLE "electric_motor_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"telemetry_log_id" bigint,
	"state" integer,
	"battery_charge" real,
	"rpm" real,
	"torque" real,
	"motor_temperature" real,
	"water_temperature" real
);
--> statement-breakpoint
CREATE TABLE "engine_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"telemetry_log_id" bigint,
	"gear" integer,
	"max_gear" integer,
	"rpm" real,
	"max_rpm" real,
	"torque" real,
	"turbo_boost" real,
	"oil_temperature" real,
	"water_temperature" real
);
--> statement-breakpoint
CREATE TABLE "input_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"telemetry_log_id" bigint,
	"throttle" real,
	"throttle_raw" real,
	"brake" real,
	"brake_raw" real,
	"clutch" real,
	"clutch_raw" real,
	"steering" real,
	"steering_raw" real,
	"steering_shaft_torque" real,
	"steering_range_physical" real,
	"steering_range_visual" real,
	"force_feedback" real
);
--> statement-breakpoint
CREATE TABLE "lap_comparisons" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"lap_ids" varchar(1000) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lap_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"lap_id" integer NOT NULL,
	"max_speed" real,
	"avg_speed" real,
	"min_speed" real,
	"max_rpm" real,
	"avg_rpm" real,
	"max_throttle" real,
	"avg_throttle" real,
	"max_brake" real,
	"avg_brake" real,
	"max_lateral_g" real,
	"max_longitudinal_g" real,
	"max_vertical_g" real,
	"max_tire_temp" real,
	"avg_tire_temp" real,
	"max_tire_pressure" real,
	"avg_tire_pressure" real,
	"fuel_used" real,
	"fuel_starting" real,
	"fuel_ending" real,
	"distance_covered" real,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "lap_summary_lap_id_unique" UNIQUE("lap_id")
);
--> statement-breakpoint
CREATE TABLE "laps" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"session_id" integer NOT NULL,
	"vehicle_id" integer NOT NULL,
	"lap_number" integer NOT NULL,
	"title" varchar(255),
	"description" text,
	"tags" varchar(500),
	"lap_time" real,
	"sector1_time" real,
	"sector2_time" real,
	"sector3_time" real,
	"is_valid" boolean DEFAULT true,
	"is_personal_best" boolean DEFAULT false,
	"lap_start_time" timestamp NOT NULL,
	"lap_end_time" timestamp,
	"track_temp" real,
	"ambient_temp" real,
	"wetness" real,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session_conditions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer,
	"timestamp" timestamp NOT NULL,
	"track_temperature" real,
	"ambient_temperature" real,
	"raininess" real,
	"wetness_minimum" real,
	"wetness_maximum" real,
	"wetness_average" real,
	"game_phase" integer,
	"in_countdown" boolean,
	"in_formation" boolean,
	"pit_open" boolean,
	"green_flag" boolean,
	"yellow_flag" boolean,
	"start_lights" integer
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"session_stamp" bigint NOT NULL,
	"session_type" integer NOT NULL,
	"track_name" varchar(255),
	"combo_id" varchar(255),
	"track_id" varchar(255),
	"sim_name" varchar(50),
	"api_version" varchar(50),
	"session_length" real,
	"max_laps" integer,
	"is_lap_type" boolean,
	"title" varchar(255),
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "switch_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"telemetry_log_id" bigint,
	"headlights" integer,
	"ignition_starter" integer,
	"speed_limiter" integer,
	"drs_status" integer,
	"auto_clutch" boolean
);
--> statement-breakpoint
CREATE TABLE "telemetry_logs" (
	"id" bigint PRIMARY KEY NOT NULL,
	"lap_id" integer NOT NULL,
	"timestamp" timestamp NOT NULL,
	"session_elapsed" real,
	"lap_progress" real,
	"position_x" real,
	"position_y" real,
	"position_z" real,
	"orientation_yaw" real,
	"speed" real,
	"accel_lateral" real,
	"accel_longitudinal" real,
	"accel_vertical" real,
	"velocity_lateral" real,
	"velocity_longitudinal" real,
	"velocity_vertical" real,
	"gear" integer,
	"rpm" real,
	"throttle" real,
	"brake" real,
	"clutch" real,
	"steering" real,
	"fuel" real
);
--> statement-breakpoint
CREATE TABLE "timing_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"lap_id" integer NOT NULL,
	"sector1_time" real,
	"sector2_time" real,
	"sector3_time" real,
	"sector1_best" real,
	"sector2_best" real,
	"sector3_best" real,
	"delta_to_personal_best" real,
	"delta_to_session_best" real,
	"start_position" integer,
	"end_position" integer
);
--> statement-breakpoint
CREATE TABLE "tyre_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"telemetry_log_id" bigint,
	"compound_front" integer,
	"compound_rear" integer,
	"compound_name_front" varchar(100),
	"compound_name_rear" varchar(100),
	"surface_temp_fl" real,
	"surface_temp_fr" real,
	"surface_temp_rl" real,
	"surface_temp_rr" real,
	"inner_temp_fl" real,
	"inner_temp_fr" real,
	"inner_temp_rl" real,
	"inner_temp_rr" real,
	"pressure_fl" real,
	"pressure_fr" real,
	"pressure_rl" real,
	"pressure_rr" real,
	"load_fl" real,
	"load_fr" real,
	"load_rl" real,
	"load_rr" real,
	"wear_fl" real,
	"wear_fr" real,
	"wear_rl" real,
	"wear_rr" real,
	"carcass_temp_fl" real,
	"carcass_temp_fr" real,
	"carcass_temp_rl" real,
	"carcass_temp_rr" real
);
--> statement-breakpoint
CREATE TABLE "tyre_temperature_detail" (
	"id" serial PRIMARY KEY NOT NULL,
	"telemetry_log_id" bigint,
	"surface_temp_fl_inner" real,
	"surface_temp_fl_center" real,
	"surface_temp_fl_outer" real,
	"surface_temp_fr_inner" real,
	"surface_temp_fr_center" real,
	"surface_temp_fr_outer" real,
	"surface_temp_rl_inner" real,
	"surface_temp_rl_center" real,
	"surface_temp_rl_outer" real,
	"surface_temp_rr_inner" real,
	"surface_temp_rr_center" real,
	"surface_temp_rr_outer" real,
	"inner_temp_fl_inner" real,
	"inner_temp_fl_center" real,
	"inner_temp_fl_outer" real,
	"inner_temp_fr_inner" real,
	"inner_temp_fr_center" real,
	"inner_temp_fr_outer" real,
	"inner_temp_rl_inner" real,
	"inner_temp_rl_center" real,
	"inner_temp_rl_outer" real,
	"inner_temp_rr_inner" real,
	"inner_temp_rr_center" real,
	"inner_temp_rr_outer" real
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"workos_user_id" varchar(255) NOT NULL,
	"organization_id" varchar(255),
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"first_name" varchar(255),
	"last_name" varchar(255),
	"profile_picture_url" varchar(500),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_workos_user_id_unique" UNIQUE("workos_user_id")
);
--> statement-breakpoint
CREATE TABLE "vehicle_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"telemetry_log_id" bigint,
	"place" integer,
	"qualification" integer,
	"in_pits" boolean,
	"in_garage" boolean,
	"num_pitstops" integer,
	"pit_request" boolean,
	"num_penalties" integer,
	"finish_state" integer,
	"fuel" real,
	"tank_capacity" real,
	"downforce_front" real,
	"downforce_rear" real,
	"damage_severity_1" integer,
	"damage_severity_2" integer,
	"damage_severity_3" integer,
	"damage_severity_4" integer,
	"damage_severity_5" integer,
	"damage_severity_6" integer,
	"damage_severity_7" integer,
	"damage_severity_8" integer,
	"is_detached" boolean,
	"last_impact_time" real,
	"last_impact_magnitude" real,
	"last_impact_position_x" real,
	"last_impact_position_y" real
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer,
	"slot_id" integer NOT NULL,
	"driver_name" varchar(255),
	"vehicle_name" varchar(255),
	"class_name" varchar(255),
	"is_player" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wheel_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"telemetry_log_id" bigint,
	"camber_fl" real,
	"camber_fr" real,
	"camber_rl" real,
	"camber_rr" real,
	"toe_fl" real,
	"toe_fr" real,
	"toe_rl" real,
	"toe_rr" real,
	"rotation_fl" real,
	"rotation_fr" real,
	"rotation_rl" real,
	"rotation_rr" real,
	"vel_lateral_fl" real,
	"vel_lateral_fr" real,
	"vel_lateral_rl" real,
	"vel_lateral_rr" real,
	"vel_longitudinal_fl" real,
	"vel_longitudinal_fr" real,
	"vel_longitudinal_rl" real,
	"vel_longitudinal_rr" real,
	"slip_angle_fl" real,
	"slip_angle_fr" real,
	"slip_angle_rl" real,
	"slip_angle_rr" real,
	"ride_height_fl" real,
	"ride_height_fr" real,
	"ride_height_rl" real,
	"ride_height_rr" real,
	"suspension_deflection_fl" real,
	"suspension_deflection_fr" real,
	"suspension_deflection_rl" real,
	"suspension_deflection_rr" real,
	"suspension_force_fl" real,
	"suspension_force_fr" real,
	"suspension_force_rl" real,
	"suspension_force_rr" real,
	"third_spring_deflection_fl" real,
	"third_spring_deflection_fr" real,
	"third_spring_deflection_rl" real,
	"third_spring_deflection_rr" real,
	"position_vertical_fl" real,
	"position_vertical_fr" real,
	"position_vertical_rl" real,
	"position_vertical_rr" real,
	"is_detached_fl" boolean,
	"is_detached_fr" boolean,
	"is_detached_rl" boolean,
	"is_detached_rr" boolean,
	"is_offroad" boolean
);
--> statement-breakpoint
ALTER TABLE "brake_data" ADD CONSTRAINT "brake_data_telemetry_log_id_telemetry_logs_id_fk" FOREIGN KEY ("telemetry_log_id") REFERENCES "public"."telemetry_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electric_motor_data" ADD CONSTRAINT "electric_motor_data_telemetry_log_id_telemetry_logs_id_fk" FOREIGN KEY ("telemetry_log_id") REFERENCES "public"."telemetry_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engine_data" ADD CONSTRAINT "engine_data_telemetry_log_id_telemetry_logs_id_fk" FOREIGN KEY ("telemetry_log_id") REFERENCES "public"."telemetry_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "input_data" ADD CONSTRAINT "input_data_telemetry_log_id_telemetry_logs_id_fk" FOREIGN KEY ("telemetry_log_id") REFERENCES "public"."telemetry_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lap_comparisons" ADD CONSTRAINT "lap_comparisons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lap_summary" ADD CONSTRAINT "lap_summary_lap_id_laps_id_fk" FOREIGN KEY ("lap_id") REFERENCES "public"."laps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laps" ADD CONSTRAINT "laps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laps" ADD CONSTRAINT "laps_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "laps" ADD CONSTRAINT "laps_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_conditions" ADD CONSTRAINT "session_conditions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "switch_states" ADD CONSTRAINT "switch_states_telemetry_log_id_telemetry_logs_id_fk" FOREIGN KEY ("telemetry_log_id") REFERENCES "public"."telemetry_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_logs" ADD CONSTRAINT "telemetry_logs_lap_id_laps_id_fk" FOREIGN KEY ("lap_id") REFERENCES "public"."laps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timing_data" ADD CONSTRAINT "timing_data_lap_id_laps_id_fk" FOREIGN KEY ("lap_id") REFERENCES "public"."laps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tyre_data" ADD CONSTRAINT "tyre_data_telemetry_log_id_telemetry_logs_id_fk" FOREIGN KEY ("telemetry_log_id") REFERENCES "public"."telemetry_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tyre_temperature_detail" ADD CONSTRAINT "tyre_temperature_detail_telemetry_log_id_telemetry_logs_id_fk" FOREIGN KEY ("telemetry_log_id") REFERENCES "public"."telemetry_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_state" ADD CONSTRAINT "vehicle_state_telemetry_log_id_telemetry_logs_id_fk" FOREIGN KEY ("telemetry_log_id") REFERENCES "public"."telemetry_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wheel_data" ADD CONSTRAINT "wheel_data_telemetry_log_id_telemetry_logs_id_fk" FOREIGN KEY ("telemetry_log_id") REFERENCES "public"."telemetry_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_comparisons_idx" ON "lap_comparisons" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_lap_idx" ON "laps" USING btree ("user_id","session_id","lap_number");--> statement-breakpoint
CREATE INDEX "lap_lap_time_idx" ON "laps" USING btree ("session_id","lap_time");--> statement-breakpoint
CREATE INDEX "personal_best_idx" ON "laps" USING btree ("user_id","is_personal_best");--> statement-breakpoint
CREATE INDEX "session_conditions_idx" ON "session_conditions" USING btree ("session_id","timestamp");--> statement-breakpoint
CREATE INDEX "user_session_idx" ON "sessions" USING btree ("user_id","session_stamp");--> statement-breakpoint
CREATE INDEX "lap_progress_idx" ON "telemetry_logs" USING btree ("lap_id","lap_progress");--> statement-breakpoint
CREATE INDEX "telemetry_timestamp_idx" ON "telemetry_logs" USING btree ("lap_id","timestamp");--> statement-breakpoint
CREATE INDEX "lap_timing_idx" ON "timing_data" USING btree ("lap_id");--> statement-breakpoint
CREATE INDEX "workos_user_idx" ON "users" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX "organization_idx" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "session_vehicle_idx" ON "vehicles" USING btree ("session_id","slot_id");