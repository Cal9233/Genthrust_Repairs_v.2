"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notificationQueue } from "@/lib/schema";
import { eq, and, desc, isNotNull, asc } from "drizzle-orm";
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
import { generateMockThreadMessages } from "@/lib/mocks/thread-messages";
import { active } from "@/lib/schema";

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

    // MOCK MODE: Return mock data for UI testing (development only)
    if (process.env.NODE_ENV !== "production" && process.env.MOCK_EMAIL_THREADS === "true") {
      // Get RO number from active table for realistic mock data
      const [roRecord] = await db
        .select({ ro: active.ro })
        .from(active)
        .where(eq(active.id, repairOrderId))
        .limit(1);

      const roNumber = roRecord?.ro ?? repairOrderId;
      return {
        success: true,
        data: {
          messages: generateMockThreadMessages(roNumber),
          graphError: false,
        },
      };
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
