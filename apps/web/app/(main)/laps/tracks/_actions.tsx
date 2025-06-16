"use server";

import prisma from "@/lib/prisma";
import { withAuth } from '@workos-inc/authkit-nextjs';

export async function getTracks() {
    const { user } = await withAuth();
    
    if (!user) {
        return [];
    }
    
    // Get distinct tracks with their details and lap counts
    const sessions = await prisma.sessions.findMany({
        where: {
            user_id: user.id,
            track_name: {
                not: null
            }
        },
        select: {
            id: true,
            track_name: true,
            sim_name: true,
            session_type: true,
            created_at: true,
            _count: {
                select: {
                    laps: {
                        where: {
                            user_id: user.id,
                            is_valid: true
                        }
                    }
                }
            }
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    // Deduplicate by track_name, keeping the one with the most laps
    const uniqueTracks = sessions.reduce((acc, session) => {
        const key = session.track_name!;
        if (!acc[key] || session._count.laps > acc[key]._count.laps) {
            acc[key] = session;
        }
        return acc;
    }, {} as Record<string, typeof sessions[0]>);

    return Object.values(uniqueTracks);
}

export async function getLapsByTrack(trackId: string) {
    const { user } = await withAuth();
    
    if (!user) {
        return { track: null, laps: [] };
    }

    const trackIdNum = parseInt(trackId);
    
    // Get track details from session
    const track = await prisma.sessions.findUnique({
        where: { id: trackIdNum },
        select: {
            id: true,
            track_name: true,
            sim_name: true,
            session_type: true,
            created_at: true,
            _count: {
                select: {
                    laps: {
                        where: {
                            user_id: user.id,
                            is_valid: true
                        }
                    }
                }
            }
        }
    });

    if (!track) {
        return { track: null, laps: [] };
    }

    // Get all laps for this track (by track_name to include all sessions on this track)
    const laps = await prisma.laps.findMany({
        where: {
            user_id: user.id,
            is_valid: true,
            sessions: {
                track_name: track.track_name
            }
        },
        include: {
            vehicles: {
                select: {
                    vehicle_name: true,
                    class_name: true
                }
            },
            sessions: {
                select: {
                    track_name: true,
                    session_type: true,
                    sim_name: true,
                    created_at: true
                }
            },
            lap_summary: {
                select: {
                    max_speed: true,
                    avg_speed: true
                }
            }
        },
        orderBy: [
            { lap_time: 'asc' }  // Fastest laps first
        ]
    });

    return { track, laps };
}