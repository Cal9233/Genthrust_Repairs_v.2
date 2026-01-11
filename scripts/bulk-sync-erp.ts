// scripts/bulk-sync-erp.ts
// Bulk sync all ERP orders to MySQL
// Run with: npx tsx scripts/bulk-sync-erp.ts

import { config } from "dotenv";
config({ path: ".env.local" });

async function runBulkSync() {
  console.log("🚀 Starting Bulk ERP Sync...\n");

  const { fetchExternalListInternal, syncRepairOrderInternal } = await import(
    "../src/app/actions/external-repair-orders"
  );

  // 1. Fetch List
  const listRes = await fetchExternalListInternal(50);
  if (!listRes.success) {
    console.error("❌ Failed to fetch list:", listRes.error);
    process.exit(1);
  }

  const items = listRes.data;
  console.log(`📦 Found ${items.length} orders to sync.\n`);

  let successCount = 0;
  let failCount = 0;

  // 2. Loop and Sync
  for (const item of items) {
    process.stdout.write(`   Syncing ${item.poNo} (${item.poId})... `);

    const res = await syncRepairOrderInternal(item.poId, false);

    if (res.success) {
      console.log(`✅ ${res.data.action}`);
      successCount++;
    } else {
      console.log(`❌ Failed: ${res.error}`);
      failCount++;
    }
  }

  console.log(`\n🏁 Bulk Sync Complete.`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  process.exit(0);
}

runBulkSync().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
