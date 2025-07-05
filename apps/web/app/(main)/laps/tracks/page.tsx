import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Clock, MapPin, Calendar, Gamepad2 } from "lucide-react";
import Link from "next/link";
import { getTracks } from "./_actions";

function getSessionTypeName(sessionType: number | null): string {
    switch (sessionType) {
        case 0: return "Practice";
        case 1: return "Qualifying";
        case 2: return "Race";
        default: return "Session";
    }
}

export default async function TracksPage() {
    const tracks = await getTracks();

    return (
        <div className="flex flex-col gap-4 p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Your Tracks</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Tracks where you&apos;ve recorded lap times
                    </p>
                </CardHeader>
                <CardContent>
                    {tracks.length === 0 ? (
                        <p className="text-muted-foreground">No tracks found. Start a racing session to see your tracks here.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {tracks.map((track, index) => (
                                <Card key={`${track.track_name}-${index}`} className="hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2">
                                            <MapPin className="h-5 w-5" />
                                            {track.track_name || "Unknown Track"}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="text-xs">
                                                    {getSessionTypeName(track.session_type)}
                                                </Badge>
                                            </div>
                                            
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <Clock className="h-4 w-4" />
                                                <span>{track._count.laps} laps recorded</span>
                                            </div>
                                            
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Calendar className="h-3 w-3" />
                                                <span>
                                                    Last session: {track.created_at ? new Date(track.created_at).toLocaleDateString() : 'Unknown'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2 pt-2 border-t">
                                            <Button asChild size="sm" className="flex-1">
                                                <Link href={`/laps/track/${track.id}`}>
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