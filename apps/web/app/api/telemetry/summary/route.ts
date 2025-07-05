import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { 
  createErrorResponse, 
  createSuccessResponse, 
  validateRequiredFields,
  safeFloat,
  isValidLapId
} from '../utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = ['lap_id']
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
    
    // Check if summary already exists
    const existingSummary = await prisma.lap_summary.findUnique({
      where: { lap_id: body.lap_id }
    })
    
    if (existingSummary) {
      return createErrorResponse('Lap summary already exists for this lap')
    }
    
    // Create lap summary
    const lapSummary = await prisma.lap_summary.create({
      data: {
        lap_id: body.lap_id,
        max_speed: safeFloat(body.max_speed),
        avg_speed: safeFloat(body.avg_speed),
        min_speed: safeFloat(body.min_speed),
        max_rpm: safeFloat(body.max_rpm),
        avg_rpm: safeFloat(body.avg_rpm),
        max_throttle: safeFloat(body.max_throttle),
        avg_throttle: safeFloat(body.avg_throttle),
        max_brake: safeFloat(body.max_brake),
        avg_brake: safeFloat(body.avg_brake),
        max_lateral_g: safeFloat(body.max_lateral_g),
        max_longitudinal_g: safeFloat(body.max_longitudinal_g),
        max_vertical_g: safeFloat(body.max_vertical_g),
        max_tire_temp: safeFloat(body.max_tire_temp),
        avg_tire_temp: safeFloat(body.avg_tire_temp),
        max_tire_pressure: safeFloat(body.max_tire_pressure),
        avg_tire_pressure: safeFloat(body.avg_tire_pressure),
        fuel_used: safeFloat(body.fuel_used),
        fuel_starting: safeFloat(body.fuel_starting),
        fuel_ending: safeFloat(body.fuel_ending),
        distance_covered: safeFloat(body.distance_covered)
      }
    })
    
    return createSuccessResponse(lapSummary, 'Lap summary created successfully')
  } catch (error) {
    console.error('Error creating lap summary:', error)
    return createErrorResponse('Failed to create lap summary', 500)
  }
}