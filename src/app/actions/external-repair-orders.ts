"use server";

/**
 * Server Actions for ERP.aero Integration
 *
 * Provides functions to fetch and sync repair orders from the external ERP system.
 * Follows the Result<T> pattern established in the codebase.
 *
 * Architecture:
 * - *Internal functions: No auth, optional revalidation - for scripts & Trigger.dev
 * - Regular functions: With auth & revalidation - for UI components
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { active, roActivityLog } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  fetchERPRepairOrderList,
  fetchERPRepairOrderDetails,
  parseERPRoNumber
} from "@/lib/api/erp-client";
import { mapERPDetailsToLocal, mapERPListItemToSummary } from "@/lib/api/erp-mapping";
import { revalidatePath } from "next/cache";

// ============================================
// Types
// ============================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

export interface ERPListSummary {
  poId: number;
  poNo: string;
  status: string;
  rawStatus: string;
  modifiedTime: string;
  createdTime: string | null;
}

export interface SyncResult {
  id: number;
  action: "SYNC_CREATE" | "SYNC_UPDATE";
}

// ============================================
// INTERNAL FUNCTIONS (For Scripts & Trigger.dev)
// No Auth checks, Optional Revalidation
// ============================================

/**
 * Fetch list of repair orders from ERP (Internal - no auth).
 * Use this in scripts and Trigger.dev tasks.
 */
export async function fetchExternalListInternal(
  limit = 50,
  page = 1
): Promise<Result<ERPListSummary[]>> {
  try {
    const data = await fetchERPRepairOrderList(limit, page);
    const summaries = data.list.map(mapERPListItemToSummary);
    return { success: true, data: summaries };
  } catch (error) {
    console.error("fetchExternalListInternal error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch ERP list"
    };
  }
}

/**
 * Sync a repair order from ERP to MySQL (Internal - no auth).
 * Use this in scripts and Trigger.dev tasks.
 *
 * @param externalPoId - The po_id from ERP (number)
 * @param shouldRevalidate - Whether to call revalidatePath (false for non-Next.js contexts)
 */
export async function syncRepairOrderInternal(
  externalPoId: number,
  shouldRevalidate = false
): Promise<Result<SyncResult>> {
  try {
    // Fetch full details from ERP
    const details = await fetchERPRepairOrderDetails(externalPoId);

    // Parse RO number from po_no string (e.g., "RO171" -> 171)
    const roNumber = parseERPRoNumber(details.body.po_no);
    if (!roNumber) {
      return {
        success: false,
        error: `Could not parse RO number from ${details.body.po_no}`
      };
    }

    // Map ERP fields to local schema
    const mappedData = mapERPDetailsToLocal(details);
    const today = new Date().toISOString().split("T")[0];

    // Check if RO already exists locally
    const [existing] = await db
      .select()
      .from(active)
      .where(eq(active.ro, roNumber))
      .limit(1);

    let localId: number;
    let actionType: "SYNC_CREATE" | "SYNC_UPDATE";

    if (existing) {
      // UPDATE existing record
      await db.update(active)
        .set({
          ...mappedData,
          lastDateUpdated: today,
        })
        .where(eq(active.id, existing.id));

      localId = existing.id;
      actionType = "SYNC_UPDATE";
    } else {
      // CREATE new record
      const insertResult = await db.insert(active).values({
        ro: roNumber,
        dateMade: details.body.created_time
          ? details.body.created_time.split("T")[0]
          : today,
        ...mappedData,
        curentStatusDate: today,
        lastDateUpdated: today,
        nextDateToUpdate: today,
        notes: `Imported from ERP PO#${externalPoId}`,
      }).$returningId();

      const newRec = insertResult[0] as { id: number } | undefined;

      if (!newRec?.id) {
        // Fallback: fetch by RO number if $returningId fails
        const [created] = await db
          .select()
          .from(active)
          .where(eq(active.ro, roNumber))
          .limit(1);

        if (!created) {
          return { success: false, error: "Failed to create record" };
        }
        localId = created.id;
      } else {
        localId = newRec.id;
      }
      actionType = "SYNC_CREATE";
    }

    // Log the sync activity
    try {
      await db.insert(roActivityLog).values({
        repairOrderId: localId,
        action: "ERP_SYNC",
        newValue: `Synced with ERP PO #${externalPoId} (${actionType})`,
        userId: "system",
      });
    } catch (logError) {
      // Don't fail the sync if activity log fails
      console.error("Failed to log ERP sync activity:", logError);
    }

    // Only revalidate if running in Next.js request context
    if (shouldRevalidate) {
      revalidatePath("/dashboard");
    }

    return {
      success: true,
      data: { id: localId, action: actionType }
    };
  } catch (error) {
    console.error(`syncRepairOrderInternal error for PO ${externalPoId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Sync failed"
    };
  }
}

// ============================================
// SERVER ACTIONS (For UI Components)
// With Auth checks & Revalidation
// ============================================

/**
 * Fetch list of repair orders from ERP.
 * Returns summary data for display in a list view.
 * Requires authentication.
 */
export async function fetchExternalList(
  limit = 50
): Promise<Result<ERPListSummary[]>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }
  return fetchExternalListInternal(limit);
}

/**
 * Fetch detailed information for a specific repair order from ERP.
 * Requires authentication.
 */
export async function fetchExternalDetails(
  poId: number
): Promise<Result<ReturnType<typeof mapERPDetailsToLocal>>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const data = await fetchERPRepairOrderDetails(poId);
    const mapped = mapERPDetailsToLocal(data);

    return { success: true, data: mapped };
  } catch (error) {
    console.error(`fetchExternalDetails error for PO ${poId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch ERP details"
    };
  }
}

/**
 * Sync a repair order from ERP to local MySQL database.
 * Requires authentication. Revalidates dashboard after sync.
 *
 * @param externalPoId - The po_id from ERP (number)
 * @returns Result with local ID and action taken
 */
export async function syncRepairOrder(
  externalPoId: number
): Promise<Result<SyncResult>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }
  return syncRepairOrderInternal(externalPoId, true);
}

/**
 * Bulk sync multiple repair orders from ERP.
 * Processes sequentially with rate limiting to avoid API throttling.
 * Requires authentication.
 *
 * @param poIds - Array of ERP po_id values to sync
 * @returns Summary of sync results
 */
export async function bulkSyncRepairOrders(
  poIds: number[]
): Promise<Result<{
  processed: number;
  created: number;
  updated: number;
  failed: number;
  errors: string[];
}>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const results = {
    processed: 0,
    created: 0,
    updated: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const poId of poIds) {
    try {
      // Use internal version, revalidate only on last item
      const isLast = results.processed === poIds.length - 1;
      const res = await syncRepairOrderInternal(poId, isLast);

      if (res.success) {
        if (res.data.action === "SYNC_CREATE") {
          results.created++;
        } else {
          results.updated++;
        }
      } else {
        results.failed++;
        results.errors.push(`PO ${poId}: ${res.error}`);
      }
    } catch (err) {
      results.failed++;
      results.errors.push(
        `PO ${poId}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }

    results.processed++;

    // Rate limit: 500ms between requests
    if (results.processed < poIds.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return { success: true, data: results };
}

/**
 * Sync all repair orders from ERP.
 * Fetches the list and syncs each one.
 * Requires authentication.
 *
 * @returns Summary of sync results
 */
export async function syncAllFromERP(): Promise<Result<{
  total: number;
  created: number;
  updated: number;
  failed: number;
}>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  // Fetch list from ERP
  const listRes = await fetchExternalListInternal(50);
  if (!listRes.success) {
    return { success: false, error: listRes.error };
  }

  const poIds = listRes.data.map(item => item.poId);

  // Use existing bulk sync
  const syncRes = await bulkSyncRepairOrders(poIds);
  if (!syncRes.success) {
    return { success: false, error: syncRes.error };
  }

  return {
    success: true,
    data: {
      total: syncRes.data.processed,
      created: syncRes.data.created,
      updated: syncRes.data.updated,
      failed: syncRes.data.failed,
    }
  };
}
