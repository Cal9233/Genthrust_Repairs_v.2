import { task, logger, wait } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { db } from "../lib/db";
import { active } from "../lib/schema";
import { eq } from "drizzle-orm";
import { insertNotificationCore } from "../lib/data/notifications";
import { getShopEmailByName } from "../lib/data/shops";
import { createCalendarEvent, createToDoTask } from "../lib/graph/productivity";

/**
 * Payload schema for handle-ro-status-change task
 */
export const roStatusChangePayloadSchema = z.object({
  repairOrderId: z.number(),
  newStatus: z.string(),
  oldStatus: z.string(),
  userId: z.string(),
});

export type RoStatusChangePayload = z.infer<typeof roStatusChangePayloadSchema>;

/**
 * Output schema for handle-ro-status-change task
 */
export const roStatusChangeOutputSchema = z.object({
  success: z.boolean(),
  action: z.enum([
    "reminder_created",
    "email_drafted",
    "status_resolved",
    "skipped",
    "failed",
  ]),
  notificationId: z.number().optional(),
  error: z.string().optional(),
});

export type RoStatusChangeOutput = z.infer<typeof roStatusChangeOutputSchema>;


/**
 * Status configuration for follow-up emails
 */
type StatusConfig = {
  waitDays: number;
  emailSubject: (roNumber: string | number, partNumber: string) => string;
  emailBody: (roNumber: string | number, partNumber: string) => string;
  reminderTitle: (roNumber: string | number, partNumber: string) => string;
  reminderBody: (roNumber: string | number, partNumber: string, shopName: string, droppedOff: string) => string;
};

const STATUS_CONFIGS: Record<string, StatusConfig> = {
  "WAITING QUOTE": {
    waitDays: 7,
    emailSubject: (roNumber, _partNumber) =>
      `Follow-up: RO# G${roNumber}`,
    emailBody: (roNumber, partNumber) =>
`Hi Team,

Just checking in on RO# G${roNumber} for part ${partNumber}.

We'd love an update on the quote when you have a moment.

Thanks!
Genthrust XVII, LLC`,
    reminderTitle: (roNumber, partNumber) =>
      `Follow up on RO# G${roNumber} - ${partNumber}`,
    reminderBody: (roNumber, partNumber, shopName, droppedOff) =>
`Repair Order# G${roNumber}
Part: ${partNumber}
Shop: ${shopName}
Status: WAITING QUOTE
Dropped Off: ${droppedOff}

Follow up with the shop for a quote.`,
  },

  "APPROVED": {
    waitDays: 10,
    emailSubject: (roNumber, _partNumber) =>
      `Repair Status: RO# G${roNumber}`,
    emailBody: (roNumber, partNumber) =>
`Hi Team,

Checking in on the repair progress for RO# G${roNumber}, part ${partNumber}.

Please let us know if there are any updates or if you need anything from us.

Thanks!
Genthrust XVII, LLC`,
    reminderTitle: (roNumber, partNumber) =>
      `Check repair progress: RO# G${roNumber} - ${partNumber}`,
    reminderBody: (roNumber, partNumber, shopName, droppedOff) =>
`Repair Order# G${roNumber}
Part: ${partNumber}
Shop: ${shopName}
Status: APPROVED (payment sent)
Dropped Off: ${droppedOff}

Follow up on repair progress.`,
  },

  "IN WORK": {
    waitDays: 10,
    emailSubject: (roNumber, _partNumber) =>
      `Repair Status: RO# G${roNumber}`,
    emailBody: (roNumber, partNumber) =>
`Hi Team,

Checking in on the repair progress for RO# G${roNumber}, part ${partNumber}.

Please let us know if there are any updates or if you need anything from us.

Thanks!
Genthrust XVII, LLC`,
    reminderTitle: (roNumber, partNumber) =>
      `Check repair progress: RO# G${roNumber} - ${partNumber}`,
    reminderBody: (roNumber, partNumber, shopName, droppedOff) =>
`Repair Order# G${roNumber}
Part: ${partNumber}
Shop: ${shopName}
Status: IN WORK
Dropped Off: ${droppedOff}

Follow up on repair progress.`,
  },

  "IN PROGRESS": {
    waitDays: 10,
    emailSubject: (roNumber, _partNumber) =>
      `Repair Status: RO# G${roNumber}`,
    emailBody: (roNumber, partNumber) =>
`Hi Team,

Checking in on the repair progress for RO# G${roNumber}, part ${partNumber}.

Please let us know if there are any updates or if you need anything from us.

Thanks!
Genthrust XVII, LLC`,
    reminderTitle: (roNumber, partNumber) =>
      `Check repair progress: RO# G${roNumber} - ${partNumber}`,
    reminderBody: (roNumber, partNumber, shopName, droppedOff) =>
`Repair Order# G${roNumber}
Part: ${partNumber}
Shop: ${shopName}
Status: IN PROGRESS
Dropped Off: ${droppedOff}

Follow up on repair progress.`,
  },

  "SHIPPED": {
    waitDays: 5,
    emailSubject: (roNumber, _partNumber) =>
      `Tracking: RO# G${roNumber}`,
    emailBody: (roNumber, partNumber) =>
`Hi Team,

Could you please provide tracking information for RO# G${roNumber}, part ${partNumber}?

Thanks!
Genthrust XVII, LLC`,
    reminderTitle: (roNumber, partNumber) =>
      `Check shipment: RO# G${roNumber} - ${partNumber}`,
    reminderBody: (roNumber, partNumber, shopName, droppedOff) =>
`Repair Order# G${roNumber}
Part: ${partNumber}
Shop: ${shopName}
Status: SHIPPED
Dropped Off: ${droppedOff}

Follow up on shipment tracking.`,
  },

  "IN TRANSIT": {
    waitDays: 5,
    emailSubject: (roNumber, _partNumber) =>
      `Tracking: RO# G${roNumber}`,
    emailBody: (roNumber, partNumber) =>
`Hi Team,

Could you please provide tracking information for RO# G${roNumber}, part ${partNumber}?

Thanks!
Genthrust XVII, LLC`,
    reminderTitle: (roNumber, partNumber) =>
      `Check shipment: RO# G${roNumber} - ${partNumber}`,
    reminderBody: (roNumber, partNumber, shopName, droppedOff) =>
`Repair Order# G${roNumber}
Part: ${partNumber}
Shop: ${shopName}
Status: IN TRANSIT
Dropped Off: ${droppedOff}

Follow up on shipment tracking.`,
  },
};

// Statuses that trigger the follow-up flow
const TRACKED_STATUSES = Object.keys(STATUS_CONFIGS);

/**
 * handle-ro-status-change Task (The Durable Waiter)
 *
 * Implements status-based waiting periods with follow-up emails.
 * Uses Trigger.dev's durable execution for the wait period.
 *
 * Supported statuses and wait times:
 * - WAITING QUOTE: 7 days
 * - APPROVED: 10 days
 * - IN WORK / IN PROGRESS: 10 days
 * - SHIPPED / IN TRANSIT: 5 days
 *
 * Flow:
 * 1. Immediate Setup: Create Calendar Event + To Do Task
 * 2. Durable Delay: wait.for({ days: X })
 * 3. Re-Validation: Check if status has changed
 * 4. Email Draft: Generate follow-up email if status unchanged
 * 5. Queue for Approval: Insert into notification queue
 */
export const handleRoStatusChange = task({
  id: "handle-ro-status-change",
  machine: {
    preset: "small-1x",
  },
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: RoStatusChangePayload): Promise<RoStatusChangeOutput> => {
    const { repairOrderId, newStatus, oldStatus, userId } = payload;
    const normalizedStatus = newStatus.toUpperCase().trim();

    logger.info("Processing RO status change", {
      repairOrderId,
      newStatus: normalizedStatus,
      oldStatus,
      userId,
    });

    // Check if this status is tracked for follow-ups
    const config = STATUS_CONFIGS[normalizedStatus];
    if (!config) {
      logger.info("Status not tracked for follow-ups, skipping", { newStatus: normalizedStatus });
      return {
        success: true,
        action: "skipped",
      };
    }

    try {
      // Fetch the repair order details
      const [repairOrder] = await db
        .select()
        .from(active)
        .where(eq(active.id, repairOrderId))
        .limit(1);

      if (!repairOrder) {
        logger.error("Repair order not found", { repairOrderId });
        return {
          success: false,
          action: "failed",
          error: "Repair order not found",
        };
      }

      // ==========================================
      // PHASE 1: Immediate Setup
      // ==========================================
      logger.info("Phase 1: Creating immediate reminders", {
        status: normalizedStatus,
        waitDays: config.waitDays
      });

      const followUpDate = new Date(Date.now() + config.waitDays * 24 * 60 * 60 * 1000);
      const roNumber = repairOrder.ro ?? repairOrderId;
      const partNumber = repairOrder.part ?? "Unknown Part";
      const shopName = repairOrder.shopName ?? "Repair Shop";
      const droppedOff = repairOrder.dateDroppedOff ?? "N/A";

      const reminderTitle = config.reminderTitle(roNumber, partNumber);
      const reminderBody = config.reminderBody(roNumber, partNumber, shopName, droppedOff);

      // Create Calendar Event and To Do Task in parallel
      try {
        await Promise.all([
          createCalendarEvent(
            userId,
            reminderTitle,
            followUpDate,
            followUpDate,
            reminderBody
          ),
          createToDoTask(userId, reminderTitle, followUpDate, reminderBody),
        ]);
        logger.info("Reminders created successfully");
      } catch (error) {
        // Log but don't fail - reminders are nice-to-have
        logger.warn("Failed to create reminders, continuing", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // ==========================================
      // PHASE 2: Durable Delay
      // ==========================================
      logger.info(`Phase 2: Starting ${config.waitDays}-day wait period`);

      await wait.for({ days: config.waitDays });

      logger.info(`Phase 2: Wake-up after ${config.waitDays}-day wait`);

      // ==========================================
      // PHASE 3: Re-Validation
      // ==========================================
      logger.info("Phase 3: Re-validating RO status");

      const [currentRO] = await db
        .select()
        .from(active)
        .where(eq(active.id, repairOrderId))
        .limit(1);

      if (!currentRO) {
        logger.warn("Repair order no longer exists", { repairOrderId });
        return {
          success: true,
          action: "status_resolved",
        };
      }

      // Check if status has changed
      const currentStatus = currentRO.curentStatus?.toUpperCase().trim() ?? "";
      if (currentStatus !== normalizedStatus) {
        logger.info("Status has been resolved, no email needed", {
          repairOrderId,
          originalStatus: normalizedStatus,
          currentStatus,
        });
        return {
          success: true,
          action: "status_resolved",
        };
      }

      // ==========================================
      // PHASE 4: Email Draft (Static Template)
      // ==========================================
      logger.info("Phase 4: Generating follow-up email draft");

      const currentRoNumber = currentRO.ro ?? repairOrderId;
      const currentPartNumber = currentRO.part ?? "Unknown";
      const currentShopName = currentRO.shopName;

      const emailSubject = config.emailSubject(currentRoNumber, currentPartNumber);
      const emailBody = config.emailBody(currentRoNumber, currentPartNumber);

      logger.info("Email draft generated", {
        subjectLength: emailSubject.length,
        bodyLength: emailBody.length,
      });

      // ==========================================
      // PHASE 5: Queue for Approval
      // ==========================================
      logger.info("Phase 5: Looking up shop email and queueing for approval");

      // Look up the shop's email address
      const shopEmail = await getShopEmailByName(currentShopName);
      const ccEmail = process.env.GENTHRUST_CC_EMAIL;

      if (!shopEmail) {
        logger.warn("No email found for shop, skipping email notification", {
          repairOrderId,
          shopName: currentShopName,
        });
        return {
          success: true,
          action: "skipped",
        };
      }

      logger.info("Shop email found", { shopEmail, ccEmail: ccEmail ?? "(not configured)" });

      const notificationId = await insertNotificationCore({
        repairOrderId,
        userId,
        type: "EMAIL_DRAFT",
        payload: {
          to: shopEmail,
          cc: ccEmail,
          subject: emailSubject,
          body: emailBody,
        },
        scheduledFor: new Date(),
      });

      if (!notificationId) {
        logger.error("Failed to insert notification into queue");
        return {
          success: false,
          action: "failed",
          error: "Failed to queue email for approval",
        };
      }

      logger.info("Email draft queued for approval", { notificationId });

      return {
        success: true,
        action: "email_drafted",
        notificationId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Failed to process RO status change", {
        repairOrderId,
        error: errorMessage,
      });

      // Re-throw for Trigger.dev retry
      throw error;
    }
  },
});
