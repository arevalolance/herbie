import { NextResponse } from 'next/server'

export function safeFloat(value: any): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = parseFloat(String(value))
  return isNaN(num) ? null : num
}

export function safeInt(value: any): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = parseInt(String(value))
  return isNaN(num) ? null : num
}

export function safeBool(value: any): boolean | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    if (lower === 'true' || lower === '1') return true
    if (lower === 'false' || lower === '0') return false
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  return null
}

export function safeString(value: any): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

export function safeBigInt(value: any): bigint | null {
  if (value === null || value === undefined || value === '') return null
  try {
    return BigInt(value)
  } catch {
    return null
  }
}

export function createErrorResponse(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status })
}

export function createSuccessResponse(data: any, message?: string) {
  return NextResponse.json({ 
    success: true, 
    data,
    ...(message && { message })
  })
}

export function validateRequiredFields(body: any, requiredFields: string[]): string | null {
  for (const field of requiredFields) {
    if (!body[field] && body[field] !== 0) {
      return `Missing required field: ${field}`
    }
  }
  return null
}

export function generateTelemetryId(): bigint {
  return BigInt(Date.now() * 1000 + Math.floor(Math.random() * 1000))
}

export function isValidUserId(userId: string): boolean {
  return typeof userId === 'string' && userId.length > 0
}

export function isValidSessionId(sessionId: number): boolean {
  return typeof sessionId === 'number' && sessionId > 0
}

export function isValidLapId(lapId: number): boolean {
  return typeof lapId === 'number' && lapId > 0
}

export function isValidVehicleId(vehicleId: number): boolean {
  return typeof vehicleId === 'number' && vehicleId > 0
}

export function calculateDistance(
  prevX: number | null,
  prevY: number | null,
  currX: number | null,
  currY: number | null
): number {
  if (prevX === null || prevY === null || currX === null || currY === null) {
    return 0
  }
  
  const dx = currX - prevX
  const dy = currY - prevY
  return Math.sqrt(dx * dx + dy * dy)
}

export function calculateSpeedFromVelocity(
  velocityLongitudinal: number | null,
  velocityLateral: number | null,
  velocityVertical: number | null
): number {
  const vLong = velocityLongitudinal ?? 0
  const vLat = velocityLateral ?? 0
  const vVert = velocityVertical ?? 0
  
  const speedMs = Math.sqrt(
    Math.pow(vLong, 2) + 
    Math.pow(vLat, 2) + 
    Math.pow(vVert, 2)
  )
  
  return speedMs * 3.6 // Convert m/s to km/h
}

export function calculateAverage(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

export function calculateMax(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.max(...values)
}

export function calculateMin(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.min(...values)
}

export function filterValidNumbers(values: (number | null)[]): number[] {
  return values.filter((v): v is number => v !== null && !isNaN(v))
}