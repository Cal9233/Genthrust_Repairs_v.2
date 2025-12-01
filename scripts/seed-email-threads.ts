// scripts/seed-email-threads.ts
// Run with: npx tsx scripts/seed-email-threads.ts

import { config } from "dotenv";
config({ path: ".env.local" }); // Load .env.local BEFORE importing db

async function seedEmailThreads() {
  // Dynamic import after env vars are loaded
  const { db, pool } = await import("../src/lib/db");
  const { notificationQueue, active, users } = await import("../src/lib/schema");
  const { desc } = await import("drizzle-orm");

  console.log("🌱 Seeding email thread test data...\n");

  // 1. Get 3 active ROs to create threads for
  const sampleROs = await db
    .select({ id: active.id, ro: active.ro, shopName: active.shopName })
    .from(active)
    .orderBy(desc(active.id))
    .limit(3);

  if (sampleROs.length === 0) {
    console.error("❌ No active ROs found in database");
    await pool.end();
    process.exit(1);
  }

  // 2. Get a user (the first one)
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .limit(1);
  if (!user) {
    console.error("❌ No users found in database");
    await pool.end();
    process.exit(1);
  }

  console.log(`📧 Using user: ${user.email}`);
  console.log(`📋 Creating threads for ${sampleROs.length} ROs\n`);

  // 3. Generate test data for each RO
  const now = new Date();
  const testData = sampleROs.flatMap((ro, roIndex) => {
    const conversationId = `AAQkADAwATM0MDAAMS1hThread${roIndex + 1}==`;
    const threadEmails = [
      {
        subject: `Quote Request - RO #G${ro.ro}`,
        body: `<p>Hi,</p><p>Please provide a quote for the repair work on part ${ro.ro}.</p><p>Best regards,<br/>GenThrust Team</p>`,
        daysAgo: 7,
      },
      {
        subject: `RE: Quote Received - RO #G${ro.ro}`,
        body: `<p>Thank you for the quote. We approve the repair at $1,250.00.</p><p>Please proceed.</p>`,
        daysAgo: 5,
      },
      {
        subject: `Parts Ordered - RO #G${ro.ro}`,
        body: `<p>We have ordered the replacement parts. ETA: 3 business days.</p>`,
        daysAgo: 3,
      },
      {
        subject: `Repair Complete - RO #G${ro.ro}`,
        body: `<p>Good news! The repair has been completed and the part is ready for pickup.</p><p>Please arrange shipping.</p>`,
        daysAgo: 1,
      },
    ];

    return threadEmails.map((email, emailIndex) => ({
      repairOrderId: ro.id,
      userId: user.id,
      type: "EMAIL_DRAFT" as const,
      status: "SENT" as const,
      payload: {
        toAddress: `repairs@${ro.shopName?.toLowerCase().replace(/\s+/g, "") || "shop"}.com`,
        subject: email.subject,
        body: email.body,
      },
      scheduledFor: new Date(now.getTime() - email.daysAgo * 24 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - email.daysAgo * 24 * 60 * 60 * 1000),
      outlookMessageId: `<msg${roIndex + 1}-${emailIndex + 1}@genthrust.outlook.com>`,
      outlookConversationId: conversationId,
    }));
  });

  // 4. Insert test data
  console.log(`📝 Inserting ${testData.length} test notifications...`);

  for (const notification of testData) {
    await db.insert(notificationQueue).values(notification);
    console.log(
      `  ✓ RO #${notification.repairOrderId}: "${notification.payload.subject}"`
    );
  }

  console.log(
    `\n✅ Done! Created ${testData.length} test emails across ${sampleROs.length} threads.`
  );
  console.log("🔔 Open the NotificationBell History tab to see the threads.");

  // Close the connection pool
  await pool.end();
  process.exit(0);
}

seedEmailThreads().catch(async (err) => {
  console.error("❌ Seed failed:", err);
  // Try to close the pool if it was initialized
  try {
    const { pool } = await import("../src/lib/db");
    await pool.end();
  } catch {
    // Pool may not be initialized
  }
  process.exit(1);
});
