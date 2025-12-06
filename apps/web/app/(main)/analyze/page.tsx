import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Cloud,
  Download,
  FileJson,
  FileSpreadsheet,
  FolderSync,
  Pause,
  Play,
  RefreshCw,
  Rocket,
  Share2,
  TriangleAlert,
  Webhook,
} from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"

const exportBundles = [
  {
    type: "CSV dataset",
    format: "CSV",
    destination: "Local download",
    status: "ready" as const,
    lastRun: "2m ago",
    size: "18.4 MB",
  },
  {
    type: "JSON bundle",
    format: "JSON",
    destination: "Team share",
    status: "running" as const,
    lastRun: "Processing",
    size: "--",
  },
  {
    type: "MoTeC export",
    format: "MoTeC",
    destination: "Cloud storage",
    status: "error" as const,
    lastRun: "8m ago",
    size: "12.1 MB",
  },
]

const recentRuns = [
  { name: "Session bundle - Spa", status: "ready" as const, completedAt: "Today 10:12", duration: "54s" },
  { name: "Lap CSV - Road Atlanta", status: "ready" as const, completedAt: "Today 09:47", duration: "38s" },
  { name: "MoTeC pack - Suzuka", status: "error" as const, completedAt: "Today 09:21", duration: "--" },
  { name: "JSON push - Nürburgring", status: "running" as const, completedAt: "In progress", duration: "--" },
]

const integrations = [
  {
    title: "Game log folders",
    description: "Watch sim telemetry folders and ingest laps automatically.",
    status: "Connected",
    detail: "rFactor 2, ACC, iRacing",
    icon: FolderSync,
  },
  {
    title: "Cloud storage",
    description: "Sync exports to S3, Azure Blob, or GCS buckets.",
    status: "Ready",
    detail: "S3 (team-shared)",
    icon: Cloud,
  },
  {
    title: "Team shares",
    description: "Push bundles to shared workspaces with permissions.",
    status: "Pending invite",
    detail: "2 awaiting approval",
    icon: Share2,
  },
  {
    title: "Webhooks & chat",
    description: "Notify Slack/Discord or trigger pipelines when runs finish.",
    status: "Enabled",
    detail: "Slack + Discord",
    icon: Webhook,
  },
]

const pipelines = [
  {
    name: "Spa practice import",
    source: "ACC folder sync",
    status: "healthy" as const,
    rate: "246 events/min",
    lag: "3.2s",
  },
  {
    name: "Team share backfill",
    source: "S3 ingestion",
    status: "warning" as const,
    rate: "88 events/min",
    lag: "11.4s",
  },
  {
    name: "Live webhooks",
    source: "Discord/Slack",
    status: "error" as const,
    rate: "0 events/min",
    lag: "--",
  },
]

const errorLog = [
  {
    title: "MoTeC exporter failed",
    detail: "Lap 241 missing channel definitions for tyre temps.",
    action: "Re-run export",
    timestamp: "10:14",
  },
  {
    title: "Webhook delivery dropped",
    detail: "Slack returned HTTP 429; retry scheduled in 2m.",
    action: "View retries",
    timestamp: "10:09",
  },
  {
    title: "Cloud sync permission",
    detail: "Access denied writing to s3://herbie-data/sessions/",
    action: "Update credentials",
    timestamp: "09:55",
  },
]

type Status = "ready" | "running" | "error" | "healthy" | "warning"

function StatusBadge({ status }: { status: Status }) {
  if (status === "ready" || status === "healthy") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {status === "healthy" ? "Healthy" : "Ready"}
      </Badge>
    )
  }

  if (status === "running") {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <RefreshCw className="h-3 w-3 animate-spin" /> Running
      </Badge>
    )
  }

  if (status === "warning") {
    return (
      <Badge variant="outline" className="flex items-center gap-1 text-amber-600">
        <TriangleAlert className="h-3 w-3" /> Degraded
      </Badge>
    )
  }

  return (
    <Badge variant="destructive" className="flex items-center gap-1">
      <AlertCircle className="h-3 w-3" /> Needs attention
    </Badge>
  )
}

export default function AnalyzePage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary" className="gap-1">
              <Rocket className="h-4 w-4" /> Data exports & integrations
            </Badge>
            <span className="flex items-center gap-2 text-xs">
              <Bell className="h-3 w-3" /> Status-first view of pipelines
            </span>
          </div>
          <h1 className="text-3xl font-bold">Export telemetry and monitor ingestion</h1>
          <p className="text-muted-foreground max-w-3xl">
            Ship clean CSV/JSON or MoTeC-ready bundles, wire them into storage and team shares, and keep an eye on
            ingestion health before analysis.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh status
          </Button>
          <Button className="gap-2">
            <Download className="h-4 w-4" /> New export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileSpreadsheet className="h-5 w-5" /> Export bundles
              </CardTitle>
              <p className="text-sm text-muted-foreground">Generate CSV, JSON, or MoTeC packs and track their status.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <FileJson className="h-4 w-4" /> Export JSON
              </Button>
              <Button size="sm" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" /> Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {exportBundles.map((bundle) => (
              <div
                key={bundle.type}
                className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{bundle.type}</span>
                    <Badge variant="outline" className="text-xs">
                      {bundle.format}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Destination: {bundle.destination} · Last run: {bundle.lastRun} · Size: {bundle.size}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <StatusBadge status={bundle.status} />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="h-4 w-4" /> Download
                    </Button>
                    <Button variant="secondary" size="sm" className="gap-2">
                      <Play className="h-4 w-4" /> Re-run
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className="h-5 w-5" /> Recent runs
            </CardTitle>
            <p className="text-sm text-muted-foreground">Monitor the last exports across destinations.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentRuns.map((run) => (
              <div key={run.name} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{run.name}</span>
                    <StatusBadge status={run.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">Completed: {run.completedAt}</p>
                </div>
                <div className="text-right text-sm text-muted-foreground">{run.duration}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {integrations.map((integration) => {
          const Icon = integration.icon
          return (
            <Card key={integration.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4" /> {integration.title}
                </CardTitle>
                <Badge variant="outline" className="w-fit">
                  {integration.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{integration.description}</p>
                <div className="flex items-center gap-2 text-xs">
                  <Share2 className="h-3 w-3" /> {integration.detail}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FolderSync className="h-5 w-5" /> Ingestion pipelines
              </CardTitle>
              <p className="text-sm text-muted-foreground">Throughput, lag, and health across live sources.</p>
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Pause className="h-4 w-4" /> Pause all
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {pipelines.map((pipeline) => (
              <div
                key={pipeline.name}
                className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{pipeline.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {pipeline.source}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Rate: {pipeline.rate} · Lag: {pipeline.lag}</p>
                </div>
                <StatusBadge status={pipeline.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5" /> Errors & retries
            </CardTitle>
            <p className="text-sm text-muted-foreground">Surface ingestion issues and next steps.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorLog.map((error) => (
              <div key={error.title} className="space-y-1 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{error.title}</span>
                  <Badge variant="outline" className="text-xs">
                    {error.timestamp}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{error.detail}</p>
                <Button variant="link" size="sm" className="px-0 gap-1">
                  <RefreshCw className="h-4 w-4" /> {error.action}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
