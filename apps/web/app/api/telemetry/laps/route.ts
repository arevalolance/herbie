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
  isValidUserId,
  isValidSessionId,
  isValidVehicleId
} from '../utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ['user_id', 'session_id', 'vehicle_id', 'lap_number', 'lap_start_time']
    const validationError = validateRequiredFields(body, requiredFields)
    if (validationError) {
      return createErrorResponse(validationError)
    }
    
    // Validate IDs
    if (!isValidUserId(body.user_id)) {
      return createErrorResponse('Invalid user_id')
    }
    if (!isValidSessionId(body.session_id)) {
      return createErrorResponse('Invalid session_id')
    }
    if (!isValidVehicleId(body.vehicle_id)) {
      return createErrorResponse('Invalid vehicle_id')
    }
    
    // Verify session and vehicle exist
    const [session, vehicle] = await Promise.all([
      prisma.sessions.findUnique({ where: { id: body.session_id } }),
      prisma.vehicles.findUnique({ where: { id: body.vehicle_id } })
    ])
    
    if (!session) {
      return createErrorResponse('Session not found')
    }
    if (!vehicle) {
      return createErrorResponse('Vehicle not found')
    }
    
    // Parse lap start time
    let lapStartTime: Date
    try {
      lapStartTime = new Date(body.lap_start_time)
      if (isNaN(lapStartTime.getTime())) {
        throw new Error('Invalid date')
      }
    } catch {
      return createErrorResponse('Invalid lap_start_time format')
    }
    
    // Create lap
    const lap = await prisma.laps.create({
      data: {
        user_id: body.user_id,
        session_id: body.session_id,
        vehicle_id: body.vehicle_id,
        lap_number: safeInt(body.lap_number) ?? 0,
        title: safeString(body.title),
        description: safeString(body.description),
        tags: safeString(body.tags),
        lap_time: safeFloat(body.lap_time),
        sector1_time: safeFloat(body.sector1_time),
        sector2_time: safeFloat(body.sector2_time),
        sector3_time: safeFloat(body.sector3_time),
        is_valid: safeBool(body.is_valid) ?? true,
        is_personal_best: safeBool(body.is_personal_best) ?? false,
        lap_start_time: lapStartTime,
        lap_end_time: body.lap_end_time ? new Date(body.lap_end_time) : null,
        track_temp: safeFloat(body.track_temp),
        ambient_temp: safeFloat(body.ambient_temp),
        wetness: safeFloat(body.wetness)
      }
    })
    
    return createSuccessResponse(lap, 'Lap created successfully')
  } catch (error) {
    console.error('Error creating lap:', error)
    return createErrorResponse('Failed to create lap', 500)
  }
}