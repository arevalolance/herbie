import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  CircleDot,
  Clock4,
  CopyCheck,
  Info,
  PauseCircle,
  Play,
  RefreshCw,
  ShieldAlert,
} from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"

const queue = [
  {
    name: "Spa practice – Porsche 963",
    status: "processing" as const,
    detail: "Lap 4/12 normalizing channels",
    eta: "1m 50s",
  },
  {
    name: "Le Mans quali – Corvette C8.R",
    status: "blocked" as const,
    detail: "Missing track layout map; awaiting upload",
    eta: "Needs action",
  },
  {
    name: "Road Atlanta test – BMW M4",
    status: "queued" as const,
    detail: "Waiting on LMU ingest window",
    eta: "0:40",
  },
  {
    name: "Paul Ricard setup laps – Aston Vantage",
    status: "done" as const,
    detail: "Validated • channel completeness 98%",
    eta: "Complete",
  },
]

const actions = [
  {
    title: "Upload missing LMU layout map",
    description: "Lap processing paused for Le Mans quali until the map is provided.",
    cta: "Attach layout",
    icon: AlertTriangle,
    badge: "Blocking",
  },
  {
    title: "Re-run failed channel mapping",
    description: "Throttle channel mismatch on Corvette C8.R; will retry with last known schema.",
    cta: "Re-run mapping",
    icon: ShieldAlert,
    badge: "Retry",
  },
  {
    title: "Share validation report",
    description: "Send the latest lap-validation summary to the race engineer channel.",
    cta: "Copy link",
    icon: CopyCheck,
    badge: "FYI",
  },
]

const signals = [
  {
    title: "Webhook delivery paused",
    detail: "Discord webhook disabled after 3 failed responses.",
    status: "paused" as const,
    when: "2m ago",
  },
  {
    title: "Queue depth increasing",
    detail: "7 laps waiting on LMU ingest window; consider raising concurrency.",
    status: "warning" as const,
    when: "6m ago",
  },
  {
    title: "Tasks cleared",
    detail: "Validation checklist finished for Spa practice import.",
    status: "info" as const,
    when: "12m ago",
  },
]

type QueueStatus = "processing" | "blocked" | "queued" | "done"

type SignalStatus = "paused" | "warning" | "info"

function StatusBadge({ status }: { status: QueueStatus | SignalStatus }) {
  if (status === "processing") {
    return (
      <Badge variant="outline" className="flex items-center gap-1 text-blue-600">
        <Play className="h-3 w-3" /> Processing
      </Badge>
    )
  }

  if (status === "blocked") {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" /> Needs action
      </Badge>
    )
  }

  if (status === "queued") {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Clock4 className="h-3 w-3" /> Queued
      </Badge>
    )
  }

  if (status === "paused") {
    return (
      <Badge variant="outline" className="flex items-center gap-1 text-amber-600">
        <PauseCircle className="h-3 w-3" /> Paused
      </Badge>
    )
  }

  if (status === "warning") {
    return (
      <Badge variant="outline" className="flex items-center gap-1 text-amber-600">
        <AlertTriangle className="h-3 w-3" /> Warning
      </Badge>
    )
  }

  if (status === "info") {
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <Info className="h-3 w-3" /> Info
      </Badge>
    )
  }

  return (
    <Badge className="bg-emerald-500/10 text-emerald-600 flex items-center gap-1">
      <CheckCircle2 className="h-3 w-3" /> Done
    </Badge>
  )
}

export default function NotificationsPage() {
  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary" className="gap-1">
              <Bell className="h-4 w-4" /> Lap-processing queue
            </Badge>
            <span className="flex items-center gap-2 text-xs">
              <CircleDot className="h-3 w-3" /> Notifications & suggested actions
            </span>
          </div>
          <h1 className="text-3xl font-bold">Notifications & tasks</h1>
          <p className="text-muted-foreground max-w-3xl">
            Keep lap-processing in view: see what is running, what is blocked, and what you can do right now to unblock
            the queue.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh queue
          </Button>
          <Button className="gap-2">
            <ArrowRight className="h-4 w-4" /> View processing log
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Play className="h-5 w-5" /> Lap-processing queue
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Active, queued, and completed LMU lap jobs with their current state.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {queue.map((item) => (
              <div
                key={item.name}
                className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/60 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium leading-tight">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={item.status} />
                  <span className="text-sm text-muted-foreground">{item.eta}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className="h-5 w-5" /> Suggested actions
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Quick tasks that keep ingestion flowing when laps error or stall.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {actions.map((action) => (
              <div key={action.title} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <action.icon className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium leading-tight">{action.title}</p>
                  </div>
                  <Badge variant="secondary">{action.badge}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
                <Button variant="outline" size="sm" className="mt-3 gap-2">
                  <ArrowRight className="h-3 w-3" /> {action.cta}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5" /> Delivery & signals
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Channel delivery updates and health signals from the lap-processing pipeline.
            </p>
          </div>
          <Button variant="ghost" className="gap-2">
            <ArrowRight className="h-4 w-4" /> Open alerts feed
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {signals.map((signal) => (
            <div
              key={signal.title}
              className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-medium leading-tight">{signal.title}</p>
                <p className="text-sm text-muted-foreground">{signal.detail}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={signal.status} />
                <span className="text-sm text-muted-foreground">{signal.when}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
