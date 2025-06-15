import prisma from "@/lib/prisma";
import { TelemetryView } from "./_components/telemetry-view";

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

    return <TelemetryView lap={lap} />;
}