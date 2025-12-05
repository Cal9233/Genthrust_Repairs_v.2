// src/lib/data/notifications.ts
// Pure Drizzle logic for Notification Queue manipulation.
// Used by both Server Actions (after auth) and unauthenticated Trigger.dev tasks.

import { db } from "@/lib/db";
import { notificationQueue } from "@/lib/schema";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import type { NewNotificationQueueItem, NotificationQueueItem } from "@/lib/schema";

/**
 * Checks if a PENDING_APPROVAL notification already exists for a repair order.
 * Used to prevent duplicate pending drafts for the same RO.
 */
export async function findExistingPendingNotification(
  repairOrderId: number
): Promise<number | null> {
  try {
    const [existing] = await db
      .select({ id: notificationQueue.id })
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.repairOrderId, repairOrderId),
          eq(notificationQueue.status, "PENDING_APPROVAL")
        )
      )
      .limit(1);

    return existing?.id ?? null;
  } catch (error) {
    console.error("Error checking for existing notification:", error);
    return null;
  }
}

/**
 * Core function to insert a new notification record into the database.
 * Does NOT perform session/auth checks.
 *
 * DEDUPLICATION: If a PENDING_APPROVAL notification already exists for
 * this RO, returns the existing ID instead of creating a duplicate.
 *
 * @param data - The notification data, including userId.
 * @returns The ID of the notification (new or existing) or null on failure.
 */
export async function insertNotificationCore(
  data: Omit<NewNotificationQueueItem, "id" | "createdAt" | "status"> & {
    status?: NewNotificationQueueItem["status"];
  }
): Promise<number | null> {
  try {
    const targetStatus = data.status || "PENDING_APPROVAL";

    // Deduplication: if creating PENDING_APPROVAL, check for existing
    if (targetStatus === "PENDING_APPROVAL") {
      const existingId = await findExistingPendingNotification(data.repairOrderId);
      if (existingId) {
        console.log(
          `[notification] Skipping duplicate: RO ${data.repairOrderId} already has pending #${existingId}`
        );
        return existingId;
      }
    }

    const [inserted] = await db
      .insert(notificationQueue)
      .values({
        ...data,
        status: targetStatus,
      })
      .$returningId();

    return Number(inserted.id) || null;
  } catch (error) {
    console.error("Error inserting notification core:", error);
    return null;
  }
}

/**
 * Core function to fetch a notification by ID.
 * Does NOT perform session/auth checks.
 *
 * @param notificationId - The notification ID to fetch.
 * @returns The notification record or null if not found.
 */
export async function getNotificationById(
  notificationId: number
): Promise<NotificationQueueItem | null> {
  try {
    const [notification] = await db
      .select()
      .from(notificationQueue)
      .where(eq(notificationQueue.id, notificationId))
      .limit(1);

    return notification || null;
  } catch (error) {
    console.error("Error fetching notification:", error);
    return null;
  }
}

/**
 * Core function to update a notification's status.
 * Does NOT perform session/auth checks.
 *
 * @param notificationId - The notification ID to update.
 * @param status - The new status value.
 * @returns True if update succeeded, false otherwise.
 */
export async function updateNotificationStatus(
  notificationId: number,
  status: NewNotificationQueueItem["status"]
): Promise<boolean> {
  try {
    await db
      .update(notificationQueue)
      .set({ status })
      .where(eq(notificationQueue.id, notificationId));

    return true;
  } catch (error) {
    console.error("Error updating notification status:", error);
    return false;
  }
}

/**
 * Find the internetMessageId from the most recent sent email for an RO.
 * Used to thread new emails with existing conversation via In-Reply-To header.
 *
 * @param repairOrderId - The RO ID to find thread for
 * @returns The internetMessageId (outlook_message_id) or null if no prior sent email
 */
export async function getEmailThreadForRO(
  repairOrderId: number
): Promise<string | null> {
  try {
    const [sent] = await db
      .select({ outlookMessageId: notificationQueue.outlookMessageId })
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.repairOrderId, repairOrderId),
          eq(notificationQueue.type, "EMAIL_DRAFT"),
          eq(notificationQueue.status, "SENT"),
          isNotNull(notificationQueue.outlookMessageId)
        )
      )
      .orderBy(desc(notificationQueue.createdAt))
      .limit(1);

    return sent?.outlookMessageId ?? null;
  } catch (error) {
    console.error("Error fetching email thread for RO:", error);
    return null;
  }
}

/**
 * Update notification with Outlook IDs after successful send.
 * Uses schema columns (not JSON payload) for data integrity.
 *
 * @param notificationId - The notification ID to update
 * @param messageId - The internetMessageId from Graph API (used for In-Reply-To)
 * @param conversationId - The conversationId from Graph API (used for UI grouping)
 * @returns True if update succeeded
 */
export async function updateNotificationOutlookIds(
  notificationId: number,
  messageId: string,
  conversationId: string
): Promise<boolean> {
  try {
    await db
      .update(notificationQueue)
      .set({
        outlookMessageId: messageId,
        outlookConversationId: conversationId,
      })
      .where(eq(notificationQueue.id, notificationId));

    return true;
  } catch (error) {
    console.error("Error updating notification Outlook IDs:", error);
    return false;
  }
}
