import prisma from "@/lib/prisma";
import { TelemetryView } from "./_components/telemetry-view";
import { LapTimelineEntry, SessionNote, SetupSnapshot } from "./_components/session-notebook-types";

export default async function AnalyzeLapsPage({
        params,
        searchParams,
}: {
        params: Promise<{ id: string }>;
        searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
        const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams ?? Promise.resolve({})]);

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
                                        electric_motor_data: true,
                                }
                        },
                }
        });

        if (!lap) {
                return <div>Lap not found</div>;
        }

        const [sessionNotes, sessionLaps] = await Promise.all([
                prisma.session_notes.findMany({
                        where: {
                                session_id: lap.session_id,
                                user_id: lap.user_id,
                        },
                        orderBy: { created_at: 'desc' },
                }),
                prisma.laps.findMany({
                        where: {
                                session_id: lap.session_id,
                                user_id: lap.user_id,
                                is_valid: true,
                        },
                        select: {
                                id: true,
                                lap_number: true,
                                lap_time: true,
                                lap_start_time: true,
                                timing_data: {
                                        select: {
                                                delta_to_session_best: true,
                                        },
                                },
                        },
                        orderBy: { lap_start_time: 'asc' },
                }),
        ]);

        const notesPayload: SessionNote[] = sessionNotes.map((note) => ({
                id: note.id,
                sessionId: note.session_id,
                createdAt: note.created_at?.toISOString() ?? null,
                note: note.note,
                tags: note.tags?.split(',').map((tag) => tag.trim()).filter(Boolean) ?? [],
                springs: note.springs as SetupSnapshot["springs"],
                aero: note.aero as SetupSnapshot["aero"],
                brakeBias: note.brake_bias,
                tirePressures: note.tire_pressures as SetupSnapshot["tirePressures"],
                tireTemps: note.tire_temps as SetupSnapshot["tireTemps"],
        }));

        const lapTimeline: LapTimelineEntry[] = sessionLaps.map((sessionLap) => ({
                id: sessionLap.id,
                lapNumber: sessionLap.lap_number,
                lapTime: sessionLap.lap_time,
                deltaToSessionBest: sessionLap.timing_data?.[0]?.delta_to_session_best ?? null,
                lapStartTime: sessionLap.lap_start_time.toISOString(),
        }));

        const sourceLabel = typeof resolvedSearchParams?.from === "string" ? resolvedSearchParams.from : undefined;

        return (
                <TelemetryView
                        lap={lap}
                        deepLinkSource={sourceLabel}
                        sessionNotes={notesPayload}
                        lapTimeline={lapTimeline}
                />
        );
}