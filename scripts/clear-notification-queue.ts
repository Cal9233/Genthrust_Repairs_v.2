// scripts/clear-notification-queue.ts
// Run with: npx tsx scripts/clear-notification-queue.ts

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  // Dynamic imports to ensure env vars are loaded first
  const { db, pool } = await import("../src/lib/db");
  const { notificationQueue } = await import("../src/lib/schema");
  const { sql } = await import("drizzle-orm");

  console.log("Checking for notifications to delete...");

  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notificationQueue);

  const count = Number(result.count);
  console.log(`Found ${count} notifications.`);

  if (count > 0) {
    await db.delete(notificationQueue);
    console.log(`Deleted ${count} notifications.`);
  } else {
    console.log("No notifications to delete.");
  }

  await pool.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Error running script:", err);
  process.exit(1);
});
