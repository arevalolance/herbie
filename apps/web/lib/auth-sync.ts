import { syncUser } from '../db/queries/users';
import { User } from '../db/schema';

// Interface for WorkOS user data (what we receive from withAuth())
interface WorkOSUserInput {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
}

/**
 * Sync WorkOS user data to our local database
 * 
 * This function handles the synchronization of user data from WorkOS
 * to your local PostgreSQL database using Drizzle ORM.
 * 
 * Features:
 * - Creates new users if they don't exist
 * - Updates existing users with latest data from WorkOS
 * - Idempotent - safe to call multiple times
 * - Handles errors gracefully without breaking auth flow
 * 
 * Usage:
 * ```typescript
 * import { withAuth } from '@workos-inc/authkit-nextjs';
 * import { syncUserToDatabase } from './lib/auth-sync';
 * 
 * const { user } = await withAuth();
 * if (user) {
 *   await syncUserToDatabase(user);
 * }
 * ```
 * 
 * @param user - The WorkOS user object from withAuth()
 * @returns Promise<boolean> - true if sync successful, false otherwise
 */
export async function syncUserToDatabase(user: WorkOSUserInput): Promise<boolean> {
  try {
    await syncUser({
      id: user.id,
      organizationId: undefined, // Organization ID is handled separately in WorkOS
      email: user.email,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      profilePictureUrl: user.profilePictureUrl || undefined,
    });
    
    console.log(`✅ User ${user.email} synced successfully to database`);
    return true;
  } catch (error) {
    console.error('❌ Failed to sync user to database:', error);
    return false;
  }
}

/**
 * Utility function to sync users in middleware
 * Use this if you want to sync users automatically on every request
 */
export async function syncUserInMiddleware(user: WorkOSUserInput): Promise<void> {
  // Fire and forget - don't wait for sync to complete
  syncUserToDatabase(user).catch((error) => {
    console.error('Background user sync failed:', error);
  });
}

// Export the User type for convenience
export type { User } from '../db/schema'; 