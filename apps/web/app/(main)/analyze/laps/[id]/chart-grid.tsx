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
			telemetry_logs: true;
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

	// Memoize a LapLine for TrackMap (full lap regardless of sector filters)
	const lapLine: LapLine = useMemo(() => ({
		id: lap.id,
		points: lap.telemetry_logs
			.map((log) => {
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
					},
				} as LapPoint
			})
			.filter(Boolean) as LapPoint[],
		highlight: true,
		color: "#f97316",
	}), [lap.id, lap.telemetry_logs])

	// Reference track (grey) – approximate centre-line reconstructed using path_lateral (if available)
	const trackPath: LapPoint[] = useMemo(() => {
		const logs = lap.telemetry_logs
		if (!logs.length) return []

		const centrePts: LapPoint[] = []

		for (let i = 0; i < logs.length; i++) {
			const log = logs[i]!
			if (log.position_x == null || log.position_y == null) continue

			const prev = logs[i > 0 ? i - 1 : i]!
			const next = logs[i < logs.length - 1 ? i + 1 : i]!
			if (prev.position_x == null || prev.position_y == null || next.position_x == null || next.position_y == null) continue

			const dirX = Number(next.position_x) - Number(prev.position_x)
			const dirY = Number(next.position_y) - Number(prev.position_y)
			const len = Math.hypot(dirX, dirY) || 1
			// unit normal pointing to the right of the direction vector
			const normX = -dirY / len
			const normY = dirX / len

			// Ensure we treat numeric strings as numbers instead of falling back to 0
			const latRaw = log.path_lateral as unknown
			const lat = latRaw != null && latRaw !== "" && !isNaN(Number(latRaw)) ? Number(latRaw) : 0

			const centreX = Number(log.position_x) - normX * lat
			const centreY = Number(log.position_y) - normY * lat

			centrePts.push({ x: centreX, y: centreY })
		}

		// Use a lower tolerance so we preserve more track detail
		return simplifyPath(centrePts, 0.2)
	}, [lap.telemetry_logs])

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
					<TrackMap
						laps={[lapLine]}
						trackPath={trackPath}
						className="w-full h-full"
						trackColor="#666666"
						strokeWidth={2}
						trackWidthMultiplier={8}
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