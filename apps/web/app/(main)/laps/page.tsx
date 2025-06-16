import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Clock, Car, MapPin, Trophy, TrendingUp } from "lucide-react";
import Link from "next/link";
import { LapCard } from "@/components/lap-card";
import { getRecentLaps, getLapStats } from "./_actions";

export default async function LapsPage() {
    const [recentLaps, stats] = await Promise.all([
        getRecentLaps(6),
        getLapStats()
    ]);

    return (
        <div className="flex flex-col gap-6 p-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Laps</h1>
                    <p className="text-muted-foreground">
                        Review your racing performance and telemetry data
                    </p>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Laps</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalLaps}</div>
                        <p className="text-xs text-muted-foreground">Valid laps recorded</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Personal Bests</CardTitle>
                        <Trophy className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.personalBests}</div>
                        <p className="text-xs text-muted-foreground">Track records achieved</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tracks</CardTitle>
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.uniqueTracks}</div>
                        <p className="text-xs text-muted-foreground">Different circuits</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Vehicles</CardTitle>
                        <Car className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.uniqueVehicles}</div>
                        <p className="text-xs text-muted-foreground">Cars driven</p>
                    </CardContent>
                </Card>
            </div>

            {/* Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Car className="h-5 w-5" />
                            Browse by Car
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            View laps organized by vehicle
                        </p>
                    </CardHeader>
                    <CardContent>
                        <Button asChild className="w-full">
                            <Link href="/laps/cars">View Cars</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MapPin className="h-5 w-5" />
                            Browse by Track
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            View laps organized by circuit
                        </p>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" className="w-full">
                            <Link href="/laps/tracks">View Tracks</Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Categories
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Personal bests, recent activity
                        </p>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline" className="w-full">
                            <Link href="/laps/categories">View Categories</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Laps */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Recent Laps</h2>
                    <Button asChild variant="outline" size="sm">
                        <Link href="/laps/all">View All</Link>
                    </Button>
                </div>

                {recentLaps.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center">
                            <p className="text-muted-foreground">
                                No laps found. Start a racing session to see your laps here.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recentLaps.map((lap) => (
                            <LapCard key={lap.id} lap={lap} showVehicleInfo={true} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}