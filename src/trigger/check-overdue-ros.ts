import { schedules, logger } from "@trigger.dev/sdk/v3";
import { db } from "../lib/db";
import { active, users, notificationQueue } from "../lib/schema";
import { eq, and, lt } from "drizzle-orm";
import { insertNotificationCore } from "../lib/data/notifications";
import { getShopEmailByName } from "../lib/data/shops";
import { isOverdue } from "../lib/date-utils";

/**
 * Overdue Safety Net - Runs daily at 8:00 AM UTC
 *
 * Step 1: Bumps stale PENDING_APPROVAL notifications (24h+) to top of UI list
 * Step 2: Finds overdue ROs (nextDateToUpdate < today) - matches dashboard definition
 * Step 3: Creates follow-up email drafts for user approval
 *
 * This catches ROs that:
 * - Became overdue before the notification system was online
 * - Missed the real-time status change trigger
 * - Need follow-up reminders
 *
 * Uses static email templates (no AI costs) matching ro-lifecycle-flow.ts
 */
export const checkOverdueRos = schedules.task({
  id: "check-overdue-ros",
  cron: "0 8 * * *", // 8:00 AM UTC daily
  machine: { preset: "small-1x" },
  run: async () => {
    // ============================================================
    // STEP 1: Bump stale PENDING_APPROVAL notifications (24h+)
    // This moves old pending items to the top of the UI list
    // ============================================================
    logger.info("Step 1: Bumping stale pending notifications...");

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const bumpResult = await db
      .update(notificationQueue)
      .set({ scheduledFor: new Date() })
      .where(
        and(
          eq(notificationQueue.status, "PENDING_APPROVAL"),
          lt(notificationQueue.scheduledFor, twentyFourHoursAgo)
        )
      );

    const bumpedCount = bumpResult[0]?.affectedRows ?? 0;
    logger.info(`Bumped ${bumpedCount} stale notifications to top of queue`);

    // ============================================================
    // STEP 2: Find overdue ROs (nextDateToUpdate < today)
    // Matches dashboard definition for consistency
    // ============================================================
    logger.info("Step 2: Scanning for overdue ROs...");

    // Fetch all active ROs with nextDateToUpdate field
    // (Must filter in memory due to string date format)
    const allActiveROs = await db
      .select({
        id: active.id,
        ro: active.ro,
        part: active.part,
        serial: active.serial,
        shopName: active.shopName,
        nextDateToUpdate: active.nextDateToUpdate,
        curentStatus: active.curentStatus,
      })
      .from(active);

    // Filter for overdue using shared isOverdue() function
    const overdueROs = allActiveROs.filter((ro) => isOverdue(ro.nextDateToUpdate));

    logger.info(`Found ${overdueROs.length} overdue ROs (nextDateToUpdate < today)`);

    if (overdueROs.length === 0) {
      return { bumped: bumpedCount, processed: 0 };
    }

    // ============================================================
    // STEP 3: Create notifications for overdue ROs
    // (insertNotificationCore handles deduplication automatically)
    // ============================================================
    logger.info("Step 3: Creating notifications for overdue ROs...");

    const [defaultUser] = await db
      .select({ id: users.id })
      .from(users)
      .limit(1);

    if (!defaultUser) {
      logger.error("No users found in system");
      return { bumped: bumpedCount, processed: 0, error: "No users found" };
    }

    let processed = 0;
    const ccEmail = process.env.GENTHRUST_CC_EMAIL;

    for (const ro of overdueROs) {
      try {
        const shopEmail = await getShopEmailByName(ro.shopName);

        // Don't skip - create notification even without email
        if (!shopEmail) {
          logger.warn(`No email found for shop "${ro.shopName}", creating notification without recipient`);
        }

        const roNumber = ro.ro ?? ro.id;
        const partNumber = ro.part ?? "Unknown Part";
        const status = ro.curentStatus ?? "Unknown Status";

        const subject = `Follow-up: RO# G${roNumber}`;
        const body = `Hi Team,

Just checking in on RO# G${roNumber} for part ${partNumber}.

Current status: ${status}

We'd love an update when you have a moment.

Thanks!
GenThrust`;

        // insertNotificationCore handles deduplication - returns existing ID if duplicate
        const notificationId = await insertNotificationCore({
          repairOrderId: ro.id,
          userId: defaultUser.id,
          type: "EMAIL_DRAFT",
          payload: {
            to: shopEmail || "",  // Empty string if no email
            cc: ccEmail,
            subject,
            body,
            missingEmail: !shopEmail,  // Flag for UI
            shopName: ro.shopName ?? undefined,     // For display when email missing
          },
          scheduledFor: new Date(),
        });

        if (notificationId) {
          processed++;
          logger.info(`Queued notification ${notificationId} for RO# G${roNumber}`, {
            shopEmail: shopEmail || "(missing)",
          });
        }
      } catch (error) {
        logger.error(`Failed to process RO ${ro.id}`, { error });
      }
    }

    logger.info(`Task complete: bumped=${bumpedCount}, processed=${processed}`);
    return { bumped: bumpedCount, processed, total: overdueROs.length };
  },
});
