"""
Telemetry importer for Convex with snapshot architecture.

Imports telemetry CSVs into physicsSamples (high-freq ~90Hz) and scoringSnapshots (low-freq ~5Hz).

Usage:
  python import_telemetry.py --user-id <USER_ID> --logs-dir tracker/tracker/telemetry_logs --convex-url https://your-deployment.convex.cloud [--admin-key <TOKEN>] [--chunk-size 200]
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

import httpx


CSV_NAME_RE = re.compile(r"lap_(\d+)_(.+)\.csv$")
# Support both old format (multiple CSVs) and new format (physics + scoring)
SNAPSHOT_FORMAT = re.compile(r"lap_(\d+)_(physics|scoring)\.csv$")


def chunked(items: Sequence[Mapping], size: int) -> Iterable[List[Mapping]]:
    for i in range(0, len(items), size):
        yield list(items[i : i + size])


def to_bool(value: str | int | float | bool | None) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return value != 0
    return str(value).lower() in {"true", "1", "yes", "y"}


def to_float(value: str | int | float | None) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def read_csv(path: Path) -> List[Dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return [dict(row) for row in reader]


@dataclass
class LapFiles:
    # Old format (separate CSVs per data type)
    lap: Optional[Path] = None
    timing: Optional[Path] = None
    session: Optional[Path] = None
    brake: Optional[Path] = None
    tyre: Optional[Path] = None
    wheel: Optional[Path] = None
    engine: Optional[Path] = None
    electric_motor: Optional[Path] = None
    inputs: Optional[Path] = None
    switch: Optional[Path] = None
    vehicle: Optional[Path] = None

    # New format (snapshot CSVs)
    physics: Optional[Path] = None
    scoring: Optional[Path] = None


class ConvexClient:
    """
    Minimal Convex HTTP client.
    Assumes functions are available at `${convex_url}/api/<module>:<fn>`.
    Uses Bearer auth if an admin key is provided.
    """

    def __init__(self, base_url: str, admin_key: Optional[str]) -> None:
        self.base_url = base_url.rstrip("/")
        self.admin_key = admin_key
        self._client = httpx.AsyncClient(timeout=30)

    async def call(self, function: str, args: Mapping) -> Mapping:
        # Convert "importer:functionName" to "/importer/functionName"
        if ":" in function:
            module, fn = function.split(":", 1)
            url = f"{self.base_url}/{module}/{fn}"
        else:
            url = f"{self.base_url}/{function}"
        headers = {"Content-Type": "application/json"}
        if self.admin_key:
            headers["Authorization"] = f"Bearer {self.admin_key}"
        # Filter out None values - Convex v.optional() expects fields to be absent, not null
        filtered_args = {k: v for k, v in args.items() if v is not None}
        resp = await self._client.post(url, headers=headers, json={"args": filtered_args})
        resp.raise_for_status()
        if resp.content:
            return resp.json()
        return {}

    async def close(self) -> None:
        await self._client.aclose()


def discover_lap_files(logs_dir: Path) -> Dict[int, LapFiles]:
    laps: Dict[int, LapFiles] = {}
    for entry in logs_dir.iterdir():
        if not entry.is_file():
            continue
        match = CSV_NAME_RE.match(entry.name)
        if not match:
            continue
        lap_num = int(match.group(1))
        kind = match.group(2)
        lap_files = laps.setdefault(lap_num, LapFiles())
        if hasattr(lap_files, kind):
            setattr(lap_files, kind, entry)
    return laps


def merge_by_elapsed(primary: List[Dict[str, str]], others: List[Dict[str, str]]) -> Dict[float, Dict[str, str]]:
    """Merge multiple CSV sources by elapsed_time."""
    merged: Dict[float, Dict[str, str]] = {}
    for row in primary:
        t = to_float(row.get("elapsed_time"))
        merged[t] = dict(row)
    for row in others:
        t = to_float(row.get("elapsed_time"))
        base = merged.setdefault(t, {})
        base.update(row)
    return merged


async def create_session(
    convex: ConvexClient, user_id: str, session_rows: List[Dict[str, str]], vehicle_rows: List[Dict[str, str]]
) -> str:
    session_row = session_rows[0]
    vehicle_row = vehicle_rows[0] if vehicle_rows else {}
    args = {
        "userId": user_id,
        "trackName": session_row.get("track_name", ""),
        "vehicleName": vehicle_row.get("vehicle_name", ""),
        "className": vehicle_row.get("class_name", ""),
        "driverName": vehicle_row.get("driver_name", ""),
        "sessionType": to_float(session_row.get("session_type")),
        "ambientTemperature": to_float(session_row.get("ambient_temperature")),
        "trackTemperature": to_float(session_row.get("track_temperature")),
        "startTime": to_float(session_row.get("start")),
        "endTime": to_float(session_row.get("end")) if session_row.get("end") else None,
    }
    result = await convex.call("importer:createSession", args)
    return result if isinstance(result, str) else result.get("id", result)


def build_lap_metadata(
    lap_number: int,
    timing_rows: List[Dict[str, str]],
    vehicle_rows: List[Dict[str, str]],
    progress_rows: List[Dict[str, str]],
) -> Tuple[float, float, Optional[float], Optional[float], Optional[float], Optional[float], bool]:
    elapsed_values = [to_float(r.get("elapsed_time")) for r in (timing_rows + vehicle_rows + progress_rows)]
    start_time = min(elapsed_values) if elapsed_values else 0.0
    end_time = max(elapsed_values) if elapsed_values else None

    lap_time_candidates = [
        to_float(r.get("current_laptime")) for r in timing_rows if to_float(r.get("current_laptime")) > 0
    ] + [to_float(r.get("last_laptime")) for r in timing_rows if to_float(r.get("last_laptime")) > 0]
    lap_time = lap_time_candidates[-1] if lap_time_candidates else None

    best_s1_candidates = [to_float(r.get("best_sector1")) for r in timing_rows if to_float(r.get("best_sector1")) > 0]
    best_s2_candidates = [to_float(r.get("best_sector2")) for r in timing_rows if to_float(r.get("best_sector2")) > 0]
    best_sector1 = best_s1_candidates[-1] if best_s1_candidates else None
    best_sector2 = best_s2_candidates[-1] if best_s2_candidates else None

    sector1_candidates = [to_float(r.get("last_sector1")) for r in timing_rows if to_float(r.get("last_sector1")) > 0]
    sector2_candidates = [to_float(r.get("last_sector2")) for r in timing_rows if to_float(r.get("last_sector2")) > 0]
    sector1_time = sector1_candidates[-1] if sector1_candidates else None
    sector2_time = sector2_candidates[-1] if sector2_candidates else None

    finish_state_values = [to_float(r.get("finish_state")) for r in vehicle_rows if "finish_state" in r]
    is_valid = not finish_state_values or finish_state_values[-1] == 0
    return start_time, end_time or None, lap_time, best_sector1, best_sector2, sector1_time, is_valid


async def create_lap(convex: ConvexClient, session_id: str, lap_number: int, meta: Tuple) -> str:
    start_time, end_time, lap_time, best_s1, best_s2, sector1, is_valid = meta
    args = {
        "sessionId": session_id,
        "lapNumber": lap_number,
        "lapTime": lap_time,
        "bestSector1": best_s1,
        "bestSector2": best_s2,
        "sector1Time": sector1,
        "sector2Time": None,
        "isValid": is_valid,
        "startTime": start_time,
        "endTime": end_time,
    }
    result = await convex.call("importer:createLap", args)
    return result if isinstance(result, str) else result.get("id", result)


# =============================================================================
# BUILD PHYSICS SAMPLES (HIGH-FREQUENCY ~90Hz)
# Merges brake, tyre, wheel, engine, motor, inputs, vehicle, lap data
# =============================================================================

def build_physics_samples(
    lap_id: str,
    brake_rows: List[Dict[str, str]],
    tyre_rows: List[Dict[str, str]],
    wheel_rows: List[Dict[str, str]],
    engine_rows: List[Dict[str, str]],
    motor_rows: List[Dict[str, str]],
    inputs_rows: List[Dict[str, str]],
    vehicle_rows: List[Dict[str, str]],
    lap_rows: List[Dict[str, str]],
) -> List[Mapping]:
    """Build physicsSamples rows from high-frequency telemetry data."""
    # Merge all high-freq data by elapsed_time
    merged = merge_by_elapsed(
        brake_rows,
        tyre_rows + wheel_rows + engine_rows + motor_rows + inputs_rows + vehicle_rows + lap_rows
    )

    rows: List[Mapping] = []
    for elapsed, row in merged.items():
        rows.append({
            "lapId": lap_id,
            "sampleTime": elapsed,

            # Brake data
            "brakeBiasFront": to_float(row.get("bias_front")),
            "brakePressure_0": to_float(row.get("pressure_0")),
            "brakePressure_1": to_float(row.get("pressure_1")),
            "brakePressure_2": to_float(row.get("pressure_2")),
            "brakePressure_3": to_float(row.get("pressure_3")),
            "brakeTemperature_0": to_float(row.get("temperature_0")),
            "brakeTemperature_1": to_float(row.get("temperature_1")),
            "brakeTemperature_2": to_float(row.get("temperature_2")),
            "brakeTemperature_3": to_float(row.get("temperature_3")),

            # Tyre data
            "tyreCarcassTemp_0": to_float(row.get("carcass_temperature_0")),
            "tyreCarcassTemp_1": to_float(row.get("carcass_temperature_1")),
            "tyreCarcassTemp_2": to_float(row.get("carcass_temperature_2")),
            "tyreCarcassTemp_3": to_float(row.get("carcass_temperature_3")),
            "tyreCompound_0": to_float(row.get("compound_0")),
            "tyreCompound_1": to_float(row.get("compound_1")),
            "tyreCompound_2": to_float(row.get("compound_2")),
            "tyreCompound_3": to_float(row.get("compound_3")),
            "tyreCompoundNameFront": row.get("compound_name_front", "") or "",
            "tyreCompoundNameRear": row.get("compound_name_rear", "") or "",
            "tyrePressure_0": to_float(row.get("pressure_0")),
            "tyrePressure_1": to_float(row.get("pressure_1")),
            "tyrePressure_2": to_float(row.get("pressure_2")),
            "tyrePressure_3": to_float(row.get("pressure_3")),
            "tyreSurfaceTempAvg_0": to_float(row.get("surface_temperature_avg_0")),
            "tyreSurfaceTempAvg_1": to_float(row.get("surface_temperature_avg_1")),
            "tyreSurfaceTempAvg_2": to_float(row.get("surface_temperature_avg_2")),
            "tyreSurfaceTempAvg_3": to_float(row.get("surface_temperature_avg_3")),
            "tyreSurfaceTempLeft_0": to_float(row.get("surface_temperature_ico_0")),
            "tyreSurfaceTempLeft_1": to_float(row.get("surface_temperature_ico_3")),
            "tyreSurfaceTempLeft_2": to_float(row.get("surface_temperature_ico_6")),
            "tyreSurfaceTempLeft_3": to_float(row.get("surface_temperature_ico_9")),
            "tyreSurfaceTempCenter_0": to_float(row.get("surface_temperature_ico_1")),
            "tyreSurfaceTempCenter_1": to_float(row.get("surface_temperature_ico_4")),
            "tyreSurfaceTempCenter_2": to_float(row.get("surface_temperature_ico_7")),
            "tyreSurfaceTempCenter_3": to_float(row.get("surface_temperature_ico_10")),
            "tyreSurfaceTempRight_0": to_float(row.get("surface_temperature_ico_2")),
            "tyreSurfaceTempRight_1": to_float(row.get("surface_temperature_ico_5")),
            "tyreSurfaceTempRight_2": to_float(row.get("surface_temperature_ico_8")),
            "tyreSurfaceTempRight_3": to_float(row.get("surface_temperature_ico_11")),
            "tyreInnerTempAvg_0": to_float(row.get("inner_temperature_avg_0")),
            "tyreInnerTempAvg_1": to_float(row.get("inner_temperature_avg_1")),
            "tyreInnerTempAvg_2": to_float(row.get("inner_temperature_avg_2")),
            "tyreInnerTempAvg_3": to_float(row.get("inner_temperature_avg_3")),
            "tyreWear_0": to_float(row.get("wear_0")),
            "tyreWear_1": to_float(row.get("wear_1")),
            "tyreWear_2": to_float(row.get("wear_2")),
            "tyreWear_3": to_float(row.get("wear_3")),
            "tyreLoad_0": to_float(row.get("load_0")),
            "tyreLoad_1": to_float(row.get("load_1")),
            "tyreLoad_2": to_float(row.get("load_2")),
            "tyreLoad_3": to_float(row.get("load_3")),

            # Wheel & suspension data
            "wheelSpeed_0": to_float(row.get("rotation_0")),
            "wheelSpeed_1": to_float(row.get("rotation_1")),
            "wheelSpeed_2": to_float(row.get("rotation_2")),
            "wheelSpeed_3": to_float(row.get("rotation_3")),
            "suspensionDeflection_0": to_float(row.get("suspension_deflection_0")),
            "suspensionDeflection_1": to_float(row.get("suspension_deflection_1")),
            "suspensionDeflection_2": to_float(row.get("suspension_deflection_2")),
            "suspensionDeflection_3": to_float(row.get("suspension_deflection_3")),
            "rideHeight_0": to_float(row.get("ride_height_0")),
            "rideHeight_1": to_float(row.get("ride_height_1")),
            "rideHeight_2": to_float(row.get("ride_height_2")),
            "rideHeight_3": to_float(row.get("ride_height_3")),
            "camber_0": to_float(row.get("camber_0")),
            "camber_1": to_float(row.get("camber_1")),
            "camber_2": to_float(row.get("camber_2")),
            "camber_3": to_float(row.get("camber_3")),
            "slipAngleFl": to_float(row.get("slip_angle_fl")),
            "slipAngleFr": to_float(row.get("slip_angle_fr")),
            "slipAngleRl": to_float(row.get("slip_angle_rl")),
            "slipAngleRr": to_float(row.get("slip_angle_rr")),
            "isDetached_0": to_bool(row.get("is_detached_0")),
            "isDetached_1": to_bool(row.get("is_detached_1")),
            "isDetached_2": to_bool(row.get("is_detached_2")),
            "isDetached_3": to_bool(row.get("is_detached_3")),
            "surfaceType_0": to_float(row.get("surface_type_0")),
            "surfaceType_1": to_float(row.get("surface_type_1")),
            "surfaceType_2": to_float(row.get("surface_type_2")),
            "surfaceType_3": to_float(row.get("surface_type_3")),

            # Engine & powertrain data
            "engineRpm": to_float(row.get("rpm")),
            "engineRpmMax": to_float(row.get("rpm_max")),
            "engineGear": to_float(row.get("gear")),
            "engineGearMax": to_float(row.get("gear_max")),
            "engineOilTemp": to_float(row.get("oil_temperature")),
            "engineWaterTemp": to_float(row.get("water_temperature")),
            "engineTorque": to_float(row.get("torque")),
            "turboBoost": to_float(row.get("turbo")),

            # Electric motor data
            "batteryCharge": to_float(row.get("battery_charge")),
            "motorRpm": to_float(row.get("motor_rpm") or row.get("rpm")),
            "motorTorque": to_float(row.get("motor_torque") or row.get("torque")),
            "motorTemp": to_float(row.get("motor_temperature")),
            "motorWaterTemp": to_float(row.get("motor_water_temperature") or row.get("water_temperature")),
            "motorState": to_float(row.get("state") or row.get("motor_state")),

            # Driver inputs
            "throttle": to_float(row.get("throttle")),
            "throttleRaw": to_float(row.get("throttle_raw")),
            "brake": to_float(row.get("brake")),
            "brakeRaw": to_float(row.get("brake_raw")),
            "clutch": to_float(row.get("clutch")),
            "clutchRaw": to_float(row.get("clutch_raw")),
            "steering": to_float(row.get("steering")),
            "steeringRaw": to_float(row.get("steering_raw")),
            "steeringRangePhysical": to_float(row.get("steering_range_physical")),
            "steeringRangeVisual": to_float(row.get("steering_range_visual")),
            "steeringShaftTorque": to_float(row.get("steering_shaft_torque")),
            "forceFeedback": to_float(row.get("force_feedback")),

            # Vehicle dynamics
            "positionX": to_float(row.get("position_xyz_0")),
            "positionY": to_float(row.get("position_xyz_1")),
            "positionZ": to_float(row.get("position_xyz_2")),
            "velocityLateral": to_float(row.get("velocity_lateral")),
            "velocityLongitudinal": to_float(row.get("velocity_longitudinal")),
            "velocityVertical": to_float(row.get("velocity_vertical")),
            "speed": to_float(row.get("speed")),
            "accelLateral": to_float(row.get("accel_lateral")),
            "accelLongitudinal": to_float(row.get("accel_longitudinal")),
            "accelVertical": to_float(row.get("accel_vertical")),
            "orientationYaw": to_float(row.get("orientation_yaw_radians")),
            "rotationLateral": to_float(row.get("rotation_lateral")),
            "rotationLongitudinal": to_float(row.get("rotation_longitudinal")),
            "rotationVertical": to_float(row.get("rotation_vertical")),

            # Fuel & damage
            "fuel": to_float(row.get("fuel")),
            "damageSeverity_0": to_float(row.get("damage_severity_0")),
            "damageSeverity_1": to_float(row.get("damage_severity_1")),
            "damageSeverity_2": to_float(row.get("damage_severity_2")),
            "damageSeverity_3": to_float(row.get("damage_severity_3")),
            "damageSeverity_4": to_float(row.get("damage_severity_4")),
            "damageSeverity_5": to_float(row.get("damage_severity_5")),
            "damageSeverity_6": to_float(row.get("damage_severity_6")),
            "damageSeverity_7": to_float(row.get("damage_severity_7")),

            # Track position
            "distance": to_float(row.get("distance")),
            "progress": to_float(row.get("progress")),
            "pathLateral": to_float(row.get("path_lateral")),
            "trackEdge": to_float(row.get("track_edge")),
        })
    return rows


# =============================================================================
# BUILD SCORING SNAPSHOTS (LOW-FREQUENCY ~5Hz)
# Merges timing, session, vehicle state, lap progress data
# =============================================================================

def build_scoring_snapshots(
    lap_id: str,
    timing_rows: List[Dict[str, str]],
    session_rows: List[Dict[str, str]],
    vehicle_rows: List[Dict[str, str]],
    lap_rows: List[Dict[str, str]],
    switch_rows: List[Dict[str, str]],
) -> List[Mapping]:
    """Build scoringSnapshots rows from low-frequency scoring data."""
    # Merge all low-freq data by elapsed_time
    merged = merge_by_elapsed(timing_rows, session_rows + vehicle_rows + lap_rows + switch_rows)

    rows: List[Mapping] = []
    for elapsed, row in merged.items():
        # Determine update trigger based on available data
        trigger = "periodic"
        if to_float(row.get("current_sector1")) > 0 and to_float(row.get("current_sector2")) <= 0:
            trigger = "sector_complete"
        elif to_float(row.get("last_laptime")) > 0:
            trigger = "lap_complete"
        elif "place" in row:
            trigger = "position_change"

        rows.append({
            "lapId": lap_id,
            "snapshotTime": elapsed,
            "updateTrigger": trigger,

            # Timing data
            "behindLeader": to_float(row.get("behind_leader")),
            "behindNext": to_float(row.get("behind_next")),
            "bestLaptime": to_float(row.get("best_laptime")),
            "bestSector1": to_float(row.get("best_sector1")),
            "bestSector2": to_float(row.get("best_sector2")),
            "currentLaptime": to_float(row.get("current_laptime")),
            "currentSector1": to_float(row.get("current_sector1")),
            "currentSector2": to_float(row.get("current_sector2")),
            "lastLaptime": to_float(row.get("last_laptime")),
            "lastSector1": to_float(row.get("last_sector1")),
            "lastSector2": to_float(row.get("last_sector2")),
            "deltaBest": to_float(row.get("delta_best")),
            "estimatedLaptime": to_float(row.get("estimated_laptime")),
            "estimatedTimeInto": to_float(row.get("estimated_time_into")),

            # Lap progress
            "sectorIndex": to_float(row.get("sector_index")),
            "trackLength": to_float(row.get("track_length")),

            # Vehicle state (from scoring)
            "positionLateral": to_float(row.get("position_lateral")),
            "inGarage": to_bool(row.get("in_garage")),
            "inPits": to_bool(row.get("in_pits")),
            "isPlayer": to_bool(row.get("is_player")),
            "place": to_float(row.get("place")),
            "finishState": to_float(row.get("finish_state")),

            # Session state
            "greenFlag": to_bool(row.get("green_flag")),
            "yellowFlag": to_bool(row.get("yellow_flag")),
            "blueFlag": to_bool(row.get("blue_flag")),
            "inRace": to_bool(row.get("in_race")),
            "inCountdown": to_bool(row.get("in_countdown")),
            "inFormation": to_bool(row.get("in_formation")),
            "pitOpen": to_bool(row.get("pit_open")),
            "raininess": to_float(row.get("raininess")),
            "wetnessAverage": to_float(row.get("wetness_average")),
            "wetnessMinimum": to_float(row.get("wetness_minimum")),
            "wetnessMaximum": to_float(row.get("wetness_maximum")),
            "sessionElapsed": to_float(row.get("elapsed")),
            "sessionRemaining": to_float(row.get("remaining")),

            # Switches (rarely change)
            "autoClutch": to_bool(row.get("auto_clutch")),
            "drsStatus": to_float(row.get("drs_status")),
            "headlights": to_bool(row.get("headlights")),
            "ignitionStarter": to_float(row.get("ignition_starter")),
            "speedLimiter": to_float(row.get("speed_limiter")),
        })
    return rows


async def upload_batches(convex: ConvexClient, fn: str, rows: List[Mapping], chunk_size: int) -> None:
    for chunk in chunked(rows, chunk_size):
        if not chunk:
            continue
        await convex.call(fn, {"rows": chunk})


async def import_lap_snapshot_format(convex: ConvexClient, session_id: str, lap_number: int, lap_files: LapFiles, chunk_size: int) -> None:
    """Import lap using new snapshot CSV format (lap_X_physics.csv + lap_X_scoring.csv)"""
    # Load snapshot CSVs
    physics_rows = read_csv(lap_files.physics) if lap_files.physics else []
    scoring_rows = read_csv(lap_files.scoring) if lap_files.scoring else []

    if not physics_rows and not scoring_rows:
        return

    # Build lap metadata from scoring snapshots (they have timing data)
    if scoring_rows:
        start_time = min(to_float(r.get("elapsed_time")) for r in scoring_rows)
        end_time = max(to_float(r.get("elapsed_time")) for r in scoring_rows)
        lap_time_val = max((to_float(r.get("last_laptime")) for r in scoring_rows if to_float(r.get("last_laptime")) > 0), default=None)
        best_s1 = max((to_float(r.get("best_sector1")) for r in scoring_rows if to_float(r.get("best_sector1")) > 0), default=None)
        best_s2 = max((to_float(r.get("best_sector2")) for r in scoring_rows if to_float(r.get("best_sector2")) > 0), default=None)
        sector1_val = max((to_float(r.get("last_sector1")) for r in scoring_rows if to_float(r.get("last_sector1")) > 0), default=None)
        finish_vals = [to_float(r.get("finish_state")) for r in scoring_rows if "finish_state" in r]
        is_valid = not finish_vals or finish_vals[-1] == 0
    else:
        # Fallback to physics data
        start_time = min(to_float(r.get("elapsed_time")) for r in physics_rows)
        end_time = max(to_float(r.get("elapsed_time")) for r in physics_rows)
        lap_time_val = None
        best_s1 = None
        best_s2 = None
        sector1_val = None
        is_valid = True

    # Create lap
    meta = (start_time, end_time, lap_time_val, best_s1, best_s2, sector1_val, is_valid)
    lap_id = await create_lap(convex, session_id, lap_number, meta)

    # Upload physics samples (already in correct format)
    if physics_rows:
        physics_samples = []
        for row in physics_rows:
            physics_samples.append({
                "lapId": lap_id,
                "sampleTime": to_float(row.get("elapsed_time")),
                "brakeBiasFront": to_float(row.get("bias_front")),
                "brakePressure_0": to_float(row.get("pressure_0")),
                "brakePressure_1": to_float(row.get("pressure_1")),
                "brakePressure_2": to_float(row.get("pressure_2")),
                "brakePressure_3": to_float(row.get("pressure_3")),
                "brakeTemperature_0": to_float(row.get("temperature_0")),
                "brakeTemperature_1": to_float(row.get("temperature_1")),
                "brakeTemperature_2": to_float(row.get("temperature_2")),
                "brakeTemperature_3": to_float(row.get("temperature_3")),
                "tyreCarcassTemp_0": to_float(row.get("carcass_temperature_0")),
                "tyreCarcassTemp_1": to_float(row.get("carcass_temperature_1")),
                "tyreCarcassTemp_2": to_float(row.get("carcass_temperature_2")),
                "tyreCarcassTemp_3": to_float(row.get("carcass_temperature_3")),
                "tyreCompound_0": to_float(row.get("compound_0")),
                "tyreCompound_1": to_float(row.get("compound_1")),
                "tyreCompound_2": to_float(row.get("compound_2")),
                "tyreCompound_3": to_float(row.get("compound_3")),
                "tyreCompoundNameFront": row.get("compound_name_front", "") or "",
                "tyreCompoundNameRear": row.get("compound_name_rear", "") or "",
                "tyrePressure_0": to_float(row.get("tyre_pressure_0")),
                "tyrePressure_1": to_float(row.get("tyre_pressure_1")),
                "tyrePressure_2": to_float(row.get("tyre_pressure_2")),
                "tyrePressure_3": to_float(row.get("tyre_pressure_3")),
                "tyreSurfaceTempAvg_0": to_float(row.get("surface_temperature_avg_0")),
                "tyreSurfaceTempAvg_1": to_float(row.get("surface_temperature_avg_1")),
                "tyreSurfaceTempAvg_2": to_float(row.get("surface_temperature_avg_2")),
                "tyreSurfaceTempAvg_3": to_float(row.get("surface_temperature_avg_3")),
                "tyreSurfaceTempLeft_0": to_float(row.get("surface_temperature_ico_0")),
                "tyreSurfaceTempLeft_1": to_float(row.get("surface_temperature_ico_3")),
                "tyreSurfaceTempLeft_2": to_float(row.get("surface_temperature_ico_6")),
                "tyreSurfaceTempLeft_3": to_float(row.get("surface_temperature_ico_9")),
                "tyreSurfaceTempCenter_0": to_float(row.get("surface_temperature_ico_1")),
                "tyreSurfaceTempCenter_1": to_float(row.get("surface_temperature_ico_4")),
                "tyreSurfaceTempCenter_2": to_float(row.get("surface_temperature_ico_7")),
                "tyreSurfaceTempCenter_3": to_float(row.get("surface_temperature_ico_10")),
                "tyreSurfaceTempRight_0": to_float(row.get("surface_temperature_ico_2")),
                "tyreSurfaceTempRight_1": to_float(row.get("surface_temperature_ico_5")),
                "tyreSurfaceTempRight_2": to_float(row.get("surface_temperature_ico_8")),
                "tyreSurfaceTempRight_3": to_float(row.get("surface_temperature_ico_11")),
                "tyreInnerTempAvg_0": to_float(row.get("inner_temperature_avg_0")),
                "tyreInnerTempAvg_1": to_float(row.get("inner_temperature_avg_1")),
                "tyreInnerTempAvg_2": to_float(row.get("inner_temperature_avg_2")),
                "tyreInnerTempAvg_3": to_float(row.get("inner_temperature_avg_3")),
                "tyreWear_0": to_float(row.get("wear_0")),
                "tyreWear_1": to_float(row.get("wear_1")),
                "tyreWear_2": to_float(row.get("wear_2")),
                "tyreWear_3": to_float(row.get("wear_3")),
                "tyreLoad_0": to_float(row.get("load_0")),
                "tyreLoad_1": to_float(row.get("load_1")),
                "tyreLoad_2": to_float(row.get("load_2")),
                "tyreLoad_3": to_float(row.get("load_3")),
                "wheelSpeed_0": to_float(row.get("rotation_0")),
                "wheelSpeed_1": to_float(row.get("rotation_1")),
                "wheelSpeed_2": to_float(row.get("rotation_2")),
                "wheelSpeed_3": to_float(row.get("rotation_3")),
                "suspensionDeflection_0": to_float(row.get("suspension_deflection_0")),
                "suspensionDeflection_1": to_float(row.get("suspension_deflection_1")),
                "suspensionDeflection_2": to_float(row.get("suspension_deflection_2")),
                "suspensionDeflection_3": to_float(row.get("suspension_deflection_3")),
                "rideHeight_0": to_float(row.get("ride_height_0")),
                "rideHeight_1": to_float(row.get("ride_height_1")),
                "rideHeight_2": to_float(row.get("ride_height_2")),
                "rideHeight_3": to_float(row.get("ride_height_3")),
                "camber_0": to_float(row.get("camber_0")),
                "camber_1": to_float(row.get("camber_1")),
                "camber_2": to_float(row.get("camber_2")),
                "camber_3": to_float(row.get("camber_3")),
                "slipAngleFl": to_float(row.get("slip_angle_fl")),
                "slipAngleFr": to_float(row.get("slip_angle_fr")),
                "slipAngleRl": to_float(row.get("slip_angle_rl")),
                "slipAngleRr": to_float(row.get("slip_angle_rr")),
                "isDetached_0": to_bool(row.get("is_detached_0")),
                "isDetached_1": to_bool(row.get("is_detached_1")),
                "isDetached_2": to_bool(row.get("is_detached_2")),
                "isDetached_3": to_bool(row.get("is_detached_3")),
                "surfaceType_0": to_float(row.get("surface_type_0")),
                "surfaceType_1": to_float(row.get("surface_type_1")),
                "surfaceType_2": to_float(row.get("surface_type_2")),
                "surfaceType_3": to_float(row.get("surface_type_3")),
                "engineRpm": to_float(row.get("rpm")),
                "engineRpmMax": to_float(row.get("rpm_max")),
                "engineGear": to_float(row.get("gear")),
                "engineGearMax": to_float(row.get("gear_max")),
                "engineOilTemp": to_float(row.get("oil_temperature")),
                "engineWaterTemp": to_float(row.get("water_temperature")),
                "engineTorque": to_float(row.get("torque")),
                "turboBoost": to_float(row.get("turbo")),
                "batteryCharge": to_float(row.get("battery_charge")),
                "motorRpm": to_float(row.get("motor_rpm")),
                "motorTorque": to_float(row.get("motor_torque")),
                "motorTemp": to_float(row.get("motor_temperature")),
                "motorWaterTemp": to_float(row.get("motor_water_temperature")),
                "motorState": to_float(row.get("motor_state")),
                "throttle": to_float(row.get("throttle")),
                "throttleRaw": to_float(row.get("throttle_raw")),
                "brake": to_float(row.get("brake_input")),
                "brakeRaw": to_float(row.get("brake_raw")),
                "clutch": to_float(row.get("clutch")),
                "clutchRaw": to_float(row.get("clutch_raw")),
                "steering": to_float(row.get("steering")),
                "steeringRaw": to_float(row.get("steering_raw")),
                "steeringRangePhysical": to_float(row.get("steering_range_physical")),
                "steeringRangeVisual": to_float(row.get("steering_range_visual")),
                "steeringShaftTorque": to_float(row.get("steering_shaft_torque")),
                "forceFeedback": to_float(row.get("force_feedback")),
                "positionX": to_float(row.get("position_xyz_0")),
                "positionY": to_float(row.get("position_xyz_1")),
                "positionZ": to_float(row.get("position_xyz_2")),
                "velocityLateral": to_float(row.get("velocity_lateral")),
                "velocityLongitudinal": to_float(row.get("velocity_longitudinal")),
                "velocityVertical": to_float(row.get("velocity_vertical")),
                "speed": to_float(row.get("speed")),
                "accelLateral": to_float(row.get("accel_lateral")),
                "accelLongitudinal": to_float(row.get("accel_longitudinal")),
                "accelVertical": to_float(row.get("accel_vertical")),
                "orientationYaw": to_float(row.get("orientation_yaw_radians")),
                "rotationLateral": to_float(row.get("rotation_lateral")),
                "rotationLongitudinal": to_float(row.get("rotation_longitudinal")),
                "rotationVertical": to_float(row.get("rotation_vertical")),
                "fuel": to_float(row.get("fuel")),
                "damageSeverity_0": to_float(row.get("damage_severity_0")),
                "damageSeverity_1": to_float(row.get("damage_severity_1")),
                "damageSeverity_2": to_float(row.get("damage_severity_2")),
                "damageSeverity_3": to_float(row.get("damage_severity_3")),
                "damageSeverity_4": to_float(row.get("damage_severity_4")),
                "damageSeverity_5": to_float(row.get("damage_severity_5")),
                "damageSeverity_6": to_float(row.get("damage_severity_6")),
                "damageSeverity_7": to_float(row.get("damage_severity_7")),
                "distance": to_float(row.get("distance")),
                "progress": to_float(row.get("progress")),
                "pathLateral": to_float(row.get("path_lateral")),
                "trackEdge": to_float(row.get("track_edge")),
            })

        await upload_batches(convex, "importer:batchInsertPhysicsSamples", physics_samples, chunk_size)

    # Upload scoring snapshots (already in correct format)
    if scoring_rows:
        scoring_snapshots = []
        for row in scoring_rows:
            scoring_snapshots.append({
                "lapId": lap_id,
                "snapshotTime": to_float(row.get("elapsed_time")),
                "updateTrigger": row.get("update_trigger", "unknown"),
                "behindLeader": to_float(row.get("behind_leader")),
                "behindNext": to_float(row.get("behind_next")),
                "bestLaptime": to_float(row.get("best_laptime")),
                "bestSector1": to_float(row.get("best_sector1")),
                "bestSector2": to_float(row.get("best_sector2")),
                "currentLaptime": to_float(row.get("current_laptime")),
                "currentSector1": to_float(row.get("current_sector1")),
                "currentSector2": to_float(row.get("current_sector2")),
                "lastLaptime": to_float(row.get("last_laptime")),
                "lastSector1": to_float(row.get("last_sector1")),
                "lastSector2": to_float(row.get("last_sector2")),
                "deltaBest": to_float(row.get("delta_best")),
                "estimatedLaptime": to_float(row.get("estimated_laptime")),
                "estimatedTimeInto": to_float(row.get("estimated_time_into")),
                "sectorIndex": to_float(row.get("sector_index")),
                "trackLength": to_float(row.get("track_length")),
                "positionLateral": to_float(row.get("position_lateral")),
                "inGarage": to_bool(row.get("in_garage")),
                "inPits": to_bool(row.get("in_pits")),
                "isPlayer": to_bool(row.get("is_player")),
                "place": to_float(row.get("place")),
                "finishState": to_float(row.get("finish_state")),
                "greenFlag": to_bool(row.get("green_flag")),
                "yellowFlag": to_bool(row.get("yellow_flag")),
                "blueFlag": to_bool(row.get("blue_flag")),
                "inRace": to_bool(row.get("in_race")),
                "inCountdown": to_bool(row.get("in_countdown")),
                "inFormation": to_bool(row.get("in_formation")),
                "pitOpen": to_bool(row.get("pit_open")),
                "raininess": to_float(row.get("raininess")),
                "wetnessAverage": to_float(row.get("wetness_average")),
                "wetnessMinimum": to_float(row.get("wetness_minimum")),
                "wetnessMaximum": to_float(row.get("wetness_maximum")),
                "sessionElapsed": to_float(row.get("session_elapsed")),
                "sessionRemaining": to_float(row.get("session_remaining")),
                "autoClutch": to_bool(row.get("auto_clutch")),
                "drsStatus": to_float(row.get("drs_status")),
                "headlights": to_bool(row.get("headlights")),
                "ignitionStarter": to_float(row.get("ignition_starter")),
                "speedLimiter": to_float(row.get("speed_limiter")),
            })

        await upload_batches(convex, "importer:batchInsertScoringSnapshots", scoring_snapshots, chunk_size)


async def import_lap(convex: ConvexClient, session_id: str, lap_number: int, lap_files: LapFiles, chunk_size: int) -> None:
    # Load CSVs
    lap_rows = read_csv(lap_files.lap) if lap_files.lap else []
    timing_rows = read_csv(lap_files.timing) if lap_files.timing else []
    session_rows = read_csv(lap_files.session) if lap_files.session else []
    brake_rows = read_csv(lap_files.brake) if lap_files.brake else []
    tyre_rows = read_csv(lap_files.tyre) if lap_files.tyre else []
    wheel_rows = read_csv(lap_files.wheel) if lap_files.wheel else []
    engine_rows = read_csv(lap_files.engine) if lap_files.engine else []
    motor_rows = read_csv(lap_files.electric_motor) if lap_files.electric_motor else []
    inputs_rows = read_csv(lap_files.inputs) if lap_files.inputs else []
    switch_rows = read_csv(lap_files.switch) if lap_files.switch else []
    vehicle_rows = read_csv(lap_files.vehicle) if lap_files.vehicle else []

    meta = build_lap_metadata(lap_number, timing_rows, vehicle_rows, lap_rows)
    lap_id = await create_lap(convex, session_id, lap_number, meta)

    # Build and upload physicsSamples (high-frequency data)
    physics_samples = build_physics_samples(
        lap_id, brake_rows, tyre_rows, wheel_rows, engine_rows, motor_rows, inputs_rows, vehicle_rows, lap_rows
    )
    await upload_batches(convex, "importer:batchInsertPhysicsSamples", physics_samples, chunk_size)

    # Build and upload scoringSnapshots (low-frequency data)
    scoring_snapshots = build_scoring_snapshots(
        lap_id, timing_rows, session_rows, vehicle_rows, lap_rows, switch_rows
    )
    await upload_batches(convex, "importer:batchInsertScoringSnapshots", scoring_snapshots, chunk_size)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Import telemetry CSV logs into Convex")
    parser.add_argument("--user-id", required=True, help="Convex user ID to associate with the session")
    parser.add_argument("--logs-dir", required=True, help="Directory containing lap_* CSV files")
    parser.add_argument("--convex-url", required=True, help="Convex deployment base URL (e.g. https://example.convex.cloud)")
    parser.add_argument("--admin-key", help="Convex admin key for Authorization header", default=os.environ.get("CONVEX_ADMIN_KEY"))
    parser.add_argument("--chunk-size", type=int, default=200, help="Batch size for uploads")
    args = parser.parse_args()

    logs_dir = Path(args.logs_dir).expanduser().resolve()
    if not logs_dir.exists():
        raise SystemExit(f"Logs dir not found: {logs_dir}")

    lap_files_map = discover_lap_files(logs_dir)
    if not lap_files_map:
        raise SystemExit(f"No lap_* CSV files found in {logs_dir}")

    # Use the first lap to create the session
    first_lap = sorted(lap_files_map.keys())[0]
    first = lap_files_map[first_lap]
    session_rows = read_csv(first.session) if first.session else []
    vehicle_rows = read_csv(first.vehicle) if first.vehicle else []
    if not session_rows:
        raise SystemExit("Session CSV is required to create a session")

    convex = ConvexClient(args.convex_url, args.admin_key)
    try:
        session_id = await create_session(convex, args.user_id, session_rows, vehicle_rows)

        # Detect format: check if first lap has physics/scoring files
        first_lap_files = lap_files_map[sorted(lap_files_map.keys())[0]]
        is_snapshot_format = first_lap_files.physics is not None or first_lap_files.scoring is not None

        if is_snapshot_format:
            print("Detected snapshot format (physics + scoring CSVs)")
            for lap_number in sorted(lap_files_map.keys()):
                await import_lap_snapshot_format(convex, session_id, lap_number, lap_files_map[lap_number], args.chunk_size)
        else:
            print("Detected legacy format (multiple CSVs per lap)")
            for lap_number in sorted(lap_files_map.keys()):
                await import_lap(convex, session_id, lap_number, lap_files_map[lap_number], args.chunk_size)

        print(f"Imported {len(lap_files_map)} lap(s) into session {session_id}")
    finally:
        await convex.close()


def cli() -> None:
    """Entry point for the console script."""
    asyncio.run(main())


if __name__ == "__main__":
    cli()
