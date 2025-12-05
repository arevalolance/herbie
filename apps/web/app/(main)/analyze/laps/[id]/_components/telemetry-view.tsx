'use client'

import React, { useMemo, useState, useCallback, useTransition, useEffect } from "react";
import { Prisma } from "@/generated/prisma";
import { Activity, Link2, Pin, PinOff, Save, Share2, Sparkles } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
        Select,
        SelectContent,
        SelectItem,
        SelectTrigger,
        SelectValue,
} from "@workspace/ui/components/select";

import { TrackMap, LapLine } from "@/components/metrics/track-map";
import { ZoomableChart } from "@/components/metrics/chart";
import {
        generateRacingLine,
        generateWorldRails,
        generateChartData,
        type TelemetryLog
} from "@/lib/track-map/utils";
import { createLapComparison } from "../_actions";
import { SessionNotebook } from "./session-notebook";
import { LapTimelineEntry, SessionNote } from "./session-notebook-types";

interface SectorFilterBarProps {
        sectorTimes: (number | null)[];
        lapTime: number;
        activeSectors: number[];
        toggleSector: (sector: number) => void;
}

const SectorFilterBar: React.FC<SectorFilterBarProps> = ({
        sectorTimes,
        lapTime,
        activeSectors,
        toggleSector,
}) => {
        return (
                <div className="flex z-10 select-none w-full">
                        {sectorTimes.map((time, idx) => {
                                const flexGrow = time && lapTime ? time / lapTime : 1 / sectorTimes.length;
                                const isActive = activeSectors.includes(idx);

                                return (
                                        <Button
                                                key={idx}
                                                onClick={() => toggleSector(idx)}
                                                style={{ flexGrow }}
                                                className={`!rounded-none flex items-center justify-center text-xs font-semibold uppercase tracking-wide min-w-0 flex-shrink-0`}
                                                variant={isActive ? "default" : "secondary"}
                                                size="sm"
                                        >
                                                S{idx + 1}
                                        </Button>
                                );
                        })}
                </div>
        );
};

function formatSeconds(time?: number | null) {
        if (time == null || isNaN(time)) return "—";
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
}

export function TelemetryView({
        lap,
        sessionNotes,
        lapTimeline,
        deepLinkSource,
}: {
        lap: Prisma.lapsGetPayload<{
                include: {
                        lap_summary: true;
                        timing_data: true;
                        sessions: { select: { track_name: true; sim_name: true } };
                        telemetry_logs: {
                                select: {
                                        id: true;
                                        lap_id: true;
                                        timestamp: true;
                                        session_elapsed: true;
                                        lap_progress: true;
                                        position_x: true;
                                        position_y: true;
                                        position_z: true;
                                        orientation_yaw: true;
                                        speed: true;
                                        accel_lateral: true;
                                        accel_longitudinal: true;
                                        accel_vertical: true;
                                        velocity_lateral: true;
                                        velocity_longitudinal: true;
                                        velocity_vertical: true;
                                        gear: true;
                                        rpm: true;
                                        throttle: true;
                                        brake: true;
                                        clutch: true;
                                        steering: true;
                                        fuel: true;
                                        track_edge: true;
                                        path_lateral: true;
                                        delta_to_best_time: true;
                                        delta_to_session_best_time: true;
                                        reference_lap_id: true;
                                };
                                include: {
                                        vehicle_state: true;
                                        wheel_data: true;
                                        input_data: true;
                                        tyre_data: true;
                                        brake_data: true;
                                        electric_motor_data: true;
                                };
                        };
                };
        }>;
        sessionNotes: SessionNote[];
        lapTimeline: LapTimelineEntry[];
        deepLinkSource?: string;
}) {
        const [activeSectors, setActiveSectors] = useState<number[]>([0, 1, 2]);
        const [showDeltaHotspots, setShowDeltaHotspots] = useState(false);
        const [comparisonTitle, setComparisonTitle] = useState(`Lap ${lap.lap_number} comparison`);
        const [comparisonNotes, setComparisonNotes] = useState("");
        const [lastComparisonId, setLastComparisonId] = useState<number | null>(null);
        const [saveError, setSaveError] = useState<string | null>(null);
        const [isSavingComparison, startSavingComparison] = useTransition();
        const telemetryLogs = lap.telemetry_logs;
        const searchParams = useSearchParams();
        const router = useRouter();
        const pathname = usePathname();
        const trackSlug = useMemo(
                () =>
                        (lap.sessions?.track_name ?? "unknown-track")
                                .toLowerCase()
                                .replace(/\s+/g, "-")
                                .replace(/[^a-z0-9-]/g, ""),
                [lap.sessions?.track_name]
        );
        const chartPresetStorageKey = `telemetry:preset:${trackSlug}`;
        const chartPinsStorageKey = `telemetry:pins:${trackSlug}`;
        const sectorPresetStorageKey = `telemetry:sectors:${trackSlug}`;
        const initialPinnedFromQuery = useMemo(
                () => {
                        const pins = searchParams?.get("pins");
                        return pins ? pins.split(",").filter(Boolean) : [];
                },
                [searchParams]
        );
        const initialPresetFromQuery = searchParams?.get("preset") ?? undefined;
        const initialSectorsFromQuery = useMemo(() => {
                const sectors = searchParams?.get("sectors");
                if (!sectors) return null;

                const parsed = sectors
                        .split(",")
                        .map((val) => Number.parseInt(val, 10))
                        .filter((num) => !Number.isNaN(num));

                return parsed.length ? parsed : null;
        }, [searchParams]);
        const [hasHydrated, setHasHydrated] = useState(false);
        const [pinnedCharts, setPinnedCharts] = useState<string[]>(initialPinnedFromQuery);
        const [activePreset, setActivePreset] = useState<string>(initialPresetFromQuery ?? "core");
        const [savedSectorPreset, setSavedSectorPreset] = useState<number[] | null>(null);

        const toggleSector = useCallback((sector: number) => {
                setActiveSectors((prev) =>
                        prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector].sort()
                );
        }, []);

        const sectorTimes = useMemo<(number | null)[]>(() => [
                lap.sector1_time ?? lap.timing_data?.[0]?.sector1_time ?? null,
                lap.sector2_time ?? lap.timing_data?.[0]?.sector2_time ?? null,
                lap.sector3_time ?? lap.timing_data?.[0]?.sector3_time ?? null,
        ], [lap.sector1_time, lap.sector2_time, lap.sector3_time, lap.timing_data]);

        const lapTime: number =
                lap.lap_time ?? sectorTimes.reduce<number>((sum, t) => sum + (t ?? 0), 0);

        const sectorBoundaries = useMemo<[number, number, number, number]>(() => {
                if (
                        lapTime > 0 &&
                        sectorTimes.every((t): t is number => t != null)
                ) {
                        const s1Time = sectorTimes[0] ?? 0;
                        const s2Time = sectorTimes[1] ?? 0;
                        const s1F = s1Time / lapTime;
                        const s2F = s2Time / lapTime;
                        return [0, s1F, s1F + s2F, 1];
                }
                return [0, 1 / 3, 2 / 3, 1];
        }, [lapTime, sectorTimes]);

        const filteredLogs = useMemo(() => {
                if (activeSectors.length === 3) return telemetryLogs;

                return telemetryLogs.filter((log) => {
                        const progress = typeof log.lap_progress === "number" ? log.lap_progress : Number(log.lap_progress);
                        if (progress === undefined || progress === null || isNaN(progress)) return false;

                        let idx = 2;
                        if (progress < sectorBoundaries[1]) idx = 0;
                        else if (progress < sectorBoundaries[2]) idx = 1;

                        return activeSectors.includes(idx);
                });
        }, [telemetryLogs, activeSectors, sectorBoundaries]);

        const lapLine: LapLine = useMemo(() =>
                generateRacingLine(lap.id, telemetryLogs as TelemetryLog[]),
                [lap.id, telemetryLogs]
        );

        const chartData = useMemo(() =>
                generateChartData(filteredLogs as TelemetryLog[]),
                [filteredLogs]
        );

        const worldRails: LapLine[] = useMemo(() =>
                generateWorldRails(lap.id, telemetryLogs as TelemetryLog[]),
                [lap.id, telemetryLogs]
        );

        const deltaHotspots = useMemo(() => {
                const candidates = telemetryLogs
                        .map((log, index) => {
                                const delta = (log.delta_to_session_best_time ?? log.delta_to_best_time);
                                if (delta == null || log.position_x == null || log.position_y == null) return null;

                                const progress = typeof log.lap_progress === "number"
                                        ? log.lap_progress
                                        : Number(log.lap_progress ?? 0);

                                return {
                                        index,
                                        delta: Number(delta),
                                        progress,
                                        x: Number(log.position_x),
                                        y: Number(log.position_y),
                                };
                        })
                        .filter(Boolean) as Array<{ index: number; delta: number; progress: number; x: number; y: number }>;

                const sorted = [...candidates].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
                return sorted.slice(0, 5);
        }, [telemetryLogs]);

        const availableChartIds = useMemo(
                () => chartData.map((chart) => chart.id).filter((id): id is string => Boolean(id)),
                [chartData]
        );

        const chartPresets = useMemo(
                () => [
                        {
                                id: "core",
                                label: "Driving inputs",
                                charts: ["speed", "throttle", "brake", "steering"],
                        },
                        {
                                id: "chassis",
                                label: "Ride & tires",
                                charts: ["ride-height", "tire-temp", "tire-pressure"],
                        },
                        {
                                id: "energy",
                                label: "Fuel / ERS",
                                charts: ["fuel", "ers"],
                        },
                        {
                                id: "all",
                                label: "All available",
                                charts: availableChartIds,
                        },
                ],
                [availableChartIds]
        );

        useEffect(() => {
                if (hasHydrated || typeof window === "undefined") return;

                const storedPreset = localStorage.getItem(chartPresetStorageKey);
                const storedPinsRaw = localStorage.getItem(chartPinsStorageKey);
                const storedSectors = localStorage.getItem(sectorPresetStorageKey);

                if (!initialPresetFromQuery && storedPreset) {
                        setActivePreset(storedPreset);
                }

                if (initialSectorsFromQuery) {
                        setActiveSectors(initialSectorsFromQuery);
                        setSavedSectorPreset(initialSectorsFromQuery);
                } else if (storedSectors) {
                        const parsed = JSON.parse(storedSectors) as number[];
                        if (Array.isArray(parsed) && parsed.length) {
                                setActiveSectors(parsed);
                                setSavedSectorPreset(parsed);
                        }
                }

                if (storedPinsRaw) {
                        const pins = JSON.parse(storedPinsRaw) as string[];
                        const mergedPins = Array.from(new Set([...initialPinnedFromQuery, ...pins])).filter((pin) =>
                                availableChartIds.includes(pin)
                        );
                        setPinnedCharts(mergedPins);
                } else if (initialPinnedFromQuery.length) {
                        const filteredPins = initialPinnedFromQuery.filter((pin) => availableChartIds.includes(pin));
                        setPinnedCharts(filteredPins);
                }

                setHasHydrated(true);
        }, [
                availableChartIds,
                chartPinsStorageKey,
                chartPresetStorageKey,
                hasHydrated,
                initialPinnedFromQuery,
                initialPresetFromQuery,
                initialSectorsFromQuery,
                sectorPresetStorageKey,
        ]);

        useEffect(() => {
                if (!hasHydrated || typeof window === "undefined") return;

                localStorage.setItem(chartPresetStorageKey, activePreset);
        }, [activePreset, chartPresetStorageKey, hasHydrated]);

        useEffect(() => {
                if (!hasHydrated || typeof window === "undefined") return;

                localStorage.setItem(chartPinsStorageKey, JSON.stringify(pinnedCharts));
        }, [chartPinsStorageKey, hasHydrated, pinnedCharts]);

        useEffect(() => {
                if (!hasHydrated) return;

                const params = new URLSearchParams(searchParams?.toString());
                const pinsValue = pinnedCharts.join(",");
                const sectorsValue = activeSectors.join(",");

                const currentPreset = params.get("preset");

                if (currentPreset !== activePreset) params.set("preset", activePreset);
                if (pinsValue) params.set("pins", pinsValue);
                else params.delete("pins");

                if (sectorsValue) params.set("sectors", sectorsValue);
                else params.delete("sectors");

                const nextQuery = params.toString();
                if (searchParams?.toString() !== nextQuery) {
                        router.replace(`${pathname}?${nextQuery}`, { scroll: false });
                }
        }, [activePreset, activeSectors, hasHydrated, pathname, pinnedCharts, router, searchParams]);

        const togglePinnedChart = useCallback((chartId?: string) => {
                if (!chartId) return;
                setPinnedCharts((prev) =>
                        prev.includes(chartId) ? prev.filter((id) => id !== chartId) : [...prev, chartId]
                );
        }, []);

        const applySavedSectors = useCallback(() => {
                if (savedSectorPreset && savedSectorPreset.length) {
                        setActiveSectors(savedSectorPreset);
                }
        }, [savedSectorPreset]);

        const saveSectorPreset = useCallback(() => {
                if (typeof window === "undefined") return;
                localStorage.setItem(sectorPresetStorageKey, JSON.stringify(activeSectors));
                setSavedSectorPreset(activeSectors);
        }, [activeSectors, sectorPresetStorageKey]);

        const resetSectors = useCallback(() => setActiveSectors([0, 1, 2]), []);

        const chartsFromPreset = useMemo(() => {
                const preset = chartPresets.find((preset) => preset.id === activePreset) ?? chartPresets[0];
                return preset?.charts ?? [];
        }, [activePreset, chartPresets]);

        const chartsToRender = useMemo(() => {
                const desired = Array.from(new Set([...pinnedCharts, ...chartsFromPreset]));

                return desired
                        .map((id) => chartData.find((chart) => chart.id === id))
                        .filter((chart): chart is typeof chartData[number] => Boolean(chart));
        }, [chartData, chartsFromPreset, pinnedCharts]);

        const copyDeepLink = useCallback(() => {
                if (typeof window === "undefined") return;
                navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
        }, []);

        const deltaHotspotLines: LapLine[] = useMemo(() => {
                if (!deltaHotspots.length) return [];

                return deltaHotspots.map((hotspot, idx) => {
                        const windowStart = Math.max(0, hotspot.index - 8);
                        const windowEnd = Math.min(telemetryLogs.length, hotspot.index + 8);
                        const points = telemetryLogs
                                .slice(windowStart, windowEnd)
                                .map((log) => {
                                        if (log.position_x == null || log.position_y == null) return null;
                                        return { x: Number(log.position_x), y: Number(log.position_y) };
                                })
                                .filter(Boolean) as LapLine["points"];

                        return {
                                id: `${lap.id}-delta-${idx}`,
                                points,
                                color: "#f97316",
                                highlight: true,
                        };
                });
        }, [deltaHotspots, lap.id, telemetryLogs]);

        const mapLines = useMemo(() => (
                showDeltaHotspots ? [...worldRails, lapLine, ...deltaHotspotLines] : [...worldRails, lapLine]
        ), [deltaHotspotLines, lapLine, showDeltaHotspots, worldRails]);

        const sectorBreakdown = useMemo(() => {
                const fastestSector = Math.min(...sectorTimes.filter((t): t is number => t != null));
                return sectorTimes.map((time, idx) => {
                        const share = time && lapTime ? (time / lapTime) * 100 : null;
                        const delta = time != null && !isNaN(time) && fastestSector !== Infinity
                                ? time - fastestSector
                                : null;
                        return {
                                name: `Sector ${idx + 1}`,
                                time,
                                share,
                                delta,
                        };
                });
        }, [lapTime, sectorTimes]);

        const checkpointSplits = useMemo(() => {
                const checkpoints = [0.25, 0.5, 0.75, 1];

                return checkpoints.map((fraction) => {
                        const closest = telemetryLogs.reduce<{
                                distance: number;
                                log: typeof telemetryLogs[number] | null;
                        }>((best, log) => {
                                const progress = typeof log.lap_progress === "number"
                                        ? log.lap_progress
                                        : Number(log.lap_progress ?? 0);
                                if (progress == null || isNaN(progress)) return best;

                                const distance = Math.abs(progress - fraction);
                                if (!best.log || distance < best.distance) {
                                        return { distance, log };
                                }
                                return best;
                        }, { distance: Number.MAX_VALUE, log: null });

                        const delta = closest.log?.delta_to_session_best_time ?? closest.log?.delta_to_best_time ?? null;
                        const speed = closest.log?.speed ?? null;

                        return {
                                label: `${Math.round(fraction * 100)}%`,
                                delta,
                                speed,
                        };
                });
        }, [telemetryLogs]);

        const onSaveComparison = useCallback((event: React.FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                setSaveError(null);

                startSavingComparison(async () => {
                        try {
                                const createdId = await createLapComparison({
                                        lapIds: [lap.id],
                                        title: comparisonTitle,
                                        description: comparisonNotes,
                                });
                                setLastComparisonId(createdId);
                        } catch (error) {
                                setSaveError(error instanceof Error ? error.message : "Unable to save comparison");
                        }
                });
        }, [comparisonNotes, comparisonTitle, lap.id, startSavingComparison]);

        return (
                <div className="flex flex-col gap-6">
                        <SessionNotebook
                                sessionId={lap.session_id}
                                lapId={lap.id}
                                initialNotes={sessionNotes}
                                lapTimeline={lapTimeline}
                        />

                        {deepLinkSource && (
                                <Card>
                                        <CardContent className="flex items-center gap-3 py-3">
                                                <Link2 className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                        <p className="text-sm font-semibold">Opened from {deepLinkSource}</p>
                                                        <p className="text-xs text-muted-foreground">You can bookmark this URL to revisit the exact lap view.</p>
                                                </div>
                                        </CardContent>
                                </Card>
                        )}

                        <div className="grid gap-6 lg:grid-cols-3 items-start">
                                <Card className="lg:col-span-2">
                                        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                                <div className="space-y-1">
                                                        <CardTitle className="text-xl">Track map & sectors</CardTitle>
                                                        <p className="text-sm text-muted-foreground">
                                                                {lap.sessions?.track_name ?? "Session"} · {lap.sessions?.sim_name ?? "Unknown sim"}
                                                        </p>
                                                </div>
                                                <div className="flex gap-2">
                                                        <Button
                                                                variant={showDeltaHotspots ? "default" : "secondary"}
                                                                size="sm"
                                                                onClick={() => setShowDeltaHotspots((prev) => !prev)}
                                                                className="gap-2"
                                                        >
                                                                <Sparkles className="h-4 w-4" />
                                                                Highlight biggest deltas
                                                        </Button>
                                                </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                                <div className="h-[420px] w-full rounded-lg border bg-background/50">
                                                        <TrackMap
                                                                laps={mapLines}
                                                                className="h-full w-full"
                                                                strokeWidth={1.5}
                                                                showHoverMarker
                                                                hoverRadius={36}
                                                        />
                                                </div>

                                                <SectorFilterBar
                                                        sectorTimes={sectorTimes}
                                                        lapTime={lapTime}
                                                        activeSectors={activeSectors}
                                                        toggleSector={toggleSector}
                                                />
                                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                                <Badge variant="outline">{lap.sessions?.track_name ?? "Track"}</Badge>
                                                                <span>Sector preset saved locally</span>
                                                                {savedSectorPreset && savedSectorPreset.length > 0 && (
                                                                        <span className="text-[11px]">
                                                                                Saved: {savedSectorPreset.map((s) => `S${s + 1}`).join(", ")}
                                                                        </span>
                                                                )}
                                                        </div>
                                                        <div className="flex gap-2">
                                                                <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={applySavedSectors}
                                                                        disabled={!savedSectorPreset?.length}
                                                                >
                                                                        Load track preset
                                                                </Button>
                                                                <Button variant="ghost" size="sm" onClick={resetSectors}>
                                                                        Reset to all
                                                                </Button>
                                                                <Button variant="secondary" size="sm" onClick={saveSectorPreset}>
                                                                        Save sectors
                                                                </Button>
                                                        </div>
                                                </div>
                                        </CardContent>
                                </Card>

                                <div className="space-y-4">
                                        <Card>
                                                <CardHeader>
                                                        <CardTitle className="text-base flex items-center gap-2">
                                                                <Activity className="h-4 w-4" /> Split tables
                                                        </CardTitle>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                        <div className="rounded-lg border">
                                                                <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground">
                                                                        <span>Sector</span>
                                                                        <span className="text-right">Time</span>
                                                                        <span className="text-right">Lap %</span>
                                                                        <span className="text-right">Δ vs best</span>
                                                                </div>
                                                                {sectorBreakdown.map((sector) => (
                                                                        <div key={sector.name} className="grid grid-cols-4 gap-2 px-3 py-2 text-sm border-t">
                                                                                <span>{sector.name}</span>
                                                                                <span className="text-right font-mono">{formatSeconds(sector.time)}</span>
                                                                                <span className="text-right text-muted-foreground">
                                                                                        {sector.share != null ? `${sector.share.toFixed(1)}%` : "—"}
                                                                                </span>
                                                                                <span className="text-right text-muted-foreground">
                                                                                        {sector.delta != null ? `+${sector.delta.toFixed(3)}s` : "—"}
                                                                                </span>
                                                                        </div>
                                                                ))}
                                                        </div>

                                                        <div className="rounded-lg border">
                                                                <div className="grid grid-cols-3 gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground">
                                                                        <span>Checkpoint</span>
                                                                        <span className="text-right">Speed</span>
                                                                        <span className="text-right">Delta</span>
                                                                </div>
                                                                {checkpointSplits.map((split) => (
                                                                        <div key={split.label} className="grid grid-cols-3 gap-2 px-3 py-2 text-sm border-t">
                                                                                <span>{split.label}</span>
                                                                                <span className="text-right text-muted-foreground">{split.speed ? `${split.speed.toFixed(1)} km/h` : "—"}</span>
                                                                                <span className="text-right font-mono">
                                                                                        {split.delta != null ? `${split.delta >= 0 ? "+" : ""}${split.delta.toFixed(3)}s` : "—"}
                                                                                </span>
                                                                        </div>
                                                                ))}
                                                        </div>
                                                </CardContent>
                                        </Card>

                                        <Card>
                                                <CardHeader>
                                                        <CardTitle className="text-base flex items-center gap-2">
                                                                <Save className="h-4 w-4" /> Save as comparison
                                                        </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                        <form className="space-y-3" onSubmit={onSaveComparison}>
                                                                <div className="space-y-1">
                                                                        <Label htmlFor="comparisonTitle">Title</Label>
                                                                        <Input
                                                                                id="comparisonTitle"
                                                                                value={comparisonTitle}
                                                                                onChange={(e) => setComparisonTitle(e.target.value)}
                                                                                placeholder="Name this comparison"
                                                                                required
                                                                        />
                                                                </div>
                                                                <div className="space-y-1">
                                                                        <Label htmlFor="comparisonNotes">Notes (optional)</Label>
                                                                        <textarea
                                                                                id="comparisonNotes"
                                                                                value={comparisonNotes}
                                                                                onChange={(e) => setComparisonNotes(e.target.value)}
                                                                                className="flex h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                                                placeholder="What should this be compared against?"
                                                                        />
                                                                </div>
                                                                <div className="flex items-center justify-between gap-2">
                                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                                <Badge variant={showDeltaHotspots ? "default" : "outline"}>
                                                                                        {showDeltaHotspots ? "Delta markers on" : "Delta markers off"}
                                                                                </Badge>
                                                                                {lastComparisonId && (
                                                                                        <Badge variant="secondary">Saved as #{lastComparisonId}</Badge>
                                                                                )}
                                                                                {saveError && (
                                                                                        <span className="text-destructive">{saveError}</span>
                                                                                )}
                                                                        </div>
                                                                        <Button type="submit" disabled={isSavingComparison} className="gap-2">
                                                                                <Save className="h-4 w-4" />
                                                                                {isSavingComparison ? "Saving..." : "Save comparison"}
                                                                        </Button>
                                                                </div>
                                                        </form>
                                                </CardContent>
                                        </Card>
                                </div>
                        </div>

                        <Card>
                                <CardHeader>
                                        <CardTitle className="text-base">Telemetry traces</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                                <div className="space-y-1">
                                                        <p className="text-sm font-medium">Preset charts</p>
                                                        <p className="text-xs text-muted-foreground">
                                                                Speed, inputs, chassis, and energy charts are organized into presets per track.
                                                                Pinned charts always stay visible.
                                                        </p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                        <Select value={activePreset} onValueChange={setActivePreset}>
                                                                <SelectTrigger className="w-[200px]">
                                                                        <SelectValue placeholder="Choose charts" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                        {chartPresets.map((preset) => (
                                                                                <SelectItem key={preset.id} value={preset.id}>
                                                                                        {preset.label}
                                                                                </SelectItem>
                                                                        ))}
                                                                </SelectContent>
                                                        </Select>
                                                        <Button variant="secondary" size="sm" className="gap-2" onClick={copyDeepLink}>
                                                                <Share2 className="h-4 w-4" />
                                                                Copy deep link
                                                        </Button>
                                                </div>
                                        </div>

                                        {pinnedCharts.length > 0 && (
                                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                        <Badge variant="outline">Pinned</Badge>
                                                        {pinnedCharts.map((pin) => (
                                                                <Badge key={pin} variant="secondary">
                                                                        {pin}
                                                                </Badge>
                                                        ))}
                                                </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {chartsToRender.length === 0 && (
                                                        <div className="col-span-2 text-sm text-muted-foreground">
                                                                No telemetry charts are available for this lap.
                                                        </div>
                                                )}
                                                {chartsToRender.map((chart) => (
                                                        <div
                                                                key={chart.id ?? chart.title}
                                                                className="rounded-lg border bg-muted/30 p-2 space-y-2"
                                                        >
                                                                <div className="flex items-center justify-between gap-2">
                                                                        <p className="text-sm font-semibold leading-none">
                                                                                {chart.title}
                                                                        </p>
                                                                        <Button
                                                                                variant={pinnedCharts.includes(chart.id ?? "") ? "default" : "ghost"}
                                                                                size="icon"
                                                                                onClick={() => togglePinnedChart(chart.id)}
                                                                                aria-pressed={pinnedCharts.includes(chart.id ?? "")}
                                                                                className="h-8 w-8"
                                                                        >
                                                                                {pinnedCharts.includes(chart.id ?? "") ? (
                                                                                        <Pin className="h-4 w-4" />
                                                                                ) : (
                                                                                        <PinOff className="h-4 w-4" />
                                                                                )}
                                                                        </Button>
                                                                </div>
                                                                <div className="h-36 md:h-44">
                                                                        <ZoomableChart
                                                                                data={chart.data}
                                                                                title={chart.title}
                                                                                syncId="lapAnalysis"
                                                                        />
                                                                </div>
                                                        </div>
                                                ))}
                                        </div>
                                </CardContent>
                        </Card>
                </div>
        );
}
