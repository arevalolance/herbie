import { handleAuth } from '@workos-inc/authkit-nextjs';

// Redirect the user to `/` after successful sign in
// User sync happens in middleware or on page load
export const GET = handleAuth({ 
    returnPathname: '/' 
});
