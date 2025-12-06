import {
  Bell,
  BookOpen,
  Database,
  Home,
  PieChart,
  Send,
  Settings2,
  UploadCloud,
  User,
  Users,
  Waypoints,
} from "lucide-react"
import { type LucideIcon } from "lucide-react"

export type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  badge?: string
  items?: {
    title: string
    url: string
  }[]
}

export type NavSection = {
  title: string
  items: NavItem[]
}

export const quickActions = [
  {
    title: "Analyze new lap",
    url: "/analyze/new",
    icon: Waypoints,
  },
  {
    title: "Upload session",
    url: "/sessions/upload",
    icon: UploadCloud,
  },
]

export const navSections: NavSection[] = [
  {
    title: "Drive & analyze",
    items: [
      {
        title: "Analyze Lap",
        url: "/analyze",
        icon: Waypoints,
        items: [
          { title: "Current analysis", url: "/analyze" },
          { title: "New lap review", url: "/analyze/new" },
          { title: "Comparisons", url: "/comparisons" },
        ],
      },
      {
        title: "Sessions Library",
        url: "/sessions",
        icon: BookOpen,
        items: [
          { title: "All sessions", url: "/sessions" },
          { title: "Uploads", url: "/sessions/upload" },
        ],
      },
      {
        title: "Garage Overview",
        url: "/garage",
        icon: Home,
      },
    ],
  },
  {
    title: "Insights & operations",
    items: [
      {
        title: "Telemetry Metrics Explorer",
        url: "/telemetry/metrics",
        icon: PieChart,
        badge: "Beta",
      },
      {
        title: "Setups & Notes",
        url: "/setups-notes",
        icon: Settings2,
      },
      {
        title: "Community",
        url: "/community",
        icon: Users,
      },
      {
        title: "Exports & Integrations",
        url: "/exports",
        icon: Send,
      },
    ],
  },
]

export const workspaceLinks = [
  {
    title: "Profile & Access",
    url: "/workspace/profile",
    icon: User,
  },
  {
    title: "Data Sources",
    url: "/workspace/data-sources",
    icon: Database,
  },
  {
    title: "Notifications & Tasks",
    url: "/workspace/notifications",
    icon: Bell,
  },
]

export const defaultRecentActivity = [
  {
    name: "Porsche 911 GT3 at Spa",
    url: "#",
  },
  {
    name: "BMW M4 GT3 at Le Mans",
    url: "#",
  },
  {
    name: "Aston Martin Vantage GT3 at Monza",
    url: "#",
  },
]
