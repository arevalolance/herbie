"use server";

import { revalidatePath } from "next/cache";
import { withAuth } from "@workos-inc/authkit-nextjs";

import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";

export type SharedLapWithDetails = Prisma.lapsGetPayload<{
    include: {
        vehicles: { select: { vehicle_name: true; class_name: true } };
        sessions: { select: { track_name: true; sim_name: true; session_type: true } };
        lap_summary: { select: { max_speed: true; avg_speed: true } };
        users: { select: { first_name: true; last_name: true; profile_picture_url: true; created_at: true } };
    };
}>;

export async function getSharedLaps(limit: number = 50) {
    const { user } = await withAuth();

    const laps = await prisma.laps.findMany({
        where: {
            is_valid: true,
            lap_time: { not: null },
            ...(user ? { user_id: { not: user.id } } : {}),
        },
        include: {
            vehicles: {
                select: {
                    vehicle_name: true,
                    class_name: true,
                },
            },
            sessions: {
                select: {
                    track_name: true,
                    sim_name: true,
                    session_type: true,
                },
            },
            lap_summary: {
                select: {
                    max_speed: true,
                    avg_speed: true,
                },
            },
            users: {
                select: {
                    first_name: true,
                    last_name: true,
                    profile_picture_url: true,
                    created_at: true,
                },
            },
        },
        orderBy: {
            lap_start_time: "desc",
        },
        take: limit,
    });

    const filters = laps.reduce(
        (acc, lap) => {
            const trackName = lap.sessions?.track_name ?? "Unknown Track";
            if (!acc.tracks.includes(trackName)) acc.tracks.push(trackName);

            const vehicleName = lap.vehicles?.vehicle_name ?? "Unknown Vehicle";
            if (!acc.vehicles.includes(vehicleName)) acc.vehicles.push(vehicleName);

            const uploader = `${lap.users.first_name ?? ""} ${lap.users.last_name ?? ""}`.trim() || "Anonymous Driver";
            if (!acc.uploaders.includes(uploader)) acc.uploaders.push(uploader);

            return acc;
        },
        { tracks: [] as string[], vehicles: [] as string[], uploaders: [] as string[] }
    );

    return { laps, filters };
}

export async function forkCommunityComparison(lapId: number) {
    const { user } = await withAuth();

    if (!user) {
        throw new Error("You must be signed in to fork this comparison.");
    }

    const record = await prisma.lap_comparisons.create({
        data: {
            user_id: user.id,
            title: `Shared lap ${lapId} comparison`,
            description: "Created from the community library",
            lap_ids: lapId.toString(),
        },
    });

    revalidatePath("/comparisons");

    return record.id;
}
