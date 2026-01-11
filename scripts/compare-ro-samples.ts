// scripts/compare-ro-samples.ts
// Show sample ROs from old and ERP systems for comparison
// Run with: npx tsx scripts/compare-ro-samples.ts

import { config } from "dotenv";
config({ path: ".env.local" });

async function showSamples() {
  console.log("📊 Comparing Old vs ERP RO Data...\n");

  const { db } = await import("../src/lib/db");
  const { active } = await import("../src/lib/schema");
  const { isNull, isNotNull, desc } = await import("drizzle-orm");

  // Get old ROs (no erpPoId)
  const oldROs = await db
    .select({
      ro: active.ro,
      part: active.part,
      serial: active.serial,
      shopName: active.shopName,
    })
    .from(active)
    .where(isNull(active.erpPoId))
    .orderBy(desc(active.ro))
    .limit(15);

  // Get ERP-synced ROs (has erpPoId)
  const erpROs = await db
    .select({
      ro: active.ro,
      part: active.part,
      serial: active.serial,
      shopName: active.shopName,
    })
    .from(active)
    .where(isNotNull(active.erpPoId))
    .orderBy(desc(active.ro))
    .limit(15);

  console.log("═".repeat(80));
  console.log("OLD SYSTEM ROs (no ERP link)");
  console.log("═".repeat(80));
  console.log("RO#".padEnd(8) + "Part".padEnd(30) + "Serial".padEnd(25) + "Shop");
  console.log("─".repeat(80));
  for (const r of oldROs) {
    console.log(
      String(r.ro).padEnd(8) +
      (r.part || "—").substring(0, 28).padEnd(30) +
      (r.serial || "—").substring(0, 23).padEnd(25) +
      (r.shopName || "—").substring(0, 15)
    );
  }

  console.log("\n");
  console.log("═".repeat(80));
  console.log("ERP-SYNCED ROs");
  console.log("═".repeat(80));
  console.log("RO#".padEnd(8) + "Part".padEnd(30) + "Serial".padEnd(25) + "Shop");
  console.log("─".repeat(80));
  for (const r of erpROs) {
    console.log(
      String(r.ro).padEnd(8) +
      (r.part || "—").substring(0, 28).padEnd(30) +
      (r.serial || "—").substring(0, 23).padEnd(25) +
      (r.shopName || "—").substring(0, 15)
    );
  }

  console.log("\n🏁 Done.");
  process.exit(0);
}

showSamples().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
