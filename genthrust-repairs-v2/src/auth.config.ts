import type { NextAuthConfig } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/**
 * Edge-Compatible Auth Configuration
 *
 * This config is used by middleware (Edge runtime).
 * It cannot include the database adapter (MySQL is not Edge-compatible).
 * The full config with adapter is in auth.ts.
 */
export default {
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!,
      authorization: {
        params: {
          // CRITICAL: offline_access required for refresh_token
          // This allows background workers to act on behalf of users
          //
          // Excel Sync scopes:
          // - Files.ReadWrite.All: Read/write files in OneDrive/SharePoint
          // - Sites.ReadWrite.All: Access SharePoint sites for Excel sync
          //
          // Notification feature scopes:
          // - Calendars.ReadWrite: Create Outlook Calendar events
          // - Tasks.ReadWrite: Create Microsoft To Do items
          // - Mail.Send: Send emails on behalf of user
          // - Mail.ReadWrite: Create draft emails in user's mailbox
          scope: "openid profile email User.Read offline_access Files.ReadWrite.All Sites.ReadWrite.All Calendars.ReadWrite Tasks.ReadWrite Mail.Send Mail.ReadWrite",
          // Allow user to select account; admin consent already granted tenant-wide
          prompt: "select_account",
        },
      },
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isOnSignIn = nextUrl.pathname === "/signin";

      // Redirect logged-in users away from sign-in page
      if (isOnSignIn && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      // Protect dashboard routes
      if (isOnDashboard) {
        return isLoggedIn;
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
