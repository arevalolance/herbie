"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertCircle, CloudRain, Filter, Loader2, Search, Sun, Users } from "lucide-react";

import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";

import { CommunityLapCard } from "@/components/community-lap-card";
import { forkCommunityComparison, SharedLapWithDetails } from "../_actions";

interface CommunityLapBrowserProps {
    laps: SharedLapWithDetails[];
    filters: {
        tracks: string[];
        vehicles: string[];
        uploaders: string[];
    };
}

type WeatherBucket = "all" | "dry" | "damp" | "wet" | "unknown";

function classifyWeather(wetness?: number | null): WeatherBucket {
    if (wetness === null || wetness === undefined) return "unknown";
    if (wetness >= 0.3) return "wet";
    if (wetness >= 0.1) return "damp";
    return "dry";
}

export function CommunityLapBrowser({ laps, filters }: CommunityLapBrowserProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [trackFilter, setTrackFilter] = useState<string>("all");
    const [vehicleFilter, setVehicleFilter] = useState<string>("all");
    const [uploaderFilter, setUploaderFilter] = useState<string>("all");
    const [weatherFilter, setWeatherFilter] = useState<WeatherBucket>("all");
    const [forkError, setForkError] = useState<string | null>(null);
    const [lastForkedId, setLastForkedId] = useState<number | null>(null);
    const [isForking, startForking] = useTransition();

    const filteredLaps = useMemo(() => {
        return laps.filter(lap => {
            const matchesSearch = (() => {
                if (!searchTerm) return true;
                const target = searchTerm.toLowerCase();
                const uploader = `${lap.users.first_name ?? ""} ${lap.users.last_name ?? ""}`.toLowerCase();
                return (
                    lap.sessions?.track_name?.toLowerCase().includes(target) ||
                    lap.vehicles?.vehicle_name?.toLowerCase().includes(target) ||
                    lap.vehicles?.class_name?.toLowerCase().includes(target) ||
                    uploader.includes(target)
                );
            })();

            if (!matchesSearch) return false;

            if (trackFilter !== "all" && lap.sessions?.track_name !== trackFilter) return false;
            if (vehicleFilter !== "all" && lap.vehicles?.vehicle_name !== vehicleFilter) return false;

            const uploader = `${lap.users.first_name ?? ""} ${lap.users.last_name ?? ""}`.trim() || "Anonymous Driver";
            if (uploaderFilter !== "all" && uploader !== uploaderFilter) return false;

            const weather = classifyWeather(lap.wetness);
            if (weatherFilter !== "all" && weather !== weatherFilter) return false;

            return true;
        });
    }, [laps, searchTerm, trackFilter, vehicleFilter, uploaderFilter, weatherFilter]);

    const handleForkComparison = (lapId: number) => {
        setForkError(null);
        startForking(async () => {
            try {
                const comparisonId = await forkCommunityComparison(lapId);
                setLastForkedId(comparisonId);
            } catch (error) {
                setForkError(error instanceof Error ? error.message : "Unable to fork comparison");
            }
        });
    };

    return (
        <div className="space-y-4">
            <CardSurface>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    <FilterField label="Search" description="Track, car, or uploader">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={searchTerm}
                                onChange={event => setSearchTerm(event.target.value)}
                                placeholder="e.g. Spa, GT3, rain"
                                className="pl-8"
                            />
                        </div>
                    </FilterField>

                    <FilterField label="Track">
                        <Select value={trackFilter} onValueChange={setTrackFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="All tracks" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All tracks</SelectItem>
                                {filters.tracks.map(track => (
                                    <SelectItem key={track} value={track}>
                                        {track}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FilterField>

                    <FilterField label="Car">
                        <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="All cars" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All cars</SelectItem>
                                {filters.vehicles.map(vehicle => (
                                    <SelectItem key={vehicle} value={vehicle}>
                                        {vehicle}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FilterField>

                    <FilterField label="Weather">
                        <Select value={weatherFilter} onValueChange={value => setWeatherFilter(value as WeatherBucket)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Any weather" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Any weather</SelectItem>
                                <SelectItem value="dry">Dry (&lt;10% wetness)</SelectItem>
                                <SelectItem value="damp">Damp (10-30% wetness)</SelectItem>
                                <SelectItem value="wet">Wet (&ge;30% wetness)</SelectItem>
                                <SelectItem value="unknown">Unknown</SelectItem>
                            </SelectContent>
                        </Select>
                    </FilterField>

                    <FilterField label="Uploader">
                        <Select value={uploaderFilter} onValueChange={setUploaderFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="All uploaders" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All uploaders</SelectItem>
                                {filters.uploaders.map(name => (
                                    <SelectItem key={name} value={name}>
                                        {name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FilterField>
                </div>
            </CardSurface>

            {forkError && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Fork failed</AlertTitle>
                    <AlertDescription>{forkError}</AlertDescription>
                </Alert>
            )}

            {lastForkedId && (
                <Alert>
                    <Users className="h-4 w-4" />
                    <AlertTitle>Comparison created</AlertTitle>
                    <AlertDescription>
                        Added to your workspace as comparison #{lastForkedId}. Open it from your comparisons list.
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Showing {filteredLaps.length} of {laps.length} shared laps
                </div>
                {isForking && (
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Forking comparison...
                    </div>
                )}
            </div>

            {filteredLaps.length === 0 ? (
                <CardSurface>
                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-3">
                        <Filter className="h-6 w-6" />
                        <p>No laps match the current filters. Try adjusting your search.</p>
                    </div>
                </CardSurface>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredLaps.map(lap => (
                        <CommunityLapCard
                            key={lap.id}
                            lap={lap}
                            showActions
                            onForkComparison={handleForkComparison}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function FilterField({
    label,
    description,
    children,
}: {
    label: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            <div className="flex flex-col gap-1">
                <Label className="text-sm">{label}</Label>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
            {children}
        </div>
    );
}

function CardSurface({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4">
            {children}
        </div>
    );
}

export function WeatherBadge({ wetness }: { wetness?: number | null }) {
    const bucket = classifyWeather(wetness);

    const icon = bucket === "wet" ? (
        <CloudRain className="h-3.5 w-3.5" />
    ) : bucket === "damp" ? (
        <CloudRain className="h-3.5 w-3.5" />
    ) : bucket === "dry" ? (
        <Sun className="h-3.5 w-3.5" />
    ) : (
        <AlertCircle className="h-3.5 w-3.5" />
    );

    const label = {
        dry: "Dry",
        damp: "Damp",
        wet: "Wet",
        unknown: "Unknown",
        all: "Any",
    }[bucket];

    return (
        <Badge variant={bucket === "dry" ? "secondary" : bucket === "unknown" ? "outline" : "default"} className="gap-1">
            {icon}
            {label}
        </Badge>
    );
}
