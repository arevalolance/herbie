"use server";

import { withAuth } from "@workos-inc/authkit-nextjs";
import { revalidatePath } from "next/cache";

import prisma from "@/lib/prisma";

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
