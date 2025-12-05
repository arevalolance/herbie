# Access control and sharing

This document summarizes how authentication, profile data, team seats, and sharing rules work for Herbie.

## Authentication and profile details
- Users sign in through WorkOS authentication (Google/OAuth) and are synced to the local database via the existing `syncUser` and `syncUserToDatabase` helpers.
- The profile record stores WorkOS IDs plus email, name, and profile picture URL so the app can render avatars and personalize session metadata.
- Profile panels should surface the signed-in user's email, full name, and avatar along with a link to manage authentication (e.g., sign out) without exposing sensitive tokens.
- When organization membership is present from WorkOS, include the organization name and role so team context is visible in the profile header.

## Team seats
- Teams consume one seat per active member; pending invitations reserve a seat until they expire or are revoked.
- Seat usage should be calculated from active users plus outstanding invites to avoid over-provisioning.
- Org owners and admins can invite or remove members, reassign seats freed by removals, and see remaining seat counts.
- The UI should highlight when the team is at or over capacity and block new invites until seats free up or billing adds capacity.

## Sharing rules for sessions and comparisons
- Sessions and lap comparisons are private to their creator by default.
- Items can be shared with specific teammates or the entire organization; the sharing modal should show current recipients and their role-derived permissions.
- Viewers can open sessions/comparisons and download exports; editors can modify metadata, annotations, and comparison pairings.
- Owners/admins can transfer ownership or revoke access; revoked users immediately lose visibility of the item.
- Public links are disabled to keep telemetry private—sharing must target authenticated teammates.

## Role-aware UI for permissions
- Roles: **Owner** (billing + full control), **Admin** (manage members/sharing), **Editor** (create/edit sessions and comparisons), **Viewer** (read-only).
- UI controls (edit buttons, upload actions, delete/revoke options) should render only when the current role allows the action; disallowed actions should show a tooltip explaining the required role.
- Share dialogs should default new recipients to the lowest role that meets the requested permission (e.g., viewer for read access) and prevent granting higher access than the user's role allows.
- Audit states (e.g., disabled buttons) should still display resource metadata so viewers can understand context even without edit rights.
