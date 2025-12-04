"use client"

import * as React from "react"
import { Command } from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavRecentActivity } from "@/components/nav-recent-activity"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  defaultRecentActivity,
  navSections,
  quickActions,
  workspaceLinks,
} from "./nav-config"
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

export function AppSidebar({ 
  recentActivity,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  recentActivity?: Array<{ name: string; url: string }>
}) {
  const resolvedRecentActivity = recentActivity || defaultRecentActivity

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
        <NavQuickActions actions={quickActions} />
        <NavMain sections={navSections} />
        <NavRecentActivity recentActivity={resolvedRecentActivity} />
        <NavSecondary
          items={workspaceLinks}
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
