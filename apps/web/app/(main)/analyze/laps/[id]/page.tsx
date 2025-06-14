import { ZoomableChart } from "@/components/metrics/chart";
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
                }
            },
        }
    });

    if (!lap) {
        return <div>Lap not found</div>;
    }

    return <ChartGrid lap={lap} />;
}