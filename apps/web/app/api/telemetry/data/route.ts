import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { 
  createErrorResponse, 
  createSuccessResponse, 
  validateRequiredFields,
  safeFloat,
  safeInt,
  safeString,
  safeBool,
  generateTelemetryId,
  isValidLapId
} from '../utils'

interface TelemetryPoint {
  // Core telemetry fields
  timestamp?: string
  session_elapsed?: number
  lap_progress?: number
  position_x?: number
  position_y?: number
  position_z?: number
  orientation_yaw?: number
  speed?: number
  accel_lateral?: number
  accel_longitudinal?: number
  accel_vertical?: number
  velocity_lateral?: number
  velocity_longitudinal?: number
  velocity_vertical?: number
  gear?: number
  rpm?: number
  throttle?: number
  brake?: number
  clutch?: number
  steering?: number
  fuel?: number
  track_edge?: number
  path_lateral?: number
  
  // Related data
  engine?: any
  input?: any
  brake_data?: any
  tyre?: any
  wheel?: any
  vehicle_state?: any
  switch_states?: any
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ['lap_id', 'telemetry_points']
    const validationError = validateRequiredFields(body, requiredFields)
    if (validationError) {
      return createErrorResponse(validationError)
    }
    
    // Validate lap_id
    if (!isValidLapId(body.lap_id)) {
      return createErrorResponse('Invalid lap_id')
    }
    
    // Verify lap exists
    const lap = await prisma.laps.findUnique({
      where: { id: body.lap_id }
    })
    
    if (!lap) {
      return createErrorResponse('Lap not found')
    }
    
    const telemetryPoints: TelemetryPoint[] = body.telemetry_points
    
    if (!Array.isArray(telemetryPoints) || telemetryPoints.length === 0) {
      return createErrorResponse('telemetry_points must be a non-empty array')
    }
    
    // Prepare batch arrays
    const telemetryBatch: any[] = []
    const engineBatch: any[] = []
    const inputBatch: any[] = []
    const brakeBatch: any[] = []
    const tyreBatch: any[] = []
    const wheelBatch: any[] = []
    const vehicleStateBatch: any[] = []
    const switchBatch: any[] = []
    
    // Process each telemetry point
    for (let i = 0; i < telemetryPoints.length; i++) {
      const point = telemetryPoints[i]
      const telemetryId = generateTelemetryId()
      
      // Prepare telemetry log entry
      telemetryBatch.push({
        id: telemetryId,
        lap_id: body.lap_id,
        timestamp: point.timestamp ? new Date(point.timestamp) : new Date(),
        session_elapsed: safeFloat(point.session_elapsed),
        lap_progress: safeFloat(point.lap_progress),
        position_x: safeFloat(point.position_x),
        position_y: safeFloat(point.position_y),
        position_z: safeFloat(point.position_z),
        orientation_yaw: safeFloat(point.orientation_yaw),
        speed: safeFloat(point.speed),
        accel_lateral: safeFloat(point.accel_lateral),
        accel_longitudinal: safeFloat(point.accel_longitudinal),
        accel_vertical: safeFloat(point.accel_vertical),
        velocity_lateral: safeFloat(point.velocity_lateral),
        velocity_longitudinal: safeFloat(point.velocity_longitudinal),
        velocity_vertical: safeFloat(point.velocity_vertical),
        gear: safeInt(point.gear),
        rpm: safeFloat(point.rpm),
        throttle: safeFloat(point.throttle),
        brake: safeFloat(point.brake),
        clutch: safeFloat(point.clutch),
        steering: safeFloat(point.steering),
        fuel: safeFloat(point.fuel),
        track_edge: safeFloat(point.track_edge),
        path_lateral: safeFloat(point.path_lateral)
      })
      
      // Prepare engine data
      if (point.engine) {
        engineBatch.push({
          telemetry_log_id: telemetryId,
          gear: safeInt(point.engine.gear),
          max_gear: safeInt(point.engine.max_gear),
          rpm: safeFloat(point.engine.rpm),
          max_rpm: safeFloat(point.engine.max_rpm),
          torque: safeFloat(point.engine.torque),
          turbo_boost: safeFloat(point.engine.turbo_boost),
          oil_temperature: safeFloat(point.engine.oil_temperature),
          water_temperature: safeFloat(point.engine.water_temperature)
        })
      }
      
      // Prepare input data
      if (point.input) {
        inputBatch.push({
          telemetry_log_id: telemetryId,
          throttle: safeFloat(point.input.throttle),
          throttle_raw: safeFloat(point.input.throttle_raw),
          brake: safeFloat(point.input.brake),
          brake_raw: safeFloat(point.input.brake_raw),
          clutch: safeFloat(point.input.clutch),
          clutch_raw: safeFloat(point.input.clutch_raw),
          steering: safeFloat(point.input.steering),
          steering_raw: safeFloat(point.input.steering_raw),
          steering_shaft_torque: safeFloat(point.input.steering_shaft_torque),
          steering_range_physical: safeFloat(point.input.steering_range_physical),
          steering_range_visual: safeFloat(point.input.steering_range_visual),
          force_feedback: safeFloat(point.input.force_feedback)
        })
      }
      
      // Prepare brake data
      if (point.brake_data) {
        brakeBatch.push({
          telemetry_log_id: telemetryId,
          bias_front: safeFloat(point.brake_data.bias_front),
          pressure_fl: safeFloat(point.brake_data.pressure_fl),
          pressure_fr: safeFloat(point.brake_data.pressure_fr),
          pressure_rl: safeFloat(point.brake_data.pressure_rl),
          pressure_rr: safeFloat(point.brake_data.pressure_rr),
          temperature_fl: safeFloat(point.brake_data.temperature_fl),
          temperature_fr: safeFloat(point.brake_data.temperature_fr),
          temperature_rl: safeFloat(point.brake_data.temperature_rl),
          temperature_rr: safeFloat(point.brake_data.temperature_rr)
        })
      }
      
      // Prepare tyre data
      if (point.tyre) {
        tyreBatch.push({
          telemetry_log_id: telemetryId,
          compound_front: safeInt(point.tyre.compound_front),
          compound_rear: safeInt(point.tyre.compound_rear),
          compound_name_front: safeString(point.tyre.compound_name_front),
          compound_name_rear: safeString(point.tyre.compound_name_rear),
          surface_temp_fl: safeFloat(point.tyre.surface_temp_fl),
          surface_temp_fr: safeFloat(point.tyre.surface_temp_fr),
          surface_temp_rl: safeFloat(point.tyre.surface_temp_rl),
          surface_temp_rr: safeFloat(point.tyre.surface_temp_rr),
          inner_temp_fl: safeFloat(point.tyre.inner_temp_fl),
          inner_temp_fr: safeFloat(point.tyre.inner_temp_fr),
          inner_temp_rl: safeFloat(point.tyre.inner_temp_rl),
          inner_temp_rr: safeFloat(point.tyre.inner_temp_rr),
          pressure_fl: safeFloat(point.tyre.pressure_fl),
          pressure_fr: safeFloat(point.tyre.pressure_fr),
          pressure_rl: safeFloat(point.tyre.pressure_rl),
          pressure_rr: safeFloat(point.tyre.pressure_rr),
          load_fl: safeFloat(point.tyre.load_fl),
          load_fr: safeFloat(point.tyre.load_fr),
          load_rl: safeFloat(point.tyre.load_rl),
          load_rr: safeFloat(point.tyre.load_rr),
          wear_fl: safeFloat(point.tyre.wear_fl),
          wear_fr: safeFloat(point.tyre.wear_fr),
          wear_rl: safeFloat(point.tyre.wear_rl),
          wear_rr: safeFloat(point.tyre.wear_rr),
          carcass_temp_fl: safeFloat(point.tyre.carcass_temp_fl),
          carcass_temp_fr: safeFloat(point.tyre.carcass_temp_fr),
          carcass_temp_rl: safeFloat(point.tyre.carcass_temp_rl),
          carcass_temp_rr: safeFloat(point.tyre.carcass_temp_rr)
        })
      }
      
      // Prepare wheel data
      if (point.wheel) {
        wheelBatch.push({
          telemetry_log_id: telemetryId,
          camber_fl: safeFloat(point.wheel.camber_fl),
          camber_fr: safeFloat(point.wheel.camber_fr),
          camber_rl: safeFloat(point.wheel.camber_rl),
          camber_rr: safeFloat(point.wheel.camber_rr),
          toe_fl: safeFloat(point.wheel.toe_fl),
          toe_fr: safeFloat(point.wheel.toe_fr),
          toe_rl: safeFloat(point.wheel.toe_rl),
          toe_rr: safeFloat(point.wheel.toe_rr),
          rotation_fl: safeFloat(point.wheel.rotation_fl),
          rotation_fr: safeFloat(point.wheel.rotation_fr),
          rotation_rl: safeFloat(point.wheel.rotation_rl),
          rotation_rr: safeFloat(point.wheel.rotation_rr),
          vel_lateral_fl: safeFloat(point.wheel.vel_lateral_fl),
          vel_lateral_fr: safeFloat(point.wheel.vel_lateral_fr),
          vel_lateral_rl: safeFloat(point.wheel.vel_lateral_rl),
          vel_lateral_rr: safeFloat(point.wheel.vel_lateral_rr),
          vel_longitudinal_fl: safeFloat(point.wheel.vel_longitudinal_fl),
          vel_longitudinal_fr: safeFloat(point.wheel.vel_longitudinal_fr),
          vel_longitudinal_rl: safeFloat(point.wheel.vel_longitudinal_rl),
          vel_longitudinal_rr: safeFloat(point.wheel.vel_longitudinal_rr),
          ride_height_fl: safeFloat(point.wheel.ride_height_fl),
          ride_height_fr: safeFloat(point.wheel.ride_height_fr),
          ride_height_rl: safeFloat(point.wheel.ride_height_rl),
          ride_height_rr: safeFloat(point.wheel.ride_height_rr),
          suspension_deflection_fl: safeFloat(point.wheel.suspension_deflection_fl),
          suspension_deflection_fr: safeFloat(point.wheel.suspension_deflection_fr),
          suspension_deflection_rl: safeFloat(point.wheel.suspension_deflection_rl),
          suspension_deflection_rr: safeFloat(point.wheel.suspension_deflection_rr),
          suspension_force_fl: safeFloat(point.wheel.suspension_force_fl),
          suspension_force_fr: safeFloat(point.wheel.suspension_force_fr),
          suspension_force_rl: safeFloat(point.wheel.suspension_force_rl),
          suspension_force_rr: safeFloat(point.wheel.suspension_force_rr),
          third_spring_deflection_fl: safeFloat(point.wheel.third_spring_deflection_fl),
          third_spring_deflection_fr: safeFloat(point.wheel.third_spring_deflection_fr),
          third_spring_deflection_rl: safeFloat(point.wheel.third_spring_deflection_rl),
          third_spring_deflection_rr: safeFloat(point.wheel.third_spring_deflection_rr),
          position_vertical_fl: safeFloat(point.wheel.position_vertical_fl),
          position_vertical_fr: safeFloat(point.wheel.position_vertical_fr),
          position_vertical_rl: safeFloat(point.wheel.position_vertical_rl),
          position_vertical_rr: safeFloat(point.wheel.position_vertical_rr),
          is_detached_fl: safeBool(point.wheel.is_detached_fl),
          is_detached_fr: safeBool(point.wheel.is_detached_fr),
          is_detached_rl: safeBool(point.wheel.is_detached_rl),
          is_detached_rr: safeBool(point.wheel.is_detached_rr),
          is_offroad: safeBool(point.wheel.is_offroad)
        })
      }
      
      // Prepare vehicle state
      if (point.vehicle_state) {
        vehicleStateBatch.push({
          telemetry_log_id: telemetryId,
          place: safeInt(point.vehicle_state.place),
          qualification: safeInt(point.vehicle_state.qualification),
          in_pits: safeBool(point.vehicle_state.in_pits),
          in_garage: safeBool(point.vehicle_state.in_garage),
          num_pitstops: safeInt(point.vehicle_state.num_pitstops),
          pit_request: safeBool(point.vehicle_state.pit_request),
          num_penalties: safeInt(point.vehicle_state.num_penalties),
          finish_state: safeInt(point.vehicle_state.finish_state),
          fuel: safeFloat(point.vehicle_state.fuel),
          tank_capacity: safeFloat(point.vehicle_state.tank_capacity),
          downforce_front: safeFloat(point.vehicle_state.downforce_front),
          downforce_rear: safeFloat(point.vehicle_state.downforce_rear),
          is_detached: safeBool(point.vehicle_state.is_detached),
          last_impact_time: safeFloat(point.vehicle_state.last_impact_time),
          last_impact_magnitude: safeFloat(point.vehicle_state.last_impact_magnitude)
        })
      }
      
      // Prepare switch states
      if (point.switch_states) {
        switchBatch.push({
          telemetry_log_id: telemetryId,
          headlights: safeInt(point.switch_states.headlights),
          ignition_starter: safeInt(point.switch_states.ignition_starter),
          speed_limiter: safeInt(point.switch_states.speed_limiter),
          drs_status: safeInt(point.switch_states.drs_status),
          auto_clutch: safeBool(point.switch_states.auto_clutch)
        })
      }
    }
    
    // Execute batch inserts
    console.log(`Batch inserting ${telemetryBatch.length} telemetry records`)
    
    // Insert telemetry logs first (parent table)
    await prisma.telemetry_logs.createMany({
      data: telemetryBatch
    })
    
    // Then insert all related data in parallel (child tables)
    await Promise.all([
      engineBatch.length > 0 ? prisma.engine_data.createMany({ data: engineBatch }) : Promise.resolve(),
      inputBatch.length > 0 ? prisma.input_data.createMany({ data: inputBatch }) : Promise.resolve(),
      brakeBatch.length > 0 ? prisma.brake_data.createMany({ data: brakeBatch }) : Promise.resolve(),
      tyreBatch.length > 0 ? prisma.tyre_data.createMany({ data: tyreBatch }) : Promise.resolve(),
      wheelBatch.length > 0 ? prisma.wheel_data.createMany({ data: wheelBatch }) : Promise.resolve(),
      vehicleStateBatch.length > 0 ? prisma.vehicle_state.createMany({ data: vehicleStateBatch }) : Promise.resolve(),
      switchBatch.length > 0 ? prisma.switch_states.createMany({ data: switchBatch }) : Promise.resolve()
    ])
    
    return createSuccessResponse(
      { 
        telemetry_count: telemetryBatch.length,
        engine_count: engineBatch.length,
        input_count: inputBatch.length,
        brake_count: brakeBatch.length,
        tyre_count: tyreBatch.length,
        wheel_count: wheelBatch.length,
        vehicle_state_count: vehicleStateBatch.length,
        switch_count: switchBatch.length
      },
      'Telemetry data inserted successfully'
    )
  } catch (error) {
    console.error('Error inserting telemetry data:', error)
    return createErrorResponse('Failed to insert telemetry data', 500)
  }
}