"""
Snapshot-based telemetry collector for tick-aligned data storage.

Separates high-frequency physics data (~90Hz from rF2Telemetry)
from low-frequency scoring data (~5Hz from rF2Scoring) to match
rFactor 2's actual shared memory buffer update rates.
"""

import asyncio
import time
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from copy import deepcopy
import structlog

# Import RF2 components
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'tracker'))

from tracker.api_connector import SimRF2, APIDataSet
from tracker.adapter import rf2_data

logger = structlog.get_logger(__name__)


@dataclass
class PhysicsSample:
    """Single physics sample from rF2Telemetry buffer (~90Hz)"""
    lap_id: str
    sample_time: float
    data: Dict[str, Any]


@dataclass
class ScoringSnapshot:
    """Single scoring snapshot from rF2Scoring buffer (~5Hz)"""
    lap_id: str
    snapshot_time: float
    update_trigger: str
    data: Dict[str, Any]


@dataclass
class ScoringState:
    """Track scoring state for change detection"""
    last_sector_index: int = -1
    last_lap_time: float = 0.0
    last_position: int = 0
    last_snapshot_time: float = 0.0
    snapshot_count: int = 0


class SnapshotTelemetryCollector:
    """
    Telemetry collector using snapshot architecture.

    Collects high-freq physics samples and low-freq scoring snapshots
    separately to align with rF2's actual buffer update rates.
    """

    def __init__(self, convex_api_client):
        """
        Args:
            convex_api_client: Client for calling Convex mutations
        """
        self.convex_client = convex_api_client
        self.rf2_sim: Optional[SimRF2] = None

        # Current lap tracking
        self.current_lap_id: Optional[str] = None
        self.current_lap_number: int = 0

        # Buffers for batch uploads
        self.physics_buffer: List[PhysicsSample] = []
        self.scoring_buffer: List[ScoringSnapshot] = []

        # Batch sizes
        self.physics_batch_size = 100  # ~1 second of data at 90Hz
        self.scoring_batch_size = 20   # ~4 seconds of data at 5Hz

        # Scoring state tracking
        self.scoring_state = ScoringState()

        # Collection control
        self._stop_event = asyncio.Event()
        self._collection_task: Optional[asyncio.Task] = None

    async def initialize(self):
        """Initialize RF2 connection"""
        logger.info("Initializing snapshot telemetry collector")

        self.rf2_sim = SimRF2()
        self.rf2_sim.setup(
            access_mode=0,  # Default access mode
            process_id=0,   # Auto-detect
            player_override=-1,
            player_index=-1,
            char_encoding="latin-1"
        )

        logger.info("Snapshot collector initialized")

    async def start(self):
        """Start telemetry collection"""
        logger.info("Starting snapshot collection")

        self.rf2_sim.start()
        self._stop_event.clear()
        self._collection_task = asyncio.create_task(self._collection_loop())

        logger.info("Snapshot collection started")

    async def stop(self):
        """Stop telemetry collection"""
        logger.info("Stopping snapshot collection")

        self._stop_event.set()

        if self._collection_task:
            self._collection_task.cancel()
            try:
                await self._collection_task
            except asyncio.CancelledError:
                pass

        # Flush remaining data
        await self._flush_physics_buffer()
        await self._flush_scoring_buffer()

        if self.rf2_sim:
            self.rf2_sim.stop()

        logger.info("Snapshot collection stopped")

    async def _collection_loop(self):
        """Main collection loop"""
        logger.info("Collection loop started")

        last_lap_number = -1

        while not self._stop_event.is_set():
            try:
                if self.rf2_sim.info.isPaused:
                    await asyncio.sleep(0.1)
                    continue

                # Collect physics sample (every tick)
                physics_sample = self._collect_physics_sample()

                if physics_sample:
                    self.physics_buffer.append(physics_sample)

                    # Batch upload physics samples
                    if len(self.physics_buffer) >= self.physics_batch_size:
                        await self._flush_physics_buffer()

                # Collect scoring snapshot (only when changed)
                scoring_snapshot = self._collect_scoring_snapshot()

                if scoring_snapshot:
                    self.scoring_buffer.append(scoring_snapshot)

                    # Batch upload scoring snapshots
                    if len(self.scoring_buffer) >= self.scoring_batch_size:
                        await self._flush_scoring_buffer()

                # Check for lap change
                current_lap = self.rf2_sim.info.rf2TeleVeh().mLapNumber
                if current_lap != last_lap_number:
                    if last_lap_number > 0:
                        await self._handle_lap_change(last_lap_number, current_lap)
                    last_lap_number = current_lap

                # Sleep based on physics tick rate (~90Hz = ~11ms)
                await asyncio.sleep(0.011)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in collection loop", error=str(e))
                await asyncio.sleep(1.0)

        logger.info("Collection loop stopped")

    def _collect_physics_sample(self) -> Optional[PhysicsSample]:
        """
        Collect high-frequency physics sample from rF2Telemetry buffer.
        This should be called ~90Hz to match rF2's physics tick rate.
        """
        try:
            tele_veh = self.rf2_sim.info.rf2TeleVeh()

            if not tele_veh or not self.current_lap_id:
                return None

            data = self.rf2_sim.dataset()

            # Extract all high-frequency data from rF2Telemetry buffer
            sample = PhysicsSample(
                lap_id=self.current_lap_id,
                sample_time=tele_veh.mElapsedTime,
                data={
                    # Brake data
                    "brakeBiasFront": data.brake.bias_front(),
                    "brakePressure_0": data.brake.pressure()[0],
                    "brakePressure_1": data.brake.pressure()[1],
                    "brakePressure_2": data.brake.pressure()[2],
                    "brakePressure_3": data.brake.pressure()[3],
                    "brakeTemperature_0": data.brake.temperature()[0],
                    "brakeTemperature_1": data.brake.temperature()[1],
                    "brakeTemperature_2": data.brake.temperature()[2],
                    "brakeTemperature_3": data.brake.temperature()[3],

                    # Tyre data
                    "tyreCarcassTemp_0": data.tyre.carcass_temperature()[0],
                    "tyreCarcassTemp_1": data.tyre.carcass_temperature()[1],
                    "tyreCarcassTemp_2": data.tyre.carcass_temperature()[2],
                    "tyreCarcassTemp_3": data.tyre.carcass_temperature()[3],
                    "tyreCompound_0": data.tyre.compound()[0],
                    "tyreCompound_1": data.tyre.compound()[0],
                    "tyreCompound_2": data.tyre.compound()[1],
                    "tyreCompound_3": data.tyre.compound()[1],
                    "tyreCompoundNameFront": data.tyre.compound_name()[0],
                    "tyreCompoundNameRear": data.tyre.compound_name()[1],
                    "tyrePressure_0": data.tyre.pressure()[0],
                    "tyrePressure_1": data.tyre.pressure()[1],
                    "tyrePressure_2": data.tyre.pressure()[2],
                    "tyrePressure_3": data.tyre.pressure()[3],
                    "tyreSurfaceTempAvg_0": data.tyre.surface_temperature_avg()[0],
                    "tyreSurfaceTempAvg_1": data.tyre.surface_temperature_avg()[1],
                    "tyreSurfaceTempAvg_2": data.tyre.surface_temperature_avg()[2],
                    "tyreSurfaceTempAvg_3": data.tyre.surface_temperature_avg()[3],
                    "tyreSurfaceTempLeft_0": data.tyre.surface_temperature_ico()[0],
                    "tyreSurfaceTempLeft_1": data.tyre.surface_temperature_ico()[3],
                    "tyreSurfaceTempLeft_2": data.tyre.surface_temperature_ico()[6],
                    "tyreSurfaceTempLeft_3": data.tyre.surface_temperature_ico()[9],
                    "tyreSurfaceTempCenter_0": data.tyre.surface_temperature_ico()[1],
                    "tyreSurfaceTempCenter_1": data.tyre.surface_temperature_ico()[4],
                    "tyreSurfaceTempCenter_2": data.tyre.surface_temperature_ico()[7],
                    "tyreSurfaceTempCenter_3": data.tyre.surface_temperature_ico()[10],
                    "tyreSurfaceTempRight_0": data.tyre.surface_temperature_ico()[2],
                    "tyreSurfaceTempRight_1": data.tyre.surface_temperature_ico()[5],
                    "tyreSurfaceTempRight_2": data.tyre.surface_temperature_ico()[8],
                    "tyreSurfaceTempRight_3": data.tyre.surface_temperature_ico()[11],
                    "tyreInnerTempAvg_0": data.tyre.inner_temperature_avg()[0],
                    "tyreInnerTempAvg_1": data.tyre.inner_temperature_avg()[1],
                    "tyreInnerTempAvg_2": data.tyre.inner_temperature_avg()[2],
                    "tyreInnerTempAvg_3": data.tyre.inner_temperature_avg()[3],
                    "tyreWear_0": data.tyre.wear()[0],
                    "tyreWear_1": data.tyre.wear()[1],
                    "tyreWear_2": data.tyre.wear()[2],
                    "tyreWear_3": data.tyre.wear()[3],
                    "tyreLoad_0": data.tyre.load()[0],
                    "tyreLoad_1": data.tyre.load()[1],
                    "tyreLoad_2": data.tyre.load()[2],
                    "tyreLoad_3": data.tyre.load()[3],

                    # Wheel & suspension data
                    "wheelSpeed_0": data.wheel.rotation()[0],
                    "wheelSpeed_1": data.wheel.rotation()[1],
                    "wheelSpeed_2": data.wheel.rotation()[2],
                    "wheelSpeed_3": data.wheel.rotation()[3],
                    "suspensionDeflection_0": data.wheel.suspension_deflection()[0],
                    "suspensionDeflection_1": data.wheel.suspension_deflection()[1],
                    "suspensionDeflection_2": data.wheel.suspension_deflection()[2],
                    "suspensionDeflection_3": data.wheel.suspension_deflection()[3],
                    "rideHeight_0": data.wheel.ride_height()[0],
                    "rideHeight_1": data.wheel.ride_height()[1],
                    "rideHeight_2": data.wheel.ride_height()[2],
                    "rideHeight_3": data.wheel.ride_height()[3],
                    "camber_0": data.wheel.camber()[0],
                    "camber_1": data.wheel.camber()[1],
                    "camber_2": data.wheel.camber()[2],
                    "camber_3": data.wheel.camber()[3],
                    "slipAngleFl": data.wheel.slip_angle_fl(),
                    "slipAngleFr": data.wheel.slip_angle_fr(),
                    "slipAngleRl": data.wheel.slip_angle_rl(),
                    "slipAngleRr": data.wheel.slip_angle_rr(),
                    "isDetached_0": data.wheel.is_detached()[0],
                    "isDetached_1": data.wheel.is_detached()[1],
                    "isDetached_2": data.wheel.is_detached()[2],
                    "isDetached_3": data.wheel.is_detached()[3],
                    "surfaceType_0": data.wheel.surface_type()[0],
                    "surfaceType_1": data.wheel.surface_type()[1],
                    "surfaceType_2": data.wheel.surface_type()[2],
                    "surfaceType_3": data.wheel.surface_type()[3],

                    # Engine & powertrain data
                    "engineRpm": data.engine.rpm(),
                    "engineRpmMax": data.engine.rpm_max(),
                    "engineGear": data.engine.gear(),
                    "engineGearMax": data.engine.gear_max(),
                    "engineOilTemp": data.engine.oil_temperature(),
                    "engineWaterTemp": data.engine.water_temperature(),
                    "engineTorque": data.engine.torque(),
                    "turboBoost": data.engine.turbo(),

                    # Electric motor data
                    "batteryCharge": data.electric_motor.battery_charge(),
                    "motorRpm": data.electric_motor.rpm(),
                    "motorTorque": data.electric_motor.torque(),
                    "motorTemp": data.electric_motor.motor_temperature(),
                    "motorWaterTemp": data.electric_motor.water_temperature(),
                    "motorState": data.electric_motor.state(),

                    # Driver inputs
                    "throttle": data.inputs.throttle(),
                    "throttleRaw": data.inputs.throttle_raw(),
                    "brake": data.inputs.brake(),
                    "brakeRaw": data.inputs.brake_raw(),
                    "clutch": data.inputs.clutch(),
                    "clutchRaw": data.inputs.clutch_raw(),
                    "steering": data.inputs.steering(),
                    "steeringRaw": data.inputs.steering_raw(),
                    "steeringRangePhysical": data.inputs.steering_range_physical(),
                    "steeringRangeVisual": data.inputs.steering_range_visual(),
                    "steeringShaftTorque": data.inputs.steering_shaft_torque(),
                    "forceFeedback": data.inputs.force_feedback(),

                    # Vehicle dynamics
                    "positionX": data.vehicle.position_xyz()[0],
                    "positionY": data.vehicle.position_xyz()[1],
                    "positionZ": data.vehicle.position_xyz()[2],
                    "velocityLateral": data.vehicle.velocity_lateral(),
                    "velocityLongitudinal": data.vehicle.velocity_longitudinal(),
                    "velocityVertical": data.vehicle.velocity_vertical(),
                    "speed": data.vehicle.speed(),
                    "accelLateral": data.vehicle.accel_lateral(),
                    "accelLongitudinal": data.vehicle.accel_longitudinal(),
                    "accelVertical": data.vehicle.accel_vertical(),
                    "orientationYaw": data.vehicle.orientation_yaw_radians(),
                    "rotationLateral": data.vehicle.rotation_lateral(),
                    "rotationLongitudinal": data.vehicle.rotation_longitudinal(),
                    "rotationVertical": data.vehicle.rotation_vertical(),

                    # Fuel & damage
                    "fuel": data.vehicle.fuel(),
                    "damageSeverity_0": data.vehicle.damage_severity()[0],
                    "damageSeverity_1": data.vehicle.damage_severity()[1],
                    "damageSeverity_2": data.vehicle.damage_severity()[2],
                    "damageSeverity_3": data.vehicle.damage_severity()[3],
                    "damageSeverity_4": data.vehicle.damage_severity()[4],
                    "damageSeverity_5": data.vehicle.damage_severity()[5],
                    "damageSeverity_6": data.vehicle.damage_severity()[6],
                    "damageSeverity_7": data.vehicle.damage_severity()[7],

                    # Track position
                    "distance": data.lap.distance(),
                    "progress": data.lap.progress(),
                    "pathLateral": data.vehicle.path_lateral(),
                    "trackEdge": data.vehicle.track_edge(),
                }
            )

            return sample

        except Exception as e:
            logger.warning("Failed to collect physics sample", error=str(e))
            return None

    def _collect_scoring_snapshot(self) -> Optional[ScoringSnapshot]:
        """
        Collect low-frequency scoring snapshot from rF2Scoring buffer.
        Only collects when data has actually changed to avoid redundant storage.
        """
        try:
            scor_veh = self.rf2_sim.info.rf2ScorVeh()
            scor_info = self.rf2_sim.info.rf2ScorInfo
            tele_veh = self.rf2_sim.info.rf2TeleVeh()

            if not scor_veh or not scor_info or not tele_veh or not self.current_lap_id:
                return None

            data = self.rf2_sim.dataset()

            # Detect changes in scoring data
            current_sector = data.lap.sector_index()
            current_lap_time = data.timing.last_laptime()
            current_position = data.vehicle.place()
            current_time = tele_veh.mElapsedTime

            # Determine update trigger
            trigger = None

            if current_sector != self.scoring_state.last_sector_index:
                trigger = "sector_complete"
            elif current_lap_time != self.scoring_state.last_lap_time and current_lap_time > 0:
                trigger = "lap_complete"
            elif current_position != self.scoring_state.last_position:
                trigger = "position_change"
            elif (current_time - self.scoring_state.last_snapshot_time) >= 1.0:
                # Periodic snapshot every ~1 second (ensures ~5Hz even without changes)
                trigger = "periodic"

            if not trigger:
                return None

            # Update scoring state
            self.scoring_state.last_sector_index = current_sector
            self.scoring_state.last_lap_time = current_lap_time
            self.scoring_state.last_position = current_position
            self.scoring_state.last_snapshot_time = current_time
            self.scoring_state.snapshot_count += 1

            # Build scoring snapshot
            snapshot = ScoringSnapshot(
                lap_id=self.current_lap_id,
                snapshot_time=current_time,
                update_trigger=trigger,
                data={
                    # Timing data
                    "behindLeader": data.timing.behind_leader(),
                    "behindNext": data.timing.behind_next(),
                    "bestLaptime": data.timing.best_laptime(),
                    "bestSector1": data.timing.best_sector1(),
                    "bestSector2": data.timing.best_sector2(),
                    "currentLaptime": data.timing.current_laptime(),
                    "currentSector1": data.timing.current_sector1(),
                    "currentSector2": data.timing.current_sector2(),
                    "lastLaptime": data.timing.last_laptime(),
                    "lastSector1": data.timing.last_sector1(),
                    "lastSector2": data.timing.last_sector2(),
                    "deltaBest": data.timing.delta_best(),
                    "estimatedLaptime": data.timing.estimated_laptime(),
                    "estimatedTimeInto": data.timing.estimated_time_into(),

                    # Lap progress
                    "sectorIndex": current_sector,
                    "trackLength": data.lap.track_length(),

                    # Vehicle state (from scoring)
                    "positionLateral": data.vehicle.path_lateral(),
                    "inGarage": data.vehicle.in_garage(),
                    "inPits": data.vehicle.in_pits(),
                    "isPlayer": data.vehicle.is_player(),
                    "place": current_position,
                    "finishState": data.vehicle.finish_state(),

                    # Session state
                    "greenFlag": data.session.green_flag(),
                    "yellowFlag": data.session.yellow_flag(),
                    "blueFlag": data.session.blue_flag(),
                    "inRace": data.session.in_race(),
                    "inCountdown": data.session.in_countdown(),
                    "inFormation": data.session.in_formation(),
                    "pitOpen": data.session.pit_open(),
                    "raininess": data.session.raininess(),
                    "wetnessAverage": data.session.wetness_average(),
                    "wetnessMinimum": data.session.wetness_minimum(),
                    "wetnessMaximum": data.session.wetness_maximum(),
                    "sessionElapsed": data.session.elapsed(),
                    "sessionRemaining": data.session.remaining(),

                    # Switches
                    "autoClutch": data.switch.auto_clutch(),
                    "drsStatus": data.switch.drs_status(),
                    "headlights": bool(data.switch.headlights()),
                    "ignitionStarter": data.switch.ignition_starter(),
                    "speedLimiter": data.switch.speed_limiter(),
                }
            )

            return snapshot

        except Exception as e:
            logger.warning("Failed to collect scoring snapshot", error=str(e))
            return None

    async def _flush_physics_buffer(self):
        """Upload batched physics samples to Convex"""
        if not self.physics_buffer:
            return

        try:
            rows = [
                {
                    "lapId": sample.lap_id,
                    "sampleTime": sample.sample_time,
                    **sample.data
                }
                for sample in self.physics_buffer
            ]

            await self.convex_client.mutation(
                "importer:batchInsertPhysicsSamples",
                {"rows": rows}
            )

            logger.debug(f"Uploaded {len(rows)} physics samples")
            self.physics_buffer.clear()

        except Exception as e:
            logger.error("Failed to upload physics samples", error=str(e))

    async def _flush_scoring_buffer(self):
        """Upload batched scoring snapshots to Convex"""
        if not self.scoring_buffer:
            return

        try:
            rows = [
                {
                    "lapId": snapshot.lap_id,
                    "snapshotTime": snapshot.snapshot_time,
                    "updateTrigger": snapshot.update_trigger,
                    **snapshot.data
                }
                for snapshot in self.scoring_buffer
            ]

            await self.convex_client.mutation(
                "importer:batchInsertScoringSnapshots",
                {"rows": rows}
            )

            logger.debug(f"Uploaded {len(rows)} scoring snapshots")
            self.scoring_buffer.clear()

        except Exception as e:
            logger.error("Failed to upload scoring snapshots", error=str(e))

    async def _handle_lap_change(self, old_lap: int, new_lap: int):
        """Handle lap number change"""
        logger.info(f"Lap changed: {old_lap} -> {new_lap}")

        # Flush any remaining data for the old lap
        await self._flush_physics_buffer()
        await self._flush_scoring_buffer()

        # Reset scoring state for new lap
        self.scoring_state = ScoringState()

        # TODO: Create new lap in Convex and get lap_id
        # For now, use lap number as ID (you'll need to implement lap creation)
        self.current_lap_id = f"lap_{new_lap}"
        self.current_lap_number = new_lap
