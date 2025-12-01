import { schedules, logger } from "@trigger.dev/sdk/v3";
import { db } from "../lib/db";
import { active, users } from "../lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { insertNotificationCore } from "../lib/data/notifications";

/**
 * Overdue Safety Net - Runs daily at 8:00 AM UTC
 *
 * Finds ROs that have been in WAITING QUOTE status for 7+ days
 * and creates follow-up email drafts for user approval.
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
  // Run daily at 8:00 AM UTC
  cron: "0 8 * * *",
  machine: { preset: "small-1x" },
  run: async () => {
    logger.info("Starting overdue RO check");

    // Find ROs in WAITING QUOTE status for 7+ days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    // Query for overdue ROs
    const overdueROs = await db
      .select({
        id: active.id,
        ro: active.ro,
        part: active.part,
        serial: active.serial,
        shopName: active.shopName,
        dateDroppedOff: active.dateDroppedOff,
        curentStatusDate: active.curentStatusDate,
      })
      .from(active)
      .where(
        and(
          eq(active.curentStatus, "WAITING QUOTE"),
          sql`${active.curentStatusDate} <= ${sevenDaysAgoStr}`
        )
      );

    logger.info(`Found ${overdueROs.length} overdue ROs`);

    if (overdueROs.length === 0) {
      return { processed: 0 };
    }

    // Get a default user to assign notifications to
    // (In production, this could be improved with RO ownership)
    const [defaultUser] = await db
      .select({ id: users.id })
      .from(users)
      .limit(1);

    if (!defaultUser) {
      logger.error("No users found in system");
      return { processed: 0, error: "No users found" };
    }

    let processed = 0;

    for (const ro of overdueROs) {
      try {
        // Generate static email template (no AI costs)
        const roNumber = ro.ro ?? ro.id;
        const partNumber = ro.part ?? "Unknown Part";

        const subject = `Follow-up: RO# G${roNumber}`;
        const body = `Hi Team,

Just checking in on RO# G${roNumber} for part ${partNumber}.

We'd love an update on the quote when you have a moment.

Thanks!
GenThrust`;

        // Queue notification for approval
        await insertNotificationCore({
          repairOrderId: ro.id,
          userId: defaultUser.id,
          type: "EMAIL_DRAFT",
          payload: {
            toAddress: "shop@example.com", // Placeholder - will be replaced with shop lookup
            subject,
            body,
          },
          scheduledFor: new Date(),
        });

        processed++;
        logger.info(`Queued notification for RO# G${roNumber}`);
      } catch (error) {
        logger.error(`Failed to process RO ${ro.id}`, { error });
      }
    }

    logger.info(`Processed ${processed} overdue ROs`);
    return { processed, total: overdueROs.length };
  },
});
