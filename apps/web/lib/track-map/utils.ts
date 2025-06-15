import { LapPoint } from "@/components/metrics/track-map";

/**
 * Ramer–Douglas–Peucker polyline simplification algorithm
 * Reduces the number of points in a polyline while preserving its overall shape
 * 
 * @param points - Array of points to simplify
 * @param tolerance - Distance tolerance for simplification (higher = more aggressive)
 * @returns Simplified array of points
 */
export function simplifyPath(points: LapPoint[], tolerance = 1): LapPoint[] {
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

/**
 * Moving average smoothing for polyline points
 * Reduces noise and creates smoother curves by averaging nearby points
 * 
 * @param points - Array of points to smooth
 * @param windowSize - Number of points to include in the averaging window
 * @returns Smoothed array of points
 */
export function smoothPolyline(points: LapPoint[], windowSize: number = 5): LapPoint[] {
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

/**
 * Catmull-Rom spline interpolation for smooth curves
 * Adds intermediate points between existing points using spline interpolation
 * 
 * @param points - Array of points to interpolate
 * @param density - Number of points to add between each pair of points
 * @returns Interpolated array of points with higher density
 */
export function interpolateSpline(points: LapPoint[], density: number = 3): LapPoint[] {
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

/**
 * Detect straight sections and apply appropriate smoothing
 * Uses linear correlation to identify straight sections and projects points onto best-fit lines
 * 
 * @param points - Array of points to analyze and straighten
 * @returns Points with straight sections cleaned up
 */
export function detectAndStraightenSections(points: LapPoint[]): LapPoint[] {
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

// Type definitions for telemetry data and chart data
export interface TelemetryLog {
	position_x?: number | null;
	position_y?: number | null;
	speed?: number | null;
	throttle?: number | null;
	brake?: number | null;
	gear?: number | null;
	rpm?: number | null;
	steering?: number | null;
	track_edge?: number | null;
	lap_progress?: number | null;
	velocity_longitudinal?: number | null;
	velocity_lateral?: number | null;
	velocity_vertical?: number | null;
	timestamp?: string | Date | null;
}

export interface LapLine {
	id: string | number;
	points: LapPoint[];
	color?: string;
	highlight?: boolean;
	interactive?: boolean;
}

export interface ChartDataPoint {
	date: string;
	events: number;
}

export interface ChartData {
	title: string;
	data: ChartDataPoint[];
}

/**
 * Generate a racing line from telemetry logs
 * Creates the main vehicle position line with comprehensive metadata
 * 
 * @param lapId - Unique identifier for the lap
 * @param telemetryLogs - Array of telemetry data points
 * @param color - Color for the line (default: "#ef4444")
 * @returns LapLine object for the racing line
 */
export function generateRacingLine(
	lapId: string | number,
	telemetryLogs: TelemetryLog[],
	color: string = "#ef4444"
): LapLine {
	const points = telemetryLogs
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
		.filter(Boolean) as LapPoint[];

	return {
		id: lapId,
		points,
		highlight: true,
		color,
	};
}

/**
 * Generate a speed-colored racing line
 * Creates a line where points contain speed ratio information for color mapping
 * 
 * @param lapId - Unique identifier for the lap
 * @param telemetryLogs - Array of telemetry data points
 * @param color - Base color for the line (default: "#3b82f6")
 * @returns LapLine object with speed-colored points
 */
export function generateSpeedColoredLine(
	lapId: string | number,
	telemetryLogs: TelemetryLog[],
	color: string = "#3b82f6"
): LapLine {
	if (!telemetryLogs.length) {
		return { id: `${lapId}-speed`, points: [], color, highlight: false };
	}

	// Calculate speed range for color mapping
	const speeds = telemetryLogs.map(log => log.speed ? Number(log.speed) : 0);
	const minSpeed = Math.min(...speeds);
	const maxSpeed = Math.max(...speeds);
	const speedRange = maxSpeed - minSpeed;

	const speedPoints: LapPoint[] = telemetryLogs
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
		id: `${lapId}-speed`,
		points: speedPoints,
		color,
		highlight: false,
	};
}

/**
 * Generate an estimated center line from a racing line
 * Creates a smoothed centerline by averaging nearby points
 * 
 * @param lapId - Unique identifier for the lap
 * @param racingLinePoints - Points from the main racing line
 * @param color - Color for the center line (default: "#666")
 * @returns LapLine object for the estimated center line
 */
export function generateEstimatedCenterLine(
	lapId: string | number,
	racingLinePoints: LapPoint[],
	color: string = "#666"
): LapLine {
	if (!racingLinePoints.length) {
		return { id: `${lapId}-center`, points: [], color, highlight: false };
	}

	// Create a smoothed centerline by averaging nearby points
	const smoothedPoints: LapPoint[] = [];
	const points = racingLinePoints;
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
		id: `${lapId}-center`,
		points: simplifyPath(smoothedPoints, 2.0), // More aggressive smoothing
		color,
		highlight: false,
	};
}

/**
 * Generate track boundary rails (left and right edges)
 * Computes track boundaries using racing line and track edge data
 * 
 * @param lapId - Unique identifier for the lap
 * @param telemetryLogs - Array of telemetry data points
 * @returns Array of LapLine objects for left and right track boundaries
 */
export function generateWorldRails(
	lapId: string | number,
	telemetryLogs: TelemetryLog[]
): LapLine[] {
	if (!telemetryLogs.length) return [];

	// Get valid racing line points
	const racingPoints = telemetryLogs
		.map((log, i) => ({
			x: log.position_x ? Number(log.position_x) : null,
			y: log.position_y ? Number(log.position_y) : null,
			trackEdge: log.track_edge ? Number(log.track_edge) : null,
			index: i
		}))
		.filter(p => p.x !== null && p.y !== null && p.trackEdge !== null) as Array<{
			x: number; y: number; trackEdge: number; index: number
		}>;

	if (racingPoints.length < 3) return [];

	// Calculate consistent track width using median to avoid outliers
	const trackEdgeValues = racingPoints.map(p => Math.abs(p.trackEdge)).sort((a, b) => a - b);
	const medianTrackWidth = trackEdgeValues[Math.floor(trackEdgeValues.length / 2)]!;

	// Use a slightly smoothed version of the median for consistency
	const consistentHalfWidth = medianTrackWidth * 1.05; // Add 5% buffer for safety

	const leftPts: LapPoint[] = [];
	const rightPts: LapPoint[] = [];

	// Calculate normals from smoothed racing line tangents
	for (let i = 0; i < racingPoints.length; i++) {
		const curr = racingPoints[i]!;

		// Get tangent vector using wider window for stability
		let tangentX = 0, tangentY = 0;
		const lookAhead = Math.min(8, Math.floor(racingPoints.length / 15)); // Increased for more stability

		if (i < racingPoints.length - lookAhead) {
			const future = racingPoints[i + lookAhead]!;
			tangentX = future.x - curr.x;
			tangentY = future.y - curr.y;
		} else if (i >= lookAhead) {
			const past = racingPoints[i - lookAhead]!;
			tangentX = curr.x - past.x;
			tangentY = curr.y - past.y;
		} else {
			// Fallback for edge cases
			const next = racingPoints[Math.min(i + 1, racingPoints.length - 1)]!;
			tangentX = next.x - curr.x;
			tangentY = next.y - curr.y;
		}

		// Normalize tangent
		const tangentLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
		if (tangentLen === 0) continue;

		tangentX /= tangentLen;
		tangentY /= tangentLen;

		// Normal vector (perpendicular to tangent, pointing left)
		const normalX = -tangentY;
		const normalY = tangentX;

		// Use consistent width instead of varying track_edge
		leftPts.push({ x: curr.x + normalX * consistentHalfWidth, y: curr.y + normalY * consistentHalfWidth });
		rightPts.push({ x: curr.x - normalX * consistentHalfWidth, y: curr.y - normalY * consistentHalfWidth });
	}

	// Apply straightness detection and correction first
	const straightenedLeft = detectAndStraightenSections(leftPts);
	const straightenedRight = detectAndStraightenSections(rightPts);

	// Apply multiple passes of heavy smoothing for ultra-smooth rails
	let smoothLeft = smoothPolyline(straightenedLeft, 25); // Increased smoothing
	let smoothRight = smoothPolyline(straightenedRight, 25);

	// Second smoothing pass for extra smoothness
	smoothLeft = smoothPolyline(smoothLeft, 15);
	smoothRight = smoothPolyline(smoothRight, 15);

	// Calculate target density to match telemetry log count
	const targetPoints = telemetryLogs.length;
	const currentPoints = smoothLeft.length;
	const densityMultiplier = Math.max(1, Math.ceil(targetPoints / currentPoints));

	// Interpolate to match telemetry density
	const denseLeft = interpolateSpline(smoothLeft, densityMultiplier);
	const denseRight = interpolateSpline(smoothRight, densityMultiplier);

	// Final light smoothing pass on the dense data
	const ultraSmoothLeft = smoothPolyline(denseLeft, 9); // Slightly increased
	const ultraSmoothRight = smoothPolyline(denseRight, 9);

	return [
		{
			id: `${lapId}-rail-left-world`,
			points: ultraSmoothLeft,
			color: "#ffffff",
			highlight: false,
			interactive: false,
		},
		{
			id: `${lapId}-rail-right-world`,
			points: ultraSmoothRight,
			color: "#ffffff",
			highlight: false,
			interactive: false,
		}
	];
}

/**
 * Generate chart data for telemetry visualization
 * Creates standardized chart data arrays for various telemetry metrics
 * 
 * @param telemetryLogs - Array of filtered telemetry data points
 * @returns Array of chart data objects for different metrics
 */
export function generateChartData(telemetryLogs: TelemetryLog[]): ChartData[] {
	return [
		{
			title: "Speed",
			data: telemetryLogs.map((log) => ({
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
			data: telemetryLogs.map((log) => ({
				date: (log.lap_progress ?? 0).toString(),
				events: (log.throttle ?? 0) * 100,
			})),
		},
		{
			title: "Brake",
			data: telemetryLogs.map((log) => ({
				date: (log.lap_progress ?? 0).toString(),
				events: (log.brake ?? 0) * 100,
			})),
		},
		{
			title: "Gear",
			data: telemetryLogs.map((log) => ({
				date: (log.lap_progress ?? 0).toString(),
				events: log.gear ?? 0,
			})),
		},
		{
			title: "RPM",
			data: telemetryLogs.map((log) => ({
				date: (log.lap_progress ?? 0).toString(),
				events: log.rpm ?? 0,
			})),
		},
		{
			title: "Steering",
			data: telemetryLogs.map((log) => ({
				date: (log.lap_progress ?? 0).toString(),
				events: (log.steering ?? 0) * 100,
			})),
		},
	];
}

/**
 * Calculate debug information for telemetry analysis
 * Provides statistical insights about the lap data
 * 
 * @param telemetryLogs - Array of telemetry data points
 * @returns Debug information object with various statistics
 */
export function calculateDebugInfo(telemetryLogs: TelemetryLog[]) {
	if (!telemetryLogs.length) return null;

	// Calculate position variation
	const positions = telemetryLogs.map(log => ({
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
	const speeds = telemetryLogs.map(log => log.speed ? Number(log.speed) : 0);
	const steering = telemetryLogs.map(log => log.steering ? Math.abs(Number(log.steering)) : 0);

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
		totalPoints: telemetryLogs.length,
		positionStats,
		speedStats,
		steeringStats,
	};
} 