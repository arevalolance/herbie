"""
Snapshot-based CSV logger for tick-aligned telemetry export.

Exports telemetry to two CSV files per lap:
- lap_X_physics.csv (high-freq ~90Hz physics data)
- lap_X_scoring.csv (low-freq ~5Hz scoring data)

This matches the snapshot architecture used in Convex database.
"""

import time
import logging
import csv
import os
import sys
from typing import Dict, List, Optional
from dataclasses import dataclass, field

from .api_connector import SimRF2
from .adapter import rf2_data

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

# Platform check
if sys.platform != "win32":
    logging.error("This tracker only works on Windows (requires rF2 shared memory)")
    sys.exit(1)

# Configuration
ACCESS_MODE = 0
RF2_PROCESS_ID = ""
PLAYER_OVERRIDE = False
PLAYER_INDEX = 0
CHAR_ENCODING = "utf-8"

# Directory where CSV logs will be stored
LOG_DIR = os.path.join(os.path.dirname(__file__), "telemetry_logs")
os.makedirs(LOG_DIR, exist_ok=True)


@dataclass
class ScoringState:
    """Track scoring state for change detection"""
    last_sector_index: int = -1
    last_lap_time: float = 0.0
    last_position: int = 0
    last_snapshot_time: float = 0.0


@dataclass
class LapLogger:
    """Manages CSV logging for a single lap"""
    lap_number: int
    physics_file: Optional[str] = None
    scoring_file: Optional[str] = None
    physics_writer: Optional[csv.DictWriter] = None
    scoring_writer: Optional[csv.DictWriter] = None
    physics_fp = None
    scoring_fp = None
    physics_count: int = 0
    scoring_count: int = 0

    def close(self):
        """Close CSV files"""
        if self.physics_fp:
            self.physics_fp.close()
        if self.scoring_fp:
            self.scoring_fp.close()


# Physics sample CSV headers (high-frequency ~90Hz)
PHYSICS_HEADERS = [
    "elapsed_time",
    "lap_number",
    # Brake data
    "bias_front",
    "pressure_0", "pressure_1", "pressure_2", "pressure_3",
    "temperature_0", "temperature_1", "temperature_2", "temperature_3",
    # Tyre data
    "carcass_temperature_0", "carcass_temperature_1", "carcass_temperature_2", "carcass_temperature_3",
    "compound_0", "compound_1", "compound_2", "compound_3",
    "compound_name_front", "compound_name_rear",
    "tyre_pressure_0", "tyre_pressure_1", "tyre_pressure_2", "tyre_pressure_3",
    "surface_temperature_avg_0", "surface_temperature_avg_1", "surface_temperature_avg_2", "surface_temperature_avg_3",
    "surface_temperature_ico_0", "surface_temperature_ico_1", "surface_temperature_ico_2",
    "surface_temperature_ico_3", "surface_temperature_ico_4", "surface_temperature_ico_5",
    "surface_temperature_ico_6", "surface_temperature_ico_7", "surface_temperature_ico_8",
    "surface_temperature_ico_9", "surface_temperature_ico_10", "surface_temperature_ico_11",
    "inner_temperature_avg_0", "inner_temperature_avg_1", "inner_temperature_avg_2", "inner_temperature_avg_3",
    "wear_0", "wear_1", "wear_2", "wear_3",
    "load_0", "load_1", "load_2", "load_3",
    # Wheel data
    "rotation_0", "rotation_1", "rotation_2", "rotation_3",
    "suspension_deflection_0", "suspension_deflection_1", "suspension_deflection_2", "suspension_deflection_3",
    "ride_height_0", "ride_height_1", "ride_height_2", "ride_height_3",
    "camber_0", "camber_1", "camber_2", "camber_3",
    "slip_angle_fl", "slip_angle_fr", "slip_angle_rl", "slip_angle_rr",
    "is_detached_0", "is_detached_1", "is_detached_2", "is_detached_3",
    "surface_type_0", "surface_type_1", "surface_type_2", "surface_type_3",
    # Engine data
    "rpm", "rpm_max", "gear", "gear_max",
    "oil_temperature", "water_temperature", "torque", "turbo",
    # Electric motor
    "battery_charge", "motor_rpm", "motor_torque", "motor_temperature", "motor_water_temperature", "motor_state",
    # Driver inputs
    "throttle", "throttle_raw", "brake_input", "brake_raw",
    "clutch", "clutch_raw", "steering", "steering_raw",
    "steering_range_physical", "steering_range_visual", "steering_shaft_torque", "force_feedback",
    # Vehicle dynamics
    "position_xyz_0", "position_xyz_1", "position_xyz_2",
    "velocity_lateral", "velocity_longitudinal", "velocity_vertical", "speed",
    "accel_lateral", "accel_longitudinal", "accel_vertical",
    "orientation_yaw_radians",
    "rotation_lateral", "rotation_longitudinal", "rotation_vertical",
    # Fuel & damage
    "fuel",
    "damage_severity_0", "damage_severity_1", "damage_severity_2", "damage_severity_3",
    "damage_severity_4", "damage_severity_5", "damage_severity_6", "damage_severity_7",
    # Track position
    "distance", "progress", "path_lateral", "track_edge",
]

# Scoring snapshot CSV headers (low-frequency ~5Hz)
SCORING_HEADERS = [
    "elapsed_time",
    "lap_number",
    "update_trigger",
    # Timing data
    "behind_leader", "behind_next",
    "best_laptime", "best_sector1", "best_sector2",
    "current_laptime", "current_sector1", "current_sector2",
    "last_laptime", "last_sector1", "last_sector2",
    "delta_best", "estimated_laptime", "estimated_time_into",
    # Lap progress
    "sector_index", "track_length",
    # Vehicle state
    "position_lateral", "in_garage", "in_pits", "is_player", "place", "finish_state",
    # Session state
    "green_flag", "yellow_flag", "blue_flag",
    "in_race", "in_countdown", "in_formation", "pit_open",
    "raininess", "wetness_average", "wetness_minimum", "wetness_maximum",
    "session_elapsed", "session_remaining",
    # Switches
    "auto_clutch", "drs_status", "headlights", "ignition_starter", "speed_limiter",
]


def collect_physics_sample(data: rf2_data.DataSet, elapsed_time: float, lap_number: int) -> Dict:
    """Collect high-frequency physics sample (~90Hz from rF2Telemetry)"""
    return {
        "elapsed_time": elapsed_time,
        "lap_number": lap_number,

        # Brake data
        "bias_front": data.brake.bias_front(),
        "pressure_0": data.brake.pressure()[0],
        "pressure_1": data.brake.pressure()[1],
        "pressure_2": data.brake.pressure()[2],
        "pressure_3": data.brake.pressure()[3],
        "temperature_0": data.brake.temperature()[0],
        "temperature_1": data.brake.temperature()[1],
        "temperature_2": data.brake.temperature()[2],
        "temperature_3": data.brake.temperature()[3],

        # Tyre data
        "carcass_temperature_0": data.tyre.carcass_temperature()[0],
        "carcass_temperature_1": data.tyre.carcass_temperature()[1],
        "carcass_temperature_2": data.tyre.carcass_temperature()[2],
        "carcass_temperature_3": data.tyre.carcass_temperature()[3],
        "compound_0": data.tyre.compound()[0],
        "compound_1": data.tyre.compound()[0],
        "compound_2": data.tyre.compound()[1],
        "compound_3": data.tyre.compound()[1],
        "compound_name_front": data.tyre.compound_name()[0],
        "compound_name_rear": data.tyre.compound_name()[1],
        "tyre_pressure_0": data.tyre.pressure()[0],
        "tyre_pressure_1": data.tyre.pressure()[1],
        "tyre_pressure_2": data.tyre.pressure()[2],
        "tyre_pressure_3": data.tyre.pressure()[3],
        "surface_temperature_avg_0": data.tyre.surface_temperature_avg()[0],
        "surface_temperature_avg_1": data.tyre.surface_temperature_avg()[1],
        "surface_temperature_avg_2": data.tyre.surface_temperature_avg()[2],
        "surface_temperature_avg_3": data.tyre.surface_temperature_avg()[3],
        "surface_temperature_ico_0": data.tyre.surface_temperature_ico()[0],
        "surface_temperature_ico_1": data.tyre.surface_temperature_ico()[1],
        "surface_temperature_ico_2": data.tyre.surface_temperature_ico()[2],
        "surface_temperature_ico_3": data.tyre.surface_temperature_ico()[3],
        "surface_temperature_ico_4": data.tyre.surface_temperature_ico()[4],
        "surface_temperature_ico_5": data.tyre.surface_temperature_ico()[5],
        "surface_temperature_ico_6": data.tyre.surface_temperature_ico()[6],
        "surface_temperature_ico_7": data.tyre.surface_temperature_ico()[7],
        "surface_temperature_ico_8": data.tyre.surface_temperature_ico()[8],
        "surface_temperature_ico_9": data.tyre.surface_temperature_ico()[9],
        "surface_temperature_ico_10": data.tyre.surface_temperature_ico()[10],
        "surface_temperature_ico_11": data.tyre.surface_temperature_ico()[11],
        "inner_temperature_avg_0": data.tyre.inner_temperature_avg()[0],
        "inner_temperature_avg_1": data.tyre.inner_temperature_avg()[1],
        "inner_temperature_avg_2": data.tyre.inner_temperature_avg()[2],
        "inner_temperature_avg_3": data.tyre.inner_temperature_avg()[3],
        "wear_0": data.tyre.wear()[0],
        "wear_1": data.tyre.wear()[1],
        "wear_2": data.tyre.wear()[2],
        "wear_3": data.tyre.wear()[3],
        "load_0": data.tyre.load()[0],
        "load_1": data.tyre.load()[1],
        "load_2": data.tyre.load()[2],
        "load_3": data.tyre.load()[3],

        # Wheel data
        "rotation_0": data.wheel.rotation()[0],
        "rotation_1": data.wheel.rotation()[1],
        "rotation_2": data.wheel.rotation()[2],
        "rotation_3": data.wheel.rotation()[3],
        "suspension_deflection_0": data.wheel.suspension_deflection()[0],
        "suspension_deflection_1": data.wheel.suspension_deflection()[1],
        "suspension_deflection_2": data.wheel.suspension_deflection()[2],
        "suspension_deflection_3": data.wheel.suspension_deflection()[3],
        "ride_height_0": data.wheel.ride_height()[0],
        "ride_height_1": data.wheel.ride_height()[1],
        "ride_height_2": data.wheel.ride_height()[2],
        "ride_height_3": data.wheel.ride_height()[3],
        "camber_0": data.wheel.camber()[0],
        "camber_1": data.wheel.camber()[1],
        "camber_2": data.wheel.camber()[2],
        "camber_3": data.wheel.camber()[3],
        "slip_angle_fl": data.wheel.slip_angle_fl(),
        "slip_angle_fr": data.wheel.slip_angle_fr(),
        "slip_angle_rl": data.wheel.slip_angle_rl(),
        "slip_angle_rr": data.wheel.slip_angle_rr(),
        "is_detached_0": data.wheel.is_detached()[0],
        "is_detached_1": data.wheel.is_detached()[1],
        "is_detached_2": data.wheel.is_detached()[2],
        "is_detached_3": data.wheel.is_detached()[3],
        "surface_type_0": data.wheel.surface_type()[0],
        "surface_type_1": data.wheel.surface_type()[1],
        "surface_type_2": data.wheel.surface_type()[2],
        "surface_type_3": data.wheel.surface_type()[3],

        # Engine data
        "rpm": data.engine.rpm(),
        "rpm_max": data.engine.rpm_max(),
        "gear": data.engine.gear(),
        "gear_max": data.engine.gear_max(),
        "oil_temperature": data.engine.oil_temperature(),
        "water_temperature": data.engine.water_temperature(),
        "torque": data.engine.torque(),
        "turbo": data.engine.turbo(),

        # Electric motor
        "battery_charge": data.electric_motor.battery_charge(),
        "motor_rpm": data.electric_motor.rpm(),
        "motor_torque": data.electric_motor.torque(),
        "motor_temperature": data.electric_motor.motor_temperature(),
        "motor_water_temperature": data.electric_motor.water_temperature(),
        "motor_state": data.electric_motor.state(),

        # Driver inputs
        "throttle": data.inputs.throttle(),
        "throttle_raw": data.inputs.throttle_raw(),
        "brake_input": data.inputs.brake(),
        "brake_raw": data.inputs.brake_raw(),
        "clutch": data.inputs.clutch(),
        "clutch_raw": data.inputs.clutch_raw(),
        "steering": data.inputs.steering(),
        "steering_raw": data.inputs.steering_raw(),
        "steering_range_physical": data.inputs.steering_range_physical(),
        "steering_range_visual": data.inputs.steering_range_visual(),
        "steering_shaft_torque": data.inputs.steering_shaft_torque(),
        "force_feedback": data.inputs.force_feedback(),

        # Vehicle dynamics
        "position_xyz_0": data.vehicle.position_xyz()[0],
        "position_xyz_1": data.vehicle.position_xyz()[1],
        "position_xyz_2": data.vehicle.position_xyz()[2],
        "velocity_lateral": data.vehicle.velocity_lateral(),
        "velocity_longitudinal": data.vehicle.velocity_longitudinal(),
        "velocity_vertical": data.vehicle.velocity_vertical(),
        "speed": data.vehicle.speed(),
        "accel_lateral": data.vehicle.accel_lateral(),
        "accel_longitudinal": data.vehicle.accel_longitudinal(),
        "accel_vertical": data.vehicle.accel_vertical(),
        "orientation_yaw_radians": data.vehicle.orientation_yaw_radians(),
        "rotation_lateral": data.vehicle.rotation_lateral(),
        "rotation_longitudinal": data.vehicle.rotation_longitudinal(),
        "rotation_vertical": data.vehicle.rotation_vertical(),

        # Fuel & damage
        "fuel": data.vehicle.fuel(),
        "damage_severity_0": data.vehicle.damage_severity()[0],
        "damage_severity_1": data.vehicle.damage_severity()[1],
        "damage_severity_2": data.vehicle.damage_severity()[2],
        "damage_severity_3": data.vehicle.damage_severity()[3],
        "damage_severity_4": data.vehicle.damage_severity()[4],
        "damage_severity_5": data.vehicle.damage_severity()[5],
        "damage_severity_6": data.vehicle.damage_severity()[6],
        "damage_severity_7": data.vehicle.damage_severity()[7],

        # Track position
        "distance": data.lap.distance(),
        "progress": data.lap.progress(),
        "path_lateral": data.vehicle.path_lateral(),
        "track_edge": data.vehicle.track_edge(),
    }


def collect_scoring_snapshot(
    data: rf2_data.DataSet,
    elapsed_time: float,
    lap_number: int,
    trigger: str
) -> Dict:
    """Collect low-frequency scoring snapshot (~5Hz from rF2Scoring)"""
    return {
        "elapsed_time": elapsed_time,
        "lap_number": lap_number,
        "update_trigger": trigger,

        # Timing data
        "behind_leader": data.timing.behind_leader(),
        "behind_next": data.timing.behind_next(),
        "best_laptime": data.timing.best_laptime(),
        "best_sector1": data.timing.best_sector1(),
        "best_sector2": data.timing.best_sector2(),
        "current_laptime": data.timing.current_laptime(),
        "current_sector1": data.timing.current_sector1(),
        "current_sector2": data.timing.current_sector2(),
        "last_laptime": data.timing.last_laptime(),
        "last_sector1": data.timing.last_sector1(),
        "last_sector2": data.timing.last_sector2(),
        "delta_best": data.timing.delta_best(),
        "estimated_laptime": data.timing.estimated_laptime(),
        "estimated_time_into": data.timing.estimated_time_into(),

        # Lap progress
        "sector_index": data.lap.sector_index(),
        "track_length": data.lap.track_length(),

        # Vehicle state
        "position_lateral": data.vehicle.path_lateral(),
        "in_garage": data.vehicle.in_garage(),
        "in_pits": data.vehicle.in_pits(),
        "is_player": data.vehicle.is_player(),
        "place": data.vehicle.place(),
        "finish_state": data.vehicle.finish_state(),

        # Session state
        "green_flag": data.session.green_flag(),
        "yellow_flag": data.session.yellow_flag(),
        "blue_flag": data.session.blue_flag(),
        "in_race": data.session.in_race(),
        "in_countdown": data.session.in_countdown(),
        "in_formation": data.session.in_formation(),
        "pit_open": data.session.pit_open(),
        "raininess": data.session.raininess(),
        "wetness_average": data.session.wetness_average(),
        "wetness_minimum": data.session.wetness_minimum(),
        "wetness_maximum": data.session.wetness_maximum(),
        "session_elapsed": data.session.elapsed(),
        "session_remaining": data.session.remaining(),

        # Switches
        "auto_clutch": data.switch.auto_clutch(),
        "drs_status": data.switch.drs_status(),
        "headlights": data.switch.headlights(),
        "ignition_starter": data.switch.ignition_starter(),
        "speed_limiter": data.switch.speed_limiter(),
    }


def run_snapshot_logger():
    """Main telemetry logging loop with snapshot architecture"""
    logging.info("=" * 60)
    logging.info("Herbie Telemetry Tracker - Snapshot CSV Logger")
    logging.info("Exports tick-aligned telemetry to CSV files")
    logging.info("=" * 60)

    # Initialize RF2 connection
    sim = SimRF2()
    sim.setup(ACCESS_MODE, RF2_PROCESS_ID, PLAYER_OVERRIDE, PLAYER_INDEX, CHAR_ENCODING)
    sim.start()

    logging.info(f"CSV logs will be saved to: {LOG_DIR}")
    logging.info("Waiting for rFactor 2 connection...")

    # Wait for RF2 connection
    while sim.info.isPaused:
        time.sleep(0.5)

    logging.info("Connected to rFactor 2!")

    current_lap: Optional[LapLogger] = None
    last_lap_number = -1
    scoring_state = ScoringState()

    try:
        while True:
            if sim.info.isPaused:
                time.sleep(0.1)
                continue

            # Setup data adapter
            data = rf2_data.DataSet()
            data.setup(sim.info)

            lap_number = data.lap.number()
            elapsed_time = sim.info.rf2TeleVeh().mElapsedTime

            # Handle lap change
            if lap_number != last_lap_number:
                if current_lap:
                    logging.info(
                        f"Lap {current_lap.lap_number} complete: "
                        f"{current_lap.physics_count} physics samples, "
                        f"{current_lap.scoring_count} scoring snapshots"
                    )
                    current_lap.close()

                # Start new lap
                current_lap = LapLogger(lap_number=lap_number)

                # Create physics CSV
                current_lap.physics_file = os.path.join(LOG_DIR, f"lap_{lap_number}_physics.csv")
                current_lap.physics_fp = open(current_lap.physics_file, "w", newline="")
                current_lap.physics_writer = csv.DictWriter(
                    current_lap.physics_fp, fieldnames=PHYSICS_HEADERS
                )
                current_lap.physics_writer.writeheader()

                # Create scoring CSV
                current_lap.scoring_file = os.path.join(LOG_DIR, f"lap_{lap_number}_scoring.csv")
                current_lap.scoring_fp = open(current_lap.scoring_file, "w", newline="")
                current_lap.scoring_writer = csv.DictWriter(
                    current_lap.scoring_fp, fieldnames=SCORING_HEADERS
                )
                current_lap.scoring_writer.writeheader()

                # Reset scoring state
                scoring_state = ScoringState()

                logging.info(f"Started lap {lap_number}")
                last_lap_number = lap_number

            if not current_lap:
                time.sleep(0.01)
                continue

            # Collect physics sample (every tick ~90Hz)
            physics_sample = collect_physics_sample(data, elapsed_time, lap_number)
            current_lap.physics_writer.writerow(physics_sample)
            current_lap.physics_count += 1

            # Collect scoring snapshot (only on changes)
            current_sector = data.lap.sector_index()
            current_lap_time = data.timing.last_laptime()
            current_position = data.vehicle.place()

            # Determine if we should write a scoring snapshot
            trigger = None
            if current_sector != scoring_state.last_sector_index:
                trigger = "sector_complete"
            elif current_lap_time != scoring_state.last_lap_time and current_lap_time > 0:
                trigger = "lap_complete"
            elif current_position != scoring_state.last_position:
                trigger = "position_change"
            elif (elapsed_time - scoring_state.last_snapshot_time) >= 1.0:
                trigger = "periodic"

            if trigger:
                scoring_snapshot = collect_scoring_snapshot(data, elapsed_time, lap_number, trigger)
                current_lap.scoring_writer.writerow(scoring_snapshot)
                current_lap.scoring_count += 1

                # Update state
                scoring_state.last_sector_index = current_sector
                scoring_state.last_lap_time = current_lap_time
                scoring_state.last_position = current_position
                scoring_state.last_snapshot_time = elapsed_time

            # Sleep based on physics tick rate (~90Hz = ~11ms)
            time.sleep(0.011)

    except KeyboardInterrupt:
        logging.info("\nShutting down...")
        if current_lap:
            logging.info(
                f"Final lap {current_lap.lap_number}: "
                f"{current_lap.physics_count} physics samples, "
                f"{current_lap.scoring_count} scoring snapshots"
            )
            current_lap.close()

    finally:
        sim.stop()
        logging.info("Telemetry logger stopped")


if __name__ == "__main__":
    run_snapshot_logger()
