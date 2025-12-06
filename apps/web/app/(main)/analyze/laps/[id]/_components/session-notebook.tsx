'use client'

import { useMemo, useState, useTransition } from "react"
import { CalendarClock, Filter, Flame, NotebookPen, Search, Tag, Timer, TimelineIcon } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { saveSessionNote } from "../_actions"
import { LapTimelineEntry, SessionNote, SetupSnapshot } from "./session-notebook-types"

function formatSeconds(time?: number | null) {
  if (time == null || Number.isNaN(time)) return "—"
  const minutes = Math.floor(time / 60)
  const seconds = time % 60
  return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`
}

function formatDate(value?: string | null) {
  if (!value) return "Just now"
  const date = new Date(value)
  return date.toLocaleString()
}

type SessionNotebookProps = {
  sessionId: number
  lapId: number
  initialNotes: SessionNote[]
  lapTimeline: LapTimelineEntry[]
}

export function SessionNotebook({ sessionId, lapId, initialNotes, lapTimeline }: SessionNotebookProps) {
  const [notes, setNotes] = useState<SessionNote[]>(initialNotes)
  const [search, setSearch] = useState("")
  const [tagInput, setTagInput] = useState((initialNotes[0]?.tags ?? []).join(", "))
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isSaving, startSaving] = useTransition()

  const latest = useMemo(() => initialNotes[0], [initialNotes])

  const [form, setForm] = useState<SetupSnapshot>({
    springs: {
      front: latest?.springs?.front ?? null,
      rear: latest?.springs?.rear ?? null,
    },
    aero: {
      front: latest?.aero?.front ?? null,
      rear: latest?.aero?.rear ?? null,
    },
    brakeBias: latest?.brakeBias ?? null,
    tirePressures: {
      fl: latest?.tirePressures?.fl ?? null,
      fr: latest?.tirePressures?.fr ?? null,
      rl: latest?.tirePressures?.rl ?? null,
      rr: latest?.tirePressures?.rr ?? null,
    },
    tireTemps: {
      fl: latest?.tireTemps?.fl ?? null,
      fr: latest?.tireTemps?.fr ?? null,
      rl: latest?.tireTemps?.rl ?? null,
      rr: latest?.tireTemps?.rr ?? null,
    },
    note: latest?.note ?? "",
    tags: latest?.tags ?? [],
  })

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    notes.forEach((note) => note.tags.forEach((tag) => tags.add(tag)))
    return Array.from(tags)
  }, [notes])

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase()
    return notes.filter((note) => {
      const matchesQuery =
        !query ||
        note.note?.toLowerCase().includes(query) ||
        note.tags.some((tag) => tag.toLowerCase().includes(query))
      const matchesTags =
        selectedTags.length === 0 || selectedTags.every((tag) => note.tags.includes(tag))
      return matchesQuery && matchesTags
    })
  }, [notes, search, selectedTags])

  const timelineEvents = useMemo(() => {
    const noteEvents = filteredNotes
      .filter((note) => note.createdAt)
      .map((note) => ({
        type: "note" as const,
        timestamp: new Date(note.createdAt ?? Date.now()).getTime(),
        label: note.tags.length ? note.tags.join(", ") : "Setup note",
        detail: note.note,
      }))

    const lapEvents = lapTimeline.map((lap) => ({
      type: "lap" as const,
      timestamp: new Date(lap.lapStartTime).getTime(),
      label: `Lap ${lap.lapNumber}`,
      detail: lap.deltaToSessionBest != null
        ? `Δ session best: ${lap.deltaToSessionBest > 0 ? "+" : ""}${lap.deltaToSessionBest.toFixed(3)}s`
        : lap.lapTime != null
          ? `Lap time: ${formatSeconds(lap.lapTime)}`
          : "Lap recorded",
    }))

    return [...noteEvents, ...lapEvents].sort((a, b) => a.timestamp - b.timestamp)
  }, [filteredNotes, lapTimeline])

  const updateNumberField = (path: string, value: string) => {
    const parsed = value === "" ? null : Number(value)
    setForm((prev) => {
      const next = structuredClone(prev) as SetupSnapshot
      switch (path) {
        case "springs.front":
          next.springs = { ...(next.springs ?? {}), front: parsed }
          break
        case "springs.rear":
          next.springs = { ...(next.springs ?? {}), rear: parsed }
          break
        case "aero.front":
          next.aero = { ...(next.aero ?? {}), front: parsed }
          break
        case "aero.rear":
          next.aero = { ...(next.aero ?? {}), rear: parsed }
          break
        case "brakeBias":
          next.brakeBias = parsed
          break
        case "tirePressures.fl":
          next.tirePressures = { ...(next.tirePressures ?? {}), fl: parsed }
          break
        case "tirePressures.fr":
          next.tirePressures = { ...(next.tirePressures ?? {}), fr: parsed }
          break
        case "tirePressures.rl":
          next.tirePressures = { ...(next.tirePressures ?? {}), rl: parsed }
          break
        case "tirePressures.rr":
          next.tirePressures = { ...(next.tirePressures ?? {}), rr: parsed }
          break
        case "tireTemps.fl":
          next.tireTemps = { ...(next.tireTemps ?? {}), fl: parsed }
          break
        case "tireTemps.fr":
          next.tireTemps = { ...(next.tireTemps ?? {}), fr: parsed }
          break
        case "tireTemps.rl":
          next.tireTemps = { ...(next.tireTemps ?? {}), rl: parsed }
          break
        case "tireTemps.rr":
          next.tireTemps = { ...(next.tireTemps ?? {}), rr: parsed }
          break
        default:
          break
      }
      return next
    })
  }

  const onSaveNote = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const tags = tagInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)

    startSaving(async () => {
      const saved = await saveSessionNote({
        sessionId,
        lapId,
        tags,
        note: form.note ?? "",
        springs: form.springs,
        aero: form.aero,
        brakeBias: form.brakeBias,
        tirePressures: form.tirePressures,
        tireTemps: form.tireTemps,
      })

      setNotes((prev) => [saved, ...prev])
      setSelectedTags([])
      setSearch("")
      setTagInput(saved.tags.join(", "))
      setForm((prev) => ({ ...prev, note: saved.note ?? "", tags: saved.tags }))
    })
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <NotebookPen className="h-5 w-5" /> Session setup notebook
          </CardTitle>
          <CardDescription>
            Capture structured setup changes for this session so you can correlate them with lap time swings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSaveNote}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Springs (N/mm)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Front"
                    value={form.springs?.front ?? ""}
                    onChange={(e) => updateNumberField("springs.front", e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Rear"
                    value={form.springs?.rear ?? ""}
                    onChange={(e) => updateNumberField("springs.rear", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Aero (wing / rake)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Front"
                    value={form.aero?.front ?? ""}
                    onChange={(e) => updateNumberField("aero.front", e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Rear"
                    value={form.aero?.rear ?? ""}
                    onChange={(e) => updateNumberField("aero.rear", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Brake bias (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="64.0"
                  value={form.brakeBias ?? ""}
                  onChange={(e) => updateNumberField("brakeBias", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Tire pressures (psi)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="FL"
                    value={form.tirePressures?.fl ?? ""}
                    onChange={(e) => updateNumberField("tirePressures.fl", e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="FR"
                    value={form.tirePressures?.fr ?? ""}
                    onChange={(e) => updateNumberField("tirePressures.fr", e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="RL"
                    value={form.tirePressures?.rl ?? ""}
                    onChange={(e) => updateNumberField("tirePressures.rl", e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="RR"
                    value={form.tirePressures?.rr ?? ""}
                    onChange={(e) => updateNumberField("tirePressures.rr", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tire temps (°C)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="FL"
                    value={form.tireTemps?.fl ?? ""}
                    onChange={(e) => updateNumberField("tireTemps.fl", e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="FR"
                    value={form.tireTemps?.fr ?? ""}
                    onChange={(e) => updateNumberField("tireTemps.fr", e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="RL"
                    value={form.tireTemps?.rl ?? ""}
                    onChange={(e) => updateNumberField("tireTemps.rl", e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="RR"
                    value={form.tireTemps?.rr ?? ""}
                    onChange={(e) => updateNumberField("tireTemps.rr", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  placeholder="race, baseline, test"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Comma-separated to make searching easier.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Notes</Label>
              <textarea
                id="note"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="What changed, how it felt, and what to try next."
                value={form.note ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />
                  {initialNotes[0]?.createdAt ? `Last saved ${formatDate(initialNotes[0].createdAt)}` : "No notes yet"}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Flame className="h-3 w-3" />
                  Springs, aero, brake bias, tires tracked
                </Badge>
              </div>
              <Button type="submit" disabled={isSaving} className="gap-2">
                <NotebookPen className="h-4 w-4" />
                {isSaving ? "Saving note..." : "Save session note"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" /> Tags & search
            </CardTitle>
            <CardDescription>Filter down your notes to find the last good balance quickly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search tags or text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                onClick={() => {
                  setSearch("")
                  setSelectedTags([])
                }}
              >
                <Filter className="h-4 w-4" />
                Reset
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {allTags.length === 0 && <p className="text-sm text-muted-foreground">No tags yet.</p>}
              {allTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() =>
                    setSelectedTags((current) =>
                      current.includes(tag)
                        ? current.filter((t) => t !== tag)
                        : [...current, tag]
                    )
                  }
                >
                  <Tag className="mr-1 h-3 w-3" />
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {filteredNotes.length === 0 && (
                <p className="text-sm text-muted-foreground">No notes match that query yet.</p>
              )}
              {filteredNotes.map((note) => (
                <div key={note.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Timer className="h-3 w-3" />
                      {formatDate(note.createdAt)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {note.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {note.note || "No freeform notes"}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Springs: {note.springs?.front ?? "–"} / {note.springs?.rear ?? "–"}</span>
                    <span>Aero: {note.aero?.front ?? "–"} / {note.aero?.rear ?? "–"}</span>
                    <span>Bias: {note.brakeBias ?? "–"}%</span>
                    <span>Pressures FL/FR: {note.tirePressures?.fl ?? "–"} / {note.tirePressures?.fr ?? "–"}</span>
                    <span>Pressures RL/RR: {note.tirePressures?.rl ?? "–"} / {note.tirePressures?.rr ?? "–"}</span>
                    <span>Temps FL/FR: {note.tireTemps?.fl ?? "–"} / {note.tireTemps?.fr ?? "–"}</span>
                    <span>Temps RL/RR: {note.tireTemps?.rl ?? "–"} / {note.tireTemps?.rr ?? "–"}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TimelineIcon className="h-4 w-4" /> Setup & lap timeline
            </CardTitle>
            <CardDescription>See where setup notes land against lap-time swings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {timelineEvents.length === 0 && <p className="text-sm text-muted-foreground">Start logging notes to build a timeline.</p>}
            {timelineEvents.map((event, index) => (
              <div key={`${event.type}-${event.timestamp}-${index}`} className="flex gap-3 text-sm">
                <div className="w-24 shrink-0 text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={event.type === "note" ? "default" : "secondary"} className="gap-1">
                      {event.type === "note" ? <NotebookPen className="h-3 w-3" /> : <Timer className="h-3 w-3" />}
                      {event.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{event.detail}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
