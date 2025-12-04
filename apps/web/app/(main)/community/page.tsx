import { Users, Filter, Compass } from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";

import { CommunityLapBrowser } from "./_components/community-lap-browser";
import { getSharedLaps } from "./_actions";

export default async function CommunityPage() {
    const { laps, filters } = await getSharedLaps();

    return (
        <div className="flex flex-col gap-6 p-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Badge variant="secondary" className="gap-1">
                            <Users className="h-4 w-4" />
                            Community Library
                        </Badge>
                        <span className="flex items-center gap-2 text-xs">
                            <Filter className="h-3 w-3" />
                            Find shared laps and comparison-ready data
                        </span>
                    </div>
                    <h1 className="text-3xl font-bold">Shared laps & comparisons</h1>
                    <p className="text-muted-foreground max-w-3xl">
                        Discover laps from the community with full track, car, and weather context. Jump straight into
                        Analyze Lap or fork a comparison into your workspace to review alongside your own data.
                    </p>
                </div>
                <Card className="w-full sm:w-auto min-w-[260px]">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium">
                            <Compass className="h-4 w-4" /> Library insights
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-1">
                        <div>Latest shared laps only</div>
                        <div>Filter by track, car, weather, or uploader</div>
                        <div>Fork comparisons into your workspace</div>
                    </CardContent>
                </Card>
            </div>

            <CommunityLapBrowser laps={laps} filters={filters} />
        </div>
    );
}
