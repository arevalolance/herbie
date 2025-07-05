import { PrismaClient } from '@/generated/prisma'

export interface TelemetryPoint {
  id: string
  lap_progress: number
  timestamp: Date
  session_elapsed: number
  speed: number
  throttle: number
  brake: number
  rpm: number
  gear: number
}

export interface DeltaResult {
  delta_to_best_time: number
  delta_to_session_best_time: number
  reference_lap_id: number
}

export interface LapData {
  lap_id: number
  lap_time: number
  telemetry_points: TelemetryPoint[]
}

export class DeltaCalculator {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Calculate delta times for all telemetry points in a lap
   * @param targetLapId - The lap to calculate deltas for
   * @param referenceLapId - The reference lap to compare against (optional - uses personal best if not provided)
   */
  async calculateLapDeltas(
    targetLapId: number,
    referenceLapId?: number
  ): Promise<Map<string, DeltaResult>> {
    const targetLap = await this.getLapTelemetryData(targetLapId)
    if (!targetLap) {
      throw new Error(`Target lap ${targetLapId} not found`)
    }

    // Get reference lap (personal best if not specified)
    const referenceLap = referenceLapId
      ? await this.getLapTelemetryData(referenceLapId)
      : await this.getPersonalBestLap(targetLapId)

    if (!referenceLap) {
      throw new Error(`Reference lap not found`)
    }

    const sessionBestLap = await this.getSessionBestLap(targetLapId)
    
    const deltaResults = new Map<string, DeltaResult>()

    // Calculate deltas for each telemetry point
    for (const targetPoint of targetLap.telemetry_points) {
      const referencePoint = this.interpolateTelemetryPoint(
        referenceLap.telemetry_points,
        targetPoint.lap_progress
      )
      
      const sessionBestPoint = sessionBestLap
        ? this.interpolateTelemetryPoint(
            sessionBestLap.telemetry_points,
            targetPoint.lap_progress
          )
        : null

      if (referencePoint) {
        const deltaToBest = this.calculateDeltaAtPoint(targetPoint, referencePoint)
        const deltaToSessionBest = sessionBestPoint
          ? this.calculateDeltaAtPoint(targetPoint, sessionBestPoint)
          : deltaToBest

        deltaResults.set(targetPoint.id, {
          delta_to_best_time: deltaToBest,
          delta_to_session_best_time: deltaToSessionBest,
          reference_lap_id: referenceLap.lap_id
        })
      }
    }

    return deltaResults
  }

  /**
   * Get telemetry data for a specific lap
   */
  private async getLapTelemetryData(lapId: number): Promise<LapData | null> {
    const lap = await this.prisma.laps.findUnique({
      where: { id: lapId },
      include: {
        telemetry_logs: {
          select: {
            id: true,
            lap_progress: true,
            timestamp: true,
            session_elapsed: true,
            speed: true,
            throttle: true,
            brake: true,
            rpm: true,
            gear: true
          },
          orderBy: {
            lap_progress: 'asc'
          }
        }
      }
    })

    if (!lap || !lap.lap_time) {
      return null
    }

    return {
      lap_id: lap.id,
      lap_time: lap.lap_time,
      telemetry_points: lap.telemetry_logs.map(log => ({
        id: log.id.toString(),
        lap_progress: log.lap_progress || 0,
        timestamp: log.timestamp,
        session_elapsed: log.session_elapsed || 0,
        speed: log.speed || 0,
        throttle: log.throttle || 0,
        brake: log.brake || 0,
        rpm: log.rpm || 0,
        gear: log.gear || 0
      }))
    }
  }

  /**
   * Get personal best lap for the same user/session
   */
  private async getPersonalBestLap(targetLapId: number): Promise<LapData | null> {
    const targetLap = await this.prisma.laps.findUnique({
      where: { id: targetLapId },
      select: { user_id: true, session_id: true }
    })

    if (!targetLap) return null

    const personalBestLap = await this.prisma.laps.findFirst({
      where: {
        user_id: targetLap.user_id,
        session_id: targetLap.session_id,
        is_personal_best: true,
        is_valid: true
      },
      include: {
        telemetry_logs: {
          select: {
            id: true,
            lap_progress: true,
            timestamp: true,
            session_elapsed: true,
            speed: true,
            throttle: true,
            brake: true,
            rpm: true,
            gear: true
          },
          orderBy: {
            lap_progress: 'asc'
          }
        }
      }
    })

    if (!personalBestLap || !personalBestLap.lap_time) {
      return null
    }

    return {
      lap_id: personalBestLap.id,
      lap_time: personalBestLap.lap_time,
      telemetry_points: personalBestLap.telemetry_logs.map(log => ({
        id: log.id.toString(),
        lap_progress: log.lap_progress || 0,
        timestamp: log.timestamp,
        session_elapsed: log.session_elapsed || 0,
        speed: log.speed || 0,
        throttle: log.throttle || 0,
        brake: log.brake || 0,
        rpm: log.rpm || 0,
        gear: log.gear || 0
      }))
    }
  }

  /**
   * Get session best lap
   */
  private async getSessionBestLap(targetLapId: number): Promise<LapData | null> {
    const targetLap = await this.prisma.laps.findUnique({
      where: { id: targetLapId },
      select: { session_id: true }
    })

    if (!targetLap) return null

    const sessionBestLap = await this.prisma.laps.findFirst({
      where: {
        session_id: targetLap.session_id,
        is_valid: true
      },
      orderBy: {
        lap_time: 'asc'
      },
      include: {
        telemetry_logs: {
          select: {
            id: true,
            lap_progress: true,
            timestamp: true,
            session_elapsed: true,
            speed: true,
            throttle: true,
            brake: true,
            rpm: true,
            gear: true
          },
          orderBy: {
            lap_progress: 'asc'
          }
        }
      }
    })

    if (!sessionBestLap || !sessionBestLap.lap_time) {
      return null
    }

    return {
      lap_id: sessionBestLap.id,
      lap_time: sessionBestLap.lap_time,
      telemetry_points: sessionBestLap.telemetry_logs.map(log => ({
        id: log.id.toString(),
        lap_progress: log.lap_progress || 0,
        timestamp: log.timestamp,
        session_elapsed: log.session_elapsed || 0,
        speed: log.speed || 0,
        throttle: log.throttle || 0,
        brake: log.brake || 0,
        rpm: log.rpm || 0,
        gear: log.gear || 0
      }))
    }
  }

  /**
   * Interpolate telemetry point at a specific lap progress
   */
  private interpolateTelemetryPoint(
    telemetryPoints: TelemetryPoint[],
    targetProgress: number
  ): TelemetryPoint | null {
    if (telemetryPoints.length === 0) return null

    // Find the closest points before and after the target progress
    let beforePoint: TelemetryPoint | null = null
    let afterPoint: TelemetryPoint | null = null

    for (let i = 0; i < telemetryPoints.length; i++) {
      const point = telemetryPoints[i]
      
      if (point.lap_progress <= targetProgress) {
        beforePoint = point
      }
      
      if (point.lap_progress >= targetProgress && !afterPoint) {
        afterPoint = point
        break
      }
    }

    // If we have exact match, return it
    if (beforePoint && beforePoint.lap_progress === targetProgress) {
      return beforePoint
    }

    // If we have both before and after points, interpolate
    if (beforePoint && afterPoint && beforePoint.lap_progress !== afterPoint.lap_progress) {
      const ratio = (targetProgress - beforePoint.lap_progress) / 
                   (afterPoint.lap_progress - beforePoint.lap_progress)
      
      return {
        id: beforePoint.id,
        lap_progress: targetProgress,
        timestamp: new Date(beforePoint.timestamp.getTime() + 
                          (afterPoint.timestamp.getTime() - beforePoint.timestamp.getTime()) * ratio),
        session_elapsed: beforePoint.session_elapsed + 
                        (afterPoint.session_elapsed - beforePoint.session_elapsed) * ratio,
        speed: beforePoint.speed + (afterPoint.speed - beforePoint.speed) * ratio,
        throttle: beforePoint.throttle + (afterPoint.throttle - beforePoint.throttle) * ratio,
        brake: beforePoint.brake + (afterPoint.brake - beforePoint.brake) * ratio,
        rpm: beforePoint.rpm + (afterPoint.rpm - beforePoint.rpm) * ratio,
        gear: Math.round(beforePoint.gear + (afterPoint.gear - beforePoint.gear) * ratio)
      }
    }

    // Return the closest point if we can't interpolate
    return beforePoint || afterPoint
  }

  /**
   * Calculate delta time between two telemetry points
   */
  private calculateDeltaAtPoint(
    targetPoint: TelemetryPoint,
    referencePoint: TelemetryPoint
  ): number {
    // Delta is the difference in session elapsed time at the same lap progress
    return targetPoint.session_elapsed - referencePoint.session_elapsed
  }

  /**
   * Calculate deltas for multiple laps in a session
   */
  async calculateSessionDeltas(sessionId: number): Promise<void> {
    const laps = await this.prisma.laps.findMany({
      where: { session_id: sessionId },
      select: { id: true }
    })

    for (const lap of laps) {
      const deltaResults = await this.calculateLapDeltas(lap.id)
      
      // Update telemetry_logs with calculated deltas
      for (const [telemetryId, delta] of deltaResults) {
        await this.prisma.telemetry_logs.update({
          where: { id: BigInt(telemetryId) },
          data: {
            delta_to_best_time: delta.delta_to_best_time,
            delta_to_session_best_time: delta.delta_to_session_best_time,
            reference_lap_id: delta.reference_lap_id
          }
        })
      }
    }
  }
}