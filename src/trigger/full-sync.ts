// src/trigger/full-sync.ts
import { task, logger } from "@trigger.dev/sdk/v3";
import { fetchExternalListInternal, syncRepairOrderInternal } from "@/app/actions/external-repair-orders";

export const fullHistorySync = task({
  id: "full-history-sync",
  run: async (payload: { startPage?: number } = { startPage: 1 }) => {
    logger.log("📚 Starting Full ERP History Sync");

    let page = payload.startPage || 1;
    let hasMore = true;
    let totalSynced = 0;
    const PAGE_LIMIT = 50; // The API limit per page

    while (hasMore) {
      logger.log(`Fetching Page ${page}...`);

      const listRes = await fetchExternalListInternal(PAGE_LIMIT, page);

      if (!listRes.success) {
        logger.error(`Failed to fetch page ${page}`, { error: listRes.error });
        hasMore = false;
        break;
      }

      const items = listRes.data;
      if (items.length === 0) {
        hasMore = false;
        break;
      }

      logger.log(`Page ${page}: Processing ${items.length} orders...`);

      for (const item of items) {
        // Sync item (pass false to skip revalidation for speed)
        await syncRepairOrderInternal(item.poId, false);
      }

      totalSynced += items.length;

      // Stop if page is not full (end of list)
      if (items.length < PAGE_LIMIT) {
        hasMore = false;
      } else {
        page++;
        // Tiny pause to be nice to the API
        await new Promise(r => setTimeout(r, 200));
      }
    }

    logger.log("🏁 Full Sync Complete", { totalSynced });
    return { totalSynced };
  },
});
