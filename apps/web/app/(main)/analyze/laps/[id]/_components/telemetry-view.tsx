'use client'

import React, { useMemo, useState, useCallback } from "react";
import { Prisma } from "@/generated/prisma";
import { Button } from "@workspace/ui/components/button";
import { TrackMap, LapLine } from "@/components/metrics/track-map";
import { ZoomableChart } from "@/components/metrics/chart";
import { 
	generateRacingLine,
	generateWorldRails,
	generateChartData,
	type TelemetryLog
} from "@/lib/track-map/utils";

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

export function TelemetryView({
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
	const lapLine: LapLine = useMemo(() => 
		generateRacingLine(lap.id, lap.telemetry_logs as TelemetryLog[]),
		[lap.id, lap.telemetry_logs]
	)

	// Memoize chart data to prevent recalculation on every render
	const chartData = useMemo(() => 
		generateChartData(filteredLogs as TelemetryLog[]),
		[filteredLogs]
	);

	// Compute left/right track boundary (rails) lines in WORLD coordinates
	const worldRails: LapLine[] = useMemo(() => 
		generateWorldRails(lap.id, lap.telemetry_logs as TelemetryLog[]),
		[lap.id, lap.telemetry_logs]
	)

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
						<ZoomableChart
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