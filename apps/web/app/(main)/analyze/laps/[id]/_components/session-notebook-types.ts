export type SetupSnapshot = {
  springs?: {
    front?: number | null
    rear?: number | null
  }
  aero?: {
    front?: number | null
    rear?: number | null
  }
  brakeBias?: number | null
  tirePressures?: {
    fl?: number | null
    fr?: number | null
    rl?: number | null
    rr?: number | null
  }
  tireTemps?: {
    fl?: number | null
    fr?: number | null
    rl?: number | null
    rr?: number | null
  }
  note?: string | null
  tags?: string[]
}

export type SessionNote = {
  id: number
  sessionId: number
  createdAt: string | null
  note: string | null
  tags: string[]
  springs?: SetupSnapshot["springs"]
  aero?: SetupSnapshot["aero"]
  brakeBias?: number | null
  tirePressures?: SetupSnapshot["tirePressures"]
  tireTemps?: SetupSnapshot["tireTemps"]
}

export type LapTimelineEntry = {
  id: number
  lapNumber: number
  lapTime: number | null
  deltaToSessionBest: number | null
  lapStartTime: string
}
