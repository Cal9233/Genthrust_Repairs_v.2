// scripts/find-duplicate-ros.ts
// Find ROs that exist in both old system and ERP (matching by part + serial)
// Run with: npx tsx scripts/find-duplicate-ros.ts

import { config } from "dotenv";
config({ path: ".env.local" });

async function findDuplicates() {
  console.log("🔍 Finding ROs that exist in both old and ERP systems...\n");

  const { db } = await import("../src/lib/db");
  const { active } = await import("../src/lib/schema");
  const { isNull, isNotNull, and, sql } = await import("drizzle-orm");

  // Get old ROs (no erpPoId)
  const oldROs = await db
    .select({
      id: active.id,
      ro: active.ro,
      part: active.part,
      serial: active.serial,
      shopName: active.shopName,
      curentStatus: active.curentStatus,
    })
    .from(active)
    .where(isNull(active.erpPoId));

  // Get ERP-synced ROs (has erpPoId)
  const erpROs = await db
    .select({
      id: active.id,
      ro: active.ro,
      part: active.part,
      serial: active.serial,
      shopName: active.shopName,
      curentStatus: active.curentStatus,
      erpPoId: active.erpPoId,
    })
    .from(active)
    .where(isNotNull(active.erpPoId));

  console.log(`📦 Old system ROs (no ERP link): ${oldROs.length}`);
  console.log(`📦 ERP-synced ROs: ${erpROs.length}\n`);

  // Normalize: lowercase, trim, remove dashes
  const normalize = (s: string | null) =>
    s?.toLowerCase().trim().replace(/-/g, "") || "";

  // Find matches by part + serial (ignoring dashes)
  const matches: Array<{
    oldRO: typeof oldROs[0];
    erpRO: typeof erpROs[0];
  }> = [];

  for (const oldRO of oldROs) {
    // Skip if no part or serial
    if (!oldRO.part || !oldRO.serial) continue;

    const match = erpROs.find(
      (erp) =>
        normalize(erp.part) === normalize(oldRO.part) &&
        normalize(erp.serial) === normalize(oldRO.serial)
    );

    if (match) {
      matches.push({ oldRO, erpRO: match });
    }
  }

  if (matches.length === 0) {
    console.log("✅ No duplicates found - old and ERP systems have no overlapping ROs.");
  } else {
    console.log(`⚠️  Found ${matches.length} potential duplicates:\n`);
    console.log("─".repeat(100));

    for (const { oldRO, erpRO } of matches) {
      console.log(`OLD RO#${oldRO.ro} (ID: ${oldRO.id})`);
      console.log(`  Part: ${oldRO.part}`);
      console.log(`  Serial: ${oldRO.serial}`);
      console.log(`  Shop: ${oldRO.shopName}`);
      console.log(`  Status: ${oldRO.curentStatus}`);
      console.log("");
      console.log(`ERP RO#${erpRO.ro} (ID: ${erpRO.id}, ERP PO: ${erpRO.erpPoId})`);
      console.log(`  Part: ${erpRO.part}`);
      console.log(`  Serial: ${erpRO.serial}`);
      console.log(`  Shop: ${erpRO.shopName}`);
      console.log(`  Status: ${erpRO.curentStatus}`);
      console.log("─".repeat(100));
    }
  }

  console.log("\n🏁 Done.");
  process.exit(0);
}

findDuplicates().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
