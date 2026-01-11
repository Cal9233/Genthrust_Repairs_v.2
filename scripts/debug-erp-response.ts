// scripts/debug-erp-response.ts
// Debug what the ERP API actually returns for a single RO
// Run with: npx tsx scripts/debug-erp-response.ts

import { config } from "dotenv";
config({ path: ".env.local" });

async function debugResponse() {
  console.log("🔍 Fetching raw ERP response...\n");

  const { fetchERPRepairOrderDetails } = await import("../src/lib/api/erp-client");
  const { fetchExternalListInternal } = await import("../src/app/actions/external-repair-orders");

  // Get first order from list
  const listRes = await fetchExternalListInternal(1);
  if (!listRes.success) {
    console.error("Failed to fetch list:", listRes.error);
    process.exit(1);
  }

  const firstOrder = listRes.data[0];
  console.log(`Fetching details for ${firstOrder.poNo} (ID: ${firstOrder.poId})...\n`);

  // Get full details
  const details = await fetchERPRepairOrderDetails(firstOrder.poId);

  // Show the first part with all its fields
  const part = details.partsList[0];
  console.log("═".repeat(60));
  console.log("BODY DETAILS:");
  console.log("═".repeat(60));
  console.log("body.created_time:", details.body.created_time);
  console.log("body.modified_time:", details.body.modified_time);

  console.log("\n" + "═".repeat(60));
  console.log("FIRST PART DETAILS:");
  console.log("═".repeat(60));
  console.log("part.leadtime:", part.leadtime);
  console.log("part.condition:", part.condition);
  console.log("part.tags:", JSON.stringify(part.tags, null, 2));
  console.log("part.json_data:", JSON.stringify(part.json_data, null, 2));
  console.log("\nFull part object keys:", Object.keys(part));

  process.exit(0);
}

debugResponse().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
