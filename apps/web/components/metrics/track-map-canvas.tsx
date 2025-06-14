"use client";

import { useRef, useEffect, useState } from "react";

// Minimal shape of telemetry log required for plotting
interface TelemetryPoint {
  position_x: number | null;
  position_y: number | null; // elevation - might be useful for debugging
  position_z: number | null;
  speed?: number | null; // optional – could be used for colour-coding later
}

interface TrackMapCanvasProps {
  logs: TelemetryPoint[];
  /** Canvas CSS width in px (device pixels automatically handled) */
  width?: number;
  /** Canvas CSS height in px (device pixels automatically handled) */
  height?: number;
  /** Stroke colour for the racing line */
  strokeStyle?: string;
}

/**
 * Draws the racing line for a lap on an HTML canvas as a bird's eye view track map.
 *
 * Usage example:
 * <TrackMapCanvas logs={lap.telemetry_logs} width={400} height={400} />
 */
export default function TrackMapCanvas({
  logs,
  width = 400,
  height = 400,
  strokeStyle = "#00adee",
}: TrackMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<{ x: number; y: number; info: TelemetryPoint }[]>([]);

  interface TooltipStateBase {
    visible: boolean;
  }

  interface TooltipVisible extends TooltipStateBase {
    visible: true;
    tooltipX: number;
    tooltipY: number;
    dotX: number;
    dotY: number;
    info: TelemetryPoint;
  }

  type TooltipState = { visible: false } | TooltipVisible;

  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Filter logs that have valid positions
    const validLogs = logs.filter(
      (l) => l.position_x != null && l.position_z != null
    );

    // Extract valid points (skip nulls) - using X,Z for bird's eye view
    const points = validLogs.map((l) => ({
      x: l.position_x as number,
      z: l.position_z as number,
    }));

    if (points.length === 0) return;

    // Reset hover reference array
    pointsRef.current = [];

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle HiDPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear with a dark background like a track map
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, width, height);

    // ---------------------------------------------------------------------------------
    // DEBUG: Log data ranges
    // ---------------------------------------------------------------------------------
    const xValues = points.map(p => p.x);
    const zValues = points.map(p => p.z);
    const xRange = Math.max(...xValues) - Math.min(...xValues);
    const zRange = Math.max(...zValues) - Math.min(...zValues);
    
    console.log('Track data debug:', {
      pointCount: points.length,
      xRange: xRange.toFixed(2),
      zRange: zRange.toFixed(2),
      aspectRatio: (xRange / zRange).toFixed(3)
    });

    // ---------------------------------------------------------------------------------
    // Calculate bounds and scaling for bird's eye view
    // ---------------------------------------------------------------------------------
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minZ = Math.min(...zValues);
    const maxZ = Math.max(...zValues);

    const trackWidth = maxX - minX || 1;
    const trackHeight = maxZ - minZ || 1;

    // Add padding on each side (fraction of canvas size)
    const padding = 0.1; // 10% padding on each side

    // Independent scaling so the track fully utilises the canvas in both axes.
    //  This prevents the map appearing "squashed" when one dimension of the
    //  track is much larger than the other.
    const scaleX = (width * (1 - padding * 2)) / trackWidth;
    const scaleY = (height * (1 - padding * 2)) / trackHeight;

    const offsetX = (width - trackWidth * scaleX) / 2;
    const offsetY = (height - trackHeight * scaleY) / 2;

    // Helper to convert world coordinates (X/Z) → canvas coordinates (x/y)
    // Note: we invert the Y-axis so positive Z in the game points upwards on
    // the canvas (traditional "north-up" map orientation).
    const worldToCanvas = (worldX: number, worldZ: number) => ({
      x: offsetX + (worldX - minX) * scaleX,
      y: height - (offsetY + (worldZ - minZ) * scaleY),
    });

    // ---------------------------------------------------------------------------------
    // Draw grid lines for reference (optional)
    // ---------------------------------------------------------------------------------
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    
    // Vertical grid lines
    const gridSpacing = Math.max(trackWidth / 10, 50); // 50m minimum spacing
    for (let x = Math.ceil(minX / gridSpacing) * gridSpacing; x <= maxX; x += gridSpacing) {
      const start = worldToCanvas(x, minZ);
      const end = worldToCanvas(x, maxZ);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    
    // Horizontal grid lines
    for (let z = Math.ceil(minZ / gridSpacing) * gridSpacing; z <= maxZ; z += gridSpacing) {
      const start = worldToCanvas(minX, z);
      const end = worldToCanvas(maxX, z);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    ctx.setLineDash([]); // Reset line dash

    // ---------------------------------------------------------------------------------
    // Draw the racing line
    // ---------------------------------------------------------------------------------
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = strokeStyle;
    ctx.shadowColor = strokeStyle;
    ctx.shadowBlur = 2;

    // Smooth the path using quadratic curves to reduce jitter / zig-zags
    ctx.beginPath();

    // Guard: If we have fewer than 2 points just draw a dot
    if (points.length === 1) {
      const solo = worldToCanvas(points[0]!.x, points[0]!.z);
      ctx.lineTo(solo.x, solo.y);
      pointsRef.current.push({ x: solo.x, y: solo.y, info: validLogs[0]! });
      ctx.stroke();
    } else {
      const first = worldToCanvas(points[0]!.x, points[0]!.z);
      ctx.moveTo(first.x, first.y);
      pointsRef.current.push({ x: first.x, y: first.y, info: validLogs[0]! });

      for (let i = 1; i < points.length - 1; i++) {
        const currentRaw = points[i]!;
        const nextRaw = points[i + 1]!;
        const current = worldToCanvas(currentRaw.x, currentRaw.z);
        const next = worldToCanvas(nextRaw.x, nextRaw.z);

        pointsRef.current.push({ x: current.x, y: current.y, info: validLogs[i]! });

        // Mid-point between current and next as the end point, current is control point
        const midX = (current.x + next.x) / 2;
        const midY = (current.y + next.y) / 2;

        ctx.quadraticCurveTo(current.x, current.y, midX, midY);
      }

      // Draw final segment straight to last point
      const lastRaw = points[points.length - 1]!;
      const last = worldToCanvas(lastRaw.x, lastRaw.z);
      ctx.lineTo(last.x, last.y);
      pointsRef.current.push({ x: last.x, y: last.y, info: validLogs[validLogs.length - 1]! });
    }

    ctx.stroke();

    // Reset shadow
    ctx.shadowBlur = 0;

    // ---------------------------------------------------------------------------------
    // Draw start/finish line indicator
    // ---------------------------------------------------------------------------------
    if (points.length > 0) {
      const startPoint = worldToCanvas(points?.[0]?.x ?? 0, points?.[0]?.z ?? 0);
      
      // Draw start marker
      ctx.fillStyle = "#00ff00";
      ctx.beginPath();
      ctx.arc(startPoint.x, startPoint.y, 4, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw "START" label
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px Arial";
      ctx.fillText("START", startPoint.x + 8, startPoint.y + 4);
    }

    // ---------------------------------------------------------------------------------
    // Draw track info
    // ---------------------------------------------------------------------------------
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px Arial";
    const trackLength = Math.sqrt(trackWidth*trackWidth + trackHeight*trackHeight).toFixed(0);
    ctx.fillText(`Track Length: ~${trackLength}m`, 10, height - 30);
    ctx.fillText(`Points: ${points.length}`, 10, height - 10);

  }, [logs, width, height, strokeStyle]);

  // -----------------------------------------------------------------------------
  // Mouse handlers for tooltip
  // -----------------------------------------------------------------------------
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const threshold = 6; // px
    let closest: { x: number; y: number; info: TelemetryPoint } | null = null;
    let minDist = Infinity;

    for (const pt of pointsRef.current) {
      const dx = pt.x - x;
      const dy = pt.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist < minDist) {
        minDist = dist;
        closest = pt;
      }
    }

    if (closest && minDist <= threshold) {
      setTooltip({
        visible: true,
        tooltipX: x + 12,
        tooltipY: y + 12,
        dotX: closest.x,
        dotY: closest.y,
        info: closest.info,
      });
    } else if (tooltip.visible) {
      setTooltip({ visible: false });
    }
  };

  const handleMouseLeave = () => {
    if (tooltip.visible) setTooltip({ visible: false });
  };

  return (
    <div className="relative select-none">
      <canvas
        ref={canvasRef}
        className="border border-gray-600 rounded"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      <div className="absolute top-2 left-2 text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded pointer-events-none">
        Bird's Eye View
      </div>

      {tooltip.visible && (
        <>
          {/* Tooltip box */}
          <div
            className="absolute text-xs bg-gray-800 bg-opacity-90 text-white px-2 py-1 rounded whitespace-nowrap pointer-events-none"
            style={{ left: tooltip.tooltipX, top: tooltip.tooltipY }}
          >
            {tooltip.info.speed != null
              ? `Speed: ${tooltip.info.speed.toFixed(0)} km/h`
              : `x: ${tooltip.info.position_x?.toFixed(1)}, z: ${tooltip.info.position_z?.toFixed(1)}`}
          </div>

          {/* Dot marker */}
          <div
            className="absolute w-2 h-2 rounded-full bg-white pointer-events-none"
            style={{
              left: tooltip.dotX - 4,
              top: tooltip.dotY - 4,
            }}
          />
        </>
      )}
    </div>
  );
} 