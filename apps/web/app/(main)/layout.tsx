import { AppSidebarWrapper } from "@/components/app-sidebar-wrapper"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="[--header-height:3.5rem]">
            <SidebarProvider className="flex min-h-svh flex-col bg-background text-foreground">
                <SiteHeader />
                <div className="flex flex-1">
                    <AppSidebarWrapper />
                    <SidebarInset className="bg-background">
                        {children}
                    </SidebarInset>
                </div>
            </SidebarProvider>
        </div>
    )
}
