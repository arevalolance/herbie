'use client'
import React, { useMemo, useState, useCallback } from "react";
import { ZoomableChart } from "@/components/metrics/chart";
import { Prisma } from "@/generated/prisma";
import { Button } from "@workspace/ui/components/button";
import { TrackMap, LapLine, LapPoint } from "@/components/metrics/track-map";

// Memoized individual chart component to prevent unnecessary re-renders
const MemoizedChart = React.memo(({
	data,
	title,
	syncId
}: {
	data: { date: string; events: number }[];
	title: string;
	syncId: string;
}) => (
	<div className="max-h-[150px]">
		<ZoomableChart
			data={data}
			title={title}
			syncId={syncId}
		/>
	</div>
));

MemoizedChart.displayName = 'MemoizedChart';

// -----------------------------------------------------------------------------
//  Sector filter bar
// -----------------------------------------------------------------------------

interface SectorFilterBarProps {
	sectorTimes: (number | null)[];
	lapTime: number;
	activeSectors: number[];
	toggleSector: (sector: number) => void;
}

const SectorFilterBar: React.FC<SectorFilterBarProps> = ({
	sectorTimes,
	lapTime,
	activeSectors,
	toggleSector,
}) => {
	return (
		<div className="flex z-10 select-none w-full">
			{sectorTimes.map((time, idx) => {
				const flexGrow = time && lapTime ? time / lapTime : 1 / sectorTimes.length;
				const isActive = activeSectors.includes(idx);

				return (
					<Button
						key={idx}
						onClick={() => toggleSector(idx)}
						style={{ flexGrow }}
						className={`!rounded-none flex items-center justify-center text-xs font-semibold uppercase tracking-wide min-w-0 flex-shrink-0`}
						variant={isActive ? "default" : "secondary"}
						size="sm"
					>
						S{idx + 1}
					</Button>
				);
			})}
		</div>
	);
};

// ---------------------------------------------------------------------------
//  Helper – Ramer–Douglas–Peucker polyline simplification
// ---------------------------------------------------------------------------

function simplifyPath(points: LapPoint[], tolerance = 1): LapPoint[] {
	if (points.length <= 2) return points

	const sqTolerance = tolerance * tolerance

	const sqSegDist = (p: LapPoint, a: LapPoint, b: LapPoint) => {
		let x = a.x
		let y = a.y
		let dx = b.x - x
		let dy = b.y - y

		if (dx !== 0 || dy !== 0) {
			const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy)
			if (t > 1) {
				x = b.x
				y = b.y
			} else if (t > 0) {
				x += dx * t
				y += dy * t
			}
		}

		dx = p.x - x
		dy = p.y - y
		return dx * dx + dy * dy
	}

	const out: LapPoint[] = []

	const simplifySection = (first: number, last: number) => {
		let maxSqDist = 0
		let index = -1
		for (let i = first + 1; i < last; i++) {
			const sqDistCurr = sqSegDist(points[i]!, points[first]!, points[last]!)
			if (sqDistCurr > maxSqDist) {
				index = i
				maxSqDist = sqDistCurr
			}
		}

		if (maxSqDist > sqTolerance && index !== -1) {
			simplifySection(first, index)
			out.push(points[index]!)
			simplifySection(index, last)
		}
	}

	out.push(points[0]!)
	simplifySection(0, points.length - 1)
	out.push(points[points.length - 1]!)

	return out
}

// Helper: moving average smoothing for polyline points
function smoothPolyline(points: LapPoint[], windowSize: number = 5): LapPoint[] {
	if (points.length <= windowSize) return points
	const smoothed: LapPoint[] = []
	const half = Math.floor(windowSize / 2)
	for (let i = 0; i < points.length; i++) {
		let sumX = 0, sumY = 0, count = 0
		for (let j = i - half; j <= i + half; j++) {
			if (j >= 0 && j < points.length) {
				sumX += points[j]!.x
				sumY += points[j]!.y
				count++
			}
		}
		smoothed.push({ x: sumX / count, y: sumY / count })
	}
	return smoothed
}

// Helper: Catmull-Rom spline interpolation for smooth curves
function interpolateSpline(points: LapPoint[], density: number = 3): LapPoint[] {
	if (points.length < 4) return points

	const interpolated: LapPoint[] = []

	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[Math.max(0, i - 1)]!
		const p1 = points[i]!
		const p2 = points[i + 1]!
		const p3 = points[Math.min(points.length - 1, i + 2)]!

		// Add the current point
		interpolated.push(p1)

		// Add interpolated points between p1 and p2
		for (let t = 1; t <= density; t++) {
			const u = t / (density + 1)
			const u2 = u * u
			const u3 = u2 * u

			// Catmull-Rom formula
			const x = 0.5 * (
				(2 * p1.x) +
				(-p0.x + p2.x) * u +
				(2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 +
				(-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3
			)

			const y = 0.5 * (
				(2 * p1.y) +
				(-p0.y + p2.y) * u +
				(2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 +
				(-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3
			)

			interpolated.push({ x, y })
		}
	}

	// Add the last point
	interpolated.push(points[points.length - 1]!)
	return interpolated
}

// Helper: Detect straight sections and apply appropriate smoothing
function detectAndStraightenSections(points: LapPoint[]): LapPoint[] {
	if (points.length < 10) return points

	const straightened: LapPoint[] = []
	const windowSize = 15 // Points to analyze for straightness
	const straightnessThreshold = 0.95 // Correlation threshold for "straight"

	for (let i = 0; i < points.length; i++) {
		const start = Math.max(0, i - Math.floor(windowSize / 2))
		const end = Math.min(points.length - 1, i + Math.floor(windowSize / 2))
		const section = points.slice(start, end + 1)

		if (section.length < 5) {
			straightened.push(points[i]!)
			continue
		}

		// Calculate linear correlation (R²) to detect straightness
		const n = section.length
		const sumX = section.reduce((sum, p) => sum + p.x, 0)
		const sumY = section.reduce((sum, p) => sum + p.y, 0)
		const sumXY = section.reduce((sum, p, idx) => sum + p.x * p.y, 0)
		const sumX2 = section.reduce((sum, p) => sum + p.x * p.x, 0)
		const sumY2 = section.reduce((sum, p) => sum + p.y * p.y, 0)

		const correlation = Math.abs(
			(n * sumXY - sumX * sumY) /
			Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
		)

		if (correlation > straightnessThreshold && !isNaN(correlation)) {
			// This is a straight section - project point onto best-fit line
			const meanX = sumX / n
			const meanY = sumY / n

			// Calculate line slope
			const numerator = section.reduce((sum, p) => sum + (p.x - meanX) * (p.y - meanY), 0)
			const denominator = section.reduce((sum, p) => sum + (p.x - meanX) * (p.x - meanX), 0)

			if (Math.abs(denominator) > 0.001) {
				const slope = numerator / denominator
				const intercept = meanY - slope * meanX

				// Project current point onto the straight line
				const curr = points[i]!
				const projectedY = slope * curr.x + intercept
				straightened.push({ x: curr.x, y: projectedY })
			} else {
				// Vertical line case - keep X, average Y
				straightened.push({ x: meanX, y: points[i]!.y })
			}
		} else {
			// Curved section - keep original point
			straightened.push(points[i]!)
		}
	}

	return straightened
}

// Create a client component wrapper for the chart grid
export function ChartGrid({
	lap,
}: {
	lap: Prisma.lapsGetPayload<{
		include: {
			lap_summary: true;
			timing_data: true;
			sessions: { select: { track_name: true; sim_name: true } };
			telemetry_logs: {
				include: {
					vehicle_state: true;
					wheel_data: true;
					input_data: true;
					tyre_data: true;
					brake_data: true;
				};
			};
		};
	}>;
}) {
	// ---------------------------------------------------------------------------
	//  State & helpers
	// ---------------------------------------------------------------------------

	const [activeSectors, setActiveSectors] = useState<number[]>([0, 1, 2]);

	const toggleSector = useCallback((sector: number) => {
		setActiveSectors((prev) =>
			prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector].sort()
		);
	}, []);

	// Sector time information (fallback to timing_data if direct fields missing)
	const sectorTimes: (number | null)[] = [
		lap.sector1_time ?? lap.timing_data?.[0]?.sector1_time ?? null,
		lap.sector2_time ?? lap.timing_data?.[0]?.sector2_time ?? null,
		lap.sector3_time ?? lap.timing_data?.[0]?.sector3_time ?? null,
	];

	// Total lap time (fallback to sum of sector times if not available)
	const lapTime: number =
		lap.lap_time ?? sectorTimes.reduce<number>((sum, t) => sum + (t ?? 0), 0);

	// Calculate cumulative sector boundaries (fractions of lap)
	const sectorBoundaries = useMemo<[number, number, number, number]>(() => {
		if (
			lapTime > 0 &&
			sectorTimes.every((t): t is number => t != null)
		) {
			const s1Time = sectorTimes[0] ?? 0;
			const s2Time = sectorTimes[1] ?? 0;
			const s1F = s1Time / lapTime;
			const s2F = s2Time / lapTime;
			// Third sector fraction is remainder
			return [0, s1F, s1F + s2F, 1];
		}
		// fallback equal thirds
		return [0, 1 / 3, 2 / 3, 1];
	}, [lapTime, sectorTimes]);

	// Filter telemetry logs by active sectors
	const filteredLogs = useMemo(() => {
		if (activeSectors.length === 3) return lap.telemetry_logs;

		return lap.telemetry_logs.filter((log) => {
			const progress = typeof log.lap_progress === "number" ? log.lap_progress : Number(log.lap_progress);
			if (progress === undefined || progress === null || isNaN(progress)) return false;

			let idx = 2; // default sector 3
			if (progress < sectorBoundaries[1]) idx = 0;
			else if (progress < sectorBoundaries[2]) idx = 1;

			return activeSectors.includes(idx);
		});
	}, [lap.telemetry_logs, activeSectors, sectorBoundaries]);

	// Memoize a LapLine for TrackMap - focus on clear vehicle position visualization
	const lapLine: LapLine = useMemo(() => ({
		id: lap.id,
		points: lap.telemetry_logs
			.map((log, index) => {
				if (log.position_x == null || log.position_y == null) return null
				return {
					x: Number(log.position_x),
					y: Number(log.position_y),
					meta: {
						speed: log.speed ?? 0,
						throttle: log.throttle ?? 0,
						brake: log.brake ?? 0,
						gear: log.gear ?? 0,
						rpm: log.rpm ?? 0,
						steering: log.steering ?? 0,
						index: index,
						timestamp: log.timestamp,
						line_type: "vehicle_position",
					},
				} as LapPoint
			})
			.filter(Boolean) as LapPoint[],
		highlight: true,
		color: "#ef4444", // Red for main racing line
	}), [lap.id, lap.telemetry_logs])

	// Create a speed-colored version of the racing line to show variation
	const speedColoredLine: LapLine = useMemo(() => {
		const logs = lap.telemetry_logs;
		if (!logs.length) return { id: `${lap.id}-speed`, points: [], color: "#3b82f6", highlight: false };

		// Calculate speed range for color mapping
		const speeds = logs.map(log => log.speed ? Number(log.speed) : 0);
		const minSpeed = Math.min(...speeds);
		const maxSpeed = Math.max(...speeds);
		const speedRange = maxSpeed - minSpeed;

		const speedPoints: LapPoint[] = logs
			.map((log, index) => {
				if (log.position_x == null || log.position_y == null) return null;

				const speed = log.speed ? Number(log.speed) : 0;
				// Map speed to color intensity (0-1)
				const speedRatio = speedRange > 0 ? (speed - minSpeed) / speedRange : 0;

				return {
					x: Number(log.position_x),
					y: Number(log.position_y),
					meta: {
						speed: speed,
						speedRatio: speedRatio,
						steering: log.steering ?? 0,
						throttle: log.throttle ?? 0,
						brake: log.brake ?? 0,
						index: index,
					},
				} as LapPoint;
			})
			.filter(Boolean) as LapPoint[];

		return {
			id: `${lap.id}-speed`,
			points: speedPoints,
			color: "#3b82f6", // Blue for speed visualization
			highlight: false,
		};
	}, [lap.id, lap.telemetry_logs])

	// Simplified track center estimation - just a smoothed version of the racing line
	const estimatedCenterLine: LapLine = useMemo(() => {
		if (!lapLine.points.length) return { id: `${lap.id}-center`, points: [], color: "#666", highlight: false };

		// Create a smoothed centerline by averaging nearby points
		const smoothedPoints: LapPoint[] = [];
		const points = lapLine.points;
		const smoothingRadius = Math.max(1, Math.floor(points.length / 100)); // Smooth over ~1% of points

		for (let i = 0; i < points.length; i++) {
			const start = Math.max(0, i - smoothingRadius);
			const end = Math.min(points.length - 1, i + smoothingRadius);

			let sumX = 0, sumY = 0, count = 0;
			for (let j = start; j <= end; j++) {
				sumX += points[j]!.x;
				sumY += points[j]!.y;
				count++;
			}

			smoothedPoints.push({
				x: sumX / count,
				y: sumY / count,
			});
		}

		return {
			id: `${lap.id}-center`,
			points: simplifyPath(smoothedPoints, 2.0), // More aggressive smoothing
			color: "#666",
			highlight: false,
		};
	}, [lapLine.points, lap.id])

	// Memoize chart data to prevent recalculation on every render
	const chartData = useMemo(
		() => [
			{
				title: "Speed",
				data: filteredLogs.map((log) => ({
					date: (log.lap_progress ?? 0).toString(),
					events: Math.sqrt(
						Math.pow(log.velocity_longitudinal ?? 0, 2) +
						Math.pow(log.velocity_lateral ?? 0, 2) +
						Math.pow(log.velocity_vertical ?? 0, 2)
					) * 3.6, // Convert m/s to km/h
				})),
			},
			{
				title: "Throttle",
				data: filteredLogs.map((log) => ({
					date: (log.lap_progress ?? 0).toString(),
					events: (log.throttle ?? 0) * 100,
				})),
			},
			{
				title: "Brake",
				data: filteredLogs.map((log) => ({
					date: (log.lap_progress ?? 0).toString(),
					events: (log.brake ?? 0) * 100,
				})),
			},
			{
				title: "Gear",
				data: filteredLogs.map((log) => ({
					date: (log.lap_progress ?? 0).toString(),
					events: log.gear ?? 0,
				})),
			},
			{
				title: "RPM",
				data: filteredLogs.map((log) => ({
					date: (log.lap_progress ?? 0).toString(),
					events: log.rpm ?? 0,
				})),
			},
			{
				title: "Steering",
				data: filteredLogs.map((log) => ({
					date: (log.lap_progress ?? 0).toString(),
					events: (log.steering ?? 0) * 100,
				})),
			},
		],
		[filteredLogs]
	);

	// Simplified debug info focusing on what matters
	const debugInfo = useMemo(() => {
		const logs = lap.telemetry_logs;
		if (!logs.length) return null;

		// Calculate position variation
		const positions = logs.map(log => ({
			x: log.position_x ? Number(log.position_x) : null,
			y: log.position_y ? Number(log.position_y) : null,
		})).filter(p => p.x !== null && p.y !== null);

		const posXValues = positions.map(p => p.x!);
		const posYValues = positions.map(p => p.y!);

		// Calculate actual racing line characteristics
		const positionStats = {
			xRange: posXValues.length ? Math.max(...posXValues) - Math.min(...posXValues) : 0,
			yRange: posYValues.length ? Math.max(...posYValues) - Math.min(...posYValues) : 0,
			totalDistance: 0,
		};

		// Calculate total distance traveled
		for (let i = 1; i < positions.length; i++) {
			const dx = positions[i]!.x! - positions[i - 1]!.x!;
			const dy = positions[i]!.y! - positions[i - 1]!.y!;
			positionStats.totalDistance += Math.sqrt(dx * dx + dy * dy);
		}

		// Calculate speed and steering variation
		const speeds = logs.map(log => log.speed ? Number(log.speed) : 0);
		const steering = logs.map(log => log.steering ? Math.abs(Number(log.steering)) : 0);

		const speedStats = {
			min: Math.min(...speeds),
			max: Math.max(...speeds),
			range: Math.max(...speeds) - Math.min(...speeds),
		};

		const steeringStats = {
			max: Math.max(...steering),
			avg: steering.reduce((a, b) => a + b, 0) / steering.length,
		};

		return {
			totalPoints: logs.length,
			positionStats,
			speedStats,
			steeringStats,
		};
	}, [lap.telemetry_logs]);

	// NEW: Compute left/right track boundary (rails) lines in WORLD coordinates
	const worldRails: LapLine[] = useMemo(() => {
		const logs = lap.telemetry_logs
		if (!logs.length) return []

		// Get valid racing line points
		const racingPoints = logs
			.map((log, i) => ({
				x: log.position_x ? Number(log.position_x) : null,
				y: log.position_y ? Number(log.position_y) : null,
				trackEdge: log.track_edge ? Number(log.track_edge) : null,
				index: i
			}))
			.filter(p => p.x !== null && p.y !== null && p.trackEdge !== null) as Array<{
				x: number; y: number; trackEdge: number; index: number
			}>

		if (racingPoints.length < 3) return []

		// Calculate consistent track width using median to avoid outliers
		const trackEdgeValues = racingPoints.map(p => Math.abs(p.trackEdge)).sort((a, b) => a - b)
		const medianTrackWidth = trackEdgeValues[Math.floor(trackEdgeValues.length / 2)]!

		// Use a slightly smoothed version of the median for consistency
		const consistentHalfWidth = medianTrackWidth * 1.05 // Add 5% buffer for safety

		const leftPts: LapPoint[] = []
		const rightPts: LapPoint[] = []

		// Calculate normals from smoothed racing line tangents
		for (let i = 0; i < racingPoints.length; i++) {
			const curr = racingPoints[i]!

			// Get tangent vector using wider window for stability
			let tangentX = 0, tangentY = 0
			const lookAhead = Math.min(8, Math.floor(racingPoints.length / 15)) // Increased for more stability

			if (i < racingPoints.length - lookAhead) {
				const future = racingPoints[i + lookAhead]!
				tangentX = future.x - curr.x
				tangentY = future.y - curr.y
			} else if (i >= lookAhead) {
				const past = racingPoints[i - lookAhead]!
				tangentX = curr.x - past.x
				tangentY = curr.y - past.y
			} else {
				// Fallback for edge cases
				const next = racingPoints[Math.min(i + 1, racingPoints.length - 1)]!
				tangentX = next.x - curr.x
				tangentY = next.y - curr.y
			}

			// Normalize tangent
			const tangentLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY)
			if (tangentLen === 0) continue

			tangentX /= tangentLen
			tangentY /= tangentLen

			// Normal vector (perpendicular to tangent, pointing left)
			const normalX = -tangentY
			const normalY = tangentX

			// Use consistent width instead of varying track_edge
			leftPts.push({ x: curr.x + normalX * consistentHalfWidth, y: curr.y + normalY * consistentHalfWidth })
			rightPts.push({ x: curr.x - normalX * consistentHalfWidth, y: curr.y - normalY * consistentHalfWidth })
		}

		// Apply straightness detection and correction first
		const straightenedLeft = detectAndStraightenSections(leftPts)
		const straightenedRight = detectAndStraightenSections(rightPts)

		// Apply multiple passes of heavy smoothing for ultra-smooth rails
		let smoothLeft = smoothPolyline(straightenedLeft, 25) // Increased smoothing
		let smoothRight = smoothPolyline(straightenedRight, 25)

		// Second smoothing pass for extra smoothness
		smoothLeft = smoothPolyline(smoothLeft, 15)
		smoothRight = smoothPolyline(smoothRight, 15)

		// Calculate target density to match telemetry log count
		const targetPoints = logs.length
		const currentPoints = smoothLeft.length
		const densityMultiplier = Math.max(1, Math.ceil(targetPoints / currentPoints))

		// Interpolate to match telemetry density
		const denseLeft = interpolateSpline(smoothLeft, densityMultiplier)
		const denseRight = interpolateSpline(smoothRight, densityMultiplier)

		// Final light smoothing pass on the dense data
		const ultraSmoothLeft = smoothPolyline(denseLeft, 9) // Slightly increased
		const ultraSmoothRight = smoothPolyline(denseRight, 9)

		return [
			{
				id: `${lap.id}-rail-left-world`,
				points: ultraSmoothLeft,
				color: "#ffffff",
				highlight: false,
				interactive: false,
			},
			{
				id: `${lap.id}-rail-right-world`,
				points: ultraSmoothRight,
				color: "#ffffff",
				highlight: false,
				interactive: false,
			}
		]
	}, [lap.id, lap.telemetry_logs])

	return (
		<div className="relative h-full w-full flex flex-col justify-between">
			{/* Layout: Track map left, charts right */}
			<div className="flex w-full h-[calc(100%-5rem)]">{/* subtract sector bar height */}
				<div className="w-1/2 h-full relative">
					<TrackMap
						laps={
							[
								...worldRails,
								lapLine
							]
						}
						className="w-full h-full"
						strokeWidth={1.5}
						showHoverMarker={true}
						hoverRadius={50}
					/>
				</div>

				<div className="grid grid-cols-1 gap-4 w-1/2 ml-auto my-10">
					{chartData.map((chart) => (
						<MemoizedChart
							key={chart.title}
							data={chart.data}
							title={chart.title}
							syncId="lapAnalysis"
						/>
					))}
				</div>
			</div>

			<SectorFilterBar
				sectorTimes={sectorTimes}
				lapTime={lapTime}
				activeSectors={activeSectors}
				toggleSector={toggleSector}
			/>
		</div>
	);
} 