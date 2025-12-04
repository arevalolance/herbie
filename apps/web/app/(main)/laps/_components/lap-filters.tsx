"use client";

import { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Input } from "@workspace/ui/components/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@workspace/ui/components/dropdown-menu";
import { Search, X, Filter, ChevronDown, Calendar, User, Users } from "lucide-react";

interface LapFiltersProps {
    vehicles: Array<{ id: number; vehicle_name: string | null; class_name: string | null }>;
    tracks: Array<{ id: number; track_name: string | null; sim_name: string | null }>;
    categories: Array<{ name: string | null }>;
    drivers: Array<{ name: string | null }>;
    teams: Array<{ name: string | null }>;
    sessionTypes: Array<{ value: number; label: string }>;
    onFiltersChange: (filters: FilterState) => void;
}

export interface FilterState {
    searchTerm: string;
    vehicle: string;
    track: string;
    category: string;
    sessionType: string;
    driver: string;
    team: string;
    startDate: string;
    endDate: string;
    personalBests: boolean;
}

export function LapFilters({ vehicles, tracks, categories, drivers, teams, sessionTypes, onFiltersChange }: LapFiltersProps) {
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

    const [showFilters, setShowFilters] = useState(false);

    const updateFilter = (key: keyof FilterState, value: string | boolean) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        onFiltersChange(newFilters);
    };

    const clearFilters = () => {
        const clearedFilters: FilterState = {
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
        };
        setFilters(clearedFilters);
        onFiltersChange(clearedFilters);
    };

    const hasActiveFilters = filters.searchTerm ||
        filters.vehicle !== "all" ||
        filters.track !== "all" ||
        filters.category !== "all" ||
        filters.sessionType !== "all" ||
        filters.driver !== "all" ||
        filters.team !== "all" ||
        filters.startDate !== "" ||
        filters.endDate !== "" ||
        filters.personalBests;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search laps..."
                        className="pl-10"
                        value={filters.searchTerm}
                        onChange={(e) => updateFilter("searchTerm", e.target.value)}
                    />
                </div>
                <Button
                    variant="outline"
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2"
                >
                    <Filter className="h-4 w-4" />
                    Filters
                    {hasActiveFilters && (
                        <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                            {[
                                filters.vehicle !== "all",
                                filters.track !== "all",
                                filters.category !== "all",
                                filters.sessionType !== "all",
                                filters.driver !== "all",
                                filters.team !== "all",
                                filters.startDate !== "",
                                filters.endDate !== "",
                                filters.personalBests
                            ].filter(Boolean).length}
                        </Badge>
                    )}
                </Button>
                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-4 w-4 mr-1" />
                        Clear
                    </Button>
                )}
            </div>

            {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Vehicle</label>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-between">
                                    {filters.vehicle === "all" ? "All Vehicles" : 
                                        vehicles.find(v => v.id.toString() === filters.vehicle)?.vehicle_name || "Unknown Vehicle"
                                    }
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56">
                                <DropdownMenuItem onClick={() => updateFilter("vehicle", "all")}>
                                    All Vehicles
                                </DropdownMenuItem>
                                {vehicles.map((vehicle) => (
                                    <DropdownMenuItem 
                                        key={vehicle.id} 
                                        onClick={() => updateFilter("vehicle", vehicle.id.toString())}
                                    >
                                        {vehicle.vehicle_name || "Unknown Vehicle"}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Track</label>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-between">
                                    {filters.track === "all" ? "All Tracks" : filters.track || "Unknown Track"}
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56">
                                <DropdownMenuItem onClick={() => updateFilter("track", "all")}>
                                    All Tracks
                                </DropdownMenuItem>
                                {tracks.map((track) => (
                                    <DropdownMenuItem 
                                        key={track.id} 
                                        onClick={() => updateFilter("track", track.track_name || "")}
                                    >
                                        {track.track_name || "Unknown Track"}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Category</label>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-between">
                                    {filters.category === "all" ? "All Categories" : filters.category || "Unknown Category"}
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56">
                                <DropdownMenuItem onClick={() => updateFilter("category", "all")}>
                                    All Categories
                                </DropdownMenuItem>
                                {categories.map((category, index) => (
                                    <DropdownMenuItem 
                                        key={index} 
                                        onClick={() => updateFilter("category", category.name || "")}
                                    >
                                        {category.name || "Unknown Category"}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Session Type</label>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-between">
                                    {filters.sessionType === "all"
                                        ? "All Sessions"
                                        : sessionTypes.find(type => type.value.toString() === filters.sessionType)?.label ?? "Session"}
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56">
                                <DropdownMenuItem onClick={() => updateFilter("sessionType", "all")}>
                                    All Sessions
                                </DropdownMenuItem>
                                {sessionTypes.map(type => (
                                    <DropdownMenuItem
                                        key={type.value}
                                        onClick={() => updateFilter("sessionType", type.value.toString())}
                                    >
                                        {type.label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <User className="h-4 w-4" /> Driver
                        </label>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-between">
                                    {filters.driver === "all" ? "All Drivers" : filters.driver || "Unknown Driver"}
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56">
                                <DropdownMenuItem onClick={() => updateFilter("driver", "all")}>All Drivers</DropdownMenuItem>
                                {drivers.map((driver, index) => (
                                    <DropdownMenuItem
                                        key={index}
                                        onClick={() => updateFilter("driver", driver.name || "")}
                                    >
                                        {driver.name || "Unknown Driver"}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Users className="h-4 w-4" /> Team
                        </label>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-between">
                                    {filters.team === "all" ? "All Teams" : filters.team || "Unknown Team"}
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56">
                                <DropdownMenuItem onClick={() => updateFilter("team", "all")}>All Teams</DropdownMenuItem>
                                {teams.map((team, index) => (
                                    <DropdownMenuItem
                                        key={index}
                                        onClick={() => updateFilter("team", team.name || "")}
                                    >
                                        {team.name || "Unknown Team"}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Calendar className="h-4 w-4" /> Date range
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <Input
                                type="date"
                                value={filters.startDate}
                                onChange={e => updateFilter("startDate", e.target.value)}
                            />
                            <Input
                                type="date"
                                value={filters.endDate}
                                onChange={e => updateFilter("endDate", e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Personal Bests</label>
                        <Button
                            variant={filters.personalBests ? "default" : "outline"}
                            className="w-full justify-start"
                            onClick={() => updateFilter("personalBests", !filters.personalBests)}
                        >
                            {filters.personalBests ? "PB Only" : "Show All"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}