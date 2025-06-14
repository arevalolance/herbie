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
		<div className="flex h-10 z-10 select-none">
			{sectorTimes.map((time, idx) => {
				const widthPercent = time && lapTime ? (time / lapTime) * 100 : 100 / sectorTimes.length;
				const isActive = activeSectors.includes(idx);

				return (
					<Button
						key={idx}
						onClick={() => toggleSector(idx)}
						style={{ width: `${widthPercent}%` }}
						className={`!rounded-none flex items-center justify-center text-xs font-semibold uppercase tracking-wide`}
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

	const sqDist = (p1: LapPoint, p2: LapPoint) => {
		const dx = p1.x - p2.x
		const dy = p1.y - p2.y
		return dx * dx + dy * dy
	}

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

	// Toggle for debugging line visibility
	const [showRedLine, setShowRedLine] = useState(true);
	const [showBlueLine, setShowBlueLine] = useState(true);
	const [viewMode, setViewMode] = useState<'world' | 'track-relative'>('world');

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

	// NEW: Track-relative racing line using lap distance and path lateral
	const trackRelativeLine: LapLine = useMemo(() => {
		// Debug: Check what data we have
		const allLogs = lap.telemetry_logs;
		const logsWithPathLateral = allLogs.filter(log => log.path_lateral != null);
		const logsWithTrackEdge = allLogs.filter(log => log.track_edge != null);
		const logsWithProgress = allLogs.filter(log => log.lap_progress != null);
		
		console.log('Track-relative debug:', {
			totalLogs: allLogs.length,
			withPathLateral: logsWithPathLateral.length,
			withTrackEdge: logsWithTrackEdge.length,
			withProgress: logsWithProgress.length,
			withVehicleState: allLogs.filter(log => log.vehicle_state?.length).length,
			withWheelData: allLogs.filter(log => log.wheel_data?.length).length,
			withInputData: allLogs.filter(log => log.input_data?.length).length,
			sampleData: allLogs[0] ? {
				path_lateral: allLogs[0].path_lateral,
				track_edge: allLogs[0].track_edge,
				lap_progress: allLogs[0].lap_progress,
				position_x: allLogs[0].position_x,
				position_y: allLogs[0].position_y,
				hasVehicleState: !!allLogs[0].vehicle_state?.length,
				hasWheelData: !!allLogs[0].wheel_data?.length,
				hasInputData: !!allLogs[0].input_data?.length,
			} : null
		});

		// If no path_lateral data, create synthetic racing line from position data
		if (logsWithPathLateral.length === 0) {
			console.log('No path_lateral data, creating synthetic track-relative view from position data');
			
			const validLogs = allLogs.filter(log => 
				log.lap_progress != null && log.position_x != null && log.position_y != null
			);

			if (!validLogs.length) {
				return { id: `${lap.id}-track-relative`, points: [], color: "#10b981", highlight: false };
			}

			// Calculate track center by finding the average position at similar progress points
			// This creates a synthetic "center line" to measure lateral deviation against
			const progressBins = 50; // Divide lap into 50 segments
			const centerLine: Array<{progress: number, centerX: number, centerY: number}> = [];
			
			for (let i = 0; i < progressBins; i++) {
				const binStart = i / progressBins;
				const binEnd = (i + 1) / progressBins;
				const binLogs = validLogs.filter(log => {
					const progress = Number(log.lap_progress) || 0;
					return progress >= binStart && progress < binEnd;
				});
				
				if (binLogs.length > 0) {
					const avgX = binLogs.reduce((sum, log) => sum + (Number(log.position_x) || 0), 0) / binLogs.length;
					const avgY = binLogs.reduce((sum, log) => sum + (Number(log.position_y) || 0), 0) / binLogs.length;
					centerLine.push({
						progress: (binStart + binEnd) / 2,
						centerX: avgX,
						centerY: avgY
					});
				}
			}

			// Calculate synthetic lateral position relative to track center
			const maxProgress = Math.max(...validLogs.map(log => Number(log.lap_progress) || 0));
			const trackLength = maxProgress > 1 ? maxProgress : 3000; // Use actual distance or 3km fallback

			return {
				id: `${lap.id}-track-relative`,
				points: validLogs.map((log, index) => {
					const progress = Number(log.lap_progress) || 0;
					const posX = Number(log.position_x) || 0;
					const posY = Number(log.position_y) || 0;
					
					// Find nearest center line point
					let nearestCenter = centerLine[0] || {centerX: posX, centerY: posY};
					let minDist = Infinity;
					
					for (const center of centerLine) {
						const dist = Math.abs(center.progress - progress);
						if (dist < minDist) {
							minDist = dist;
							nearestCenter = center;
						}
					}
					
					// Calculate lateral deviation from center line
					const lateralOffset = Math.sqrt(
						Math.pow(posX - nearestCenter.centerX, 2) + 
						Math.pow(posY - nearestCenter.centerY, 2)
					);
					
					// Determine if left or right of center (simplified)
					const crossProduct = (posX - nearestCenter.centerX) * (0) - (posY - nearestCenter.centerY) * (1);
					const signedLateral = crossProduct >= 0 ? lateralOffset : -lateralOffset;

					return {
						x: progress * trackLength,
						y: signedLateral,
						meta: {
							speed: log.speed ?? 0,
							throttle: log.throttle ?? 0,
							brake: log.brake ?? 0,
							steering: log.steering ?? 0,
							lap_progress: log.lap_progress ?? 0,
							position_x: log.position_x ?? 0,
							position_y: log.position_y ?? 0,
							lateral_offset: signedLateral,
							index: index,
							line_type: "track_relative_synthetic",
						},
					};
				}),
				color: "#10b981", // Green for track-relative line
				highlight: false,
			};
		}

		// Use actual path_lateral data
		const validLogs = logsWithPathLateral.filter(log => log.lap_progress != null);
		if (!validLogs.length) {
			return { id: `${lap.id}-track-relative`, points: [], color: "#10b981", highlight: false };
		}

		const maxLapDist = Math.max(...validLogs.map(log => Number(log.lap_progress) || 0));
		const lapLength = maxLapDist > 1 ? maxLapDist : 3000;

		return {
			id: `${lap.id}-track-relative`,
			points: validLogs.map((log, index) => ({
				x: (Number(log.lap_progress) || 0) * (maxLapDist > 1 ? 1 : lapLength),
				y: Number(log.path_lateral) || 0,
				meta: {
					speed: log.speed ?? 0,
					throttle: log.throttle ?? 0,
					brake: log.brake ?? 0,
					steering: log.steering ?? 0,
					track_edge: log.track_edge ?? 0,
					lap_progress: log.lap_progress ?? 0,
					path_lateral: log.path_lateral ?? 0,
					index: index,
					line_type: "track_relative_actual",
				},
			})),
			color: "#10b981", // Green for track-relative line
			highlight: false,
		};
	}, [lap.id, lap.telemetry_logs])

	// Create track center reference line
	const trackCenterLine: LapLine = useMemo(() => {
		const validLogs = lap.telemetry_logs.filter(log => log.lap_progress != null);
		
		if (!validLogs.length) return { id: `${lap.id}-center`, points: [], color: "#64748b", highlight: false };

		const maxLapDist = Math.max(...validLogs.map(log => Number(log.lap_progress) || 0));
		const trackLength = maxLapDist > 1 ? maxLapDist : 3000;

		// Create points every 1% of the lap for a smooth center line
		const centerPoints: LapPoint[] = [];
		for (let i = 0; i <= 100; i++) {
			const progress = i / 100;
			centerPoints.push({
				x: progress * trackLength,
				y: 0, // Track center reference at y=0
			});
		}

		return {
			id: `${lap.id}-center`,
			points: centerPoints,
			color: "#64748b", // Gray for track center
			highlight: false,
		};
	}, [lap.id, lap.telemetry_logs])

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
			const dx = positions[i]!.x! - positions[i-1]!.x!;
			const dy = positions[i]!.y! - positions[i-1]!.y!;
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

	return (
		<div className="relative h-full w-full">
			<SectorFilterBar
				sectorTimes={sectorTimes}
				lapTime={lapTime}
				activeSectors={activeSectors}
				toggleSector={toggleSector}
			/>

			{/* Layout: Track map left, charts right */}
			<div className="flex w-full h-[calc(100%-2.5rem)]">{/* subtract sector bar height */}
				<div className="w-1/2 h-full relative">
					{/* Track visualization legend */}
					<div className="absolute top-2 left-2 z-10 bg-black/80 text-white p-2 rounded text-xs">
						<div className="flex items-center gap-2 mb-2">
							<span className="text-yellow-400 font-semibold">View Mode:</span>
							<button
								onClick={() => setViewMode(viewMode === 'world' ? 'track-relative' : 'world')}
								className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-[10px]"
							>
								{viewMode === 'world' ? 'World Coords' : 'Track-Relative'}
							</button>
						</div>
						
						{viewMode === 'world' && (
							<>
								<div className="flex items-center gap-2 mb-1">
									<button
										onClick={() => setShowRedLine(!showRedLine)}
										className={`flex items-center gap-2 hover:bg-gray-700 px-1 rounded ${!showRedLine ? 'opacity-50' : ''}`}
									>
										<div className="w-3 h-1 bg-red-500"></div>
										<span>Racing Line</span>
										<span className="text-[10px]">{showRedLine ? '✓' : '✗'}</span>
									</button>
								</div>
								<div className="flex items-center gap-2 mb-1">
									<button
										onClick={() => setShowBlueLine(!showBlueLine)}
										className={`flex items-center gap-2 hover:bg-gray-700 px-1 rounded ${!showBlueLine ? 'opacity-50' : ''}`}
									>
										<div className="w-3 h-0.5 bg-blue-500"></div>
										<span>Speed Variation</span>
										<span className="text-[10px]">{showBlueLine ? '✓' : '✗'}</span>
									</button>
								</div>
							</>
						)}
						
						{viewMode === 'track-relative' && (
							<>
								<div className="flex items-center gap-2 mb-1">
									<div className="w-3 h-1 bg-green-500"></div>
									<span>Racing Line (Track-Relative)</span>
								</div>
								<div className="flex items-center gap-2 mb-1">
									<div className="w-3 h-0.5 bg-gray-500"></div>
									<span>Track Center Reference</span>
								</div>
								<div className="text-yellow-300 text-[10px] mt-1">
									X-axis: Distance along track<br/>
									Y-axis: Lateral offset from center
								</div>
							</>
						)}
						
						<div className="text-gray-300 text-[10px] mt-2">
							Hover over line to see telemetry data
						</div>
					</div>
					
					{/* Debug info panel */}
					{debugInfo && (
						<div className="absolute top-2 right-2 z-10 bg-black/80 text-white p-2 rounded text-xs max-w-sm">
							<div className="font-semibold mb-1">Racing Line Analysis</div>
							<div>Data Points: {debugInfo.totalPoints}</div>
							
							<div className="border-t border-gray-600 mt-1 pt-1">
								<div className="font-medium">Position Variation:</div>
								<div>X Range: {debugInfo.positionStats.xRange.toFixed(1)}m</div>
								<div>Y Range: {debugInfo.positionStats.yRange.toFixed(1)}m</div>
								<div>Distance: {debugInfo.positionStats.totalDistance.toFixed(0)}m</div>
							</div>

							<div className="border-t border-gray-600 mt-1 pt-1">
								<div className="font-medium">Speed Variation:</div>
								<div>Range: {debugInfo.speedStats.range.toFixed(1)} km/h</div>
								<div>Min: {debugInfo.speedStats.min.toFixed(1)} km/h</div>
								<div>Max: {debugInfo.speedStats.max.toFixed(1)} km/h</div>
							</div>

							<div className="border-t border-gray-600 mt-1 pt-1">
								<div className="font-medium">Steering:</div>
								<div>Max: {(debugInfo.steeringStats.max * 100).toFixed(1)}%</div>
								<div>Avg: {(debugInfo.steeringStats.avg * 100).toFixed(1)}%</div>
							</div>
						</div>
					)}
					<TrackMap
						laps={
							viewMode === 'world' 
								? [
									...(showBlueLine ? [speedColoredLine] : []),
									...(showRedLine ? [lapLine] : [])
								  ]
								: [
									trackCenterLine,
									trackRelativeLine
								  ]
						}
						className="w-full h-full"
						strokeWidth={1.5}
						showHoverMarker={true}
						hoverRadius={15}
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
		</div>
	);
} 