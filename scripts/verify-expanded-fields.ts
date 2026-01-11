// scripts/verify-expanded-fields.ts
// Verify the expanded ERP field mapping
// Run with: npx tsx scripts/verify-expanded-fields.ts

import { config } from "dotenv";
config({ path: ".env.local" });

async function verify() {
  console.log("🔍 Verifying expanded ERP fields...\n");

  const { db } = await import("../src/lib/db");
  const { active } = await import("../src/lib/schema");
  const { isNotNull, desc } = await import("drizzle-orm");

  const erpROs = await db
    .select({
      ro: active.ro,
      terms: active.terms,
      trackingNumberPickingUp: active.trackingNumberPickingUp,
      estimatedDeliveryDate: active.estimatedDeliveryDate,
      curentStatusDate: active.curentStatusDate,
      lastDateUpdated: active.lastDateUpdated,
      notes: active.notes,
    })
    .from(active)
    .where(isNotNull(active.erpPoId))
    .orderBy(desc(active.ro))
    .limit(10);

  console.log("RO#".padEnd(8) + "Terms".padEnd(12) + "Ship Via".padEnd(10) + "Lead Time".padEnd(12) + "Status Date".padEnd(14) + "Notes");
  console.log("─".repeat(80));

  for (const r of erpROs) {
    console.log(
      String(r.ro).padEnd(8) +
      (r.terms || "—").padEnd(12) +
      (r.trackingNumberPickingUp || "—").substring(0, 8).padEnd(10) +
      (r.estimatedDeliveryDate || "—").substring(0, 10).padEnd(12) +
      (r.curentStatusDate || "—").padEnd(14) +
      (r.notes || "—").substring(0, 20)
    );
  }

  console.log("\n🏁 Done.");
  process.exit(0);
}

verify().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
