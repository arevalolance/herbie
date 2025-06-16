import { Card, CardContent } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { ArrowLeft, Filter } from "lucide-react";
import Link from "next/link";
import { LapCard } from "@/components/lap-card";
import { getLaps } from "../_actions";

export default async function AllLapsPage() {
    const laps = await getLaps(50); // Show more laps on the dedicated page

    return (
        <div className="flex flex-col gap-6 p-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button asChild variant="outline" size="sm">
                        <Link href="/laps">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Overview
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">All Laps</h1>
                        <p className="text-muted-foreground">
                            Complete history of your racing sessions
                        </p>
                    </div>
                </div>
                
                <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                        <Filter className="h-4 w-4 mr-2" />
                        Filter
                    </Button>
                </div>
            </div>

            {/* Laps List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">{laps.length} Laps Found</h2>
                    <div className="text-sm text-muted-foreground">
                        Sorted by date (newest first)
                    </div>
                </div>

                {laps.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center">
                            <p className="text-muted-foreground">
                                No valid laps found. Start a racing session to see your laps here.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {laps.map((lap) => (
                            <LapCard key={lap.id} lap={lap} showVehicleInfo={true} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}