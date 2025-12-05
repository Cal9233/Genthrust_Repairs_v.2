"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notificationQueue } from "@/lib/schema";
import { eq, and, desc, isNotNull, asc, or, sql, ne, inArray } from "drizzle-orm";
import { tasks } from "@trigger.dev/sdk/v3";
import type { NotificationQueueItem } from "@/lib/schema";
import type {
  NotificationType,
  NotificationPayload,
  ThreadMessage,
  ThreadHistoryResult,
  GraphMessage,
  EmailDraftPayload,
} from "@/lib/types/notification";
import { insertNotificationCore } from "@/lib/data/notifications";
import { getConversationMessages } from "@/lib/graph/productivity";
import { active } from "@/lib/schema";
import { updateShopEmail } from "@/lib/data/shops";

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

    // Note: Removed userId filter to show all pending notifications to any authenticated user
    // This is appropriate for single-user/admin scenarios where all notifications should be visible
    // INNER JOIN with active table to filter out orphaned notifications (ROs deleted from Excel)
    const notifications = await db
      .select({
        id: notificationQueue.id,
        userId: notificationQueue.userId,
        repairOrderId: notificationQueue.repairOrderId,
        type: notificationQueue.type,
        status: notificationQueue.status,
        payload: notificationQueue.payload,
        scheduledFor: notificationQueue.scheduledFor,
        createdAt: notificationQueue.createdAt,
        outlookMessageId: notificationQueue.outlookMessageId,
        outlookConversationId: notificationQueue.outlookConversationId,
      })
      .from(notificationQueue)
      .innerJoin(active, eq(notificationQueue.repairOrderId, active.id))
      .where(eq(notificationQueue.status, "PENDING_APPROVAL"))
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
 * Returns runId and publicAccessToken for real-time UI tracking via toast.
 */
export async function approveNotification(
  notificationId: number
): Promise<Result<{ runId: string; publicAccessToken: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify pending status (removed userId filter for single-tenant admin app)
    const [notification] = await db
      .select()
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.id, notificationId),
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

    // Get the public access token for real-time UI updates
    const publicAccessToken = await handle.publicAccessToken;

    return { success: true, data: { runId: handle.id, publicAccessToken } };
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

    // Removed userId filter for single-tenant admin app
    const [result] = await db
      .update(notificationQueue)
      .set({ status: "REJECTED" })
      .where(
        and(
          eq(notificationQueue.id, notificationId),
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

/**
 * Fetches all sent emails for a specific Repair Order, grouped as a thread.
 * Returns emails in chronological order to show conversation flow.
 *
 * @param repairOrderId - The RO ID to fetch email thread for
 * @deprecated Use getFullThreadHistory() for full inbound+outbound support
 */
export async function getEmailThreadHistory(
  repairOrderId: number
): Promise<Result<NotificationQueueItem[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const emails = await db
      .select()
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.repairOrderId, repairOrderId),
          eq(notificationQueue.type, "EMAIL_DRAFT"),
          eq(notificationQueue.status, "SENT"),
          eq(notificationQueue.userId, session.user.id)
        )
      )
      .orderBy(notificationQueue.createdAt); // Chronological order for thread view

    return { success: true, data: emails };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch thread history",
    };
  }
}

/**
 * Fetches full conversation history for a Repair Order (inbound + outbound).
 * Combines DB records (for internal metadata) with Graph API (for full thread).
 *
 * Architecture:
 * - Outbound emails: From notification_queue (DB) with internal status
 * - Inbound replies: From Microsoft Graph API via conversationId lookup
 * - Graceful degradation: If Graph fails, returns DB records only with warning
 *
 * @param repairOrderId - The RO ID to fetch conversation for
 */
export async function getFullThreadHistory(
  repairOrderId: number
): Promise<Result<ThreadHistoryResult>> {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return { success: false, error: "Unauthorized" };
    }

    // 1. Get conversation ID from a sent email for this RO
    const [conversationRecord] = await db
      .select({ conversationId: notificationQueue.outlookConversationId })
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.repairOrderId, repairOrderId),
          eq(notificationQueue.status, "SENT"),
          isNotNull(notificationQueue.outlookConversationId)
        )
      )
      .limit(1);

    const conversationId = conversationRecord?.conversationId;

    // 2. Parallel fetch: DB records + Graph messages
    const [dbMessages, graphResult] = await Promise.all([
      // DB: All notification_queue records for this RO (EMAIL_DRAFT only)
      db
        .select()
        .from(notificationQueue)
        .where(
          and(
            eq(notificationQueue.repairOrderId, repairOrderId),
            eq(notificationQueue.type, "EMAIL_DRAFT"),
            eq(notificationQueue.userId, session.user.id)
          )
        )
        .orderBy(asc(notificationQueue.createdAt)),
      // Graph: Full conversation thread (if conversation ID exists)
      conversationId
        ? getConversationMessages(session.user.id, conversationId)
            .then((msgs) => ({ messages: msgs, error: false }))
            .catch(() => ({ messages: null, error: true }))
        : Promise.resolve({ messages: null, error: false }),
    ]);

    // 3. Merge and map to ThreadMessage[]
    const messages = mergeThreadMessages(
      dbMessages,
      graphResult.messages,
      session.user.email
    );

    return {
      success: true,
      data: {
        messages,
        graphError: graphResult.error,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch thread history",
    };
  }
}

/**
 * Merges DB notification records with Graph API messages into a unified timeline.
 * - DB messages get enriched with Graph data (webLink) if available
 * - Graph-only messages (inbound) are added as new entries
 * - Direction is determined by comparing sender email to user email
 */
function mergeThreadMessages(
  dbMessages: NotificationQueueItem[],
  graphMessages: GraphMessage[] | null,
  userEmail: string
): ThreadMessage[] {
  const messageMap = new Map<string, ThreadMessage>();

  // 1. Add DB messages first (these are our outbound messages)
  for (const dbMsg of dbMessages) {
    const payload = dbMsg.payload as EmailDraftPayload;
    const key = dbMsg.outlookMessageId || `db-${dbMsg.id}`;

    messageMap.set(key, {
      id: key,
      internetMessageId: dbMsg.outlookMessageId ?? undefined,
      subject: payload.subject,
      bodyPreview: stripHtml(payload.body).slice(0, 200),
      sender: {
        name: "GenThrust Team",
        email: userEmail,
      },
      sentDateTime: dbMsg.createdAt,
      direction: "outbound",
      webLink: undefined, // Will be enriched from Graph if available
      isDraft: dbMsg.status === "PENDING_APPROVAL" || dbMsg.status === "APPROVED",
      dbStatus: dbMsg.status,
      dbId: dbMsg.id,
    });
  }

  // 2. Process Graph messages - enrich existing or add new inbound
  if (graphMessages) {
    for (const graphMsg of graphMessages) {
      const key = graphMsg.internetMessageId || graphMsg.id;
      const senderEmail = graphMsg.from?.emailAddress?.address?.toLowerCase() || "";
      const isOutbound = senderEmail === userEmail.toLowerCase();

      // Check if this message already exists in our DB records
      const existingKey = [...messageMap.keys()].find(
        (k) =>
          k === graphMsg.internetMessageId ||
          k === `<${graphMsg.internetMessageId}>` ||
          graphMsg.internetMessageId === k.replace(/[<>]/g, "")
      );

      if (existingKey) {
        // Enrich existing DB message with Graph data
        const existing = messageMap.get(existingKey)!;
        existing.webLink = graphMsg.webLink;
      } else {
        // New message (likely inbound from customer)
        messageMap.set(key, {
          id: key,
          internetMessageId: graphMsg.internetMessageId,
          subject: graphMsg.subject,
          bodyPreview: graphMsg.bodyPreview,
          sender: {
            name: graphMsg.from?.emailAddress?.name || "Unknown",
            email: senderEmail,
          },
          sentDateTime: new Date(graphMsg.sentDateTime),
          direction: isOutbound ? "outbound" : "inbound",
          webLink: graphMsg.webLink,
          isDraft: graphMsg.isDraft,
        });
      }
    }
  }

  // 3. Sort by date ascending (oldest first)
  return [...messageMap.values()].sort(
    (a, b) => a.sentDateTime.getTime() - b.sentDateTime.getTime()
  );
}

/**
 * Simple HTML tag stripper for body preview
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Get all notifications for a specific repair order
 */
export async function getNotificationsForRO(
  repairOrderId: number
): Promise<Result<NotificationQueueItem[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const notifications = await db
      .select()
      .from(notificationQueue)
      .where(eq(notificationQueue.repairOrderId, repairOrderId))
      .orderBy(desc(notificationQueue.createdAt));

    return { success: true, data: notifications };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch notifications",
    };
  }
}

/**
 * Updates the payload of a PENDING_APPROVAL notification.
 * Used for editing email drafts before sending.
 */
export async function updateNotificationPayload(
  notificationId: number,
  updates: { to?: string; cc?: string; subject?: string; body?: string }
): Promise<Result<{ id: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify pending status (removed userId filter for single-tenant admin app)
    const [notification] = await db
      .select()
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.id, notificationId),
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

    // Merge updates into existing payload
    const currentPayload = notification.payload as EmailDraftPayload;
    const updatedPayload: EmailDraftPayload = {
      ...currentPayload,
      ...(updates.to !== undefined && { to: updates.to }),
      ...(updates.cc !== undefined && { cc: updates.cc || undefined }),
      ...(updates.subject !== undefined && { subject: updates.subject }),
      ...(updates.body !== undefined && { body: updates.body }),
    };

    // Update the notification
    await db
      .update(notificationQueue)
      .set({ payload: updatedPayload })
      .where(eq(notificationQueue.id, notificationId));

    // Also update shop email for future notifications (if "to" field was edited)
    if (updates.to) {
      try {
        // Get the shop name from the associated repair order
        const [ro] = await db
          .select({ shopName: active.shopName })
          .from(active)
          .where(eq(active.id, notification.repairOrderId))
          .limit(1);

        if (ro?.shopName) {
          await updateShopEmail(ro.shopName, updates.to);
        }
      } catch (shopError) {
        // Non-critical - don't fail the save if shop update fails
        console.warn("Failed to update shop email:", shopError);
      }
    }

    return { success: true, data: { id: notificationId } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update notification",
    };
  }
}

/**
 * Re-queues a REJECTED notification by creating a new one with the same payload.
 * The new notification has PENDING_APPROVAL status, allowing the user to edit and approve.
 */
export async function requeueNotification(
  notificationId: number
): Promise<Result<{ id: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Find the rejected or failed notification
    const [notification] = await db
      .select()
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.id, notificationId),
          eq(notificationQueue.userId, session.user.id),
          or(
            eq(notificationQueue.status, "REJECTED"),
            eq(notificationQueue.status, "FAILED")
          )
        )
      )
      .limit(1);

    if (!notification) {
      return {
        success: false,
        error: "Notification not found or not in a requeueable state",
      };
    }

    // Create a new notification with the same payload
    const newId = await insertNotificationCore({
      repairOrderId: notification.repairOrderId,
      userId: session.user.id,
      type: notification.type,
      payload: notification.payload,
      scheduledFor: new Date(),
    });

    if (!newId) {
      return { success: false, error: "Failed to create new notification" };
    }

    return { success: true, data: { id: newId } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to requeue notification",
    };
  }
}

/**
 * ADMIN: Clears all notifications from the queue.
 * Used to reset test data. After clearing, the next scheduled
 * check-overdue-ros run will regenerate pending notifications.
 */
export async function clearAllNotifications(): Promise<Result<{ deleted: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Count before delete
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notificationQueue);

    const countBefore = Number(result.count);

    // Delete all records
    await db.delete(notificationQueue);

    return { success: true, data: { deleted: countBefore } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clear notifications",
    };
  }
}

/**
 * ADMIN: Manually triggers the overdue RO check task.
 * Useful after clearing notifications to regenerate immediately
 * instead of waiting for the 8 AM UTC scheduled run.
 */
export async function triggerOverdueCheck(): Promise<Result<{ runId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const handle = await tasks.trigger("check-overdue-ros", {});

    return { success: true, data: { runId: handle.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to trigger check",
    };
  }
}

/**
 * Type for sibling notification details in batch email feature
 */
export type SiblingNotification = {
  notificationId: number;
  roNumber: number | null;
  partNumber: string | null;
  serialNumber: string | null;
};

/**
 * Fetches related pending notifications from the same shop.
 * Used for batch email feature - when user clicks preview on one notification,
 * we check if there are others from the same shop that could be batched.
 *
 * @param currentNotificationId - The notification being previewed
 * @returns Shop name and list of sibling notifications from same shop
 */
export async function getRelatedPendingNotifications(
  currentNotificationId: number
): Promise<
  Result<{
    shopName: string;
    currentRo: {
      roNumber: number | null;
      partNumber: string | null;
      serialNumber: string | null;
    };
    siblings: SiblingNotification[];
  }>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Step 1: Get the current notification's RO and shop name
    const [currentNotification] = await db
      .select({
        repairOrderId: notificationQueue.repairOrderId,
        shopName: active.shopName,
        roNumber: active.ro,
        partNumber: active.part,
        serialNumber: active.serial,
      })
      .from(notificationQueue)
      .innerJoin(active, eq(notificationQueue.repairOrderId, active.id))
      .where(eq(notificationQueue.id, currentNotificationId))
      .limit(1);

    if (!currentNotification) {
      return { success: false, error: "Notification not found" };
    }

    const shopName = currentNotification.shopName;

    if (!shopName) {
      // No shop name means we can't find siblings
      return {
        success: true,
        data: {
          shopName: "",
          currentRo: {
            roNumber: currentNotification.roNumber,
            partNumber: currentNotification.partNumber,
            serialNumber: currentNotification.serialNumber,
          },
          siblings: [],
        },
      };
    }

    // Step 2: Find all other PENDING_APPROVAL notifications for the same shop
    const siblings = await db
      .select({
        notificationId: notificationQueue.id,
        roNumber: active.ro,
        partNumber: active.part,
        serialNumber: active.serial,
      })
      .from(notificationQueue)
      .innerJoin(active, eq(notificationQueue.repairOrderId, active.id))
      .where(
        and(
          eq(notificationQueue.status, "PENDING_APPROVAL"),
          eq(notificationQueue.type, "EMAIL_DRAFT"),
          eq(active.shopName, shopName),
          ne(notificationQueue.id, currentNotificationId)
        )
      )
      .orderBy(active.ro);

    return {
      success: true,
      data: {
        shopName,
        currentRo: {
          roNumber: currentNotification.roNumber,
          partNumber: currentNotification.partNumber,
          serialNumber: currentNotification.serialNumber,
        },
        siblings,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch related notifications",
    };
  }
}

/**
 * Approves multiple notifications as a batch and triggers a single email send.
 * The primary notification gets the merged email content, siblings are marked
 * as BATCHED and linked to the primary.
 *
 * @param primaryNotificationId - The main notification (clicked first)
 * @param siblingNotificationIds - Additional notifications to batch
 * @param mergedPayload - The combined email content with all ROs
 * @returns Run ID and public access token for tracking
 */
export async function approveBatchNotifications(
  primaryNotificationId: number,
  siblingNotificationIds: number[],
  mergedPayload: EmailDraftPayload
): Promise<Result<{ runId: string; publicAccessToken: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify primary notification exists and is pending
    const [primaryNotification] = await db
      .select()
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.id, primaryNotificationId),
          eq(notificationQueue.status, "PENDING_APPROVAL")
        )
      )
      .limit(1);

    if (!primaryNotification) {
      return {
        success: false,
        error: "Primary notification not found or already processed",
      };
    }

    // Update primary notification with merged payload and APPROVED status
    await db
      .update(notificationQueue)
      .set({
        status: "APPROVED",
        payload: mergedPayload,
      })
      .where(eq(notificationQueue.id, primaryNotificationId));

    // Update sibling notifications to APPROVED status
    // They will be marked SENT when the primary email is sent
    if (siblingNotificationIds.length > 0) {
      await db
        .update(notificationQueue)
        .set({ status: "APPROVED" })
        .where(
          and(
            inArray(notificationQueue.id, siblingNotificationIds),
            eq(notificationQueue.status, "PENDING_APPROVAL")
          )
        );
    }

    // Trigger send-approved-email with batch info
    const handle = await tasks.trigger("send-approved-email", {
      notificationId: primaryNotificationId,
      userId: session.user.id,
      batchedNotificationIds: siblingNotificationIds,
    });

    const publicAccessToken = await handle.publicAccessToken;

    return { success: true, data: { runId: handle.id, publicAccessToken } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to approve batch notifications",
    };
  }
}
