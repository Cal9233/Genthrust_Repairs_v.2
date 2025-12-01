// src/lib/data/notifications.ts
// Pure Drizzle logic for Notification Queue manipulation.
// Used by both Server Actions (after auth) and unauthenticated Trigger.dev tasks.

import { db } from "@/lib/db";
import { notificationQueue } from "@/lib/schema";
import { eq } from "drizzle-orm";
import type { NewNotificationQueueItem, NotificationQueueItem } from "@/lib/schema";

/**
 * Core function to insert a new notification record into the database.
 * Does NOT perform session/auth checks.
 *
 * @param data - The notification data, including userId.
 * @returns The ID of the newly inserted notification or null on failure.
 */
export async function insertNotificationCore(
  data: Omit<NewNotificationQueueItem, "id" | "createdAt" | "status"> & {
    status?: NewNotificationQueueItem["status"];
  }
): Promise<number | null> {
  try {
    const [inserted] = await db
      .insert(notificationQueue)
      .values({
        ...data,
        // Status defaults to PENDING_APPROVAL in the schema, but we ensure consistency here
        status: data.status || "PENDING_APPROVAL",
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
