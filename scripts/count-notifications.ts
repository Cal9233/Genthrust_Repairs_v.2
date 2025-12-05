// scripts/count-notifications.ts
// Run with: npx tsx scripts/count-notifications.ts

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db, pool } = await import("../src/lib/db");
  const { notificationQueue } = await import("../src/lib/schema");
  const { sql, eq } = await import("drizzle-orm");

  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notificationQueue);

  console.log("Total notifications:", result.count);

  const [pending] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notificationQueue)
    .where(eq(notificationQueue.status, "PENDING_APPROVAL"));

  console.log("Pending approval:", pending.count);

  await pool.end();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
