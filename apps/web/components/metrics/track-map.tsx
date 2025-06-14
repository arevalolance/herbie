'use client'
import { useEffect, useRef } from "react"

/**
 * A single recorded driving line for one lap.
 * Each entry in `points` should be a tuple or object containing world X/Y
 * coordinates (usually metres) sampled along the lap.
 */
export interface LapPoint {
  x: number
  y: number
  // Arbitrary extra data (speed, throttle, etc.)
  meta?: Record<string, unknown>
}

export interface LapLine {
  /** Unique identifier – helpful for React key & highlighting */
  id: number | string
  /** Ordered list of sampled points */
  points: LapPoint[]
  /** Stroke colour for this lap (fallback palette used if omitted) */
  color?: string
  /** Emphasise this lap with thicker stroke */
  highlight?: boolean
  /**
   * Whether this lap should respond to hover interactions.
   * Defaults to true. Set to false for background/reference lines that
   * should not trigger hover markers or callbacks.
   */
  interactive?: boolean
}

/**
 * TrackMap – visualises one or more racing lines on top of each other.
 *
 * The component is intentionally agnostic about how coordinates are produced –
 * feed it whatever telemetry you have and it will scale / centre everything so
 * it fits nicely inside the available space.
 */
export function TrackMap({
  laps,
  className,
  strokeWidth = 1.5,
  padding = 20,
  hoverRadius = 10,
  showHoverMarker = true,
  trackPath,
  trackColor = "#666",
  trackWidthMultiplier = 6,
  onHover,
}: {
  /** Racing lines to display */
  laps: LapLine[]
  /** Optional additional Tailwind / CSS classes for the wrapper */
  className?: string
  /** Base line width (in CSS pixels). Highlighted laps will be 2× this. */
  strokeWidth?: number
  /** Inner padding (CSS pixels) around the drawing inside the canvas */
  padding?: number
  /** Pixel radius within which hover counts as selecting the line */
  hoverRadius?: number
  /** Draw a small circle marker at hovered point */
  showHoverMarker?: boolean
  trackPath?: LapPoint[]
  trackColor?: string
  /** Multiplier applied to strokeWidth when drawing the reference track */
  trackWidthMultiplier?: number
  /** Callback fired when hovering over a point (or null when not) */
  onHover?: (info: { lapId: LapLine["id"]; index: number; point: LapPoint; canvas: { x: number; y: number } } | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const miniMapRef = useRef<HTMLCanvasElement | null>(null)
  const viewRef = useRef<{ zoom: number; panX: number; panY: number }>({
    zoom: 1,
    panX: 0,
    panY: 0,
  })

  // Store last computed transform + canvas points for quick lookup
  const pointsRef = useRef<{
    // For each lap, array of canvas-space points (x,y)
    canvasPts: Array<Array<{ x: number; y: number }>>
    // Functions to convert; needed for marker rendering without full redraw
    toCanvas?: (p: { x: number; y: number }) => { x: number; y: number }
    scale?: number
    offsetX?: number
    offsetY?: number
    worldBounds: { minX: number; maxX: number; minY: number; maxY: number }
  }>({ canvasPts: [], worldBounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } })

  // Helper to actually draw the scene (lines + optional marker)
  const drawScene = (
    marker?: { x: number; y: number },
    meta?: Record<string, unknown>
  ) => {
    const canvas = canvasRef.current
    if (!canvas || !laps.length) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { width: cssW, height: cssH } = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    ctx.scale(dpr, dpr)

    // Flatten points
    const allPoints: { x: number; y: number }[] = []
    laps.forEach((lap) => allPoints.push(...lap.points))
    if (trackPath) {
      allPoints.push(...trackPath)
    }
    if (!allPoints.length) return

    const xs = allPoints.map((p) => p.x)
    const ys = allPoints.map((p) => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)

    const worldW = maxX - minX || 1
    const worldH = maxY - minY || 1

    const drawW = cssW - padding * 2
    const drawH = cssH - padding * 2
    const scale = Math.min(drawW / worldW, drawH / worldH)

    const offsetX = (cssW - worldW * scale) / 2 - minX * scale
    const offsetY = (cssH - worldH * scale) / 2 + maxY * scale

    const toCanvas = (p: { x: number; y: number }) => ({
      x: (p.x * scale + offsetX) * viewRef.current.zoom + viewRef.current.panX,
      y: (-p.y * scale + offsetY) * viewRef.current.zoom + viewRef.current.panY,
    })

    ctx.clearRect(0, 0, cssW, cssH)

    // Draw reference track path first so racing line sits on top
    if (trackPath && trackPath.length > 1) {
      const tPts = trackPath.map(toCanvas)
      ctx.beginPath()
      ctx.moveTo(tPts[0]!.x, tPts[0]!.y)
      for (let i = 1; i < tPts.length; i++) {
        const { x, y } = tPts[i]!
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = trackColor
      ctx.lineWidth = strokeWidth * trackWidthMultiplier
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.stroke()
    }

    let colorIdx = 1
    const paletteFallback = [
      "var(--chart-1)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
    ]

    // collect canvas points for hover lookup
    const allCanvasPts: Array<Array<{ x: number; y: number }>> = []

    laps.forEach((lap) => {
      const pts = lap.points
      if (pts.length < 2) return

      const canvasPts: Array<{ x: number; y: number }> = pts.map(toCanvas)
      allCanvasPts.push(canvasPts)

      ctx.beginPath()
      ctx.moveTo(canvasPts[0]!.x, canvasPts[0]!.y)
      for (let i = 1; i < canvasPts.length; i++) {
        const { x, y } = canvasPts[i]!
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = (
        lap.color || paletteFallback[colorIdx++ % paletteFallback.length]
      ) as string
      ctx.lineWidth = lap.highlight ? strokeWidth * 2 : strokeWidth
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.stroke()
    })

    // Save transform + canvas points
    pointsRef.current = {
      canvasPts: allCanvasPts,
      toCanvas,
      scale,
      offsetX,
      offsetY,
      worldBounds: { minX, maxX, minY, maxY },
    }

    // Draw marker & tooltip if provided
    if (marker && showHoverMarker) {
      // marker circle
      ctx.fillStyle = "#ffffff"
      ctx.strokeStyle = "#000000"
      ctx.lineWidth = 1
      const r = 4
      ctx.beginPath()
      ctx.arc(marker.x, marker.y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      if (meta) {
        const lines = Object.entries(meta).map(
          ([k, v]) => `${k}: ${typeof v === "number" ? v.toFixed(1) : v}`
        )

        ctx.font = "10px sans-serif"
        const textW = Math.max(...lines.map((l) => ctx.measureText(l).width))
        const lineH = 12
        const boxW = textW + 8
        const boxH = lineH * lines.length + 4
        const boxX = marker.x + 8
        const boxY = marker.y - boxH - 8

        // background
        ctx.fillStyle = "rgba(0,0,0,0.7)"
        ctx.fillRect(boxX, boxY, boxW, boxH)

        // text
        ctx.fillStyle = "#ffffff"
        lines.forEach((l, idx) => {
          ctx.fillText(l, boxX + 4, boxY + lineH * (idx + 1) - 2)
        })
      }
    }

    // --------------------------------------------------------------
    //  Draw minimap (simple overview with viewport rectangle)
    // --------------------------------------------------------------
    const mini = miniMapRef.current
    if (mini) {
      const mctx = mini.getContext("2d")
      if (mctx) {
        const { width: mCssW, height: mCssH } = mini.getBoundingClientRect()
        const dpr2 = window.devicePixelRatio || 1
        mini.width = Math.round(mCssW * dpr2)
        mini.height = Math.round(mCssH * dpr2)
        mctx.scale(dpr2, dpr2)

        // fit entire track
        const mPadding = 4
        const mWorldW = worldW || 1
        const mWorldH = worldH || 1
        const mScale = Math.min(
          (mCssW - mPadding * 2) / mWorldW,
          (mCssH - mPadding * 2) / mWorldH
        )
        const mOffsetX = (mCssW - mWorldW * mScale) / 2 - minX * mScale
        const mOffsetY = (mCssH - mWorldH * mScale) / 2 + maxY * mScale

        const mToCanvas = (pt: { x: number; y: number }) => ({
          x: pt.x * mScale + mOffsetX,
          y: -pt.y * mScale + mOffsetY,
        })

        // clear
        mctx.clearRect(0, 0, mCssW, mCssH)

        // draw track path
        if (trackPath && trackPath.length > 1) {
          const tPts = trackPath.map(mToCanvas)
          mctx.beginPath()
          mctx.moveTo(tPts[0]!.x, tPts[0]!.y)
          for (let i = 1; i < tPts.length; i++) {
            const { x, y } = tPts[i]!
            mctx.lineTo(x, y)
          }
          mctx.strokeStyle = trackColor
          mctx.lineWidth = 2
          mctx.lineCap = "round"
          mctx.lineJoin = "round"
          mctx.stroke()
        }

        // viewport rectangle
        const v = viewRef.current
        const topLeftWorld = {
          x: ((0 - v.panX) / v.zoom - offsetX) / scale,
          y: -(((0 - v.panY) / v.zoom - offsetY) / scale),
        }
        const bottomRightWorld = {
          x: (((cssW) - v.panX) / v.zoom - offsetX) / scale,
          y: -(((cssH) - v.panY) / v.zoom - offsetY) / scale,
        }

        const tl = mToCanvas(topLeftWorld)
        const br = mToCanvas(bottomRightWorld)
        mctx.strokeStyle = "#fff"
        mctx.lineWidth = 1
        mctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y)
      }
    }
  }

  // initial draw & redraw when laps change
  useEffect(() => {
    drawScene()
  }, [laps, strokeWidth, padding, trackPath, trackWidthMultiplier])

  // ------------------------------------------------------------------------
  //  Resize observer – make the canvas responsive to its container
  // ------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resizeObserver = new ResizeObserver(() => drawScene())
    resizeObserver.observe(canvas)
    return () => resizeObserver.disconnect()
  }, [])

  // ------------------------------------------------------------------------
  //  Hover detection
  // ------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function handleMove(ev: MouseEvent) {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = ev.clientX - rect.left
      const y = ev.clientY - rect.top

      // search nearest point
      type HoverHit = { lapIdx: number; ptIdx: number; pt: { x: number; y: number } }
      const { canvasPts } = pointsRef.current
      let bestDist = Infinity
      let best: HoverHit | null = null
      canvasPts.forEach((arr, li) => {
        // Skip laps that are flagged as non-interactive
        if (laps[li] && laps[li]!.interactive === false) return
        for (let pi = 0; pi < arr.length; pi++) {
          const p = arr[pi]!
          const dx = p.x - x
          const dy = p.y - y
          const dist = Math.hypot(dx, dy)
          if (dist < bestDist) {
            bestDist = dist
            best = { lapIdx: li, ptIdx: pi, pt: p }
          }
        }
      })

      if (best && bestDist <= hoverRadius) {
        const b = best as HoverHit // non-null assertion
        // redraw with marker at hovered location
        drawScene(b.pt, (laps[b.lapIdx]?.points[b.ptIdx] as LapPoint)?.meta)
        if (onHover) {
          const lap = laps[b.lapIdx]!
          const worldPt = lap.points[b.ptIdx]!
          onHover({ lapId: lap.id, index: b.ptIdx, point: worldPt, canvas: b.pt })
        }
      } else {
        drawScene() // no marker
        if (onHover) onHover(null)
      }
    }

    function handleLeave() {
      drawScene()
      if (onHover) onHover(null)
    }

    const canvasEl = canvas // assured non-null
    canvasEl.addEventListener("mousemove", handleMove)
    canvasEl.addEventListener("mouseleave", handleLeave)
    return () => {
      canvasEl.removeEventListener("mousemove", handleMove)
      canvasEl.removeEventListener("mouseleave", handleLeave)
    }
  }, [laps, hoverRadius, showHoverMarker, onHover])

  // ------------------------------------------------------------------------
  //  Zoom / pan controls (wheel + drag + buttons)
  // ------------------------------------------------------------------------
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Wheel zoom
    function handleWheel(ev: WheelEvent) {
      if (!canvas) return
      ev.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const cx = ev.clientX - rect.left
      const cy = ev.clientY - rect.top

      const view = viewRef.current
      const factor = ev.deltaY < 0 ? 1.1 : 0.9
      const newZoom = Math.max(0.2, Math.min(view.zoom * factor, 10))

      // adjust pan so cursor stays in same world position
      view.panX = cx - ((cx - view.panX) * (newZoom / view.zoom))
      view.panY = cy - ((cy - view.panY) * (newZoom / view.zoom))
      view.zoom = newZoom

      drawScene()
    }

    // Drag pan
    let dragging = false
    let lastX = 0
    let lastY = 0
    function handleDown(ev: MouseEvent) {
      if (ev.button !== 0) return
      dragging = true
      lastX = ev.clientX
      lastY = ev.clientY
    }
    function handleMove(ev: MouseEvent) {
      if (!dragging) return
      const dx = ev.clientX - lastX
      const dy = ev.clientY - lastY
      lastX = ev.clientX
      lastY = ev.clientY
      const view = viewRef.current
      view.panX += dx
      view.panY += dy
      drawScene()
    }
    function handleUp() {
      dragging = false
    }

    canvas.addEventListener("wheel", handleWheel, { passive: false })
    canvas.addEventListener("mousedown", handleDown)
    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)

    return () => {
      canvas.removeEventListener("wheel", handleWheel)
      canvas.removeEventListener("mousedown", handleDown)
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)
    }
  }, [])

  // helper to change zoom from buttons
  const changeZoom = (mult: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2
    const view = viewRef.current
    const newZoom = Math.max(0.2, Math.min(view.zoom * mult, 10))
    view.panX = cx - ((cx - view.panX) * (newZoom / view.zoom))
    view.panY = cy - ((cy - view.panY) * (newZoom / view.zoom))
    view.zoom = newZoom
    drawScene()
  }

  return (
    <div className={className ?? "w-full h-full relative select-none"}>
      {/* Main drawing canvas */}
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Zoom controls */}
      <div className="absolute top-2 left-2 flex flex-col bg-gray-800/70 rounded text-white">
        <button
          className="px-2 py-1 hover:bg-gray-700"
          onClick={() => changeZoom(1.25)}
        >
          +
        </button>
        <button
          className="px-2 py-1 hover:bg-gray-700 border-t border-gray-700"
          onClick={() => changeZoom(0.8)}
        >
          −
        </button>
      </div>

      {/* Mini-map overview */}
      <canvas
        ref={miniMapRef}
        className="absolute bottom-2 left-2 w-28 h-28 rounded bg-gray-800/70"
      />
    </div>
  )
} 