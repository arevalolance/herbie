import { getLapsByVehicle } from "../_actions";
import { LapCard } from "@/components/lap-card";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { ArrowLeft, Car, Clock, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
    params: Promise<{
        vehicleId: string;
    }>;
}

function formatLapTime(timeInSeconds: number | null | undefined): string {
    if (!timeInSeconds) return "N/A";
    
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = (timeInSeconds % 60).toFixed(3);
    
    return `${minutes}:${seconds.padStart(6, '0')}`;
}

export default async function VehicleLapsPage({ params }: PageProps) {
    const { vehicleId } = await params;
    const { vehicle, laps } = await getLapsByVehicle(vehicleId);
    
    if (!vehicle) {
        notFound();
    }

    // Calculate statistics
    const totalLaps = laps.length;
    const personalBests = laps.filter(lap => lap.is_personal_best).length;
    const bestLapTime = laps.length > 0 ? laps[0]?.lap_time : null; // Already sorted by fastest first

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" asChild>
                    <Link href="/laps/cars">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Cars
                    </Link>
                </Button>
                <div className="flex items-center gap-3">
                    <Car className="h-6 w-6" />
                    <div>
                        <h1 className="text-2xl font-bold">{vehicle.vehicle_name}</h1>
                        <Badge variant="secondary" className="mt-1">
                            {vehicle.class_name}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Laps</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalLaps}</div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Trophy className="h-4 w-4" />
                            Personal Bests
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{personalBests}</div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Best Lap Time
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono">
                            {formatLapTime(bestLapTime)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Laps List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">
                        All Laps ({totalLaps})
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Sorted by lap time (fastest first)
                    </p>
                </div>
                
                {laps.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center">
                            <p className="text-muted-foreground">
                                No laps found for this vehicle.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {laps.map((lap) => (
                            <LapCard 
                                key={lap.id} 
                                lap={lap} 
                                showVehicleInfo={false} 
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}