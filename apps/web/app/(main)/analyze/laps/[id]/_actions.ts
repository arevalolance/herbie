"use server";

import { withAuth } from "@workos-inc/authkit-nextjs";
import { revalidatePath } from "next/cache";

import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import { SessionNote, SetupSnapshot } from "./_components/session-notebook-types";

export async function createLapComparison({
        lapIds,
        title,
        description,
}: {
        lapIds: number[];
        title?: string;
        description?: string;
}) {
        const { user } = await withAuth();

        if (!user) {
                throw new Error("You must be signed in to save comparisons.");
        }

        const uniqueLapIds = Array.from(new Set(lapIds)).filter(Boolean);

        if (uniqueLapIds.length === 0) {
                throw new Error("No laps selected for comparison.");
        }

        const record = await prisma.lap_comparisons.create({
                data: {
                        user_id: user.id,
                        title: title?.trim() || `Comparison for lap ${uniqueLapIds.join(", ")}`,
                        description: description?.trim() || null,
                        lap_ids: uniqueLapIds.join(","),
                },
        });

        revalidatePath("/comparisons");

        return record.id;
}

type NotePayload = {
        sessionId: number;
        lapId: number;
        tags?: string[];
        note?: string;
        springs?: SetupSnapshot["springs"];
        aero?: SetupSnapshot["aero"];
        brakeBias?: number | null;
        tirePressures?: SetupSnapshot["tirePressures"];
        tireTemps?: SetupSnapshot["tireTemps"];
};

export async function saveSessionNote({
        sessionId,
        lapId,
        tags = [],
        note,
        springs,
        aero,
        brakeBias,
        tirePressures,
        tireTemps,
}: NotePayload): Promise<SessionNote> {
        const { user } = await withAuth();

        if (!user) {
                throw new Error("You must be signed in to save session notes.");
        }

        const normalizedTags = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));

        const created = await prisma.session_notes.create({
                data: {
                        session_id: sessionId,
                        user_id: user.id,
                        note: note?.trim() || null,
                        tags: normalizedTags.join(","),
                        springs: springs as Prisma.InputJsonValue,
                        aero: aero as Prisma.InputJsonValue,
                        brake_bias: typeof brakeBias === "number" ? brakeBias : null,
                        tire_pressures: tirePressures as Prisma.InputJsonValue,
                        tire_temps: tireTemps as Prisma.InputJsonValue,
                },
        });

        revalidatePath(`/analyze/laps/${lapId}`);

        return {
                id: created.id,
                sessionId: created.session_id,
                createdAt: created.created_at?.toISOString() ?? new Date().toISOString(),
                note: created.note ?? null,
                tags: normalizedTags,
                springs,
                aero,
                brakeBias: created.brake_bias,
                tirePressures,
                tireTemps,
        };
}
