import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CloudUpload,
  FolderInput,
  HardDrive,
  Loader2,
  Pause,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  UploadCloud,
} from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"

const lmuSetupSteps = [
  {
    title: "Choose LMU log directory",
    description: "Detect default Steam install folders or browse manually.",
    status: "completed" as const,
    detail: "D:/SteamLibrary/steamapps/common/Le Mans Ultimate/telemetry/logs",
    icon: FolderInput,
  },
  {
    title: "Authorize background watch",
    description: "Allow the collector to watch for new lap files in real time.",
    status: "active" as const,
    detail: "Watching 3 subfolders • 1.4k files indexed",
    icon: ShieldCheck,
  },
  {
    title: "Validate new laps",
    description: "Check channel completeness, session metadata, and naming conventions.",
    status: "pending" as const,
    detail: "Waiting for next file drop",
    icon: HardDrive,
  },
]

const processingStates = [
  {
    name: "Spa practice – Porsche 963",
    state: "processing" as const,
    detail: "Mapping channels & normalizing units",
    eta: "~2m",
  },
  {
    name: "Le Mans quali – Corvette C8.R",
    state: "error" as const,
    detail: "Missing throttle channel; fell back to last known mapping",
    eta: "Manual review",
  },
  {
    name: "Road Atlanta test – BMW M4",
    state: "queued" as const,
    detail: "Awaiting ingestion window",
    eta: "0:45",
  },
]

const uploadSteps = [
  {
    title: "Drop LMU file or folder",
    description: "Upload zip exports or raw *.ldx/*.csv telemetry drops.",
    status: "completed" as const,
  },
  {
    title: "Assign to car & track",
    description: "We match car classes automatically; override if needed.",
    status: "active" as const,
  },
  {
    title: "Process & validate",
    description: "Queue jobs, re-run failed laps, and monitor channel completeness.",
    status: "pending" as const,
  },
]

const uploadRuns = [
  {
    label: "Manual upload",
    file: "LMU_log_2024-09-18.ldx",
    status: "processing" as const,
    detail: "Ingesting 12 laps (GT3 class)",
  },
  {
    label: "Cloud handoff",
    file: "spa-night-session.zip",
    status: "paused" as const,
    detail: "Network throttled, will resume in 3m",
  },
  {
    label: "Retry",
    file: "lemans-qualifying.ldx",
    status: "error" as const,
    detail: "Checksum mismatch, needs new upload",
  },
]

type Status = "completed" | "active" | "pending" | "processing" | "error" | "paused" | "queued"

type WizardStep = {
  title: string
  description: string
  status: Status
  detail?: string
  icon?: typeof FolderInput
}

function StepBadge({ status }: { status: Status }) {
  if (status === "completed") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" /> Done
      </Badge>
    )
  }

  if (status === "active") {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> In progress
      </Badge>
    )
  }

  if (status === "processing") {
    return (
      <Badge variant="outline" className="flex items-center gap-1 text-blue-600">
        <PlayCircle className="h-3 w-3" /> Processing
      </Badge>
    )
  }

  if (status === "queued") {
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <Pause className="h-3 w-3" /> Queued
      </Badge>
    )
  }

  if (status === "paused") {
    return (
      <Badge variant="outline" className="flex items-center gap-1 text-amber-600">
        <Pause className="h-3 w-3" /> Paused
      </Badge>
    )
  }

  if (status === "error") {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" /> Error
      </Badge>
    )
  }

  return <Badge variant="outline">Pending</Badge>
}

function WizardStepRow({ step }: { step: WizardStep }) {
  const Icon = step.icon ?? CheckCircle2

  return (
    <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-medium leading-tight">{step.title}</p>
            <p className="text-sm text-muted-foreground">{step.description}</p>
          </div>
          <StepBadge status={step.status} />
        </div>
        {step.detail ? (
          <p className="text-xs text-muted-foreground">{step.detail}</p>
        ) : null}
      </div>
    </div>
  )
}

export default function DataSourcesPage() {
  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary" className="gap-1">
              <UploadCloud className="h-4 w-4" /> LMU ingestion
            </Badge>
            <span className="flex items-center gap-2 text-xs">
              <ShieldOff className="h-3 w-3" /> Guided setup + processing states
            </span>
          </div>
          <h1 className="text-3xl font-bold">Connect LMU log sources</h1>
          <p className="text-muted-foreground max-w-3xl">
            Link live log directories or upload files manually, keep track of how new laps are processed, and catch
            channel mapping issues before they block analysis.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="gap-2">
            <Loader2 className="h-4 w-4" /> Refresh state
          </Button>
          <Button className="gap-2">
            <CloudUpload className="h-4 w-4" /> Add new source
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FolderInput className="h-5 w-5" /> LMU log directory wizard
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Confirm where LMU writes telemetry, then authorize continuous monitoring with validation checks.
              </p>
            </div>
            <Button variant="outline" className="gap-2">
              <ArrowRight className="h-4 w-4" /> Resume wizard
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {lmuSetupSteps.map((step) => (
              <WizardStepRow key={step.title} step={step} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CloudUpload className="h-5 w-5" /> Upload wizard
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Drop LMU exports, attach context, and see what is queued vs. blocked.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {uploadSteps.map((step) => (
              <WizardStepRow key={step.title} step={step} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PlayCircle className="h-5 w-5" /> Processing states
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Track active and queued LMU jobs with their current health and ETA.
              </p>
            </div>
            <Button variant="outline" className="gap-2">
              <ShieldCheck className="h-4 w-4" /> View channel mapping
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {processingStates.map((item) => (
              <div
                key={item.name}
                className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/60 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium leading-tight">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StepBadge status={item.state} />
                  <span className="text-sm text-muted-foreground">{item.eta}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5" /> Errors & retries
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Quickly re-queue LMU laps that failed validation or channel mapping.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {uploadRuns.map((run) => (
              <div key={run.file} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium leading-tight">{run.label}</p>
                    <p className="text-xs text-muted-foreground">{run.file}</p>
                  </div>
                  <StepBadge status={run.status} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{run.detail}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1">
                    <RefreshCw className="h-3 w-3" /> Retry
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <ShieldOff className="h-3 w-3" /> Mark reviewed
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
