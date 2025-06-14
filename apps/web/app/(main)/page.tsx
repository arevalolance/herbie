import { Button } from "@workspace/ui/components/button"
import { withAuth, signOut } from '@workos-inc/authkit-nextjs'
import Link from 'next/link'
import { syncUserToDatabase } from '../../lib/auth-sync'

export default async function Page() {
  const { user } = await withAuth()

  // Sync user to database if logged in
  if (user) {
    try {
      await syncUserToDatabase(user);
    } catch (error) {
      console.error('User sync failed:', error);
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height))]">
        <div className="flex flex-col items-center justify-center gap-4">
          <h1 className="text-2xl font-bold">Welcome to Herbie</h1>
          <p className="text-muted-foreground">Please sign in to continue</p>
          <div className="flex gap-4">
            <Button asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/sign-up">Sign Up</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height))]">
      <div className="flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">
          Welcome back{user.firstName ? `, ${user.firstName}` : ''}!
        </h1>
        <p className="text-muted-foreground">
          Signed in as {user.email}
        </p>
        <form action={async () => {
          'use server'
          await signOut()
        }}>
          <Button type="submit" variant="outline">
            Sign Out
          </Button>
        </form>
      </div>
    </div>
  )
}
