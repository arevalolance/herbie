'use client'
import { useMemo } from "react";
import { ZoomableChart } from "@/components/metrics/chart";
import React from "react";
import { Prisma } from "@/generated/prisma";

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

// Create a client component wrapper for the chart grid
export function ChartGrid({ lap }: { lap: Prisma.lapsGetPayload<{ include: { lap_summary: true; timing_data: true; sessions: { select: { track_name: true; sim_name: true } }; telemetry_logs: true } }> }) {
    // Memoize chart data to prevent recalculation on every render
    const chartData = useMemo(() => [
        {
            title: "Speed",
            data: lap.telemetry_logs.map((log) => ({
                date: log.lap_progress?.toString() || '',
                events: log.speed || 0
            }))
        },
        {
            title: "Throttle",
            data: lap.telemetry_logs.map((log) => ({
                date: log.lap_progress?.toString() || '',
                events: (log.throttle || 0) * 100
            }))
        },
        {
            title: "Brake",
            data: lap.telemetry_logs.map((log) => ({
                date: log.lap_progress?.toString() || '',
                events: (log.brake || 0) * 100
            }))
        },
        {
            title: "Gear",
            data: lap.telemetry_logs.map((log) => ({
                date: log.lap_progress?.toString() || '',
                events: log.gear || 0
            }))
        },
        {
            title: "RPM",
            data: lap.telemetry_logs.map((log) => ({
                date: log.lap_progress?.toString() || '',
                events: log.rpm || 0
            }))
        },
        {
            title: "Steering",
            data: lap.telemetry_logs.map((log) => ({
                date: log.lap_progress?.toString() || '',
                events: (log.steering || 0) * 100
            }))
        }
    ], [lap.telemetry_logs]);

    return (
        <div className="grid grid-cols-1 gap-4 w-1/2 ml-auto">
            {chartData.map((chart) => (
                <MemoizedChart
                    key={chart.title}
                    data={chart.data}
                    title={chart.title}
                    syncId="lapAnalysis"
                />
            ))}
        </div>
    );
} 