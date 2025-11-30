import "isomorphic-fetch";
import { Client } from "@microsoft/microsoft-graph-client";
import { db } from "./db";
import { accounts } from "./schema";
import { eq, and } from "drizzle-orm";
import type { TokenResponse, ExcelSession } from "./types/graph";
import { UserNotConnectedError, TokenRefreshError } from "./types/graph";

const MICROSOFT_TOKEN_ENDPOINT =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";

// SharePoint configuration
const SHAREPOINT_HOSTNAME = process.env.SHAREPOINT_HOSTNAME;
const SHAREPOINT_SITE_PATH = process.env.SHAREPOINT_SITE_PATH;

/**
 * Build the Graph API base path for the workbook
 *
 * For SharePoint: /sites/{hostname}:{site-path}:/drive/items/{itemId}/workbook
 * For OneDrive:   /me/drive/items/{itemId}/workbook
 */
export function getWorkbookBasePath(workbookId: string): string {
  if (SHAREPOINT_HOSTNAME && SHAREPOINT_SITE_PATH) {
    // SharePoint site path
    return `/sites/${SHAREPOINT_HOSTNAME}:${SHAREPOINT_SITE_PATH}:/drive/items/${workbookId}/workbook`;
  }
  // Fallback to personal OneDrive
  return `/me/drive/items/${workbookId}/workbook`;
}

/**
 * Build the Graph API path for a worksheet
 */
export function getWorksheetPath(workbookId: string, worksheetName: string): string {
  return `${getWorkbookBasePath(workbookId)}/worksheets/${worksheetName}`;
}

/**
 * Refresh the access token using the stored refresh_token
 */
async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
  const clientSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;

  if (!clientId || !clientSecret) {
    throw new TokenRefreshError(
      "Missing Microsoft OAuth credentials in environment"
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    // Sites.ReadWrite.All for SharePoint access
    scope: "openid profile email User.Read Files.ReadWrite.All Sites.ReadWrite.All offline_access",
  });

  const response = await fetch(MICROSOFT_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new TokenRefreshError(
      `Failed to refresh token: ${response.status} - ${error}`
    );
  }

  return response.json() as Promise<TokenResponse>;
}

/**
 * Get a Microsoft Graph client for a specific user
 *
 * Per CLAUDE.md: Background workers need to act on behalf of users,
 * so we retrieve the refresh_token from the accounts table and
 * exchange it for a fresh access_token.
 */
export async function getGraphClient(userId: string): Promise<Client> {
  // Query the accounts table for the Microsoft account
  const [account] = await db
    .select({
      refreshToken: accounts.refresh_token,
      accessToken: accounts.access_token,
      expiresAt: accounts.expires_at,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.provider, "microsoft-entra-id")
      )
    )
    .limit(1);

  if (!account || !account.refreshToken) {
    throw new UserNotConnectedError(userId);
  }

  // Get a fresh access token
  const tokenResponse = await refreshAccessToken(account.refreshToken);

  // Update stored tokens (Microsoft rotates refresh_tokens)
  await db
    .update(accounts)
    .set({
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token ?? account.refreshToken,
      expires_at: Math.floor(Date.now() / 1000) + tokenResponse.expires_in,
    })
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.provider, "microsoft-entra-id")
      )
    );

  return Client.init({
    authProvider: (done) => {
      done(null, tokenResponse.access_token);
    },
  });
}

/**
 * Create an Excel session for batch operations
 *
 * Per CLAUDE.md Section 3C: Use workbook-session-id with persistChanges: true.
 * Never open/close files per row.
 */
export async function createExcelSession(
  client: Client,
  workbookId: string
): Promise<ExcelSession> {
  const basePath = getWorkbookBasePath(workbookId);
  const response = await client
    .api(`${basePath}/createSession`)
    .post({ persistChanges: true });

  return response as ExcelSession;
}

/**
 * Close an Excel session to save changes
 */
export async function closeExcelSession(
  client: Client,
  workbookId: string,
  sessionId: string
): Promise<void> {
  const basePath = getWorkbookBasePath(workbookId);
  await client
    .api(`${basePath}/closeSession`)
    .header("workbook-session-id", sessionId)
    .post({});
}

/**
 * Helper to chunk an array into groups
 *
 * Per CLAUDE.md Section 3C: Always chunk Graph API writes into groups of 20
 * (JSON Batching limit).
 */
export function chunkArray<T>(array: T[], size: number = 20): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
