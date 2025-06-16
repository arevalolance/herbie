import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Clock, Car } from "lucide-react";
import Link from "next/link";
import { getCars } from "./_actions";

export default async function CarsPage() {
    const vehicles = await getCars();

    return (
        <div className="flex flex-col gap-4 p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Your Cars</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Vehicles you&apos;ve driven in your racing sessions
                    </p>
                </CardHeader>
                <CardContent>
                    {vehicles.length === 0 ? (
                        <p className="text-muted-foreground">No vehicles found. Start a racing session to see your cars here.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {vehicles.map((vehicle, index) => (
                                <Card key={`${vehicle.vehicle_name}-${vehicle.class_name}-${index}`} className="hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2">
                                            <Car className="h-5 w-5" />
                                            {vehicle.vehicle_name || "Unknown Vehicle"}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Badge variant="secondary" className="text-xs">
                                                {vehicle.class_name || "Unknown Class"}
                                            </Badge>
                                            
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <Clock className="h-4 w-4" />
                                                <span>{vehicle._count.laps} laps recorded</span>
                                            </div>
                                            
                                            {vehicle.sessions?.track_name && (
                                                <p className="text-sm text-muted-foreground">
                                                    Last driven on: {vehicle.sessions.track_name}
                                                </p>
                                            )}
                                            {vehicle.sessions?.created_at && (
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(vehicle.sessions.created_at).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                        
                                        <div className="flex gap-2 pt-2 border-t">
                                            <Button asChild size="sm" className="flex-1">
                                                <Link href={`/laps/cars/${vehicle.id}`}>
                                                    View Laps
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}