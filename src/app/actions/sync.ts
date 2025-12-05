"use server";

import { auth } from "@/auth";
import { tasks } from "@trigger.dev/sdk/v3";
import { syncRepairOrders } from "@/trigger/excel-sync";
import { db } from "@/lib/db";
import { active } from "@/lib/schema";

/**
 * Result type per CLAUDE.md Section 4
 * All Server Actions must return this standardized type.
 */
type Result<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Trigger handle returned when starting a sync job
 */
export interface TriggerSyncResult {
  /** The Trigger.dev run ID for tracking */
  runId: string;
  /** Public access token for realtime updates */
  publicAccessToken: string;
}

/**
 * Payload for triggering sync from UI (userId injected from session)
 */
interface TriggerSyncPayload {
  userId: string;
  repairOrderIds: number[];
}

/**
 * triggerSync Server Action
 *
 * Authenticates the user and dispatches the sync-repair-orders task
 * to Trigger.dev for background processing.
 *
 * Per CLAUDE.md Section 3A (Write-Behind Pattern):
 * Flow: UI -> Server Action -> MySQL Write -> Push Job to Trigger.dev
 *
 * @param payload - The sync payload containing userId and repairOrderIds
 * @returns Result with runId and publicAccessToken for realtime tracking
 */
export async function triggerSync(
  payload: TriggerSyncPayload
): Promise<Result<TriggerSyncResult>> {
  try {
    // ==========================================
    // AUTHENTICATION CHECK
    // ==========================================
    const session = await auth();

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized: You must be signed in to sync repair orders",
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
    // VALIDATION
    // ==========================================
    if (!payload.repairOrderIds || payload.repairOrderIds.length === 0) {
      return {
        success: false,
        error: "Validation error: At least one repairOrderId is required",
      };
    }

    // ==========================================
    // TRIGGER THE BACKGROUND TASK
    // ==========================================
    // Use session userId for security (ignore payload userId)
    const handle = await tasks.trigger<typeof syncRepairOrders>(
      "sync-repair-orders",
      {
        userId: session.user.id,
        repairOrderIds: payload.repairOrderIds,
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
    console.error("triggerSync error:", error);
    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Failed to trigger sync job",
    };
  }
}

/**
 * triggerExcelSync Server Action
 *
 * Convenience function for UI components that takes userId and repairOrderIds
 * as separate parameters.
 *
 * @param userId - The user ID (for authentication context)
 * @param repairOrderIds - Array of repair order IDs to sync
 * @returns Result with runId and publicAccessToken for realtime tracking
 */
export async function triggerExcelSync(
  userId: string,
  repairOrderIds: number[]
): Promise<Result<TriggerSyncResult>> {
  return triggerSync({ userId, repairOrderIds });
}

/**
 * triggerSyncAllActive Server Action
 *
 * Syncs ALL active repair orders to Excel.
 * Fetches all RO IDs from the active table, then triggers the sync task.
 *
 * @returns Result with runId and publicAccessToken for realtime tracking
 */
export async function triggerSyncAllActive(): Promise<Result<TriggerSyncResult>> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized: You must be signed in to sync repair orders",
      };
    }

    if (session.error) {
      return {
        success: false,
        error: `Authentication error: ${session.error}. Please sign in again.`,
      };
    }

    // Fetch all active RO IDs
    const allActiveROs = await db
      .select({ id: active.id })
      .from(active);

    const repairOrderIds = allActiveROs.map((ro) => ro.id);

    if (repairOrderIds.length === 0) {
      return {
        success: false,
        error: "No active repair orders to sync",
      };
    }

    // Trigger the sync task
    const handle = await tasks.trigger<typeof syncRepairOrders>(
      "sync-repair-orders",
      {
        userId: session.user.id,
        repairOrderIds,
      }
    );

    const publicAccessToken = await handle.publicAccessToken;

    return {
      success: true,
      data: {
        runId: handle.id,
        publicAccessToken,
      },
    };
  } catch (error) {
    console.error("triggerSyncAllActive error:", error);
    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Failed to trigger sync job",
    };
  }
}
