// scripts/full-history-sync.ts
// Full ERP history sync - fetches ALL pages of repair orders
// Run with: npx tsx scripts/full-history-sync.ts

import { config } from "dotenv";
config({ path: ".env.local" });

async function runFullSync() {
  console.log("📚 Starting Full ERP History Sync...\n");

  const { fetchExternalListInternal, syncRepairOrderInternal } = await import(
    "../src/app/actions/external-repair-orders"
  );

  let page = 1;
  let totalSynced = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalFailed = 0;
  let hasMore = true;
  const BATCH_SIZE = 50;

  while (hasMore) {
    console.log(`\n📄 Fetching Page ${page}...`);

    // Fetch page
    const listRes = await fetchExternalListInternal(BATCH_SIZE, page);

    if (!listRes.success) {
      console.error(`❌ Failed to fetch page ${page}:`, listRes.error);
      break;
    }

    const items = listRes.data;

    if (items.length === 0) {
      console.log("⚠️ No more items found. Sync complete.");
      hasMore = false;
      break;
    }

    console.log(`   Found ${items.length} orders. Syncing...`);

    // Sync items in this page
    for (const item of items) {
      const poId = item.poId;

      // Pass false to skip revalidation for speed
      const res = await syncRepairOrderInternal(poId, false);

      if (res.success) {
        if (res.data.action === "SYNC_CREATE") {
          totalCreated++;
        } else {
          totalUpdated++;
        }
        process.stdout.write(".");
      } else {
        totalFailed++;
        process.stdout.write("x");
      }
    }

    totalSynced += items.length;
    console.log(`\n   ✅ Page ${page} complete.`);

    // If we got fewer items than the limit, we reached the end
    if (items.length < BATCH_SIZE) {
      hasMore = false;
    } else {
      page++;
      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\n🏁 Full Sync Finished!`);
  console.log(`   Total Processed: ${totalSynced}`);
  console.log(`   Created: ${totalCreated}`);
  console.log(`   Updated: ${totalUpdated}`);
  console.log(`   Failed: ${totalFailed}`);
  process.exit(0);
}

runFullSync().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
