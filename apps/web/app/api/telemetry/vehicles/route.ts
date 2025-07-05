import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { 
  createErrorResponse, 
  createSuccessResponse, 
  validateRequiredFields,
  safeInt,
  safeString,
  safeBool,
  isValidSessionId 
} from '../utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ['session_id', 'slot_id', 'driver_name', 'vehicle_name']
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
    
    // Create vehicle
    const vehicle = await prisma.vehicles.create({
      data: {
        session_id: body.session_id,
        slot_id: safeInt(body.slot_id) ?? 0,
        driver_name: safeString(body.driver_name) || 'Unknown Driver',
        vehicle_name: safeString(body.vehicle_name) || 'Unknown Vehicle',
        class_name: safeString(body.class_name) || 'Unknown Class',
        is_player: safeBool(body.is_player) ?? false
      }
    })
    
    return createSuccessResponse(vehicle, 'Vehicle created successfully')
  } catch (error) {
    console.error('Error creating vehicle:', error)
    return createErrorResponse('Failed to create vehicle', 500)
  }
}