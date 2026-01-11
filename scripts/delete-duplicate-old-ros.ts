// scripts/delete-duplicate-old-ros.ts
// Delete old ROs that have duplicates in ERP
// Run with: npx tsx scripts/delete-duplicate-old-ros.ts

import { config } from "dotenv";
config({ path: ".env.local" });

async function deleteDuplicates() {
  console.log("🗑️  Deleting duplicate old ROs (keeping ERP versions)...\n");

  const { db } = await import("../src/lib/db");
  const { active } = await import("../src/lib/schema");
  const { inArray } = await import("drizzle-orm");

  // Old RO IDs to delete (from duplicate finder output)
  const oldIdsToDelete = [
    60,   // RO#38546
    85,   // RO#38585
    90,   // RO#38589
    96,   // RO#38595
    101,  // RO#38601
    102,  // RO#38602
    103,  // RO#38603
    104,  // RO#38604
    109,  // RO#38610
    110,  // RO#38611
    113,  // RO#38614
    114,  // RO#38615
    115,  // RO#38616
  ];

  console.log(`Deleting ${oldIdsToDelete.length} old RO records...`);

  const result = await db
    .delete(active)
    .where(inArray(active.id, oldIdsToDelete));

  console.log(`\n✅ Deleted ${oldIdsToDelete.length} duplicate old ROs.`);
  console.log("   ERP versions have been preserved.");

  process.exit(0);
}

deleteDuplicates().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
