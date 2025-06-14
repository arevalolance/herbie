import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { getCars } from "./_actions";

export default async function CarsPage() {
    const vehicles = await getCars();

    return (
        <div className="flex flex-col gap-4 p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Your Cars</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Vehicles you've driven in your racing sessions
                    </p>
                </CardHeader>
                <CardContent>
                    {vehicles.length === 0 ? (
                        <p className="text-muted-foreground">No vehicles found. Start a racing session to see your cars here.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {vehicles.map((vehicle, index) => (
                                <Card key={`${vehicle.vehicle_name}-${vehicle.class_name}-${index}`} className="p-4">
                                    <div className="space-y-2">
                                        <h3 className="font-semibold text-lg">
                                            {vehicle.vehicle_name || "Unknown Vehicle"}
                                        </h3>
                                        <div className="space-y-1">
                                            <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors bg-secondary text-secondary-foreground">
                                                {vehicle.class_name || "Unknown Class"}
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
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}