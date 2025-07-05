"use client"

import {
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import Link from "next/link"

export function NavRecentActivity({
  recentActivity,
}: {
  recentActivity: {
    name: string
    url: string
  }[]
}) {
  const { isMobile } = useSidebar()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Recent Activity</SidebarGroupLabel>
      <TooltipProvider>
        <SidebarMenu>
          {recentActivity.length === 0 ? (
            <SidebarMenuItem>
              <SidebarMenuButton disabled>
                <span className="text-muted-foreground">No recent laps</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            recentActivity.map((item) => (
              <SidebarMenuItem key={`${item.name}-${item.url}`}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton asChild>
                      <Link href={item.url}>
                        <span className="truncate">{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p>{item.name}</p>
                  </TooltipContent>
                </Tooltip>
              </SidebarMenuItem>
            ))
          )}
        </SidebarMenu>
      </TooltipProvider>
    </SidebarGroup>
  )
}
