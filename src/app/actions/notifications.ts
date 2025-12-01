"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notificationQueue } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";
import { tasks } from "@trigger.dev/sdk/v3";
import type { NotificationQueueItem } from "@/lib/schema";
import type {
  NotificationType,
  NotificationPayload,
} from "@/lib/types/notification";
import { insertNotificationCore } from "@/lib/data/notifications";

type Result<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Fetches all pending notifications for the current user.
 * Returns notifications sorted by scheduledFor date (newest first).
 */
export async function getPendingNotifications(): Promise<
  Result<NotificationQueueItem[]>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const notifications = await db
      .select()
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.userId, session.user.id),
          eq(notificationQueue.status, "PENDING_APPROVAL")
        )
      )
      .orderBy(desc(notificationQueue.scheduledFor));

    return { success: true, data: notifications };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch notifications",
    };
  }
}

/**
 * Approves a notification and dispatches it to a Trigger.dev background task
 * for actual email sending via Microsoft Graph API.
 *
 * Flow: Update status to APPROVED -> Dispatch to send-approved-email task
 */
export async function approveNotification(
  notificationId: number
): Promise<Result<{ runId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify ownership and pending status
    const [notification] = await db
      .select()
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.id, notificationId),
          eq(notificationQueue.userId, session.user.id),
          eq(notificationQueue.status, "PENDING_APPROVAL")
        )
      )
      .limit(1);

    if (!notification) {
      return {
        success: false,
        error: "Notification not found or already processed",
      };
    }

    // Update status to APPROVED
    await db
      .update(notificationQueue)
      .set({ status: "APPROVED" })
      .where(eq(notificationQueue.id, notificationId));

    // Dispatch to Trigger.dev background task (Write-Behind pattern)
    const handle = await tasks.trigger("send-approved-email", {
      notificationId,
      userId: session.user.id,
    });

    return { success: true, data: { runId: handle.id } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to approve notification",
    };
  }
}

/**
 * Rejects a notification, marking it as REJECTED.
 * Rejected notifications are not sent.
 */
export async function rejectNotification(
  notificationId: number
): Promise<Result<{ id: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const [result] = await db
      .update(notificationQueue)
      .set({ status: "REJECTED" })
      .where(
        and(
          eq(notificationQueue.id, notificationId),
          eq(notificationQueue.userId, session.user.id),
          eq(notificationQueue.status, "PENDING_APPROVAL")
        )
      );

    // Check if any rows were affected
    if (!result || result.affectedRows === 0) {
      return {
        success: false,
        error: "Notification not found or already processed",
      };
    }

    return { success: true, data: { id: notificationId } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to reject notification",
    };
  }
}

/**
 * Creates a new notification in the queue with PENDING_APPROVAL status.
 * This is a helper function for queueing notifications from other parts of the app.
 *
 * Uses insertNotificationCore for the actual DB operation, providing a single
 * source of truth for Drizzle logic (shared with Trigger.dev tasks).
 */
export async function createNotification(
  repairOrderId: number,
  type: NotificationType,
  payload: NotificationPayload,
  scheduledFor: Date
): Promise<Result<{ id: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const insertedId = await insertNotificationCore({
      repairOrderId,
      userId: session.user.id,
      type,
      payload,
      scheduledFor,
    });

    if (!insertedId) {
      return { success: false, error: "Failed to insert notification" };
    }

    return { success: true, data: { id: insertedId } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create notification",
    };
  }
}

/**
 * Fetches all notifications for the current user (all statuses).
 * Useful for displaying notification history.
 */
export async function getAllNotifications(
  limit = 50
): Promise<Result<NotificationQueueItem[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const notifications = await db
      .select()
      .from(notificationQueue)
      .where(eq(notificationQueue.userId, session.user.id))
      .orderBy(desc(notificationQueue.createdAt))
      .limit(limit);

    return { success: true, data: notifications };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch notifications",
    };
  }
}
