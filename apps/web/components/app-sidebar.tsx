"use client"

import * as React from "react"
import {
  BarChart3,
  Bell,
  BookOpen,
  Command,
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

import { NavMain } from "@/components/nav-main"
import { NavRecentActivity } from "@/components/nav-recent-activity"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { NavQuickActions } from "./nav-quick-actions"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

const data = {
  quickActions: [
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
  ],
  navMain: [
    {
      title: "Analyze Lap",
      url: "/analyze",
      icon: Waypoints,
      isActive: true,
    },
    {
      title: "Garage Overview",
      url: "/garage",
      icon: Home,
    },
    {
      title: "Sessions Library",
      url: "/sessions",
      icon: BookOpen,
    },
    {
      title: "Comparisons",
      url: "/comparisons",
      icon: BarChart3,
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
      title: "Telemetry Metrics Explorer",
      url: "/telemetry/metrics",
      icon: PieChart,
    },
    {
      title: "Exports & Integrations",
      url: "/exports",
      icon: Send,
    },
  ],
  navWorkspace: [
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
  ],
  recentActivity: [
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
  ],
}

export function AppSidebar({ 
  recentActivity, 
  ...props 
}: React.ComponentProps<typeof Sidebar> & {
  recentActivity?: Array<{ name: string; url: string }>
}) {
  return (
    <Sidebar
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Herbie</span>
                  <span className="truncate text-xs">Basic</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavQuickActions actions={data.quickActions} />
        <NavMain items={data.navMain} />
        <NavRecentActivity recentActivity={recentActivity || data.recentActivity} />
        <NavSecondary
          items={data.navWorkspace}
          label="Workspace & Utility"
          className="mt-auto"
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
