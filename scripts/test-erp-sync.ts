// scripts/test-erp-sync.ts
// Tests ERP sync using Internal functions (no auth required)
// Run with: npx tsx scripts/test-erp-sync.ts

// Load environment variables FIRST (before any imports that read env vars)
import { config } from "dotenv";
config({ path: ".env.local" });

// Dynamic import AFTER dotenv runs (to ensure env vars are loaded)
async function runTest() {
  console.log("🔍 Starting ERP Sync Test...\n");

  // Import modules after dotenv has loaded env vars
  const { fetchExternalListInternal, syncRepairOrderInternal } = await import(
    "../src/app/actions/external-repair-orders"
  );

  // Step 1: Fetch list from ERP
  console.log("1️⃣  Fetching recent Repair Orders from ERP API...");

  const listResult = await fetchExternalListInternal(10);

  if (!listResult.success) {
    console.error("❌ Failed to fetch list:", listResult.error);
    process.exit(1);
  }

  console.log(`✅ Successfully fetched ${listResult.data.length} orders from ERP.\n`);

  if (listResult.data.length === 0) {
    console.log("⚠️  No orders found in ERP.");
    process.exit(0);
  }

  // Show what we got
  console.log("📋 Orders from ERP:");
  for (const item of listResult.data.slice(0, 5)) {
    console.log(`   - ${item.poNo} (ID: ${item.poId}) - Status: ${item.status}`);
  }

  // Step 2: Sync the first order to database
  const firstOrder = listResult.data[0];
  const poId = firstOrder.poId;
  const poNo = firstOrder.poNo;

  console.log(`\n2️⃣  Syncing ${poNo} (ID: ${poId}) to MySQL database...`);

  // Use Internal sync function with shouldRevalidate=false (no Next.js context)
  const syncResult = await syncRepairOrderInternal(poId, false);

  if (!syncResult.success) {
    console.error("❌ Sync failed:", syncResult.error);
    process.exit(1);
  }

  console.log(`✅ Sync Successful!`);
  console.log(`   Action: ${syncResult.data.action}`);
  console.log(`   Local DB ID: ${syncResult.data.id}`);

  console.log("\n🏁 Test Complete!");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
