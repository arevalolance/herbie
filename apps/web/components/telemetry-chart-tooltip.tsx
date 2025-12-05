'use client'

import React from 'react'
import { ChartTooltipContent } from "@workspace/ui/components/chart"
import { formatDeltaWithColor } from '@/lib/delta-formatter'

interface TelemetryChartTooltipProps {
  active?: boolean
  payload?: Array<{
    value: number
    dataKey: string
    color: string
    payload: {
      date: string
      events: number
      delta_to_best?: number
      delta_to_session_best?: number
    }
  }>
  label?: string
  title?: string
}

export function TelemetryChartTooltip({ 
  active, 
  payload, 
  label,
  title 
}: TelemetryChartTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null
  }

  const data = payload[0]?.payload
  const value = payload[0]?.value
  
  // Format lap progress
  const formatLabel = (value: string) => {
    const num = parseFloat(value)
    if (!Number.isNaN(num)) {
      return `${Math.round(num * 100)}% lap`
    }
    return new Date(value).toLocaleString()
  }

  // Format the main value based on metric type
  const formatValue = (value: number, title?: string) => {
    if (!title) return value.toFixed(1)
    
    switch (title.toLowerCase()) {
      case 'speed':
        return `${value.toFixed(1)} km/h`
      case 'throttle':
      case 'brake':
      case 'steering':
        return `${value.toFixed(1)}%`
      case 'ride height':
        return `${value.toFixed(1)} mm`
      case 'tire temperature':
        return `${value.toFixed(1)} °C`
      case 'tire pressure':
        return `${value.toFixed(1)} kPa`
      case 'fuel':
        return `${value.toFixed(2)} L`
      case 'ers / battery':
        return `${value.toFixed(1)}%`
      case 'rpm':
        return `${Math.round(value)} RPM`
      case 'gear':
        return `${Math.round(value)}`
      case 'delta to personal best':
      case 'delta to session best':
        const { text, className } = formatDeltaWithColor(value)
        return <span className={className}>{text}</span>
      default:
        return value.toFixed(1)
    }
  }

  // Check if delta data is available for this point
  const hasDeltaData = data?.delta_to_best !== undefined || data?.delta_to_session_best !== undefined

  return (
    <div className="rounded-lg border bg-background p-2 shadow-md">
      <div className="grid grid-cols-1 gap-1">
        {/* Progress label */}
        <div className="font-medium text-sm">
          {formatLabel(label || '')}
        </div>
        
        {/* Main metric value */}
        <div className="flex items-center gap-2">
          <div 
            className="h-2 w-2 rounded-full" 
            style={{ backgroundColor: payload[0]?.color }} 
          />
          <span className="text-sm font-mono">
            {title}: {formatValue(value || 0, title)}
          </span>
        </div>

        {/* Delta information if available */}
        {hasDeltaData && (
          <div className="mt-1 pt-1 border-t border-border/50">
            {data?.delta_to_best !== undefined && data?.delta_to_best !== null && (
              <div className="text-xs font-mono">
                <span className="text-muted-foreground">vs PB: </span>
                <span className={formatDeltaWithColor(data.delta_to_best).className}>
                  {formatDeltaWithColor(data.delta_to_best).text}
                </span>
              </div>
            )}
            {data?.delta_to_session_best !== undefined && data?.delta_to_session_best !== null && (
              <div className="text-xs font-mono">
                <span className="text-muted-foreground">vs Session: </span>
                <span className={formatDeltaWithColor(data.delta_to_session_best).className}>
                  {formatDeltaWithColor(data.delta_to_session_best).text}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}