import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import {
  sessions,
  vehicles,
  laps,
  telemetryLogs,
  lapSummary,
  timingData,
  engineData,
  inputData,
  brakeData,
  tyreData,
  wheelData,
  vehicleState,
  switchStates,
} from '../db/schema.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

interface CSVRow {
  [key: string]: string | number;
}

interface LapData {
  [className: string]: CSVRow[];
}

function readCSVFile(filePath: string): CSVRow[] {
  console.log(`  📖 Reading file: ${path.basename(filePath)}`);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  console.log(`  📊 File size: ${(fileContent.length / 1024).toFixed(1)}KB`);
  
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    cast: true,
  });
  console.log(`  ✅ Parsed ${records.length} rows from ${path.basename(filePath)}`);
  return records as CSVRow[];
}

function findCSVFiles(directory: string): { [lapNumber: string]: LapData } {
  const files = fs.readdirSync(directory);
  const lapData: { [lapNumber: string]: LapData } = {};
  
  for (const file of files) {
    const match = file.match(/^lap_(\d+)_(.+)\.csv$/);
    if (match && match[1] && match[2]) {
      const lapNumber = match[1];
      const className = match[2];
      const filePath = path.join(directory, file);
      
      console.log(`Reading ${file}...`);
      const data = readCSVFile(filePath);
      
      if (!lapData[lapNumber]) {
        lapData[lapNumber] = {};
      }
      lapData[lapNumber][className] = data;
    }
  }
  
  return lapData;
}

function safeFloat(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(String(value));
  return isNaN(num) ? null : num;
}

function safeInt(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = parseInt(String(value));
  return isNaN(num) ? null : num;
}

function safeBool(value: any): boolean | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return null;
}

function safeString(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

async function seedData(userId: string, csvDirectory: string) {
  const startTime = Date.now();
  console.log(`🚀 Starting seed for user ${userId} from directory ${csvDirectory}`);
  console.log(`⏰ Start time: ${new Date().toISOString()}`);
  
  // Find all CSV files
  console.log(`🔍 Scanning directory for CSV files...`);
  const lapData = findCSVFiles(csvDirectory);
  
  if (Object.keys(lapData).length === 0) {
    console.log('❌ No CSV files found in the specified directory');
    return;
  }
  
  const lapCount = Object.keys(lapData).length;
  console.log(`✅ Found data for ${lapCount} laps`);
  
  // Calculate total telemetry points
  let totalTelemetryPoints = 0;
  for (const lapClasses of Object.values(lapData)) {
    const maxPoints = Math.max(...Object.values(lapClasses).map(data => data.length));
    totalTelemetryPoints += maxPoints;
  }
  console.log(`📊 Total telemetry data points to process: ${totalTelemetryPoints}`);
  console.log(`⚡ Estimated processing time: ${Math.round(totalTelemetryPoints / 1000)} seconds\n`);
  
  // Get first lap data for session/vehicle creation
  const firstLapNumber = Object.keys(lapData).sort((a, b) => parseInt(a) - parseInt(b))[0];
  const firstLapData = lapData[firstLapNumber];
  
  if (!firstLapData) {
    throw new Error('No first lap data found');
  }
  
  const firstSessionData = firstLapData.session?.[0];
  const firstVehicleData = firstLapData.vehicle?.[0];
  
  // Create a session
  const sessionResult = await db.insert(sessions).values({
    userId,
    sessionStamp: Date.now(),
    sessionType: safeInt(firstSessionData?.session_type) ?? 0,
    trackName: safeString(firstSessionData?.track_name) || 'Unknown Track',
    simName: 'rFactor 2',
    apiVersion: '1.0',
    sessionLength: safeFloat(firstSessionData?.elapsed),
    title: `Imported Session ${new Date().toISOString()}`,
    description: 'Imported from CSV telemetry data'
  }).returning();
  
  const session = sessionResult[0];
  if (!session) {
    throw new Error('Failed to create session');
  }
  
  console.log(`✅ Created session with ID: ${session.id}`);
  
  // Create a vehicle
  console.log(`🚗 Creating vehicle record...`);
  const vehicleResult = await db.insert(vehicles).values({
    sessionId: session.id,
    slotId: safeInt(firstVehicleData?.slot_id) ?? 0,
    driverName: safeString(firstVehicleData?.driver_name) || 'Unknown Driver',
    vehicleName: safeString(firstVehicleData?.vehicle_name) || 'Unknown Vehicle',
    className: safeString(firstVehicleData?.class_name) || 'Unknown Class',
    isPlayer: safeBool(firstVehicleData?.is_player) ?? true
  }).returning();
  
  const vehicle = vehicleResult[0];
  if (!vehicle) {
    throw new Error('Failed to create vehicle');
  }
  
  console.log(`✅ Created vehicle with ID: ${vehicle.id}\n`);
  
  // Process each lap
  let processedLaps = 0;
  let processedTelemetryPoints = 0;
  
  for (const [lapNumber, lapClasses] of Object.entries(lapData)) {
    const lapStartTime = Date.now();
    console.log(`🏁 Processing lap ${lapNumber}/${lapCount}...`);
    
    const lapNum = parseInt(lapNumber);
    const lapClassData = lapClasses.lap?.[0];
    const timingClassData = lapClasses.timing?.[0];
    
    // Create lap entry
    const lapResult = await db.insert(laps).values({
      userId,
      sessionId: session.id,
      vehicleId: vehicle.id,
      lapNumber: lapNum,
      lapTime: safeFloat(timingClassData?.last_laptime),
      sector1Time: safeFloat(timingClassData?.last_sector1),
      sector2Time: safeFloat(timingClassData?.last_sector2),
      isValid: true,
      lapStartTime: new Date(Date.now() - (lapNum * 90000)), // Approximate timing
      trackTemp: safeFloat(lapClasses.session?.[0]?.track_temperature),
      ambientTemp: safeFloat(lapClasses.session?.[0]?.ambient_temperature),
      wetness: safeFloat(lapClasses.session?.[0]?.wetness)
    }).returning();
    
    const lap = lapResult[0];
    if (!lap) {
      throw new Error(`Failed to create lap ${lapNum}`);
    }
    
    console.log(`  ✅ Created lap ${lapNum} with ID: ${lap.id}`);
    
    // Create timing data
    if (timingClassData) {
      console.log(`  ⏱️  Adding timing data...`);
      await db.insert(timingData).values({
        lapId: lap.id,
        sector1Time: safeFloat(timingClassData.last_sector1),
        sector2Time: safeFloat(timingClassData.last_sector2),
        sector1Best: safeFloat(timingClassData.best_sector1),
        sector2Best: safeFloat(timingClassData.best_sector2),
        deltaToPersonalBest: safeFloat(timingClassData.behind_leader)
      });
    }
    
    // Process telemetry data for each data point in the lap
    const telemetryCount = Math.max(
      ...Object.values(lapClasses).map(data => data.length)
    );
    
    console.log(`  📊 Processing ${telemetryCount} telemetry data points with batch inserts...`);
    
    // Prepare batch arrays
    const telemetryBatch: any[] = [];
    const engineBatch: any[] = [];
    const inputBatch: any[] = [];
    const brakeBatch: any[] = [];
    const tyreBatch: any[] = [];
    const wheelBatch: any[] = [];
    const vehicleStateBatch: any[] = [];
    const switchBatch: any[] = [];
    
    const batchSize = 100; // Process in batches of 100
    let processedPoints = 0;
    
    for (let i = 0; i < telemetryCount; i++) {
      const vehicleData = lapClasses.vehicle?.[i];
      if (!vehicleData) continue;
      
      const telemetryId = Date.now() * 1000 + i; // Unique ID
      
      // Prepare telemetry log entry
      telemetryBatch.push({
        id: telemetryId,
        lapId: lap.id,
        timestamp: new Date(Date.now() - (lapNum * 90000) + (i * 100)),
        sessionElapsed: safeFloat(vehicleData.elapsed_time),
        lapProgress: safeFloat(lapClassData?.progress) || (i / telemetryCount),
        positionX: safeFloat(vehicleData.position_longitudinal),
        positionY: safeFloat(vehicleData.position_lateral), 
        positionZ: safeFloat(vehicleData.position_vertical),
        orientationYaw: safeFloat(vehicleData.orientation_yaw_radians),
        speed: safeFloat(vehicleData.speed),
        accelLateral: safeFloat(vehicleData.accel_lateral),
        accelLongitudinal: safeFloat(vehicleData.accel_longitudinal),
        accelVertical: safeFloat(vehicleData.accel_vertical),
        velocityLateral: safeFloat(vehicleData.velocity_lateral),
        velocityLongitudinal: safeFloat(vehicleData.velocity_longitudinal),
        velocityVertical: safeFloat(vehicleData.velocity_vertical),
        gear: safeInt(lapClasses.engine?.[i]?.gear),
        rpm: safeFloat(lapClasses.engine?.[i]?.rpm),
        throttle: safeFloat(lapClasses.inputs?.[i]?.throttle),
        brake: safeFloat(lapClasses.inputs?.[i]?.brake),
        clutch: safeFloat(lapClasses.inputs?.[i]?.clutch),
        steering: safeFloat(lapClasses.inputs?.[i]?.steering),
        fuel: safeFloat(vehicleData.fuel)
      });
      
      // Prepare engine data
      if (lapClasses.engine?.[i]) {
        const engineRow = lapClasses.engine[i];
        engineBatch.push({
          telemetryLogId: telemetryId,
          gear: safeInt(engineRow.gear),
          maxGear: safeInt(engineRow.gear_max),
          rpm: safeFloat(engineRow.rpm),
          maxRpm: safeFloat(engineRow.rpm_max),
          torque: safeFloat(engineRow.torque),
          turboBoost: safeFloat(engineRow.turbo),
          oilTemperature: safeFloat(engineRow.oil_temperature),
          waterTemperature: safeFloat(engineRow.water_temperature)
        });
      }
      
      // Prepare input data
      if (lapClasses.inputs?.[i]) {
        const inputRow = lapClasses.inputs[i];
        inputBatch.push({
          telemetryLogId: telemetryId,
          throttle: safeFloat(inputRow.throttle),
          throttleRaw: safeFloat(inputRow.throttle_raw),
          brake: safeFloat(inputRow.brake),
          brakeRaw: safeFloat(inputRow.brake_raw),
          clutch: safeFloat(inputRow.clutch),
          clutchRaw: safeFloat(inputRow.clutch_raw),
          steering: safeFloat(inputRow.steering),
          steeringRaw: safeFloat(inputRow.steering_raw),
          steeringShaftTorque: safeFloat(inputRow.steering_shaft_torque),
          steeringRangePhysical: safeFloat(inputRow.steering_range_physical),
          steeringRangeVisual: safeFloat(inputRow.steering_range_visual),
          forceFeedback: safeFloat(inputRow.force_feedback)
        });
      }
      
      // Prepare brake data
      if (lapClasses.brake?.[i]) {
        const brakeRow = lapClasses.brake[i];
        brakeBatch.push({
          telemetryLogId: telemetryId,
          biasFront: safeFloat(brakeRow.bias_front),
          pressureFL: safeFloat(brakeRow.pressure_0),
          pressureFR: safeFloat(brakeRow.pressure_1),
          pressureRL: safeFloat(brakeRow.pressure_2),
          pressureRR: safeFloat(brakeRow.pressure_3),
          temperatureFL: safeFloat(brakeRow.temperature_0),
          temperatureFR: safeFloat(brakeRow.temperature_1),
          temperatureRL: safeFloat(brakeRow.temperature_2),
          temperatureRR: safeFloat(brakeRow.temperature_3)
        });
      }
      
      // Prepare tyre data
      if (lapClasses.tyre?.[i]) {
        const tyreRow = lapClasses.tyre[i];
        tyreBatch.push({
          telemetryLogId: telemetryId,
          compoundFront: safeInt(tyreRow.compound_front),
          compoundRear: safeInt(tyreRow.compound_rear),
          compoundNameFront: safeString(tyreRow.compound_name_front),
          compoundNameRear: safeString(tyreRow.compound_name_rear),
          surfaceTempFL: safeFloat(tyreRow.surface_temperature_avg_0),
          surfaceTempFR: safeFloat(tyreRow.surface_temperature_avg_1),
          surfaceTempRL: safeFloat(tyreRow.surface_temperature_avg_2),
          surfaceTempRR: safeFloat(tyreRow.surface_temperature_avg_3),
          innerTempFL: safeFloat(tyreRow.inner_temperature_avg_0),
          innerTempFR: safeFloat(tyreRow.inner_temperature_avg_1),
          innerTempRL: safeFloat(tyreRow.inner_temperature_avg_2),
          innerTempRR: safeFloat(tyreRow.inner_temperature_avg_3),
          pressureFL: safeFloat(tyreRow.pressure_0),
          pressureFR: safeFloat(tyreRow.pressure_1),
          pressureRL: safeFloat(tyreRow.pressure_2),
          pressureRR: safeFloat(tyreRow.pressure_3),
          loadFL: safeFloat(tyreRow.load_0),
          loadFR: safeFloat(tyreRow.load_1),
          loadRL: safeFloat(tyreRow.load_2),
          loadRR: safeFloat(tyreRow.load_3),
          wearFL: safeFloat(tyreRow.wear_0),
          wearFR: safeFloat(tyreRow.wear_1),
          wearRL: safeFloat(tyreRow.wear_2),
          wearRR: safeFloat(tyreRow.wear_3),
          carcassTempFL: safeFloat(tyreRow.carcass_temperature_0),
          carcassTempFR: safeFloat(tyreRow.carcass_temperature_1),
          carcassTempRL: safeFloat(tyreRow.carcass_temperature_2),
          carcassTempRR: safeFloat(tyreRow.carcass_temperature_3)
        });
      }
      
      // Prepare wheel data
      if (lapClasses.wheel?.[i]) {
        const wheelRow = lapClasses.wheel[i];
        wheelBatch.push({
          telemetryLogId: telemetryId,
          camberFL: safeFloat(wheelRow.camber_0),
          camberFR: safeFloat(wheelRow.camber_1),
          camberRL: safeFloat(wheelRow.camber_2),
          camberRR: safeFloat(wheelRow.camber_3),
          toeFL: safeFloat(wheelRow.toe_0),
          toeFR: safeFloat(wheelRow.toe_1),
          toeRL: safeFloat(wheelRow.toe_2),
          toeRR: safeFloat(wheelRow.toe_3),
          rotationFL: safeFloat(wheelRow.rotation_0),
          rotationFR: safeFloat(wheelRow.rotation_1),
          rotationRL: safeFloat(wheelRow.rotation_2),
          rotationRR: safeFloat(wheelRow.rotation_3),
          velLateralFL: safeFloat(wheelRow.velocity_lateral_0),
          velLateralFR: safeFloat(wheelRow.velocity_lateral_1),
          velLateralRL: safeFloat(wheelRow.velocity_lateral_2),
          velLateralRR: safeFloat(wheelRow.velocity_lateral_3),
          velLongitudinalFL: safeFloat(wheelRow.velocity_longitudinal_0),
          velLongitudinalFR: safeFloat(wheelRow.velocity_longitudinal_1),
          velLongitudinalRL: safeFloat(wheelRow.velocity_longitudinal_2),
          velLongitudinalRR: safeFloat(wheelRow.velocity_longitudinal_3),
          rideHeightFL: safeFloat(wheelRow.ride_height_0),
          rideHeightFR: safeFloat(wheelRow.ride_height_1),
          rideHeightRL: safeFloat(wheelRow.ride_height_2),
          rideHeightRR: safeFloat(wheelRow.ride_height_3),
          suspensionDeflectionFL: safeFloat(wheelRow.suspension_deflection_0),
          suspensionDeflectionFR: safeFloat(wheelRow.suspension_deflection_1),
          suspensionDeflectionRL: safeFloat(wheelRow.suspension_deflection_2),
          suspensionDeflectionRR: safeFloat(wheelRow.suspension_deflection_3),
          suspensionForceFL: safeFloat(wheelRow.suspension_force_0),
          suspensionForceFR: safeFloat(wheelRow.suspension_force_1),
          suspensionForceRL: safeFloat(wheelRow.suspension_force_2),
          suspensionForceRR: safeFloat(wheelRow.suspension_force_3),
          thirdSpringDeflectionFL: safeFloat(wheelRow.third_spring_deflection_0),
          thirdSpringDeflectionFR: safeFloat(wheelRow.third_spring_deflection_1),
          thirdSpringDeflectionRL: safeFloat(wheelRow.third_spring_deflection_2),
          thirdSpringDeflectionRR: safeFloat(wheelRow.third_spring_deflection_3),
          positionVerticalFL: safeFloat(wheelRow.position_vertical_0),
          positionVerticalFR: safeFloat(wheelRow.position_vertical_1),
          positionVerticalRL: safeFloat(wheelRow.position_vertical_2),
          positionVerticalRR: safeFloat(wheelRow.position_vertical_3),
          isDetachedFL: safeBool(wheelRow.is_detached_0),
          isDetachedFR: safeBool(wheelRow.is_detached_1),
          isDetachedRL: safeBool(wheelRow.is_detached_2),
          isDetachedRR: safeBool(wheelRow.is_detached_3),
          isOffroad: safeBool(wheelRow.is_offroad)
        });
      }
      
      // Prepare vehicle state
      vehicleStateBatch.push({
        telemetryLogId: telemetryId,
        place: safeInt(vehicleData.place),
        qualification: safeInt(vehicleData.qualification),
        inPits: safeBool(vehicleData.in_pits),
        inGarage: safeBool(vehicleData.in_garage),
        numPitstops: safeInt(vehicleData.number_pitstops),
        pitRequest: safeBool(vehicleData.pit_request),
        numPenalties: safeInt(vehicleData.number_penalties),
        finishState: safeInt(vehicleData.finish_state),
        fuel: safeFloat(vehicleData.fuel),
        tankCapacity: safeFloat(vehicleData.tank_capacity),
        downforceFront: safeFloat(vehicleData.downforce_front),
        downforceRear: safeFloat(vehicleData.downforce_rear),
        isDetached: safeBool(vehicleData.is_detached),
        lastImpactTime: safeFloat(vehicleData.impact_time),
        lastImpactMagnitude: safeFloat(vehicleData.impact_magnitude)
      });
      
      // Prepare switch states
      if (lapClasses.switch?.[i]) {
        const switchRow = lapClasses.switch[i];
        switchBatch.push({
          telemetryLogId: telemetryId,
          headlights: safeInt(switchRow.headlights),
          ignitionStarter: safeInt(switchRow.ignition_starter),
          speedLimiter: safeInt(switchRow.speed_limiter),
          drsStatus: safeInt(switchRow.drs_status),
          autoClutch: safeBool(switchRow.auto_clutch)
        });
      }
      
      processedPoints++;
      
      // Execute batch inserts when batch size is reached or at the end
      if (telemetryBatch.length >= batchSize || i === telemetryCount - 1) {
        console.log(`    🚀 Batch inserting ${telemetryBatch.length} telemetry records (${Math.round((processedPoints / telemetryCount) * 100)}%)`);
        
        // Insert telemetry logs first (parent table)
        if (telemetryBatch.length > 0) {
          await db.insert(telemetryLogs).values(telemetryBatch);
        }
        
        // Then insert all related data in parallel (child tables)
        await Promise.all([
          engineBatch.length > 0 ? db.insert(engineData).values(engineBatch) : Promise.resolve(),
          inputBatch.length > 0 ? db.insert(inputData).values(inputBatch) : Promise.resolve(),
          brakeBatch.length > 0 ? db.insert(brakeData).values(brakeBatch) : Promise.resolve(),
          tyreBatch.length > 0 ? db.insert(tyreData).values(tyreBatch) : Promise.resolve(),
          wheelBatch.length > 0 ? db.insert(wheelData).values(wheelBatch) : Promise.resolve(),
          vehicleStateBatch.length > 0 ? db.insert(vehicleState).values(vehicleStateBatch) : Promise.resolve(),
          switchBatch.length > 0 ? db.insert(switchStates).values(switchBatch) : Promise.resolve()
        ]);
        
        // Clear batches
        telemetryBatch.length = 0;
        engineBatch.length = 0;
        inputBatch.length = 0;
        brakeBatch.length = 0;
        tyreBatch.length = 0;
        wheelBatch.length = 0;
        vehicleStateBatch.length = 0;
        switchBatch.length = 0;
      }
    }
    
    // Create lap summary
    console.log(`  📊 Creating lap summary...`);
    const vehicleRows = lapClasses.vehicle || [];
    const engineRows = lapClasses.engine || [];
    const inputRows = lapClasses.inputs || [];
    
    if (vehicleRows.length > 0) {
      const speeds = vehicleRows.map(r => safeFloat(r.speed)).filter(s => s !== null) as number[];
      const rpms = engineRows.map(r => safeFloat(r.rpm)).filter(r => r !== null) as number[];
      const throttles = inputRows.map(r => safeFloat(r.throttle)).filter(t => t !== null) as number[];
      const brakes = inputRows.map(r => safeFloat(r.brake)).filter(b => b !== null) as number[];
      
      await db.insert(lapSummary).values({
        lapId: lap.id,
        maxSpeed: speeds.length > 0 ? Math.max(...speeds) : null,
        avgSpeed: speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null,
        minSpeed: speeds.length > 0 ? Math.min(...speeds) : null,
        maxRpm: rpms.length > 0 ? Math.max(...rpms) : null,
        avgRpm: rpms.length > 0 ? rpms.reduce((a, b) => a + b, 0) / rpms.length : null,
        maxThrottle: throttles.length > 0 ? Math.max(...throttles) : null,
        avgThrottle: throttles.length > 0 ? throttles.reduce((a, b) => a + b, 0) / throttles.length : null,
        maxBrake: brakes.length > 0 ? Math.max(...brakes) : null,
        avgBrake: brakes.length > 0 ? brakes.reduce((a, b) => a + b, 0) / brakes.length : null,
        fuelStarting: safeFloat(vehicleRows[0]?.fuel),
        fuelEnding: safeFloat(vehicleRows[vehicleRows.length - 1]?.fuel),
        fuelUsed: vehicleRows.length > 1 ? 
          (safeFloat(vehicleRows[0]?.fuel) || 0) - (safeFloat(vehicleRows[vehicleRows.length - 1]?.fuel) || 0) : 
          null
      });
    }
    
    processedLaps++;
    processedTelemetryPoints += telemetryCount;
    const lapElapsed = Date.now() - lapStartTime;
    const remainingLaps = lapCount - processedLaps;
    const avgTimePerLap = (Date.now() - startTime) / processedLaps;
    const estimatedTimeRemaining = remainingLaps * avgTimePerLap;
    
    console.log(`  ✅ Completed lap ${lapNumber} in ${lapElapsed}ms`);
    console.log(`  📈 Progress: ${processedLaps}/${lapCount} laps (${Math.round((processedLaps / lapCount) * 100)}%)`);
    console.log(`  ⏱️  ETA: ${Math.round(estimatedTimeRemaining / 1000)}s remaining\n`);
  }
  
  const totalElapsed = Date.now() - startTime;
  console.log(`🎉 Seed completed successfully!`);
  console.log(`⏰ Total time: ${Math.round(totalElapsed / 1000)}s`);
  console.log(`📊 Processed ${processedLaps} laps with ${processedTelemetryPoints} telemetry data points`);
  console.log(`⚡ Average: ${Math.round(processedTelemetryPoints / (totalElapsed / 1000))} points/second`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: pnpm seed:csv <userId> <csvDirectory>');
    console.error('Example: pnpm seed:csv "user_123" "./telemetry_logs"');
    process.exit(1);
  }
  
  const [userId, csvDirectory] = args;
  
  if (!fs.existsSync(csvDirectory)) {
    console.error(`Directory ${csvDirectory} does not exist`);
    process.exit(1);
  }
  
  try {
    await seedData(userId, csvDirectory);
  } catch (error) {
    console.error('Error during seed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main(); 