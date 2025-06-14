import time
import logging
import csv
import os
from typing import Dict, List

from .api_connector import SimRF2
from .adapter import rf2_data

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

ACCESS_MODE = 0
RF2_PROCESS_ID = ""
PLAYER_OVERRIDE = False
PLAYER_INDEX = 0
CHAR_ENCODING = "utf-8"

# Directory where CSV logs will be stored
LOG_DIR = os.path.join(os.path.dirname(__file__), "telemetry_logs")
os.makedirs(LOG_DIR, exist_ok=True)

# Define data classes and their fields
TELEMETRY_CLASSES = {
    "brake": {
        "fields": ["bias_front", "pressure", "temperature"],
        "class": rf2_data.Brake
    },
    "engine": {
        "fields": ["gear", "gear_max", "rpm", "rpm_max", "torque", "turbo", "oil_temperature", "water_temperature"],
        "class": rf2_data.Engine
    },
    "inputs": {
        "fields": ["throttle", "throttle_raw", "brake", "brake_raw", "clutch", "clutch_raw", 
                  "steering", "steering_raw", "steering_shaft_torque", "steering_range_physical", 
                  "steering_range_visual", "force_feedback"],
        "class": rf2_data.Inputs
    },
    "lap": {
        "fields": ["number", "completed_laps", "track_length", "distance", "progress", "maximum", 
                  "sector_index", "behind_leader", "behind_next"],
        "class": rf2_data.Lap
    },
    "session": {
        "fields": ["elapsed", "start", "end", "remaining", "session_type", "lap_type", "in_race", 
                  "in_countdown", "in_formation", "pit_open", "green_flag", "blue_flag", "yellow_flag", 
                  "start_lights", "track_name", "track_temperature", "ambient_temperature", "raininess", 
                  "wetness_minimum", "wetness_maximum", "wetness_average", "wetness"],
        "class": rf2_data.Session
    },
    "switch": {
        "fields": ["headlights", "ignition_starter", "speed_limiter", "drs_status", "auto_clutch"],
        "class": rf2_data.Switch
    },
    "timing": {
        "fields": ["start", "elapsed", "current_laptime", "last_laptime", "best_laptime", 
                  "estimated_laptime", "estimated_time_into", "current_sector1", "current_sector2", 
                  "last_sector1", "last_sector2", "best_sector1", "best_sector2", "behind_leader", "behind_next"],
        "class": rf2_data.Timing
    },
    "tyre": {
        "fields": ["compound_front", "compound_rear", "compound", "compound_name_front", "compound_name_rear", 
                  "compound_name", "surface_temperature_avg", "surface_temperature_ico", "inner_temperature_avg", 
                  "inner_temperature_ico", "pressure", "load", "wear", "carcass_temperature"],
        "class": rf2_data.Tyre
    },
    "vehicle": {
        "fields": ["is_player", "is_driving", "player_index", "slot_id", "driver_name", "vehicle_name", 
                  "class_name", "same_class", "total_vehicles", "place", "qualification", "in_pits", 
                  "in_garage", "number_pitstops", "number_penalties", "pit_request", "finish_state", 
                  "fuel", "tank_capacity", "orientation_yaw_radians", "position_xyz", "position_longitudinal", 
                  "position_lateral", "position_vertical", "accel_lateral", "accel_longitudinal", 
                  "accel_vertical", "velocity_lateral", "velocity_longitudinal", "velocity_vertical", 
                  "speed", "downforce_front", "downforce_rear", "damage_severity", "is_detached", 
                  "impact_time", "impact_magnitude", "impact_position"],
        "class": rf2_data.Vehicle
    },
    "wheel": {
        "fields": ["camber", "toe", "toe_symmetric", "rotation", "velocity_lateral", "velocity_longitudinal", 
                  "slip_angle_fl", "slip_angle_fr", "slip_angle_rl", "slip_angle_rr", "ride_height", 
                  "third_spring_deflection", "suspension_deflection", "suspension_force", 
                  "position_vertical", "is_detached", "is_offroad"],
        "class": rf2_data.Wheel
    }
}

def get_telemetry_data(telemetry_class: rf2_data.DataAdapter, fields: List[str]) -> Dict:
    """Get telemetry data for a specific class and its fields"""
    data = {}
    for field in fields:
        try:
            value = getattr(telemetry_class, field)()
            # Handle tuple values by flattening them
            if isinstance(value, tuple):
                for i, v in enumerate(value):
                    data[f"{field}_{i}"] = v
            else:
                data[field] = value
        except Exception as e:
            logging.warning(f"Failed to get {field}: {e}")
            data[field] = None
    return data

def run_logger():
    rf2_sim = SimRF2()

    rf2_sim.setup(
        ACCESS_MODE,
        RF2_PROCESS_ID,
        PLAYER_OVERRIDE,
        PLAYER_INDEX,
        CHAR_ENCODING,
    )

    rf2_sim.start()

    print("Logger connected. Monitoring telemetry data... (Press Ctrl+C to exit)")
    
    # Initialize data storage for each class
    class_data: Dict[str, List[Dict]] = {class_name: [] for class_name in TELEMETRY_CLASSES.keys()}
    prev_lap_number = None
    first_struct_dumped = False

    try:
        while True:
            if not rf2_sim.info.isPaused:
                # Get current lap number
                current_lap = rf2_sim.info.rf2TeleVeh().mLapNumber

                # Collect data for each class
                for class_name, class_info in TELEMETRY_CLASSES.items():
                    telemetry_class = class_info["class"](rf2_sim.info)
                    data = get_telemetry_data(telemetry_class, class_info["fields"])
                    data["elapsed_time"] = rf2_sim.info.rf2TeleVeh().mElapsedTime
                    data["lap_number"] = current_lap
                    class_data[class_name].append(data)

                # Detect lap change to write CSVs
                if prev_lap_number is not None and current_lap != prev_lap_number:
                    # Check if the previous lap is valid
                    last_lap_time = rf2_sim.info.rf2ScorVeh().mLastLapTime
                    if last_lap_time and last_lap_time > 0:
                        # Write data for each class to its own CSV
                        for class_name, data in class_data.items():
                            if data:  # Only write if we have data
                                csv_path = os.path.join(LOG_DIR, f"lap_{prev_lap_number}_{class_name}.csv")
                                with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
                                    # Get all possible fields from the data
                                    fieldnames = set()
                                    for entry in data:
                                        fieldnames.update(entry.keys())
                                    fieldnames = sorted(list(fieldnames))
                                    
                                    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                                    writer.writeheader()
                                    writer.writerows(data)
                                print(f"Saved {class_name} telemetry for lap {prev_lap_number} to {csv_path}")
                        
                        # Clear the data after writing
                        class_data = {class_name: [] for class_name in TELEMETRY_CLASSES.keys()}

                prev_lap_number = current_lap

                # Print minimal info
                if not first_struct_dumped:
                    print("--- Full Telemetry Struct Dump ---")
                    for field_name, _ in rf2_sim.info.rf2TeleVeh()._fields_:
                        print(field_name, getattr(rf2_sim.info.rf2TeleVeh(), field_name))
                    print("--- End Dump ---")
                    first_struct_dumped = True

                print(
                    f"RPM: {rf2_sim.info.rf2TeleVeh().mEngineRPM}",
                    f"Speed: {rf2_sim.info.rf2TeleVeh().mLocalVel.z * 3.6:.1f} km/h",
                    f"Gear: {rf2_sim.info.rf2TeleVeh().mGear}",
                )

            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\nLogger stopped by user")
    finally:
        # Flush remaining lap data on exit
        if prev_lap_number is not None:
            last_lap_time = rf2_sim.info.rf2ScorVeh().mLastLapTime
            if last_lap_time and last_lap_time > 0:
                for class_name, data in class_data.items():
                    if data:  # Only write if we have data
                        csv_path = os.path.join(LOG_DIR, f"lap_{prev_lap_number}_{class_name}.csv")
                        with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
                            fieldnames = set()
                            for entry in data:
                                fieldnames.update(entry.keys())
                            fieldnames = sorted(list(fieldnames))
                            
                            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                            writer.writeheader()
                            writer.writerows(data)
                        print(f"Saved {class_name} telemetry for lap {prev_lap_number} to {csv_path}")

        rf2_sim.stop()

if __name__ == "__main__":
    run_logger()
