import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Clock, Gauge, MapPin, Calendar, User } from "lucide-react";
import { Prisma } from "@/generated/prisma";

type CommunityLapWithDetails = Prisma.lapsGetPayload<{
    include: {
        vehicles: { select: { vehicle_name: true; class_name: true } };
        sessions: { select: { track_name: true; sim_name: true; session_type: true } };
        lap_summary: { select: { max_speed: true; avg_speed: true } };
        users: { select: { first_name: true; last_name: true; profile_picture_url: true; created_at: true } };
    };
}>;

interface CommunityLapCardProps {
    lap: CommunityLapWithDetails;
}

function formatLapTime(timeInSeconds: number | null): string {
    if (!timeInSeconds) return "N/A";
    
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = (timeInSeconds % 60).toFixed(3);
    
    return `${minutes}:${seconds.padStart(6, '0')}`;
}

function formatSpeed(speed: number | null): string {
    if (!speed) return "N/A";
    return `${speed.toFixed(1)} km/h`;
}

function getSessionTypeName(sessionType: number | null): string {
    switch (sessionType) {
        case 0: return "Practice";
        case 1: return "Qualifying";
        case 2: return "Race";
        default: return "Session";
    }
}

function getUserDisplayName(user: { first_name: string | null; last_name: string | null }): string {
    if (user.first_name && user.last_name) {
        return `${user.first_name} ${user.last_name}`;
    } else if (user.first_name) {
        return user.first_name;
    } else if (user.last_name) {
        return user.last_name;
    }
    return "Anonymous Driver";
}

function getUserInitials(user: { first_name: string | null; last_name: string | null }): string {
    const firstName = user.first_name?.charAt(0) || "";
    const lastName = user.last_name?.charAt(0) || "";
    return firstName + lastName || "AD";
}

export function CommunityLapCard({ lap }: CommunityLapCardProps) {
    const displayName = getUserDisplayName(lap.users);
    const initials = getUserInitials(lap.users);

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                                <AvatarImage src={lap.users.profile_picture_url || undefined} />
                                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm">{displayName}</span>
                        </div>
                        <CardTitle className="text-lg">
                            Lap {lap.lap_number}
                            {lap.is_personal_best && (
                                <Badge variant="default" className="ml-2 text-xs">
                                    PB
                                </Badge>
                            )}
                        </CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" suppressHydrationWarning />
                            <span>{lap.sessions?.track_name || "Unknown Track"}</span>
                            <Badge variant="outline" className="text-xs">
                                {getSessionTypeName(lap.sessions?.session_type)}
                            </Badge>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center gap-1 text-lg font-mono font-semibold">
                            <Clock className="h-4 w-4" suppressHydrationWarning />
                            {formatLapTime(lap.lap_time)}
                        </div>
                    </div>
                </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <h4 className="font-medium text-sm">Vehicle</h4>
                    <div className="flex items-center gap-2">
                        <span className="font-medium">
                            {lap.vehicles?.vehicle_name || "Unknown Vehicle"}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                            {lap.vehicles?.class_name || "Unknown Class"}
                        </Badge>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                        <div className="text-muted-foreground">Sectors</div>
                        <div className="font-mono text-xs space-y-1">
                            <div>S1: {formatLapTime(lap.sector1_time)}</div>
                            <div>S2: {formatLapTime(lap.sector2_time)}</div>
                            <div>S3: {formatLapTime(lap.sector3_time)}</div>
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <div className="text-muted-foreground">Speed</div>
                        <div className="space-y-1">
                            {lap.lap_summary?.max_speed && (
                                <div className="flex items-center gap-1 text-xs">
                                    <Gauge className="h-3 w-3" suppressHydrationWarning />
                                    <span>Max: {formatSpeed(lap.lap_summary.max_speed)}</span>
                                </div>
                            )}
                            {lap.lap_summary?.avg_speed && (
                                <div className="text-xs text-muted-foreground">
                                    Avg: {formatSpeed(lap.lap_summary.avg_speed)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" suppressHydrationWarning />
                        {new Date(lap.lap_start_time).toLocaleDateString()}
                    </div>
                    
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" suppressHydrationWarning />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}