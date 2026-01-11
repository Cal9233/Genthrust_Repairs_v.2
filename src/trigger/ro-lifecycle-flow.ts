import { task, logger, wait } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { db } from "../lib/db";
import { active } from "../lib/schema";
import { eq } from "drizzle-orm";
import { insertNotificationCore } from "../lib/data/notifications";
import { getShopEmailByName } from "../lib/data/shops";
import { createCalendarEvent, createToDoTask } from "../lib/graph/productivity";
import { COMPANY_NAME } from "../lib/constants/company";
import { parseDate } from "../lib/date-utils";

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
 * Check if payment terms indicate NET-30 payment terms.
 * Handles patterns like "NET 30", "Net30", "NET-30", "30", etc.
 * Returns true if terms contain "NET" (case-insensitive) or "30".
 */
function hasNet30Terms(terms: string | null | undefined): boolean {
  if (!terms) return false;
  const normalizedTerms = terms.toUpperCase().trim();
  // Check if terms contain "NET" (case-insensitive) or "30"
  return normalizedTerms.includes("NET") || normalizedTerms.includes("30");
}

/**
 * Parse payment terms to extract the number of days.
 * Handles patterns like "NET 30", "Net30", "NET 60 DAYS", etc.
 * For NET-30 specifically, always returns 30.
 */
function parsePaymentTermsDays(terms: string | null | undefined): number | null {
  if (!terms) return null;
  const match = terms.match(/net\s*(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  // If no match but terms contain "30", assume NET-30
  if (hasNet30Terms(terms)) {
    return 30;
  }
  return null;
}

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
${COMPANY_NAME}`,
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
${COMPANY_NAME}`,
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
${COMPANY_NAME}`,
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
${COMPANY_NAME}`,
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
${COMPANY_NAME}`,
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
${COMPANY_NAME}`,
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
// Includes RECEIVED explicitly for NET payment reminders (not in STATUS_CONFIGS)
const TRACKED_STATUSES = [...Object.keys(STATUS_CONFIGS), "RECEIVED"];

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

    try {
      // Fetch the repair order details first
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
      // SPECIAL HANDLING: RECEIVED with NET Terms
      // ==========================================
      // Handle RECEIVED status FIRST (before checking STATUS_CONFIGS)
      // For RECEIVED status, create payment reminders based on NET payment terms
      // then return early (no wait/email flow needed)
      if (normalizedStatus === "RECEIVED") {
        // Parse payment terms to get the actual number of days (NET 30, NET 60, etc.)
        const paymentDays = parsePaymentTermsDays(repairOrder.terms);
        if (!paymentDays) {
          logger.info("RECEIVED status without NET payment terms, skipping", {
            terms: repairOrder.terms
          });
          return { success: true, action: "skipped" };
        }

        // Calculate payment due date: paymentDays from status date (or today if null)
        const statusDate = parseDate(repairOrder.curentStatusDate);
        const baseDate = statusDate ? new Date(statusDate) : new Date();
        // Set to start of day for consistent calculation (all-day event)
        baseDate.setHours(0, 0, 0, 0);
        const paymentDueDate = new Date(baseDate);
        paymentDueDate.setDate(paymentDueDate.getDate() + paymentDays);
        // Ensure it remains at start of day for all-day event
        paymentDueDate.setHours(0, 0, 0, 0);

        const roNumber = repairOrder.ro ?? repairOrderId;
        const partNumber = repairOrder.part ?? "Unknown Part";
        const shopName = repairOrder.shopName ?? "Repair Shop";
        const estimatedCost = repairOrder.estimatedCost 
          ? `$${repairOrder.estimatedCost.toLocaleString()}` 
          : "N/A";

        // To-Do Task title and body
        const todoTitle = `PAYMENT DUE: RO#${roNumber} - ${shopName}`;
        const todoBody = `Amount: ${estimatedCost}. Part: ${partNumber}.`;

        // Calendar Event subject (no shop name in subject)
        const calendarSubject = `PAYMENT DUE: RO#${roNumber}`;
        const calendarBody = `Payment due for RO#${roNumber}
Part: ${partNumber}
Shop: ${shopName}
Amount: ${estimatedCost}
Terms: ${repairOrder.terms || "NET-30"}
Due Date: ${paymentDueDate.toLocaleDateString()}

Process payment for this repair order.`;

        // Create Calendar Event and To-Do Task with error handling
        try {
          await Promise.all([
            createCalendarEvent(userId, calendarSubject, paymentDueDate, paymentDueDate, calendarBody),
            createToDoTask(userId, todoTitle, paymentDueDate, todoBody),
          ]);
          logger.info("Payment reminders created for RECEIVED RO with NET-30 terms", {
            repairOrderId,
            roNumber,
            paymentDueDate: paymentDueDate.toISOString(),
            statusDate: statusDate?.toISOString() || "today",
          });
        } catch (error) {
          // Log error but don't crash the task - payment reminders are important but not critical
          logger.error("Failed to create payment reminders for NET-30 RO", {
            repairOrderId,
            error: error instanceof Error ? error.message : String(error),
          });
          // Still return success since the status change was processed
          // The reminders can be created manually if needed
        }

        return { success: true, action: "reminder_created" };
      }

      // ==========================================
      // Check if this status has follow-up configuration
      // ==========================================
      const config = STATUS_CONFIGS[normalizedStatus];
      if (!config) {
        logger.info("Status not tracked for follow-ups, skipping", { newStatus: normalizedStatus });
        return {
          success: true,
          action: "skipped",
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

/**
 * Backfill Payment Reminders Task
 *
 * One-time task to create payment reminders for existing ROs
 * that are already in RECEIVED status with NET terms.
 *
 * Run this once after deploying the payment reminder feature
 * to catch existing ROs that missed the status change trigger.
 */
export const backfillPaymentReminders = task({
  id: "backfill-payment-reminders",
  machine: {
    preset: "small-1x",
  },
  run: async (payload: { userId: string }) => {
    const { userId } = payload;

    logger.info("Starting backfill of payment reminders for existing RECEIVED ROs");

    // Find all ROs in RECEIVED status with NET terms
    const receivedROs = await db
      .select()
      .from(active)
      .where(eq(active.curentStatus, "RECEIVED"));

    let processed = 0;
    let skipped = 0;
    let created = 0;

    for (const ro of receivedROs) {
      processed++;

      // Check for NET terms
      const paymentDays = parsePaymentTermsDays(ro.terms);
      if (!paymentDays) {
        skipped++;
        continue;
      }

      // Calculate due date from status date (when marked RECEIVED)
      let receivedDate = new Date();
      if (ro.curentStatusDate) {
        const parsed = new Date(ro.curentStatusDate);
        if (!isNaN(parsed.getTime())) {
          receivedDate = parsed;
        }
      }

      const paymentDueDate = new Date(receivedDate.getTime() + paymentDays * 24 * 60 * 60 * 1000);

      // Skip if due date is in the past
      if (paymentDueDate < new Date()) {
        logger.info("Skipping RO with past due date", {
          roId: ro.id,
          roNumber: ro.ro,
          paymentDueDate: paymentDueDate.toISOString(),
        });
        skipped++;
        continue;
      }

      const roNumber = ro.ro ?? ro.id;
      const partNumber = ro.part ?? "Unknown Part";
      const shopName = ro.shopName ?? "Repair Shop";

      const reminderTitle = `Payment Due: RO# G${roNumber} - ${shopName}`;
      const reminderBody = `Payment due for RO# G${roNumber}
Part: ${partNumber}
Shop: ${shopName}
Terms: ${ro.terms}
Due Date: ${paymentDueDate.toLocaleDateString()}

Process payment for this repair order.`;

      try {
        await Promise.all([
          createCalendarEvent(userId, reminderTitle, paymentDueDate, paymentDueDate, reminderBody),
          createToDoTask(userId, reminderTitle, paymentDueDate, reminderBody),
        ]);
        created++;
        logger.info("Created payment reminders for existing RO", {
          roId: ro.id,
          roNumber,
          paymentDays,
          paymentDueDate: paymentDueDate.toISOString(),
        });
      } catch (error) {
        logger.warn("Failed to create reminders for RO", {
          roId: ro.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("Backfill complete", { processed, created, skipped });

    return {
      success: true,
      processed,
      created,
      skipped,
    };
  },
});
