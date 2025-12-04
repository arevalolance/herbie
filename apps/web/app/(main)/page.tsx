import { Suspense } from "react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { withAuth, signOut } from "@workos-inc/authkit-nextjs"
import Link from "next/link"
import { syncUserToDatabase } from "../../lib/auth-sync"
import {
  getOverviewStats,
  getRecentActivity,
  getQuickNavigation,
  getCommunityActivity,
  getDashboardHighlights,
} from "./_actions"
import { LapCard } from "@/components/lap-card"
import { CommunityLapCard } from "@/components/community-lap-card"
import {
  Activity,
  AlertCircle,
  Car,
  Clock,
  Compass,
  Gauge,
  Link2,
  MapPin,
  Target,
  ThermometerSun,
  Timer,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react"

function formatTime(seconds: number | null): string {
  if (!seconds) return "N/A"

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  } else {
    return `${secs}s`
  }
}

function formatDistance(meters: number | null): string {
  if (!meters) return "N/A"

  const km = meters / 1000
  return `${km.toFixed(1)} km`
}

function formatLapTime(timeInSeconds: number | null): string {
  if (!timeInSeconds) return "N/A"

  const minutes = Math.floor(timeInSeconds / 60)
  const seconds = (timeInSeconds % 60).toFixed(3)

  return `${minutes}:${seconds.padStart(6, "0")}`
}

function formatTemperature(value: number | null | undefined) {
  if (value === null || value === undefined) return "--"
  return `${value.toFixed(1)}°C`
}

function getSessionTypeName(sessionType: number | null): string {
  switch (sessionType) {
    case 0:
      return "Practice"
    case 1:
      return "Qualifying"
    case 2:
      return "Race"
    default:
      return "Session"
  }
}

function getLapStatusBadge(lap?: { is_valid?: boolean } | null, hasSummary?: boolean) {
  if (lap?.is_valid === false) {
    return <Badge variant="destructive">Failed</Badge>
  }

  if (hasSummary) {
    return <Badge className="bg-emerald-500/10 text-emerald-600">Processed</Badge>
  }

  return <Badge variant="outline">Needs data</Badge>
}

type WeatherProps = {
  ambient?: number | null
  track?: number | null
  wetness?: number | null
  raininess?: number | null
}

function WeatherSummary({ ambient, track, wetness, raininess }: WeatherProps) {
  const hasWeather = ambient !== undefined || track !== undefined || wetness !== undefined || raininess !== undefined

  if (!hasWeather) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <ThermometerSun className="h-4 w-4" />
        Weather data unavailable
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <ThermometerSun className="h-4 w-4" />
        Ambient {formatTemperature(ambient)}
      </div>
      <div className="flex items-center gap-1">
        <Gauge className="h-4 w-4" />
        Track {formatTemperature(track)}
      </div>
      <div className="flex items-center gap-1">
        <Clock className="h-4 w-4" />
        Wetness {wetness !== null && wetness !== undefined ? `${(wetness * 100).toFixed(0)}%` : "--"}
      </div>
      {raininess !== undefined && raininess !== null && (
        <div className="flex items-center gap-1">
          <Activity className="h-4 w-4" />
          Rain {(raininess * 100).toFixed(0)}%
        </div>
      )}
    </div>
  )
}

function HighlightCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-4 w-28" />
      </CardContent>
    </Card>
  )
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-20" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-3 w-28 mt-2" />
      </CardContent>
    </Card>
  )
}

function SectionSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  )
}

async function Highlights({
  highlightsPromise,
}: {
  highlightsPromise: ReturnType<typeof getDashboardHighlights>
}) {
  const highlights = await highlightsPromise

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Latest session
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!highlights.latestSession && (
            <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <p>No sessions yet. Upload a session to see details here.</p>
            </div>
          )}

          {highlights.latestSession && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-lg font-semibold">
                    {highlights.latestSession.track_name || "Unknown track"}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Compass className="h-4 w-4" />
                    {highlights.latestSession.sim_name || "Unknown sim"}
                    <Badge variant="outline" className="text-xs">
                      {getSessionTypeName(highlights.latestSession.session_type)}
                    </Badge>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {highlights.latestSession._count?.laps || 0} laps
                </Badge>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Fastest lap</div>
                    <div className="text-lg font-semibold">
                      {formatLapTime(highlights.latestSession.laps?.[0]?.lap_time ?? null)}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Car className="h-4 w-4" />
                      {highlights.latestSession.laps?.[0]?.vehicles?.vehicle_name || "Unknown car"}
                      {highlights.latestSession.laps?.[0]?.vehicles?.class_name && (
                        <Badge variant="outline" className="text-[11px]">
                          {highlights.latestSession.laps?.[0]?.vehicles?.class_name}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {getLapStatusBadge(
                    highlights.latestSession.laps?.[0],
                    Boolean(highlights.latestSession.laps?.[0]?.lap_summary)
                  )}
                </div>
                <WeatherSummary
                  ambient={highlights.latestSession.session_conditions?.[0]?.ambient_temperature}
                  track={highlights.latestSession.session_conditions?.[0]?.track_temperature}
                  wetness={
                    highlights.latestSession.session_conditions?.[0]?.wetness_average ??
                    highlights.latestSession.laps?.[0]?.wetness ??
                    undefined
                  }
                  raininess={highlights.latestSession.session_conditions?.[0]?.raininess ?? undefined}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" /> Best lap
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!highlights.bestLap && (
            <p className="text-sm text-muted-foreground">Set a lap to see your personal best.</p>
          )}

          {highlights.bestLap && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">
                    {formatLapTime(highlights.bestLap.lap_time)}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {highlights.bestLap.sessions?.track_name || "Unknown track"}
                  </div>
                </div>
                {getLapStatusBadge(highlights.bestLap, Boolean(highlights.bestLap.lap_summary))}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Car className="h-4 w-4" />
                {highlights.bestLap.vehicles?.vehicle_name || "Unknown car"}
                {highlights.bestLap.vehicles?.class_name && (
                  <Badge variant="outline" className="text-[11px]">
                    {highlights.bestLap.vehicles.class_name}
                  </Badge>
                )}
              </div>
              <WeatherSummary
                ambient={highlights.bestLap.ambient_temp}
                track={highlights.bestLap.track_temp}
                wetness={highlights.bestLap.wetness ?? undefined}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Recently analyzed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {highlights.recentlyAnalyzed.length === 0 && (
            <p className="text-sm text-muted-foreground">We will show your latest processed laps here.</p>
          )}

          {highlights.recentlyAnalyzed.map(item => (
            <div key={item.id} className="space-y-1 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{formatLapTime(item.lap?.lap_time ?? null)}</div>
                {getLapStatusBadge(item.lap, true)}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {item.lap?.sessions?.track_name || "Unknown track"}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Car className="h-4 w-4" />
                {item.lap?.vehicles?.vehicle_name || "Unknown car"}
              </div>
              <WeatherSummary
                ambient={item.lap?.ambient_temp}
                track={item.lap?.track_temp}
                wetness={item.lap?.wetness ?? undefined}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Quick links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" asChild>
            <Link href={highlights.latestLapId ? `/analyze/laps/${highlights.latestLapId}` : "/analyze"}>
              Analyze Lap
            </Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/comparisons">Comparisons</Link>
          </Button>
          <div className="text-xs text-muted-foreground">
            Jump directly to your most recent lap or start a comparison session.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

async function StatGrid({ statsPromise }: { statsPromise: ReturnType<typeof getOverviewStats> }) {
  const stats = await statsPromise

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Laps</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalLaps}</div>
          <p className="text-xs text-muted-foreground">{formatTime(stats.totalDrivingTime)} total driving time</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Personal Bests</CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.personalBests}</div>
          <p className="text-xs text-muted-foreground">
            {stats.personalBests} personal best{stats.personalBests !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tracks</CardTitle>
          <MapPin className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.uniqueTracks}</div>
          <p className="text-xs text-muted-foreground">{stats.recentSessions} sessions this month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Vehicles</CardTitle>
          <Car className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.uniqueVehicles}</div>
          <p className="text-xs text-muted-foreground">{formatDistance(stats.totalDistance)} covered</p>
        </CardContent>
      </Card>
    </div>
  )
}

async function PerformanceSummary({ statsPromise }: { statsPromise: ReturnType<typeof getOverviewStats> }) {
  const stats = await statsPromise

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5" /> Performance Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Total Driving Time</span>
          <span className="font-semibold">{formatTime(stats.totalDrivingTime)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Total Distance</span>
          <span className="font-semibold">{formatDistance(stats.totalDistance)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Avg Session Length</span>
          <span className="font-semibold">{stats.avgSessionLength ? `${stats.avgSessionLength} laps` : "N/A"}</span>
        </div>
      </CardContent>
    </Card>
  )
}

async function QuickNavigationPanel({ quickNavPromise }: { quickNavPromise: ReturnType<typeof getQuickNavigation> }) {
  const quickNav = await quickNavPromise

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" /> Quick Navigation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h4 className="text-sm font-medium mb-2">Frequent Tracks</h4>
          <div className="space-y-1">
            {quickNav.frequentTracks.slice(0, 3).map((track, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>{track.track_name}</span>
                <Badge variant="outline" className="text-xs">
                  {track._count.id} sessions
                </Badge>
              </div>
            ))}
            {quickNav.frequentTracks.length === 0 && (
              <p className="text-xs text-muted-foreground">No track history yet.</p>
            )}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium mb-2">Frequent Vehicles</h4>
          <div className="space-y-1">
            {quickNav.frequentVehicles.slice(0, 3).map((vehicle, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="truncate">{vehicle.vehicle_name}</span>
                <Badge variant="outline" className="text-xs">
                  {vehicle._count.laps} laps
                </Badge>
              </div>
            ))}
            {quickNav.frequentVehicles.length === 0 && (
              <p className="text-xs text-muted-foreground">Drive a car to see it here.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

async function RecentSessionsCard({ quickNavPromise }: { quickNavPromise: ReturnType<typeof getQuickNavigation> }) {
  const quickNav = await quickNavPromise

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" /> Recent Sessions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {quickNav.recentSessions.map(session => (
          <div key={session.id} className="flex flex-col space-y-1">
            <div className="flex justify-between items-start">
              <span className="font-medium text-sm truncate">{session.track_name}</span>
              <Badge variant="outline" className="text-xs">{getSessionTypeName(session.session_type)}</Badge>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{session._count.laps} laps</span>
              <span>{new Date(session.created_at!).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
        {quickNav.recentSessions.length === 0 && (
          <p className="text-sm text-muted-foreground">Your latest sessions will appear here.</p>
        )}
      </CardContent>
    </Card>
  )
}

async function RecentActivityGrid({
  recentActivityPromise,
}: {
  recentActivityPromise: ReturnType<typeof getRecentActivity>
}) {
  const recentActivity = await recentActivityPromise

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Recent Activity</h2>
        <Button asChild variant="outline">
          <Link href="/laps">View All</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recentActivity.map(lap => (
          <LapCard key={lap.id} lap={lap} />
        ))}
      </div>

      {recentActivity.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No laps yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start your racing journey by connecting rFactor 2 and recording your first lap!
            </p>
            <Button asChild>
              <Link href="/laps">Get Started</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

async function CommunityActivityGrid({
  communityActivityPromise,
}: {
  communityActivityPromise: ReturnType<typeof getCommunityActivity>
}) {
  const communityActivity = await communityActivityPromise

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Community Activity
        </h2>
        <Badge variant="outline" className="text-xs">
          Recent laps from other drivers
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {communityActivity.map(lap => (
          <CommunityLapCard key={lap.id} lap={lap} />
        ))}
      </div>

      {communityActivity.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No community activity yet</h3>
            <p className="text-muted-foreground text-center mb-4">Coming soon!</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default async function Page() {
  const { user } = await withAuth()

  if (user) {
    try {
      await syncUserToDatabase(user)
    } catch (error) {
      console.error("User sync failed:", error)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height))]">
        <div className="flex flex-col items-center justify-center gap-4">
          <h1 className="text-2xl font-bold">Welcome to Herbie</h1>
          <p className="text-muted-foreground">Please sign in to continue</p>
          <div className="flex gap-4">
            <Button asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/sign-up">Sign Up</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const statsPromise = getOverviewStats()
  const recentActivityPromise = getRecentActivity(6)
  const quickNavPromise = getQuickNavigation()
  const communityActivityPromise = getCommunityActivity(6)
  const highlightsPromise = getDashboardHighlights()

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome back{user.firstName ? `, ${user.firstName}` : ""}!</h1>
          <p className="text-muted-foreground">Here&apos;s your racing performance overview</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/laps">View All Laps</Link>
          </Button>
          <form
            action={async () => {
              "use server"
              await signOut()
            }}
          >
            <Button type="submit" variant="outline">
              Sign Out
            </Button>
          </form>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            <HighlightCardSkeleton />
            <HighlightCardSkeleton />
            <HighlightCardSkeleton />
            <HighlightCardSkeleton />
          </div>
        }
      >
        <Highlights highlightsPromise={highlightsPromise} />
      </Suspense>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        }
      >
        <StatGrid statsPromise={statsPromise} />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Suspense fallback={<SectionSkeleton />}>
          <PerformanceSummary statsPromise={statsPromise} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <QuickNavigationPanel quickNavPromise={quickNavPromise} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <RecentSessionsCard quickNavPromise={quickNavPromise} />
        </Suspense>
      </div>

      <Suspense fallback={<SectionSkeleton />}>
        <RecentActivityGrid recentActivityPromise={recentActivityPromise} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <CommunityActivityGrid communityActivityPromise={communityActivityPromise} />
      </Suspense>
    </div>
  )
}
