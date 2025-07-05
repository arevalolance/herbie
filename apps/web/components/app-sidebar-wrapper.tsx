import { AppSidebar } from './app-sidebar'
import { getRecentActivityForSidebar } from '@/app/(main)/_actions'

export async function AppSidebarWrapper({ ...props }: React.ComponentProps<typeof AppSidebar>) {
  const recentActivity = await getRecentActivityForSidebar(5)
  
  return <AppSidebar recentActivity={recentActivity} {...props} />
} 