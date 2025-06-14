# User Sync with WorkOS

This document explains how user data is synchronized between WorkOS and your local PostgreSQL database when users sign in with Google (or any other OAuth provider).

## Overview

When users sign in through WorkOS, their data is automatically synchronized to your local database. This ensures you have a local copy of user information for:

- Analytics and reporting
- User preferences and settings
- Application-specific data
- Performance optimization (avoiding API calls)

## How It Works

### Database Schema

The `users` table in your PostgreSQL database stores:

```sql
- id (varchar) - WorkOS user ID (primary key)
- workos_user_id (varchar) - WorkOS user ID (unique)
- organization_id (varchar) - WorkOS organization ID (optional)
- email (varchar) - User's email address
- name (varchar) - Full name
- first_name (varchar) - First name
- last_name (varchar) - Last name
- profile_picture_url (varchar) - Avatar URL
- created_at (timestamp) - When user was first created
- updated_at (timestamp) - Last update timestamp
```

### Sync Functions

#### `syncUser(workosUser)`
Core function that handles database operations:
- Creates new users if they don't exist
- Updates existing users with latest data
- Returns the synced user record

#### `syncUserToDatabase(user)`
High-level wrapper that:
- Calls `syncUser()` with proper error handling
- Logs sync results
- Returns boolean success status

## Usage Examples

### Basic Usage (Recommended)

Add user sync to any page where you use `withAuth()`:

```typescript
import { withAuth } from '@workos-inc/authkit-nextjs';
import { syncUserToDatabase } from '../lib/auth-sync';

export default async function Page() {
  const { user } = await withAuth();

  // Sync user to database
  if (user) {
    await syncUserToDatabase(user);
  }

  // Rest of your component...
}
```

### Middleware Approach

For automatic syncing on every request, you can add to your middleware:

```typescript
// middleware.ts
import { authkitMiddleware } from '@workos-inc/authkit-nextjs';
import { syncUserInMiddleware } from './lib/auth-sync';

export default authkitMiddleware({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: ['/', '/sign-in', '/sign-up'],
  },
  async onAuthenticated({ user }) {
    // Background sync - doesn't block the request
    if (user) {
      await syncUserInMiddleware(user);
    }
  }
});
```

### Manual Query Usage

You can also use the database queries directly. All functions return the `User` type from your schema:

```typescript
import { findUserByWorkosId, createUser, updateUser } from './db/queries/users';
import { User } from './db/schema';

// Find a user (returns User | null)
const user: User | null = await findUserByWorkosId('user_123');

// Create a new user (returns User)
const newUser: User = await createUser({
  id: 'user_123',
  workosUserId: 'user_123',
  email: 'user@example.com',
  firstName: 'John',
  lastName: 'Doe',
});

// Update existing user (returns User)
const updatedUser: User = await updateUser('user_123', {
  firstName: 'Jane',
  profilePictureUrl: 'https://example.com/avatar.jpg',
});
```

## Google OAuth Integration

When users sign in with Google through WorkOS:

1. User clicks "Continue with Google" button
2. WorkOS handles OAuth flow with Google
3. User is redirected to `/auth/callback`
4. WorkOS creates/updates user in their system
5. Your app calls `syncUserToDatabase()` on first page load
6. User data is stored locally in PostgreSQL

## Data Flow

```
Google OAuth → WorkOS → Your App → PostgreSQL
     ↓             ↓         ↓         ↓
  User Info → User Object → Sync → Local User Record
```

## Error Handling

The sync functions handle errors gracefully:

- Database connection issues are logged but don't break auth
- Invalid user data is caught and reported
- Duplicate key errors are handled (updates instead of creates)
- Network timeouts don't affect user experience

## Performance Considerations

- Sync is idempotent - safe to call multiple times
- Database connections are pooled and properly closed
- Consider using background sync for high-traffic apps
- Cache user data locally to reduce database calls

## Customization

To modify what data is synced, edit `apps/web/lib/auth-sync.ts`:

```typescript
await syncUser({
  id: user.id,
  workosUserId: user.id,
  organizationId: user.organizationId, // Add if needed
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  profilePictureUrl: user.profilePictureUrl,
  // Add custom fields here
});
```

## Testing

To test the sync functionality:

1. Sign in with Google
2. Check the `users` table in your database
3. Verify user data is present and accurate
4. Sign in again - data should update if changed

## Troubleshooting

### Common Issues

1. **Database connection errors**
   - Check `DATABASE_URL` environment variable
   - Ensure PostgreSQL is running
   - Verify database permissions

2. **User not syncing**
   - Check console logs for errors
   - Verify WorkOS configuration
   - Ensure `syncUserToDatabase()` is called

3. **Duplicate user errors**
   - Check for conflicting email addresses
   - Verify WorkOS user ID uniqueness
   - Review database constraints

### Debug Mode

Enable detailed logging by setting:

```bash
NODE_ENV=development
```

This will show detailed sync logs in your console. 