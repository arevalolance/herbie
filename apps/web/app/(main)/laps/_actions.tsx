"use server";

import prisma from "@/lib/prisma";
import { withAuth } from '@workos-inc/authkit-nextjs';

export async function getLaps(limit: number = 20, offset: number = 0) {
    const { user } = await withAuth();
    
    if (!user) {
        return [];
    }
    
    const lapsWithDetails = await prisma.laps.findMany({
        where: {
            user_id: user.id,
            is_valid: true
        },
        include: {
            vehicles: {
                select: {
                    vehicle_name: true,
                    class_name: true,
                    driver_name: true
                }
            },
            sessions: {
                select: {
                    track_name: true,
                    sim_name: true,
                    session_type: true
                }
            },
            lap_summary: {
                select: {
                    max_speed: true,
                    avg_speed: true
                }
            },
            users: {
                select: {
                    name: true
                }
            }
        },
        orderBy: {
            lap_start_time: 'desc'
        },
        take: limit,
        skip: offset
    });

    return lapsWithDetails;
}

export async function getLapsByVehicle(vehicleId: number, limit: number = 20, offset: number = 0) {
    const { user } = await withAuth();
    
    if (!user) {
        return [];
    }
    
    const lapsWithDetails = await prisma.laps.findMany({
        where: {
            user_id: user.id,
            vehicle_id: vehicleId,
            is_valid: true
        },
        include: {
            vehicles: {
                select: {
                    vehicle_name: true,
                    class_name: true,
                    driver_name: true
                }
            },
            sessions: {
                select: {
                    track_name: true,
                    sim_name: true,
                    session_type: true
                }
            },
            lap_summary: {
                select: {
                    max_speed: true,
                    avg_speed: true
                }
            },
            users: {
                select: {
                    name: true
                }
            }
        },
        orderBy: {
            lap_time: 'asc' // Best times first for vehicle-specific view
        },
        take: limit,
        skip: offset
    });

    return lapsWithDetails;
}

export async function getRecentLaps(limit: number = 10) {
    const { user } = await withAuth();
    
    if (!user) {
        return [];
    }
    
    const recentLaps = await prisma.laps.findMany({
        where: {
            user_id: user.id,
            is_valid: true
        },
        include: {
            vehicles: {
                select: {
                    vehicle_name: true,
                    class_name: true,
                    driver_name: true
                }
            },
            sessions: {
                select: {
                    track_name: true,
                    sim_name: true,
                    session_type: true
                }
            },
            lap_summary: {
                select: {
                    max_speed: true,
                    avg_speed: true
                }
            },
            users: {
                select: {
                    name: true
                }
            }
        },
        orderBy: {
            lap_start_time: 'desc'
        },
        take: limit
    });

    return recentLaps;
}

export async function getLapStats() {
    const { user } = await withAuth();
    
    if (!user) {
        return {
            totalLaps: 0,
            personalBests: 0,
            uniqueTracks: 0,
            uniqueVehicles: 0
        };
    }
    
    const [totalLaps, personalBests, uniqueTracks, uniqueVehicles] = await Promise.all([
        prisma.laps.count({
            where: {
                user_id: user.id,
                is_valid: true
            }
        }),
        prisma.laps.count({
            where: {
                user_id: user.id,
                is_personal_best: true,
                is_valid: true
            }
        }),
        prisma.sessions.findMany({
            where: {
                user_id: user.id,
                laps: {
                    some: {
                        is_valid: true
                    }
                }
            },
            select: {
                track_name: true
            },
            distinct: ['track_name']
        }).then(tracks => tracks.length),
        prisma.vehicles.findMany({
            where: {
                laps: {
                    some: {
                        user_id: user.id,
                        is_valid: true
                    }
                }
            },
            select: {
                vehicle_name: true,
                class_name: true
            },
            distinct: ['vehicle_name', 'class_name']
        }).then(vehicles => vehicles.length)
    ]);

    return {
        totalLaps,
        personalBests,
        uniqueTracks,
        uniqueVehicles
    };
}

export async function getFilterData() {
    const { user } = await withAuth();
    
    if (!user) {
        return {
            vehicles: [],
            tracks: [],
            categories: [],
            drivers: [],
            teams: [],
            sessionTypes: []
        };
    }

    const [vehicles, tracks, categories, sessionTypes] = await Promise.all([
        prisma.vehicles.findMany({
            where: {
                laps: {
                    some: {
                        user_id: user.id,
                        is_valid: true
                    }
                }
            },
            select: {
                id: true,
                vehicle_name: true,
                class_name: true
            },
            distinct: ['vehicle_name', 'class_name']
        }),
        prisma.sessions.findMany({
            where: {
                user_id: user.id,
                laps: {
                    some: {
                        is_valid: true
                    }
                }
            },
            select: {
                id: true,
                track_name: true,
                sim_name: true
            },
            distinct: ['track_name']
        }),
        prisma.vehicles.findMany({
            where: {
                laps: {
                    some: {
                        user_id: user.id,
                        is_valid: true
                    }
                }
            },
            select: {
                class_name: true,
                driver_name: true
            },
            distinct: ['class_name', 'driver_name']
        }),
        prisma.sessions.findMany({
            where: {
                user_id: user.id,
                laps: {
                    some: {
                        is_valid: true
                    }
                }
            },
            select: {
                session_type: true
            },
            distinct: ['session_type']
        })
    ]);

    return {
        vehicles,
        tracks,
        categories: categories.map(c => ({ name: c.class_name })),
        drivers: Array.from(new Set(categories.map(c => c.driver_name).filter(Boolean))).map(name => ({ name })),
        teams: Array.from(new Set(categories.map(c => c.class_name).filter(Boolean))).map(name => ({ name })),
        sessionTypes: Array.from(new Set(
            sessionTypes
                .map(type => type.session_type)
                .filter((value): value is number => value !== null && value !== undefined)
        )).map(value => ({
            value,
            label: value === 0 ? "Practice" : value === 1 ? "Qualifying" : value === 2 ? "Race" : "Session"
        }))
    };
}