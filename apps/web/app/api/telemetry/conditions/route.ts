import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { 
  createErrorResponse, 
  createSuccessResponse, 
  validateRequiredFields,
  safeFloat,
  safeInt,
  safeBool,
  isValidSessionId
} from '../utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ['session_id', 'timestamp']
    const validationError = validateRequiredFields(body, requiredFields)
    if (validationError) {
      return createErrorResponse(validationError)
    }
    
    // Validate session_id
    if (!isValidSessionId(body.session_id)) {
      return createErrorResponse('Invalid session_id')
    }
    
    // Verify session exists
    const session = await prisma.sessions.findUnique({
      where: { id: body.session_id }
    })
    
    if (!session) {
      return createErrorResponse('Session not found')
    }
    
    // Parse timestamp
    let timestamp: Date
    try {
      timestamp = new Date(body.timestamp)
      if (isNaN(timestamp.getTime())) {
        throw new Error('Invalid date')
      }
    } catch {
      return createErrorResponse('Invalid timestamp format')
    }
    
    // Create session conditions
    const sessionConditions = await prisma.session_conditions.create({
      data: {
        session_id: body.session_id,
        timestamp: timestamp,
        track_temperature: safeFloat(body.track_temperature),
        ambient_temperature: safeFloat(body.ambient_temperature),
        raininess: safeFloat(body.raininess),
        wetness_minimum: safeFloat(body.wetness_minimum),
        wetness_maximum: safeFloat(body.wetness_maximum),
        wetness_average: safeFloat(body.wetness_average),
        game_phase: safeInt(body.game_phase),
        in_countdown: safeBool(body.in_countdown),
        in_formation: safeBool(body.in_formation),
        pit_open: safeBool(body.pit_open),
        green_flag: safeBool(body.green_flag),
        yellow_flag: safeBool(body.yellow_flag),
        start_lights: safeInt(body.start_lights)
      }
    })
    
    return createSuccessResponse(sessionConditions, 'Session conditions created successfully')
  } catch (error) {
    console.error('Error creating session conditions:', error)
    return createErrorResponse('Failed to create session conditions', 500)
  }
}