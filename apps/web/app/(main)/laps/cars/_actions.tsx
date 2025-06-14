"use server";

import prisma from "@/lib/prisma";
import { withAuth } from '@workos-inc/authkit-nextjs';

export async function getCars() {
    const { user } = await withAuth();
    
    if (!user) {
        return [];
    }
    
    // Get vehicles where the user is the player (directly from sessions)
    const vehiclesFromSessions = await prisma.vehicles.findMany({
        where: {
            is_player: true,
            sessions: {
                user_id: user.id
            }
        },
        include: {
            sessions: {
                select: {
                    track_name: true,
                    session_type: true,
                    created_at: true
                }
            }
        },
        distinct: ['vehicle_name', 'class_name'],
        orderBy: {
            created_at: 'desc'
        }
    });

    // Also get vehicles from laps (in case vehicle was used in laps by the user)
    const vehiclesFromLaps = await prisma.vehicles.findMany({
        where: {
            laps: {
                some: {
                    user_id: user.id
                }
            }
        },
        include: {
            sessions: {
                select: {
                    track_name: true,
                    session_type: true,
                    created_at: true
                }
            }
        },
        distinct: ['vehicle_name', 'class_name'],
        orderBy: {
            created_at: 'desc'
        }
    });

    // Combine and deduplicate vehicles by vehicle_name and class_name
    const allVehicles = [...vehiclesFromSessions, ...vehiclesFromLaps];
    const uniqueVehicles = allVehicles.filter((vehicle, index, self) =>
        index === self.findIndex(v => 
            v.vehicle_name === vehicle.vehicle_name && 
            v.class_name === vehicle.class_name
        )
    );

    return uniqueVehicles;
}