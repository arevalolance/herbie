"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@workspace/ui/components/card";
import { LapCard } from "@/components/lap-card";
import { LapFilters, FilterState } from "./lap-filters";
import { Prisma } from "@/generated/prisma";

type LapWithDetails = Prisma.lapsGetPayload<{
    include: {
        vehicles: { select: { vehicle_name: true; class_name: true } };
        sessions: { select: { track_name: true; sim_name: true; session_type: true } };
        lap_summary: { select: { max_speed: true; avg_speed: true } };
    };
}>;

interface FilteredLapsListProps {
    laps: LapWithDetails[];
    filterData: {
        vehicles: Array<{ id: number; vehicle_name: string | null; class_name: string | null }>;
        tracks: Array<{ id: number; track_name: string | null; sim_name: string | null }>;
        categories: Array<{ name: string | null }>;
    };
}

export function FilteredLapsList({ laps, filterData }: FilteredLapsListProps) {
    const [filters, setFilters] = useState<FilterState>({
        searchTerm: "",
        vehicle: "all",
        track: "all",
        category: "all",
        personalBests: false
    });

    const filteredLaps = useMemo(() => {
        return laps.filter(lap => {
            // Search term filter
            if (filters.searchTerm) {
                const searchLower = filters.searchTerm.toLowerCase();
                const matchesVehicle = lap.vehicles?.vehicle_name?.toLowerCase().includes(searchLower);
                const matchesTrack = lap.sessions?.track_name?.toLowerCase().includes(searchLower);
                const matchesCategory = lap.vehicles?.class_name?.toLowerCase().includes(searchLower);
                
                if (!matchesVehicle && !matchesTrack && !matchesCategory) {
                    return false;
                }
            }

            // Vehicle filter
            if (filters.vehicle !== "all") {
                const selectedVehicle = filterData.vehicles.find(v => v.id.toString() === filters.vehicle);
                if (!selectedVehicle || lap.vehicles?.vehicle_name !== selectedVehicle.vehicle_name) {
                    return false;
                }
            }

            // Track filter
            if (filters.track !== "all") {
                if (lap.sessions?.track_name !== filters.track) {
                    return false;
                }
            }

            // Category filter
            if (filters.category !== "all") {
                if (lap.vehicles?.class_name !== filters.category) {
                    return false;
                }
            }

            // Personal bests filter
            if (filters.personalBests && !lap.is_personal_best) {
                return false;
            }

            return true;
        });
    }, [laps, filters, filterData.vehicles]);

    return (
        <div className="space-y-4">
            <LapFilters
                vehicles={filterData.vehicles}
                tracks={filterData.tracks}
                categories={filterData.categories}
                onFiltersChange={setFilters}
            />

            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {filteredLaps.length} of {laps.length} laps
                </p>
            </div>

            {filteredLaps.length === 0 ? (
                <Card>
                    <CardContent className="py-8 text-center">
                        <p className="text-muted-foreground">
                            No laps found matching the current filters.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredLaps.map((lap) => (
                        <LapCard key={lap.id} lap={lap} showVehicleInfo={true} />
                    ))}
                </div>
            )}
        </div>
    );
}