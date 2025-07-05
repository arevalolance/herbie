import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { withAuth, signOut } from '@workos-inc/authkit-nextjs'
import Link from 'next/link'
import { syncUserToDatabase } from '../../lib/auth-sync'
import { getOverviewStats, getRecentActivity, getQuickNavigation, getCommunityActivity } from './_actions'
import { LapCard } from '@/components/lap-card'
import { CommunityLapCard } from '@/components/community-lap-card'
import {
  Clock,
  Trophy,
  MapPin,
  Car,
  Timer,
  Activity,
  TrendingUp,
  Target,
  Users
} from "lucide-react"

function formatTime(seconds: number | null): string {
  if (!seconds) return "N/A";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}


function formatDistance(meters: number | null): string {
  if (!meters) return "N/A";

  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

function getSessionTypeName(sessionType: number | null): string {
  switch (sessionType) {
    case 0: return "Practice";
    case 1: return "Qualifying";
    case 2: return "Race";
    default: return "Session";
  }
}

export default async function Page() {
  const { user } = await withAuth()

  // Sync user to database if logged in
  if (user) {
    try {
      await syncUserToDatabase(user);
    } catch (error) {
      console.error('User sync failed:', error);
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

  // Fetch dashboard data
  const [stats, recentActivity, quickNav, communityActivity] = await Promise.all([
    getOverviewStats(),
    getRecentActivity(6),
    getQuickNavigation(),
    getCommunityActivity(6)
  ]);

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back{user.firstName ? `, ${user.firstName}` : ''}!
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s your racing performance overview
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/laps">View All Laps</Link>
          </Button>
          <form action={async () => {
            'use server'
            await signOut()
          }}>
            <Button type="submit" variant="outline">
              Sign Out
            </Button>
          </form>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Laps</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLaps}</div>
            <p className="text-xs text-muted-foreground">
              {formatTime(stats.totalDrivingTime)} total driving time
            </p>
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
              {stats.personalBests} personal best{stats.personalBests !== 1 ? 's' : ''}
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
            <p className="text-xs text-muted-foreground">
              {stats.recentSessions} sessions this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vehicles</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueVehicles}</div>
            <p className="text-xs text-muted-foreground">
              {formatDistance(stats.totalDistance)} covered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Performance Summary
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quick Navigation
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
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickNav.recentSessions.map((session) => (
              <div key={session.id} className="flex flex-col space-y-1">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-sm truncate">{session.track_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {getSessionTypeName(session.session_type)}
                  </Badge>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{session._count.laps} laps</span>
                  <span>{new Date(session.created_at!).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Activity</h2>
          <Button asChild variant="outline">
            <Link href="/laps">View All</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recentActivity.map((lap) => (
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

      {/* Community Activity */}
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
          {communityActivity.map((lap) => (
            <CommunityLapCard key={lap.id} lap={lap} />
          ))}
        </div>

        {communityActivity.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No community activity yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Coming soon!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
