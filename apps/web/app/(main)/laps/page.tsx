import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Clock, Car, MapPin, Trophy } from "lucide-react";
import { getLaps, getLapStats, getFilterData } from "./_actions";
import { FilteredLapsList } from "./_components/filtered-laps-list";

export default async function LapsPage() {
    const [laps, stats, filterData] = await Promise.all([
        getLaps(100),
        getLapStats(),
        getFilterData()
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

            {/* Laps with Filtering */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Your Laps</h2>
                
                <FilteredLapsList 
                    laps={laps}
                    filterData={filterData}
                />
            </div>
        </div>
    );
}