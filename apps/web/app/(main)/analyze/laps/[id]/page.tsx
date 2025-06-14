import prisma from "@/lib/prisma";
import { ChartGrid } from "./chart-grid";

export default async function AnalyzeLapsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const lap = await prisma.laps.findUnique({
        where: { id: parseInt(id) },
        include: {
            lap_summary: true,
            timing_data: true,
            sessions: { select: { track_name: true, sim_name: true } },
            telemetry_logs: {
                orderBy: {
                    timestamp: 'asc'
                },
                include: {
                    vehicle_state: true,
                    wheel_data: true,
                    input_data: true,
                    tyre_data: true,
                    brake_data: true,
                }
            },
        }
    });

    if (!lap) {
        return <div>Lap not found</div>;
    }

    console.log({ tele: lap.telemetry_logs.filter(log => log.lap_id === 1) });

    return <ChartGrid lap={lap as any} />;
}