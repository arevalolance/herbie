import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import prisma from '../lib/prisma.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  if (!firstLapNumber) {
    throw new Error('No lap data found');
  }
  
  const firstLapData = lapData[firstLapNumber];
  if (!firstLapData) {
    throw new Error('No first lap data found');
  }
  
  const firstSessionData = firstLapData.session?.[0];
  
  // Find the first vehicle data row that has actual data (not empty)
  let firstVehicleData = null;
  if (firstLapData.vehicle && firstLapData.vehicle.length > 0) {
    for (const vehicleRow of firstLapData.vehicle) {
      if (vehicleRow.driver_name && vehicleRow.vehicle_name && vehicleRow.class_name) {
        firstVehicleData = vehicleRow;
        break;
      }
    }
  }
  
  if (!firstVehicleData) {
    console.log('❌ No vehicle data found in first lap. Available data classes:', Object.keys(firstLapData));
    // Let's also check what vehicle data we do have
    if (firstLapData.vehicle && firstLapData.vehicle.length > 0) {
      console.log('🔍 First few vehicle rows sample:', firstLapData.vehicle.slice(0, 10).map((row, i) => ({
        row: i,
        driver_name: row.driver_name,
        vehicle_name: row.vehicle_name,
        class_name: row.class_name
      })));
    }
    throw new Error('No vehicle data found in CSV files');
  }
  
  console.log(`🔍 Available vehicle fields:`, Object.keys(firstVehicleData));
  console.log(`🚗 Vehicle info: ${firstVehicleData.driver_name || 'N/A'} driving ${firstVehicleData.vehicle_name || 'N/A'} (${firstVehicleData.class_name || 'N/A'})`);
  
  // Create a session
  const session = await prisma.sessions.create({
    data: {
      user_id: userId,
      session_stamp: BigInt(Date.now()),
      session_type: safeInt(firstSessionData?.session_type) ?? 0,
      track_name: safeString(firstSessionData?.track_name) || 'Unknown Track',
      sim_name: 'rFactor 2',
      api_version: '1.0',
      session_length: safeFloat(firstSessionData?.elapsed),
      title: `Imported Session ${new Date().toISOString()}`,
      description: 'Imported from CSV telemetry data'
    }
  });
  
  console.log(`✅ Created session with ID: ${session.id}`);
  
  console.log(`Vehicle: ${firstVehicleData?.driver_name}`);
  
  // Create a vehicle
  console.log(`🚗 Creating vehicle record...`);
  const vehicle = await prisma.vehicles.create({
    data: {
      session_id: session.id,
      slot_id: safeInt(firstVehicleData?.slot_id) ?? 0,
      driver_name: safeString(firstVehicleData?.driver_name) || 'Unknown Driver',
      vehicle_name: safeString(firstVehicleData?.vehicle_name) || 'Unknown Vehicle',
      class_name: safeString(firstVehicleData?.class_name) || 'Unknown Class',
      is_player: safeBool(firstVehicleData?.is_player) ?? true
    }
  });
  
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
    const lap = await prisma.laps.create({
      data: {
        user_id: userId,
        session_id: session.id,
        vehicle_id: vehicle.id,
        lap_number: lapNum,
        lap_time: safeFloat(timingClassData?.last_laptime),
        sector1_time: safeFloat(timingClassData?.last_sector1),
        sector2_time: safeFloat(timingClassData?.last_sector2),
        is_valid: true,
        lap_start_time: new Date(Date.now() - (lapNum * 90000)), // Approximate timing
        track_temp: safeFloat(lapClasses.session?.[0]?.track_temperature),
        ambient_temp: safeFloat(lapClasses.session?.[0]?.ambient_temperature),
        wetness: safeFloat(lapClasses.session?.[0]?.wetness)
      }
    });
    
    console.log(`  ✅ Created lap ${lapNum} with ID: ${lap.id}`);
    
    // Create timing data
    if (timingClassData) {
      console.log(`  ⏱️  Adding timing data...`);
      await prisma.timing_data.create({
        data: {
          lap_id: lap.id,
          sector1_time: safeFloat(timingClassData.last_sector1),
          sector2_time: safeFloat(timingClassData.last_sector2),
          sector1_best: safeFloat(timingClassData.best_sector1),
          sector2_best: safeFloat(timingClassData.best_sector2),
          delta_to_personal_best: safeFloat(timingClassData.behind_leader)
        }
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
      
      const telemetryId = BigInt(Date.now() * 1000 + i); // Unique BigInt ID
      
      // Prepare telemetry log entry
      telemetryBatch.push({
        id: telemetryId,
        lap_id: lap.id,
        timestamp: new Date(Date.now() - (lapNum * 90000) + (i * 100)),
        session_elapsed: safeFloat(vehicleData.elapsed_time),
        lap_progress: safeFloat(lapClassData?.progress) || (i / telemetryCount),
        position_x: safeFloat(vehicleData.position_longitudinal),
        position_y: safeFloat(vehicleData.position_lateral), 
        position_z: safeFloat(vehicleData.position_vertical),
        orientation_yaw: safeFloat(vehicleData.orientation_yaw_radians),
        speed: safeFloat(vehicleData.speed),
        accel_lateral: safeFloat(vehicleData.accel_lateral),
        accel_longitudinal: safeFloat(vehicleData.accel_longitudinal),
        accel_vertical: safeFloat(vehicleData.accel_vertical),
        velocity_lateral: safeFloat(vehicleData.velocity_lateral),
        velocity_longitudinal: safeFloat(vehicleData.velocity_longitudinal),
        velocity_vertical: safeFloat(vehicleData.velocity_vertical),
        gear: safeInt(lapClasses.engine?.[i]?.gear),
        rpm: safeFloat(lapClasses.engine?.[i]?.rpm),
        throttle: safeFloat(lapClasses.inputs?.[i]?.throttle),
        brake: safeFloat(lapClasses.inputs?.[i]?.brake),
        clutch: safeFloat(lapClasses.inputs?.[i]?.clutch),
        steering: safeFloat(lapClasses.inputs?.[i]?.steering),
        fuel: safeFloat(vehicleData.fuel),
        track_edge: safeFloat(vehicleData.track_edge),
        path_lateral: safeFloat(vehicleData.path_lateral)
      });
      
      // Prepare engine data
      const engineRow = lapClasses.engine?.[i];
      if (engineRow) {
        engineBatch.push({
          telemetry_log_id: telemetryId,
          gear: safeInt(engineRow.gear),
          max_gear: safeInt(engineRow.gear_max),
          rpm: safeFloat(engineRow.rpm),
          max_rpm: safeFloat(engineRow.rpm_max),
          torque: safeFloat(engineRow.torque),
          turbo_boost: safeFloat(engineRow.turbo),
          oil_temperature: safeFloat(engineRow.oil_temperature),
          water_temperature: safeFloat(engineRow.water_temperature)
        });
      }
      
      // Prepare input data
      const inputRow = lapClasses.inputs?.[i];
      if (inputRow) {
        inputBatch.push({
          telemetry_log_id: telemetryId,
          throttle: safeFloat(inputRow.throttle),
          throttle_raw: safeFloat(inputRow.throttle_raw),
          brake: safeFloat(inputRow.brake),
          brake_raw: safeFloat(inputRow.brake_raw),
          clutch: safeFloat(inputRow.clutch),
          clutch_raw: safeFloat(inputRow.clutch_raw),
          steering: safeFloat(inputRow.steering),
          steering_raw: safeFloat(inputRow.steering_raw),
          steering_shaft_torque: safeFloat(inputRow.steering_shaft_torque),
          steering_range_physical: safeFloat(inputRow.steering_range_physical),
          steering_range_visual: safeFloat(inputRow.steering_range_visual),
          force_feedback: safeFloat(inputRow.force_feedback)
        });
      }
      
      // Prepare brake data
      const brakeRow = lapClasses.brake?.[i];
      if (brakeRow) {
        brakeBatch.push({
          telemetry_log_id: telemetryId,
          bias_front: safeFloat(brakeRow.bias_front),
          pressure_fl: safeFloat(brakeRow.pressure_0),
          pressure_fr: safeFloat(brakeRow.pressure_1),
          pressure_rl: safeFloat(brakeRow.pressure_2),
          pressure_rr: safeFloat(brakeRow.pressure_3),
          temperature_fl: safeFloat(brakeRow.temperature_0),
          temperature_fr: safeFloat(brakeRow.temperature_1),
          temperature_rl: safeFloat(brakeRow.temperature_2),
          temperature_rr: safeFloat(brakeRow.temperature_3)
        });
      }
      
      // Prepare tyre data
      const tyreRow = lapClasses.tyre?.[i];
      if (tyreRow) {
        tyreBatch.push({
          telemetry_log_id: telemetryId,
          compound_front: safeInt(tyreRow.compound_front),
          compound_rear: safeInt(tyreRow.compound_rear),
          compound_name_front: safeString(tyreRow.compound_name_front),
          compound_name_rear: safeString(tyreRow.compound_name_rear),
          surface_temp_fl: safeFloat(tyreRow.surface_temperature_avg_0),
          surface_temp_fr: safeFloat(tyreRow.surface_temperature_avg_1),
          surface_temp_rl: safeFloat(tyreRow.surface_temperature_avg_2),
          surface_temp_rr: safeFloat(tyreRow.surface_temperature_avg_3),
          inner_temp_fl: safeFloat(tyreRow.inner_temperature_avg_0),
          inner_temp_fr: safeFloat(tyreRow.inner_temperature_avg_1),
          inner_temp_rl: safeFloat(tyreRow.inner_temperature_avg_2),
          inner_temp_rr: safeFloat(tyreRow.inner_temperature_avg_3),
          pressure_fl: safeFloat(tyreRow.pressure_0),
          pressure_fr: safeFloat(tyreRow.pressure_1),
          pressure_rl: safeFloat(tyreRow.pressure_2),
          pressure_rr: safeFloat(tyreRow.pressure_3),
          load_fl: safeFloat(tyreRow.load_0),
          load_fr: safeFloat(tyreRow.load_1),
          load_rl: safeFloat(tyreRow.load_2),
          load_rr: safeFloat(tyreRow.load_3),
          wear_fl: safeFloat(tyreRow.wear_0),
          wear_fr: safeFloat(tyreRow.wear_1),
          wear_rl: safeFloat(tyreRow.wear_2),
          wear_rr: safeFloat(tyreRow.wear_3),
          carcass_temp_fl: safeFloat(tyreRow.carcass_temperature_0),
          carcass_temp_fr: safeFloat(tyreRow.carcass_temperature_1),
          carcass_temp_rl: safeFloat(tyreRow.carcass_temperature_2),
          carcass_temp_rr: safeFloat(tyreRow.carcass_temperature_3)
        });
      }
      
      // Prepare wheel data
      const wheelRow = lapClasses.wheel?.[i];
      if (wheelRow) {
        wheelBatch.push({
          telemetry_log_id: telemetryId,
          camber_fl: safeFloat(wheelRow.camber_0),
          camber_fr: safeFloat(wheelRow.camber_1),
          camber_rl: safeFloat(wheelRow.camber_2),
          camber_rr: safeFloat(wheelRow.camber_3),
          toe_fl: safeFloat(wheelRow.toe_0),
          toe_fr: safeFloat(wheelRow.toe_1),
          toe_rl: safeFloat(wheelRow.toe_2),
          toe_rr: safeFloat(wheelRow.toe_3),
          rotation_fl: safeFloat(wheelRow.rotation_0),
          rotation_fr: safeFloat(wheelRow.rotation_1),
          rotation_rl: safeFloat(wheelRow.rotation_2),
          rotation_rr: safeFloat(wheelRow.rotation_3),
          vel_lateral_fl: safeFloat(wheelRow.velocity_lateral_0),
          vel_lateral_fr: safeFloat(wheelRow.velocity_lateral_1),
          vel_lateral_rl: safeFloat(wheelRow.velocity_lateral_2),
          vel_lateral_rr: safeFloat(wheelRow.velocity_lateral_3),
          vel_longitudinal_fl: safeFloat(wheelRow.velocity_longitudinal_0),
          vel_longitudinal_fr: safeFloat(wheelRow.velocity_longitudinal_1),
          vel_longitudinal_rl: safeFloat(wheelRow.velocity_longitudinal_2),
          vel_longitudinal_rr: safeFloat(wheelRow.velocity_longitudinal_3),
          ride_height_fl: safeFloat(wheelRow.ride_height_0),
          ride_height_fr: safeFloat(wheelRow.ride_height_1),
          ride_height_rl: safeFloat(wheelRow.ride_height_2),
          ride_height_rr: safeFloat(wheelRow.ride_height_3),
          suspension_deflection_fl: safeFloat(wheelRow.suspension_deflection_0),
          suspension_deflection_fr: safeFloat(wheelRow.suspension_deflection_1),
          suspension_deflection_rl: safeFloat(wheelRow.suspension_deflection_2),
          suspension_deflection_rr: safeFloat(wheelRow.suspension_deflection_3),
          suspension_force_fl: safeFloat(wheelRow.suspension_force_0),
          suspension_force_fr: safeFloat(wheelRow.suspension_force_1),
          suspension_force_rl: safeFloat(wheelRow.suspension_force_2),
          suspension_force_rr: safeFloat(wheelRow.suspension_force_3),
          third_spring_deflection_fl: safeFloat(wheelRow.third_spring_deflection_0),
          third_spring_deflection_fr: safeFloat(wheelRow.third_spring_deflection_1),
          third_spring_deflection_rl: safeFloat(wheelRow.third_spring_deflection_2),
          third_spring_deflection_rr: safeFloat(wheelRow.third_spring_deflection_3),
          position_vertical_fl: safeFloat(wheelRow.position_vertical_0),
          position_vertical_fr: safeFloat(wheelRow.position_vertical_1),
          position_vertical_rl: safeFloat(wheelRow.position_vertical_2),
          position_vertical_rr: safeFloat(wheelRow.position_vertical_3),
          is_detached_fl: safeBool(wheelRow.is_detached_0),
          is_detached_fr: safeBool(wheelRow.is_detached_1),
          is_detached_rl: safeBool(wheelRow.is_detached_2),
          is_detached_rr: safeBool(wheelRow.is_detached_3),
          is_offroad: safeBool(wheelRow.is_offroad)
        });
      }
      
      // Prepare vehicle state
      vehicleStateBatch.push({
        telemetry_log_id: telemetryId,
        place: safeInt(vehicleData.place),
        qualification: safeInt(vehicleData.qualification),
        in_pits: safeBool(vehicleData.in_pits),
        in_garage: safeBool(vehicleData.in_garage),
        num_pitstops: safeInt(vehicleData.number_pitstops),
        pit_request: safeBool(vehicleData.pit_request),
        num_penalties: safeInt(vehicleData.number_penalties),
        finish_state: safeInt(vehicleData.finish_state),
        fuel: safeFloat(vehicleData.fuel),
        tank_capacity: safeFloat(vehicleData.tank_capacity),
        downforce_front: safeFloat(vehicleData.downforce_front),
        downforce_rear: safeFloat(vehicleData.downforce_rear),
        is_detached: safeBool(vehicleData.is_detached),
        last_impact_time: safeFloat(vehicleData.impact_time),
        last_impact_magnitude: safeFloat(vehicleData.impact_magnitude)
      });
      
      // Prepare switch states
      const switchRow = lapClasses.switch?.[i];
      if (switchRow) {
        switchBatch.push({
          telemetry_log_id: telemetryId,
          headlights: safeInt(switchRow.headlights),
          ignition_starter: safeInt(switchRow.ignition_starter),
          speed_limiter: safeInt(switchRow.speed_limiter),
          drs_status: safeInt(switchRow.drs_status),
          auto_clutch: safeBool(switchRow.auto_clutch)
        });
      }
      
      processedPoints++;
      
      // Execute batch inserts when batch size is reached or at the end
      if (telemetryBatch.length >= batchSize || i === telemetryCount - 1) {
        console.log(`    🚀 Batch inserting ${telemetryBatch.length} telemetry records (${Math.round((processedPoints / telemetryCount) * 100)}%)`);
        
        // Insert telemetry logs first (parent table)
        if (telemetryBatch.length > 0) {
          await prisma.telemetry_logs.createMany({
            data: telemetryBatch
          });
        }
        
        // Then insert all related data in parallel (child tables)
        await Promise.all([
          engineBatch.length > 0 ? prisma.engine_data.createMany({ data: engineBatch }) : Promise.resolve(),
          inputBatch.length > 0 ? prisma.input_data.createMany({ data: inputBatch }) : Promise.resolve(),
          brakeBatch.length > 0 ? prisma.brake_data.createMany({ data: brakeBatch }) : Promise.resolve(),
          tyreBatch.length > 0 ? prisma.tyre_data.createMany({ data: tyreBatch }) : Promise.resolve(),
          wheelBatch.length > 0 ? prisma.wheel_data.createMany({ data: wheelBatch }) : Promise.resolve(),
          vehicleStateBatch.length > 0 ? prisma.vehicle_state.createMany({ data: vehicleStateBatch }) : Promise.resolve(),
          switchBatch.length > 0 ? prisma.switch_states.createMany({ data: switchBatch }) : Promise.resolve()
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
      
      await prisma.lap_summary.create({
        data: {
          lap_id: lap.id,
          max_speed: speeds.length > 0 ? Math.max(...speeds) : null,
          avg_speed: speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null,
          min_speed: speeds.length > 0 ? Math.min(...speeds) : null,
          max_rpm: rpms.length > 0 ? Math.max(...rpms) : null,
          avg_rpm: rpms.length > 0 ? rpms.reduce((a, b) => a + b, 0) / rpms.length : null,
          max_throttle: throttles.length > 0 ? Math.max(...throttles) : null,
          avg_throttle: throttles.length > 0 ? throttles.reduce((a, b) => a + b, 0) / throttles.length : null,
          max_brake: brakes.length > 0 ? Math.max(...brakes) : null,
          avg_brake: brakes.length > 0 ? brakes.reduce((a, b) => a + b, 0) / brakes.length : null,
          fuel_starting: safeFloat(vehicleRows[0]?.fuel),
          fuel_ending: safeFloat(vehicleRows[vehicleRows.length - 1]?.fuel),
          fuel_used: vehicleRows.length > 1 ? 
            (safeFloat(vehicleRows[0]?.fuel) || 0) - (safeFloat(vehicleRows[vehicleRows.length - 1]?.fuel) || 0) : 
            null
        }
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
  
  if (!userId || !csvDirectory) {
    console.error('Both userId and csvDirectory are required');
    process.exit(1);
  }
  
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
    await prisma.$disconnect();
  }
}

main(); 