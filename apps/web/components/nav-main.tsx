"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
import { usePathname } from "next/navigation"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@workspace/ui/components/sidebar"
import { type NavItem, type NavSection } from "./nav-config"

const normalizePath = (path?: string | null) => {
  if (!path) return "/"
  return path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path
}

const isActivePath = (pathname: string | null, url: string) => {
  const current = normalizePath(pathname)
  const target = normalizePath(url)

  if (target === "/") return current === target

  return current === target || current.startsWith(`${target}/`)
}

function NavMainItem({ item, pathname }: { item: NavItem; pathname: string | null }) {
  const hasActiveChild = item.items?.some((subItem) => isActivePath(pathname, subItem.url))
  const isActive = isActivePath(pathname, item.url) || Boolean(hasActiveChild)
  const [isOpen, setIsOpen] = React.useState(isActive)

  React.useEffect(() => {
    if (isActive) {
      setIsOpen(true)
    }
  }, [isActive])

  return (
    <Collapsible key={item.title} asChild open={isOpen} onOpenChange={setIsOpen}>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
          <a href={item.url}>
            <item.icon />
            <span>{item.title}</span>
            {item.badge ? (
              <span className="text-muted-foreground ml-auto text-[10px] font-medium uppercase tracking-wide">
                {item.badge}
              </span>
            ) : null}
          </a>
        </SidebarMenuButton>
        {item.items?.length ? (
          <>
            <CollapsibleTrigger asChild>
              <SidebarMenuAction className="data-[state=open]:rotate-90">
                <ChevronRight />
                <span className="sr-only">Toggle {item.title}</span>
              </SidebarMenuAction>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {item.items?.map((subItem) => {
                  const isSubActive = isActivePath(pathname, subItem.url)

                  return (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton asChild isActive={isSubActive}>
                        <a href={subItem.url}>
                          <span>{subItem.title}</span>
                        </a>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )
                })}
              </SidebarMenuSub>
            </CollapsibleContent>
          </>
        ) : null}
      </SidebarMenuItem>
    </Collapsible>
  )
}

export function NavMain({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <SidebarGroup key={section.title}>
          <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => (
                <NavMainItem key={item.title} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </div>
  )
}
