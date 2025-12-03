"use server";

import { auth } from "@/auth";
import { tasks } from "@trigger.dev/sdk/v3";
import { importFromExcel } from "@/trigger/import-from-excel";

/**
 * Result type per CLAUDE.md Section 4
 * All Server Actions must return this standardized type.
 */
type Result<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Trigger handle returned when starting an import job
 */
export interface TriggerImportResult {
  /** The Trigger.dev run ID for tracking */
  runId: string;
  /** Public access token for realtime updates */
  publicAccessToken: string;
}

/**
 * triggerExcelImport Server Action
 *
 * Authenticates the user and dispatches the import-from-excel task
 * to Trigger.dev for background processing.
 *
 * Flow: Excel → Trigger.dev Task → MySQL
 * This is the inverse of the sync operation.
 *
 * @param userId - The user ID (for authentication context - validated against session)
 * @returns Result with runId and publicAccessToken for realtime tracking
 */
export async function triggerExcelImport(
  userId: string
): Promise<Result<TriggerImportResult>> {
  try {
    // ==========================================
    // AUTHENTICATION CHECK
    // ==========================================
    const session = await auth();

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized: You must be signed in to import from Excel",
      };
    }

    // Check for token errors (e.g., expired refresh token)
    if (session.error) {
      return {
        success: false,
        error: `Authentication error: ${session.error}. Please sign in again.`,
      };
    }

    // ==========================================
    // TRIGGER THE BACKGROUND TASK
    // ==========================================
    // Use session userId for security (ignore payload userId)
    const handle = await tasks.trigger<typeof importFromExcel>(
      "import-from-excel",
      {
        userId: session.user.id,
      }
    );

    // Get the public access token for realtime updates
    const publicAccessToken = await handle.publicAccessToken;

    return {
      success: true,
      data: {
        runId: handle.id,
        publicAccessToken,
      },
    };
  } catch (error) {
    console.error("triggerExcelImport error:", error);
    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Failed to trigger import job",
    };
  }
}
