import time
import logging
import csv
import os
import sys
import ctypes
from typing import Dict, List, Optional, Any

from .api_connector import SimRF2

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

# Platform check
if sys.platform != "win32":
    logging.error("This tracker only works on Windows (requires rF2 shared memory)")
    sys.exit(1)

ACCESS_MODE = 0
RF2_PROCESS_ID = ""
PLAYER_OVERRIDE = False
PLAYER_INDEX = 0
CHAR_ENCODING = "utf-8"

# Directory where CSV logs will be stored
LOG_DIR = os.path.join(os.path.dirname(__file__), "telemetry_logs")
os.makedirs(LOG_DIR, exist_ok=True)


def serialize_ctypes_struct(
    obj: Any, prefix: str = "", max_depth: int = 5, current_depth: int = 0
) -> Dict[str, Any]:
    """
    Recursively serialize ctypes Structure to flat dictionary.

    Handles:
    - Nested structures (recurse with prefix)
    - Arrays (iterate with index)
    - Byte arrays (decode to string)
    - Primitives (direct value)

    Args:
        obj: ctypes object to serialize
        prefix: Current field prefix for flattening
        max_depth: Maximum recursion depth
        current_depth: Current recursion level

    Returns:
        Flat dictionary with all fields
    """
    result = {}

    if current_depth >= max_depth:
        return result

    # Handle ctypes.Structure
    if isinstance(obj, ctypes.Structure):
        for field_name, field_type in obj._fields_:
            field_value = getattr(obj, field_name)
            field_key = f"{prefix}{field_name}"

            # Recursively serialize nested structures
            if isinstance(field_value, ctypes.Structure):
                nested = serialize_ctypes_struct(
                    field_value, f"{field_key}_", max_depth, current_depth + 1
                )
                result.update(nested)

            # Handle arrays
            elif isinstance(field_value, ctypes.Array):
                array_result = serialize_ctypes_array(
                    field_value, field_key, max_depth, current_depth
                )
                result.update(array_result)

            # Handle primitives
            else:
                try:
                    result[field_key] = field_value
                except (ValueError, TypeError):
                    result[field_key] = None

    # Handle ctypes.Array at top level
    elif isinstance(obj, ctypes.Array):
        array_result = serialize_ctypes_array(obj, prefix, max_depth, current_depth)
        result.update(array_result)

    return result


def serialize_ctypes_array(
    arr: ctypes.Array, prefix: str, max_depth: int, current_depth: int
) -> Dict[str, Any]:
    """
    Serialize ctypes Array to flat dictionary with indexed keys.

    Args:
        arr: ctypes Array object
        prefix: Field prefix
        max_depth: Maximum recursion depth
        current_depth: Current recursion level

    Returns:
        Flat dictionary with indexed array elements
    """
    result = {}

    # Check if it's a byte array (char array)
    if hasattr(arr, "_type_") and arr._type_ in (ctypes.c_ubyte, ctypes.c_char):
        # Decode byte array to string
        try:
            byte_list = bytes(arr)
            # Find null terminator
            null_pos = byte_list.find(b"\x00")
            if null_pos != -1:
                byte_list = byte_list[:null_pos]
            decoded = byte_list.decode("utf-8", errors="replace").strip()
            result[prefix] = decoded
        except Exception:
            result[prefix] = ""
    else:
        # Iterate array elements
        for idx, elem in enumerate(arr):
            elem_key = f"{prefix}_{idx}"

            # Recursively serialize structure elements
            if isinstance(elem, ctypes.Structure):
                nested = serialize_ctypes_struct(
                    elem, f"{elem_key}_", max_depth, current_depth + 1
                )
                result.update(nested)
            # Nested arrays
            elif isinstance(elem, ctypes.Array):
                nested_array = serialize_ctypes_array(
                    elem, elem_key, max_depth, current_depth + 1
                )
                result.update(nested_array)
            # Primitives
            else:
                try:
                    result[elem_key] = elem
                except (ValueError, TypeError):
                    result[elem_key] = None

    return result


def capture_raw_telemetry(rf2_sim: SimRF2) -> Dict[str, Any]:
    """
    Capture ALL raw telemetry fields from rF2 shared memory.

    Captures complete data from:
    - rF2VehicleTelemetry (~180 fields including 4 wheels)
    - rF2VehicleScoring (~60 fields)
    - rF2ScoringInfo (~40 fields)

    Total: 280+ fields per sample, completely raw, no restructuring.

    Args:
        rf2_sim: rF2 API connector

    Returns:
        Flat dictionary with all telemetry fields
    """
    data = {}

    try:
        # Telemetry data (~180 fields including 4x rF2Wheel)
        tele_veh = rf2_sim.info.rf2TeleVeh()
        data.update(serialize_ctypes_struct(tele_veh, "tele_"))

        # Scoring data (~60 fields)
        scor_veh = rf2_sim.info.rf2ScorVeh()
        data.update(serialize_ctypes_struct(scor_veh, "scor_"))

        # Session info (~40 fields)
        scor_info = rf2_sim.info.rf2ScorInfo
        data.update(serialize_ctypes_struct(scor_info, "session_"))

        # Extended data (optional, ~50 fields)
        # Uncomment if needed:
        # ext = rf2_sim.info.rf2Ext
        # data.update(serialize_ctypes_struct(ext, "ext_"))

    except (AttributeError, TypeError, ValueError) as e:
        logging.warning(f"Failed to capture some telemetry fields: {e}")

    return data


# Old selective field extraction (kept for reference, not used)
_OLD_TELEMETRY_CLASSES = {
    "brake": {
        "fields": ["bias_front", "pressure", "temperature"],
    "engine": {
        "fields": [
            "gear",
            "gear_max",
            "rpm",
            "rpm_max",
            "torque",
            "turbo",
            "oil_temperature",
            "water_temperature",
        ],
        "class": rf2_data.Engine,
    },
    "electric_motor": {
        "fields": [
            "state",
            "battery_charge",
            "rpm",
            "torque",
            "motor_temperature",
            "water_temperature",
        ],
        "class": rf2_data.ElectricMotor,
    },
    "inputs": {
        "fields": [
            "throttle",
            "throttle_raw",
            "brake",
            "brake_raw",
            "clutch",
            "clutch_raw",
            "steering",
            "steering_raw",
            "steering_shaft_torque",
            "steering_range_physical",
            "steering_range_visual",
            "force_feedback",
        ],
        "class": rf2_data.Inputs,
    },
    "lap": {
        "fields": [
            "number",
            "completed_laps",
            "track_length",
            "distance",
            "progress",
            "maximum",
            "sector_index",
            "behind_leader",
            "behind_next",
        ],
        "class": rf2_data.Lap,
    },
    "session": {
        "fields": [
            "elapsed",
            "start",
            "end",
            "remaining",
            "session_type",
            "lap_type",
            "in_race",
            "in_countdown",
            "in_formation",
            "pit_open",
            "green_flag",
            "blue_flag",
            "yellow_flag",
            "start_lights",
            "track_name",
            "track_temperature",
            "ambient_temperature",
            "raininess",
            "wetness_minimum",
            "wetness_maximum",
            "wetness_average",
            "wetness",
        ],
        "class": rf2_data.Session,
    },
    "switch": {
        "fields": [
            "headlights",
            "ignition_starter",
            "speed_limiter",
            "drs_status",
            "auto_clutch",
        ],
        "class": rf2_data.Switch,
    },
    "timing": {
        "fields": [
            "start",
            "elapsed",
            "current_laptime",
            "last_laptime",
            "best_laptime",
            "estimated_laptime",
            "estimated_time_into",
            "current_sector1",
            "current_sector2",
            "last_sector1",
            "last_sector2",
            "best_sector1",
            "best_sector2",
            "behind_leader",
            "behind_next",
            "delta_best",
        ],
        "class": rf2_data.Timing,
    },
    "tyre": {
        "fields": [
            "compound_front",
            "compound_rear",
            "compound",
            "compound_name_front",
            "compound_name_rear",
            "compound_name",
            "surface_temperature_avg",
            "surface_temperature_ico",
            "inner_temperature_avg",
            "inner_temperature_ico",
            "pressure",
            "load",
            "wear",
            "carcass_temperature",
        ],
        "class": rf2_data.Tyre,
    },
    "vehicle": {
        "fields": [
            "is_player",
            "is_driving",
            "player_index",
            "slot_id",
            "driver_name",
            "vehicle_name",
            "class_name",
            "same_class",
            "total_vehicles",
            "place",
            "qualification",
            "in_pits",
            "in_garage",
            "number_pitstops",
            "number_penalties",
            "pit_request",
            "finish_state",
            "fuel",
            "tank_capacity",
            "orientation_yaw_radians",
            "position_xyz",
            "position_longitudinal",
            "position_lateral",
            "position_vertical",
            "accel_lateral",
            "accel_longitudinal",
            "accel_vertical",
            "velocity_lateral",
            "velocity_longitudinal",
            "velocity_vertical",
            "speed",
            "downforce_front",
            "downforce_rear",
            "damage_severity",
            "is_detached",
            "impact_time",
            "impact_magnitude",
            "track_edge",
            "path_lateral",
            "impact_position",
            "clutch_rpm",
            "scheduled_stops",
            "overheating",
            "anti_stall_activated",
            "physics_to_graphics_offset",
            "rotational_acceleration_lateral",
            "rotational_acceleration_longitudinal",
            "rotational_acceleration_vertical",
            "rotation_lateral",
            "rotation_longitudinal",
            "rotation_vertical",
        ],
        "class": rf2_data.Vehicle,
    },
    "wheel": {
        "fields": [
            "camber",
            "toe",
            "toe_symmetric",
            "rotation",
            "velocity_lateral",
            "velocity_longitudinal",
            "slip_angle_fl",
            "slip_angle_fr",
            "slip_angle_rl",
            "slip_angle_rr",
            "ride_height",
            "third_spring_deflection",
            "suspension_deflection",
            "suspension_force",
            "position_vertical",
            "is_detached",
            "is_offroad",
            "lateral_force",
            "longitudinal_force",
            "grip_fraction",
            "is_flat",
            "static_radius",
            "vertical_deflection",
            "terrain_name",
            "surface_type",
        ],
        "class": rf2_data.Wheel,
    },
}


def write_lap_csv(lap_number: int, data: List[Dict]) -> None:
    """
    Write complete raw telemetry data to single CSV file per lap.

    Args:
        lap_number: Lap number
        data: List of dictionaries with all 280+ raw telemetry fields
    """
    if not data:
        logging.warning(f"No data to write for lap {lap_number}")
        return

    csv_path = os.path.join(LOG_DIR, f"lap_{lap_number}_raw.csv")

    try:
        # Get all column names from first sample (should be consistent)
        # Fallback to collecting all keys if samples vary
        fieldnames = set()
        for entry in data:
            fieldnames.update(entry.keys())
        fieldnames = sorted(list(fieldnames))

        with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)

        logging.info(
            f"Saved complete raw telemetry for lap {lap_number} "
            f"({len(data)} samples, {len(fieldnames)} fields) to {csv_path}"
        )
    except (IOError, OSError) as e:
        logging.error(f"Failed to write CSV for lap {lap_number}: {e}")


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

    # Initialize data storage - single list for all raw data
    lap_data: List[Dict] = []
    prev_lap_number: Optional[int] = None
    prev_lap_snapshot: Optional[Dict] = None
    first_struct_dumped = False

    try:
        while True:
            if not rf2_sim.info.isPaused:
                # Atomic snapshot of current lap state (prevent race conditions)
                vehicle_info = rf2_sim.info.rf2ScorVeh()
                tele_veh = rf2_sim.info.rf2TeleVeh()

                current_lap = tele_veh.mLapNumber
                last_laptime = vehicle_info.mLastLapTime
                in_pits = vehicle_info.mInPits

                # Only record data if not in pits
                should_record = not in_pits

                if should_record:
                    # Capture ALL raw telemetry fields (~280+ fields)
                    raw_data = capture_raw_telemetry(rf2_sim)
                    lap_data.append(raw_data)

                # Detect lap change to write CSV
                if prev_lap_number is not None and current_lap != prev_lap_number:
                    # Validate PREVIOUS lap using snapshot taken BEFORE lap change
                    if prev_lap_snapshot is not None:
                        prev_laptime = prev_lap_snapshot["last_laptime"]
                        prev_in_pits = prev_lap_snapshot["in_pits"]

                        # Lap is valid if: positive laptime AND not completed in pits
                        is_valid_lap = (
                            prev_laptime is not None
                            and prev_laptime > 0
                            and not prev_in_pits
                        )

                        if is_valid_lap:
                            logging.info(
                                f"Valid lap detected: {prev_lap_number}, "
                                f"time: {prev_laptime:.3f}s, "
                                f"samples: {len(lap_data)}"
                            )
                            # Write complete raw telemetry to single CSV
                            write_lap_csv(prev_lap_number, lap_data)
                        else:
                            logging.info(
                                f"Invalid lap {prev_lap_number} discarded "
                                f"(laptime: {prev_laptime}, in_pits: {prev_in_pits})"
                            )

                    # Clear the data after processing
                    lap_data = []

                # Store snapshot for next lap change validation
                prev_lap_snapshot = {
                    "last_laptime": last_laptime,
                    "in_pits": in_pits,
                }
                prev_lap_number = current_lap

                # Print minimal info
                if not first_struct_dumped:
                    print("--- Full Telemetry Struct Dump ---")
                    for field_name, _ in rf2_sim.info.rf2TeleVeh()._fields_:
                        print(
                            field_name, getattr(rf2_sim.info.rf2TeleVeh(), field_name)
                        )
                    print("--- End Dump ---")
                    first_struct_dumped = True

                v = rf2_sim.info.rf2TeleVeh().mLocalVel  # m/s in vehicle-local axes
                speed_kph = (v.x**2 + v.y**2 + v.z**2) ** 0.5 * 3.6

                print(
                    f"RPM: {rf2_sim.info.rf2TeleVeh().mEngineRPM}",
                    f"Gear: {rf2_sim.info.rf2TeleVeh().mGear}",
                    f"Speed: {speed_kph:.1f} km/h",
                    f"Recording: {'Yes' if should_record else 'No'}",
                )

            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\nLogger stopped by user")
    finally:
        # Flush remaining lap data on exit
        if prev_lap_number is not None and prev_lap_snapshot is not None:
            prev_laptime = prev_lap_snapshot["last_laptime"]
            prev_in_pits = prev_lap_snapshot["in_pits"]

            is_valid_lap = (
                prev_laptime is not None and prev_laptime > 0 and not prev_in_pits
            )

            if is_valid_lap and lap_data:
                logging.info(
                    f"Flushing final lap {prev_lap_number} "
                    f"(time: {prev_laptime:.3f}s, samples: {len(lap_data)})"
                )
                write_lap_csv(prev_lap_number, lap_data)

        rf2_sim.stop()


if __name__ == "__main__":
    run_logger()
