"use server";

import prisma from "@/lib/prisma";
import { withAuth } from '@workos-inc/authkit-nextjs';

export async function getOverviewStats() {
    const { user } = await withAuth();
    
    if (!user) {
        return {
            totalLaps: 0,
            personalBests: 0,
            uniqueTracks: 0,
            uniqueVehicles: 0,
            totalDrivingTime: 0,
            recentSessions: 0,
            avgSessionLength: null,
            totalDistance: 0
        };
    }
    
    const [
        totalLaps,
        personalBests,
        uniqueTracks,
        uniqueVehicles,
        recentSessions,
        lapSummaries,
        sessions
    ] = await Promise.all([
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
        }).then(vehicles => vehicles.length),
        prisma.sessions.count({
            where: {
                user_id: user.id,
                created_at: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                }
            }
        }),
        prisma.lap_summary.findMany({
            where: {
                laps: {
                    user_id: user.id,
                    is_valid: true
                }
            },
            select: {
                distance_covered: true
            }
        }),
        prisma.sessions.findMany({
            where: {
                user_id: user.id
            },
            include: {
                _count: {
                    select: {
                        laps: {
                            where: {
                                is_valid: true
                            }
                        }
                    }
                },
                laps: {
                    where: {
                        is_valid: true,
                        lap_time: {
                            not: null
                        }
                    },
                    select: {
                        lap_time: true
                    }
                }
            }
        })
    ]);

    // Calculate driving statistics
    const validSessions = sessions.filter(session => session.laps.length > 0);
    const totalDrivingTime = validSessions.reduce((sum, session) => {
        return sum + session.laps.reduce((sessionSum, lap) => sessionSum + (lap.lap_time || 0), 0);
    }, 0);
    
    const avgSessionLength = validSessions.length > 0 
        ? Math.round(validSessions.reduce((sum, session) => sum + session._count.laps, 0) / validSessions.length)
        : null;
    
    const totalDistance = lapSummaries
        .filter(summary => summary.distance_covered !== null)
        .reduce((sum, summary) => sum + (summary.distance_covered as number), 0);

    return {
        totalLaps,
        personalBests,
        uniqueTracks,
        uniqueVehicles,
        totalDrivingTime,
        recentSessions,
        avgSessionLength,
        totalDistance
    };
}

export async function getRecentActivity(limit: number = 10) {
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
                    class_name: true
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
            }
        },
        orderBy: {
            lap_start_time: 'desc'
        },
        take: limit
    });

    return recentLaps;
}

export async function getPerformanceTrends(days: number = 30) {
    const { user } = await withAuth();
    
    if (!user) {
        return {
            lapTimes: [],
            speeds: [],
            sessionActivity: []
        };
    }

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [lapTrends, speedTrends, sessionActivity] = await Promise.all([
        // Lap time trends by day
        prisma.laps.findMany({
            where: {
                user_id: user.id,
                is_valid: true,
                lap_time: { not: null },
                lap_start_time: { gte: cutoffDate }
            },
            select: {
                lap_time: true,
                lap_start_time: true
            },
            orderBy: {
                lap_start_time: 'asc'
            }
        }),
        // Speed trends from lap summaries
        prisma.lap_summary.findMany({
            where: {
                laps: {
                    user_id: user.id,
                    is_valid: true,
                    lap_start_time: { gte: cutoffDate }
                }
            },
            include: {
                laps: {
                    select: {
                        lap_start_time: true
                    }
                }
            }
        }),
        // Session activity by day
        prisma.sessions.findMany({
            where: {
                user_id: user.id,
                created_at: { gte: cutoffDate }
            },
            select: {
                created_at: true,
                track_name: true
            },
            orderBy: {
                created_at: 'asc'
            }
        })
    ]);

    return {
        lapTimes: lapTrends,
        speeds: speedTrends,
        sessionActivity
    };
}

export async function getQuickNavigation() {
    const { user } = await withAuth();
    
    if (!user) {
        return {
            frequentTracks: [],
            frequentVehicles: [],
            recentSessions: []
        };
    }

    const [frequentTracks, frequentVehicles, recentSessions] = await Promise.all([
        // Most driven tracks
        prisma.sessions.groupBy({
            by: ['track_name'],
            where: {
                user_id: user.id,
                laps: {
                    some: {
                        is_valid: true
                    }
                }
            },
            _count: {
                id: true
            },
            orderBy: {
                _count: {
                    id: 'desc'
                }
            },
            take: 5
        }),
        // Most driven vehicles
        prisma.vehicles.findMany({
            where: {
                laps: {
                    some: {
                        user_id: user.id,
                        is_valid: true
                    }
                }
            },
            include: {
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
                laps: {
                    _count: 'desc'
                }
            },
            take: 5
        }),
        // Recent sessions
        prisma.sessions.findMany({
            where: {
                user_id: user.id
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
                                is_valid: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            },
            take: 5
        })
    ]);

    return {
        frequentTracks,
        frequentVehicles,
        recentSessions
    };
}

export async function getCommunityActivity(limit: number = 6) {
    const { user } = await withAuth();
    
    // Get recent laps from other users (excluding current user if logged in)
    const communityLaps = await prisma.laps.findMany({
        where: {
            is_valid: true,
            ...(user ? { user_id: { not: user.id } } : {}), // Exclude current user's laps if logged in
            lap_time: { not: null } // Only show laps with valid times
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
                    first_name: true,
                    last_name: true,
                    profile_picture_url: true,
                    created_at: true
                }
            }
        },
        orderBy: {
            lap_start_time: 'desc'
        },
        take: limit
    });

    return communityLaps;
}

export async function getDashboardHighlights() {
    const { user } = await withAuth();

    if (!user) {
        return {
            latestSession: null,
            bestLap: null,
            recentlyAnalyzed: [],
            latestLapId: null,
        };
    }

    const [latestSession, personalBest, fallbackBestLap, recentSummaries, latestLap] = await Promise.all([
        prisma.sessions.findFirst({
            where: { user_id: user.id },
            orderBy: { created_at: "desc" },
            select: {
                id: true,
                track_name: true,
                sim_name: true,
                session_type: true,
                created_at: true,
                _count: {
                    select: {
                        laps: true,
                    },
                },
                laps: {
                    where: {
                        is_valid: true,
                        lap_time: { not: null },
                    },
                    orderBy: {
                        lap_time: "asc",
                    },
                    take: 1,
                    select: {
                        id: true,
                        lap_number: true,
                        lap_time: true,
                        lap_start_time: true,
                        is_valid: true,
                        track_temp: true,
                        ambient_temp: true,
                        wetness: true,
                        lap_summary: {
                            select: {
                                max_speed: true,
                                distance_covered: true,
                            },
                        },
                        vehicles: {
                            select: {
                                vehicle_name: true,
                                class_name: true,
                            },
                        },
                    },
                },
                session_conditions: {
                    orderBy: {
                        timestamp: "desc",
                    },
                    take: 1,
                    select: {
                        ambient_temperature: true,
                        track_temperature: true,
                        wetness_average: true,
                        raininess: true,
                    },
                },
            },
        }),
        prisma.laps.findFirst({
            where: {
                user_id: user.id,
                is_valid: true,
                lap_time: { not: null },
                is_personal_best: true,
            },
            orderBy: {
                lap_time: "asc",
            },
            include: {
                lap_summary: {
                    select: {
                        max_speed: true,
                        distance_covered: true,
                    },
                },
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
            },
        }),
        prisma.laps.findFirst({
            where: {
                user_id: user.id,
                is_valid: true,
                lap_time: { not: null },
            },
            orderBy: {
                lap_time: "asc",
            },
            include: {
                lap_summary: {
                    select: {
                        max_speed: true,
                        distance_covered: true,
                    },
                },
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
            },
        }),
        prisma.lap_summary.findMany({
            where: {
                laps: {
                    user_id: user.id,
                },
            },
            include: {
                laps: {
                    select: {
                        id: true,
                        lap_number: true,
                        lap_time: true,
                        lap_start_time: true,
                        is_valid: true,
                        track_temp: true,
                        ambient_temp: true,
                        wetness: true,
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
                    },
                },
            },
            orderBy: {
                created_at: "desc",
            },
            take: 3,
        }),
        prisma.laps.findFirst({
            where: {
                user_id: user.id,
            },
            orderBy: {
                lap_start_time: "desc",
            },
            select: {
                id: true,
            },
        }),
    ]);

    const bestLap = personalBest || fallbackBestLap;

    const recentlyAnalyzed = recentSummaries
        .filter(summary => summary.laps !== null)
        .map(summary => ({
            id: summary.lap_id,
            created_at: summary.created_at,
            distance: summary.distance_covered,
            max_speed: summary.max_speed,
            lap: summary.laps!,
        }));

    return {
        latestSession,
        bestLap,
        recentlyAnalyzed,
        latestLapId: latestLap?.id ?? null,
    };
}

export async function getRecentActivityForSidebar(limit: number = 5) {
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
                    class_name: true
                }
            },
            sessions: {
                select: {
                    track_name: true,
                    sim_name: true,
                    session_type: true
                }
            }
        },
        orderBy: {
            lap_start_time: 'desc'
        },
        take: limit
    });

    // Helper function to format lap time
    const formatLapTime = (timeInSeconds: number | null): string => {
        if (!timeInSeconds) return '';
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = (timeInSeconds % 60).toFixed(3);
        return `${minutes}:${seconds.padStart(6, '0')}`;
    };

    // Helper function to get session type name
    const getSessionTypeName = (sessionType: number | null): string => {
        if (!sessionType) return '';
        switch (sessionType) {
            case 1: return 'Practice';
            case 2: return 'Qualifying';
            case 3: return 'Race';
            case 4: return 'Time Trial';
            case 5: return 'Warmup';
            case 6: return 'Formation';
            default: return 'Session';
        }
    };

    // Helper function to get relative time
    const getRelativeTime = (date: Date): string => {
        const now = new Date();
        const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
        
        if (diffInHours < 1) return 'Just now';
        if (diffInHours < 24) return `${diffInHours}h ago`;
        if (diffInHours < 48) return 'Yesterday';
        const days = Math.floor(diffInHours / 24);
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    // Transform the data to match the expected format for NavRecentActivity
    return recentLaps.map(lap => {
        const carName = lap.vehicles?.vehicle_name || 'Unknown Car';
        const trackName = lap.sessions?.track_name || 'Unknown Track';
        const lapTime = formatLapTime(lap.lap_time);
        const sessionType = getSessionTypeName(lap.sessions?.session_type);
        const relativeTime = getRelativeTime(lap.lap_start_time);
        const isPB = lap.is_personal_best;

        // Create a more descriptive name
        let displayName = '';
        
        // Add lap time if available
        if (lapTime) {
            displayName = `${lapTime} - ${carName}`;
        } else {
            displayName = `Lap ${lap.lap_number} - ${carName}`;
        }
        
        // Add track name (shortened if necessary)
        const shortTrackName = trackName.length > 20 ? trackName.substring(0, 20) + '...' : trackName;
        displayName += ` @ ${shortTrackName}`;
        
        // Add session type if available
        if (sessionType) {
            displayName += ` (${sessionType})`;
        }
        
        // Add PB indicator
        if (isPB) {
            displayName += ' 🏆';
        }

        return {
            name: displayName,
            url: `/analyze/laps/${lap.id}`
        };
    });
}