"use client"

import * as React from "react"
import {
  BookOpen,
  Bot,
  Car,
  Command,
  Frame,
  LifeBuoy,
  Map,
  PieChart,
  Send,
  Settings2,
  SquareTerminal,
  Waypoints,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavRecentActivity } from "@/components/nav-recent-activity"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
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
  navMain: [
    {
      title: "Overview",
      url: "/",
      icon: SquareTerminal,
      isActive: true,
    },
    {
      title: "Analyze",
      url: "/analyze",
      icon: Waypoints,
    },
    {
      title: "Laps",
      url: "/laps",
      icon: Car,
      isActive: true,
      items: [
        {
          title: "Cars",
          url: "/laps/cars",
        },
        {
          title: "Tracks",
          url: "/laps/tracks",
        },
        {
          title: "Categories",
          url: "/laps/categories",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Support",
      url: "#",
      icon: LifeBuoy,
    },
    {
      title: "Feedback",
      url: "#",
      icon: Send,
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
        <NavMain items={data.navMain} />
        <NavRecentActivity recentActivity={data.recentActivity} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
