import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { 
  createErrorResponse, 
  createSuccessResponse, 
  validateRequiredFields,
  safeFloat,
  safeInt,
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
    
    // Create timing data
    const timingData = await prisma.timing_data.create({
      data: {
        lap_id: body.lap_id,
        sector1_time: safeFloat(body.sector1_time),
        sector2_time: safeFloat(body.sector2_time),
        sector3_time: safeFloat(body.sector3_time),
        sector1_best: safeFloat(body.sector1_best),
        sector2_best: safeFloat(body.sector2_best),
        sector3_best: safeFloat(body.sector3_best),
        delta_to_personal_best: safeFloat(body.delta_to_personal_best),
        delta_to_session_best: safeFloat(body.delta_to_session_best),
        start_position: safeInt(body.start_position),
        end_position: safeInt(body.end_position)
      }
    })
    
    return createSuccessResponse(timingData, 'Timing data created successfully')
  } catch (error) {
    console.error('Error creating timing data:', error)
    return createErrorResponse('Failed to create timing data', 500)
  }
}