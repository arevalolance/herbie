"use client"

import React from "react"
import { Bell, SidebarIcon } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { useSidebar } from "@workspace/ui/components/sidebar"
import { useAuth } from "@workos-inc/authkit-nextjs/components"
import { quickActions } from "./nav-config"

interface BreadcrumbItem {
  label: string;
  href: string;
  current?: boolean;
}

export function SiteHeader() {
  const { toggleSidebar } = useSidebar()
  const pathname = usePathname()
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([])
  const { user } = useAuth()

  useEffect(() => {
    // Fetch breadcrumbs from the server
    const fetchBreadcrumbs = async () => {
      try {
        const response = await fetch('/api/breadcrumbs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ pathname }),
        })
        
        if (response.ok) {
          const data = await response.json()
          setBreadcrumbs(data.breadcrumbs)
        }
      } catch (error) {
        console.error('Failed to fetch breadcrumbs:', error)
        // Fallback to simple breadcrumbs
        setBreadcrumbs([
          { label: 'Dashboard', href: '/' },
          { label: 'Current Page', href: pathname, current: true }
        ])
      }
    }

    fetchBreadcrumbs()
  }, [pathname])

  return (
    <header className="bg-background sticky top-0 z-50 flex w-full items-center border-b">
      <div className="flex h-(--header-height) w-full items-center gap-3 px-4">
        <div className="flex flex-1 items-center gap-2">
          <Button
            className="h-9 w-9"
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label="Toggle navigation"
          >
            <SidebarIcon />
          </Button>
          <Separator orientation="vertical" className="hidden sm:block h-5" />
          <Breadcrumb className="hidden sm:block">
            <BreadcrumbList>
              {breadcrumbs.map((item, index) => (
                <React.Fragment key={item.href}>
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {item.current ? (
                      <BreadcrumbPage>{item.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={item.href}>
                        {item.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-2">
            {quickActions.map((action) => (
              <Button
                key={action.title}
                asChild
                size="sm"
                variant={action.title === "Analyze new lap" ? "default" : "outline"}
                className="font-medium"
              >
                <a href={action.url} className="flex items-center gap-2">
                  <action.icon className="size-4" />
                  <span>{action.title}</span>
                </a>
              </Button>
            ))}
          </div>

          <Separator orientation="vertical" className="hidden sm:block h-6" />

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
          </Button>

          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.profilePictureUrl ?? undefined} alt={user?.firstName} />
            <AvatarFallback>
              {(user?.firstName?.[0] ?? "H")}
              {(user?.lastName?.[0] ?? "B")}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
