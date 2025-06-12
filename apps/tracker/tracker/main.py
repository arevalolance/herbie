import time
import logging
import csv
import os

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

# Telemetry fields to record per sample
SAMPLE_FIELDS = [
    "elapsed_time",
    "lap_number",
    "speed_kph",
    "gear",
    "rpm",
    "throttle",
    "brake",
    "steering",
    "pos_x",
    "pos_y",
    "pos_z",
    "acc_x",
    "acc_y",
    "acc_z",
    "sector",
    "lap_dist",
    "path_lateral",
    "track_edge",
    "surface_fl",
    "surface_fr",
    "surface_rl",
    "surface_rr",
    "lap_valid",
]

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

    telemetry_data = rf2_sim.dataset()

    print("Logger connected. Monitoring telemetry data... (Press Ctrl+C to exit)")
    lap_data: list[dict] = []  # samples collected for the current lap
    prev_lap_number = None
    first_struct_dumped = False
    try:
        while True:
            # Check if the sim is running and sending data
            if not rf2_sim.info.isPaused:

                # Option A: Use the high-level accessors from rf2_data.py
                # Cache telemetry & scoring structs for this tick to avoid redundant calls
                tele_veh = rf2_sim.info.rf2TeleVeh()
                scor_veh = rf2_sim.info.rf2ScorVeh()

                rpm = telemetry_data.engine.rpm()
                speed_kph = telemetry_data.vehicle.speed() * 3.6
                gear = telemetry_data.engine.gear()
                throttle = tele_veh.mFilteredThrottle
                brake = tele_veh.mFilteredBrake
                steering = tele_veh.mFilteredSteering
                pos = tele_veh.mPos
                accel = tele_veh.mLocalAccel
                elapsed_time = tele_veh.mElapsedTime
                lap_number = tele_veh.mLapNumber
                sector = telemetry_data.lap.sector_index()

                # Additional requested data
                lap_dist = scor_veh.mLapDist
                path_lateral = scor_veh.mPathLateral
                track_edge = scor_veh.mTrackEdge

                # Lap validity: using CountLapFlag (0=invalid, 1/2=valid)
                count_lap_flag = scor_veh.mCountLapFlag if hasattr(scor_veh, "mCountLapFlag") else 0
                lap_valid = count_lap_flag in (1, 2)

                # Per-wheel surface types (0=dry, 1=wet, 2=grass, 3=dirt, 4=gravel, 5=rumblestrip, 6=special)
                surface_fl = tele_veh.mWheels[0].mSurfaceType  # Front Left
                surface_fr = tele_veh.mWheels[1].mSurfaceType  # Front Right
                surface_rl = tele_veh.mWheels[2].mSurfaceType  # Rear Left
                surface_rr = tele_veh.mWheels[3].mSurfaceType  # Rear Right

                # Collect data for CSV
                sample = {
                    "elapsed_time": elapsed_time,
                    "lap_number": lap_number,
                    "speed_kph": speed_kph,
                    "gear": gear,
                    "rpm": rpm,
                    "throttle": throttle,
                    "brake": brake,
                    "steering": steering,
                    "sector": sector,
                    "pos_x": pos.x,
                    "pos_y": pos.y,
                    "pos_z": pos.z,
                    "acc_x": accel.x,
                    "acc_y": accel.y,
                    "acc_z": accel.z,
                    "lap_dist": lap_dist,
                    "path_lateral": path_lateral,
                    "track_edge": track_edge,
                    "surface_fl": surface_fl,
                    "surface_fr": surface_fr,
                    "surface_rl": surface_rl,
                    "surface_rr": surface_rr,
                    "lap_valid": lap_valid,
                }

                lap_data.append(sample)

                # Detect lap change to write CSV
                if prev_lap_number is not None and lap_number != prev_lap_number:
                    # Check if the previous lap is valid
                    last_lap_time = rf2_sim.info.rf2ScorVeh().mLastLapTime
                    lap_was_valid = lap_data and lap_data[-1].get("lap_valid", False)
                    if last_lap_time and last_lap_time > 0 and lap_was_valid:
                        csv_path = os.path.join(LOG_DIR, f"lap_{prev_lap_number}.csv")
                        with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
                            writer = csv.DictWriter(csvfile, fieldnames=SAMPLE_FIELDS)
                            writer.writeheader()
                            writer.writerows(lap_data)
                        print(f"Saved telemetry for lap {prev_lap_number} to {csv_path}")
                    else:
                        print(f"Skipped lap {prev_lap_number} (invalid or no lap time)")
                    lap_data.clear()

                prev_lap_number = lap_number

                # Option B: Get the entire raw telemetry data structure
                # This is useful if you want to log EVERYTHING
                raw_telemetry_struct = rf2_sim.info.rf2TeleVeh()

                # Print a summary (first time) and always minimal info
                if not first_struct_dumped:
                    print("--- Full Telemetry Struct Dump ---")
                    for field_name, _ in raw_telemetry_struct._fields_:
                        print(field_name, getattr(raw_telemetry_struct, field_name))
                    print("--- End Dump ---")
                    first_struct_dumped = True

                print(
                    f"RPM: {rpm}",
                    f"Speed: {speed_kph:.1f} km/h",
                    f"Gear: {gear}",
                )

            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\nLogger stopped by user")
    finally:
        # Flush remaining lap data on exit
        if lap_data and prev_lap_number is not None:
            last_lap_time = rf2_sim.info.rf2ScorVeh().mLastLapTime
            lap_was_valid = lap_data and lap_data[-1].get("lap_valid", False)
            if last_lap_time and last_lap_time > 0 and lap_was_valid:
                csv_path = os.path.join(LOG_DIR, f"lap_{prev_lap_number}.csv")
                with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
                    writer = csv.DictWriter(csvfile, fieldnames=SAMPLE_FIELDS)
                    writer.writeheader()
                    writer.writerows(lap_data)
                print(f"Saved telemetry for lap {prev_lap_number} to {csv_path}")
            else:
                print(f"Skipped lap {prev_lap_number} (invalid or no lap time)")

        rf2_sim.stop()

if __name__ == "__main__":
    run_logger()
