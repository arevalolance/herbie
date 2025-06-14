'use client'
import React, { useMemo, useState, useCallback } from "react";
import { ZoomableChart } from "@/components/metrics/chart";
import { Prisma } from "@/generated/prisma";
import { Button } from "@workspace/ui/components/button";

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

	// Memoize chart data to prevent recalculation on every render
	const chartData = useMemo(
		() => [
			{
				title: "Speed",
				data: filteredLogs.map((log) => ({
					date: (log.lap_progress ?? 0).toString(),
					events: log.speed ?? 0,
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
	);
} 