"use server";

import prisma from "@/lib/prisma";
import { withAuth } from '@workos-inc/authkit-nextjs';

export async function getCategories() {
    const { user } = await withAuth();
    
    if (!user) {
        return [];
    }
    
    // Get distinct vehicle categories with their details and lap counts
    const vehicles = await prisma.vehicles.findMany({
        where: {
            class_name: {
                not: null
            },
            laps: {
                some: {
                    user_id: user.id,
                    is_valid: true
                }
            }
        },
        select: {
            id: true,
            class_name: true,
            vehicle_name: true,
            sessions: {
                select: {
                    sim_name: true,
                    created_at: true
                }
            },
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
            sessions: {
                created_at: 'desc'
            }
        }
    });

    // Deduplicate by class_name, keeping the one with the most laps
    const uniqueCategories = vehicles.reduce((acc, vehicle) => {
        const key = vehicle.class_name!;
        if (!acc[key] || vehicle._count.laps > acc[key]._count.laps) {
            acc[key] = vehicle;
        }
        return acc;
    }, {} as Record<string, typeof vehicles[0]>);

    return Object.values(uniqueCategories);
}

export async function getLapsByCategory(categoryId: string) {
    const { user } = await withAuth();
    
    if (!user) {
        return { category: null, laps: [] };
    }

    const categoryIdNum = parseInt(categoryId);
    
    // Get category details from vehicle
    const categoryVehicle = await prisma.vehicles.findUnique({
        where: { id: categoryIdNum },
        select: {
            id: true,
            class_name: true,
            vehicle_name: true,
            sessions: {
                select: {
                    sim_name: true,
                    created_at: true
                }
            },
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

    if (!categoryVehicle) {
        return { category: null, laps: [] };
    }

    // Get all laps for this category (by class_name to include all vehicles in this category)
    const laps = await prisma.laps.findMany({
        where: {
            user_id: user.id,
            is_valid: true,
            vehicles: {
                class_name: categoryVehicle.class_name
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

    return { category: categoryVehicle, laps };
}