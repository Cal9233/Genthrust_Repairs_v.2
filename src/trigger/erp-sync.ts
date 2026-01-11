/**
 * ERP.aero Periodic Sync Task
 *
 * Background task that runs every 4 hours to sync repair orders
 * from the external ERP system to the local MySQL database.
 *
 * This ensures data consistency even when users aren't actively
 * using the application.
 *
 * Uses Internal functions from external-repair-orders.ts which:
 * - Don't require Next.js request context (no auth() calls)
 * - Skip revalidatePath() since we're not in a Next.js context
 */

import { schedules, logger, task } from "@trigger.dev/sdk/v3";
import {
  fetchExternalListInternal,
  syncRepairOrderInternal
} from "../app/actions/external-repair-orders";

// ============================================
// Types
// ============================================

interface SyncResults {
  processed: number;
  created: number;
  updated: number;
  failed: number;
  errors: string[];
}

// ============================================
// Scheduled Task - Every 4 Hours
// ============================================

/**
 * Periodic ERP Sync
 *
 * Runs every 4 hours to fetch the latest repair orders from ERP
 * and sync them to the local database.
 */
export const scheduledERPSync = schedules.task({
  id: "erp-periodic-sync",
  cron: "0 */4 * * *", // Every 4 hours
  machine: { preset: "small-1x" },
  run: async () => {
    logger.info("Starting Scheduled ERP Sync", { time: new Date().toISOString() });

    const results: SyncResults = {
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    // Fetch list of recent ROs from ERP (using Internal function - no auth required)
    const listResult = await fetchExternalListInternal(50);

    if (!listResult.success) {
      logger.error("ERP Sync failed to fetch list", { error: listResult.error });
      results.errors.push(`List fetch failed: ${listResult.error}`);
      return results;
    }

    const items = listResult.data;
    logger.info(`Found ${items.length} repair orders to process`);

    // Process each RO
    for (const item of items) {
      const poId = item.poId;

      // Use Internal sync function with shouldRevalidate=false (no Next.js context)
      const res = await syncRepairOrderInternal(poId, false);

      if (res.success) {
        if (res.data.action === "SYNC_CREATE") {
          results.created++;
          logger.info(`Created RO from ERP PO#${poId}`);
        } else {
          results.updated++;
          logger.info(`Updated RO from ERP PO#${poId}`);
        }
      } else {
        logger.error(`Failed to sync PO ${poId}`, { error: res.error });
        results.failed++;
        results.errors.push(`PO ${poId}: ${res.error}`);
      }

      results.processed++;

      // Rate limit: 500ms between requests
      if (results.processed < items.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    logger.info("ERP Sync Completed", { results });
    return results;
  },
});

// ============================================
// Manual Trigger Task
// ============================================

/**
 * Manual ERP Sync Task
 *
 * Can be triggered manually to sync specific PO IDs or all recent ROs.
 * Useful for on-demand syncing from the UI.
 */
export const manualERPSync = task({
  id: "erp-manual-sync",
  machine: { preset: "small-1x" },
  run: async (payload: { poIds?: number[] }) => {
    logger.info("Starting Manual ERP Sync", {
      specificPOs: payload.poIds?.length ?? "all recent"
    });

    const results: SyncResults = {
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    let poIdsToSync: number[];

    if (payload.poIds && payload.poIds.length > 0) {
      // Sync specific PO IDs
      poIdsToSync = payload.poIds;
    } else {
      // Fetch all recent from ERP (using Internal function - no auth required)
      const listResult = await fetchExternalListInternal(50);

      if (!listResult.success) {
        logger.error("Failed to fetch ERP list", { error: listResult.error });
        return { ...results, errors: [listResult.error] };
      }

      poIdsToSync = listResult.data.map(item => item.poId);
    }

    logger.info(`Processing ${poIdsToSync.length} repair orders`);

    for (const poId of poIdsToSync) {
      // Use Internal sync function with shouldRevalidate=false (no Next.js context)
      const res = await syncRepairOrderInternal(poId, false);

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

      results.processed++;

      // Rate limit
      if (results.processed < poIdsToSync.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    logger.info("Manual ERP Sync Completed", { results });
    return results;
  },
});
