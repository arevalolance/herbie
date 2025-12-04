"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { LapFilters, FilterState } from "./lap-filters";
import { Prisma } from "@/generated/prisma";
import { ArrowUpRight, Download, GitCompare, Share2, Tag, Timer } from "lucide-react";

type LapWithDetails = Prisma.lapsGetPayload<{
    include: {
        vehicles: { select: { vehicle_name: true; class_name: true; driver_name: true } };
        sessions: { select: { track_name: true; sim_name: true; session_type: true } };
        lap_summary: { select: { max_speed: true; avg_speed: true } };
        users: { select: { name: true } };
    };
}>;

interface FilteredLapsListProps {
    laps: LapWithDetails[];
    filterData: {
        vehicles: Array<{ id: number; vehicle_name: string | null; class_name: string | null }>;
        tracks: Array<{ id: number; track_name: string | null; sim_name: string | null }>;
        categories: Array<{ name: string | null }>;
        drivers: Array<{ name: string | null }>;
        teams: Array<{ name: string | null }>;
        sessionTypes: Array<{ value: number; label: string }>;
    };
}

export function FilteredLapsList({ laps, filterData }: FilteredLapsListProps) {
    const [filters, setFilters] = useState<FilterState>({
        searchTerm: "",
        vehicle: "all",
        track: "all",
        category: "all",
        sessionType: "all",
        driver: "all",
        team: "all",
        startDate: "",
        endDate: "",
        personalBests: false
    });

    const [selectedLaps, setSelectedLaps] = useState<number[]>([]);

    const toggleSelectAll = () => {
        if (selectedLaps.length === filteredLaps.length) {
            setSelectedLaps([]);
        } else {
            setSelectedLaps(filteredLaps.map(lap => lap.id));
        }
    };

    const toggleSelectLap = (lapId: number) => {
        setSelectedLaps(prev =>
            prev.includes(lapId) ? prev.filter(id => id !== lapId) : [...prev, lapId]
        );
    };

    const filteredLaps = useMemo(() => {
        return laps.filter(lap => {
            // Search term filter
            if (filters.searchTerm) {
                const searchLower = filters.searchTerm.toLowerCase();
                const matchesVehicle = lap.vehicles?.vehicle_name?.toLowerCase().includes(searchLower);
                const matchesTrack = lap.sessions?.track_name?.toLowerCase().includes(searchLower);
                const matchesCategory = lap.vehicles?.class_name?.toLowerCase().includes(searchLower);
                const matchesDriver = lap.vehicles?.driver_name?.toLowerCase().includes(searchLower);

                if (!matchesVehicle && !matchesTrack && !matchesCategory && !matchesDriver) {
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

            // Session type filter
            if (filters.sessionType !== "all") {
                if (lap.sessions?.session_type?.toString() !== filters.sessionType) {
                    return false;
                }
            }

            // Driver filter
            if (filters.driver !== "all") {
                if (lap.vehicles?.driver_name !== filters.driver) {
                    return false;
                }
            }

            // Team filter
            if (filters.team !== "all") {
                if (lap.vehicles?.class_name !== filters.team) {
                    return false;
                }
            }

            // Date range filter
            if (filters.startDate) {
                const startDate = new Date(filters.startDate);
                if (new Date(lap.lap_start_time) < startDate) {
                    return false;
                }
            }

            if (filters.endDate) {
                const endDate = new Date(filters.endDate);
                endDate.setHours(23, 59, 59, 999);
                if (new Date(lap.lap_start_time) > endDate) {
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

    const getSessionTypeLabel = (sessionType?: number | null) => {
        const mapping = filterData.sessionTypes.find(type => type.value === sessionType);
        return mapping?.label ?? "Session";
    };

    const getStatusBadge = (lap: LapWithDetails) => {
        if (lap.is_valid === false) {
            return <Badge variant="destructive">Invalid</Badge>;
        }

        if (lap.lap_summary) {
            return <Badge className="bg-emerald-500/10 text-emerald-600">Processed</Badge>;
        }

        return <Badge variant="outline">Pending</Badge>;
    };

    return (
        <div className="space-y-4">
            <LapFilters
                vehicles={filterData.vehicles}
                tracks={filterData.tracks}
                categories={filterData.categories}
                drivers={filterData.drivers}
                teams={filterData.teams}
                sessionTypes={filterData.sessionTypes}
                onFiltersChange={setFilters}
            />

            <Card>
                <CardContent className="space-y-4 pt-6">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <p className="text-sm text-muted-foreground">
                            {filteredLaps.length} of {laps.length} laps
                        </p>

                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">Selected {selectedLaps.length}</Badge>
                            <Button variant="outline" size="sm" disabled={selectedLaps.length === 0}>
                                <Tag className="h-4 w-4 mr-2" /> Tag
                            </Button>
                            <Button variant="outline" size="sm" disabled={selectedLaps.length === 0}>
                                <Share2 className="h-4 w-4 mr-2" /> Share
                            </Button>
                            <Button variant="default" size="sm" disabled={selectedLaps.length < 2}>
                                <GitCompare className="h-4 w-4 mr-2" /> Compare
                            </Button>
                        </div>
                    </div>

                    {filteredLaps.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground">
                            No laps found matching the current filters.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-muted-foreground">
                                        <th className="py-2 pr-2">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border"
                                                checked={selectedLaps.length === filteredLaps.length}
                                                onChange={toggleSelectAll}
                                            />
                                        </th>
                                        <th className="py-2 text-left">Lap</th>
                                        <th className="py-2 text-left">Track</th>
                                        <th className="py-2 text-left">Car</th>
                                        <th className="py-2 text-left">Session</th>
                                        <th className="py-2 text-left">Driver / Team</th>
                                        <th className="py-2 text-left">Date</th>
                                        <th className="py-2 text-left">Status</th>
                                        <th className="py-2 text-left">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredLaps.map(lap => (
                                        <tr key={lap.id} className="hover:bg-muted/40">
                                            <td className="py-3 pr-2 align-top">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border"
                                                    checked={selectedLaps.includes(lap.id)}
                                                    onChange={() => toggleSelectLap(lap.id)}
                                                />
                                            </td>
                                            <td className="py-3 align-top">
                                                <div className="font-semibold flex items-center gap-2">
                                                    <Timer className="h-4 w-4 text-muted-foreground" />
                                                    {lap.lap_time ? `${lap.lap_time.toFixed(3)}s` : "--"}
                                                </div>
                                                <p className="text-xs text-muted-foreground">Lap {lap.lap_number}</p>
                                            </td>
                                            <td className="py-3 align-top">
                                                <div className="font-medium">{lap.sessions?.track_name || "Unknown track"}</div>
                                                <p className="text-xs text-muted-foreground">{lap.sessions?.sim_name || "--"}</p>
                                            </td>
                                            <td className="py-3 align-top">
                                                <div className="font-medium">{lap.vehicles?.vehicle_name || "Unknown car"}</div>
                                                <p className="text-xs text-muted-foreground">{lap.vehicles?.class_name || "--"}</p>
                                            </td>
                                            <td className="py-3 align-top">
                                                <div className="text-sm font-medium">{getSessionTypeLabel(lap.sessions?.session_type)}</div>
                                                <p className="text-xs text-muted-foreground">{lap.lap_summary?.avg_speed ? `${lap.lap_summary.avg_speed.toFixed(1)} km/h avg` : "No telemetry"}</p>
                                            </td>
                                            <td className="py-3 align-top">
                                                <div className="text-sm font-medium">{lap.vehicles?.driver_name || lap.users?.name || "Unknown"}</div>
                                                <p className="text-xs text-muted-foreground">{lap.vehicles?.class_name || "Private"}</p>
                                            </td>
                                            <td className="py-3 align-top">
                                                <div className="text-sm font-medium">{new Date(lap.lap_start_time).toLocaleDateString()}</div>
                                                <p className="text-xs text-muted-foreground">{new Date(lap.lap_start_time).toLocaleTimeString()}</p>
                                            </td>
                                            <td className="py-3 align-top">{getStatusBadge(lap)}</td>
                                            <td className="py-3 align-top">
                                                <div className="flex flex-wrap gap-2">
                                                    <Button asChild size="sm">
                                                        <Link href={`/analyze/laps/${lap.id}`}>
                                                            <ArrowUpRight className="h-4 w-4 mr-2" /> Analyze
                                                        </Link>
                                                    </Button>
                                                    <Button asChild variant="outline" size="sm">
                                                        <Link href={`/comparisons?laps=${lap.id}`}>
                                                            <GitCompare className="h-4 w-4 mr-2" /> Compare
                                                        </Link>
                                                    </Button>
                                                    <Button asChild variant="ghost" size="sm">
                                                        <Link href={`/api/telemetry/laps?lapId=${lap.id}`}>
                                                            <Download className="h-4 w-4 mr-2" /> Export
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}