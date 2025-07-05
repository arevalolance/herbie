import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { 
  createErrorResponse, 
  createSuccessResponse, 
  validateRequiredFields,
  safeFloat,
  safeInt,
  safeString,
  safeBigInt,
  isValidUserId 
} from '../utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ['user_id', 'session_type', 'track_name']
    const validationError = validateRequiredFields(body, requiredFields)
    if (validationError) {
      return createErrorResponse(validationError)
    }
    
    // Validate user_id
    if (!isValidUserId(body.user_id)) {
      return createErrorResponse('Invalid user_id')
    }
    
    // Create session
    const session = await prisma.sessions.create({
      data: {
        user_id: body.user_id,
        session_stamp: safeBigInt(body.session_stamp) ?? BigInt(Date.now()),
        session_type: safeInt(body.session_type) ?? 0,
        track_name: safeString(body.track_name) || 'Unknown Track',
        combo_id: safeString(body.combo_id),
        track_id: safeString(body.track_id),
        sim_name: safeString(body.sim_name) || 'rFactor 2',
        api_version: safeString(body.api_version) || '1.0',
        session_length: safeFloat(body.session_length),
        max_laps: safeInt(body.max_laps),
        is_lap_type: body.is_lap_type ?? true,
        title: safeString(body.title) || `Session ${new Date().toISOString()}`,
        description: safeString(body.description)
      }
    })
    
    return createSuccessResponse(session, 'Session created successfully')
  } catch (error) {
    console.error('Error creating session:', error)
    return createErrorResponse('Failed to create session', 500)
  }
}