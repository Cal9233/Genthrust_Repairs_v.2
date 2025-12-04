// src/lib/graph/productivity.ts
// Microsoft Graph API helpers for Calendar, To-Do, and Mail operations.
// These functions will be used exclusively by durable Trigger.dev tasks.

import { Client } from "@microsoft/microsoft-graph-client";
import { getGraphClient } from "../graph";
import { TokenRefreshError, UserNotConnectedError } from "../types/graph";
import type { SentEmailResult, GraphMessage } from "../types/notification";

// --- Utility Functions ---

/**
 * Returns the mailbox path for Graph API calls.
 * Supports shared mailboxes via MS_GRAPH_SHARED_MAILBOX env var.
 *
 * @example
 * // If MS_GRAPH_SHARED_MAILBOX=repairs@genthrust.com
 * getMailboxPath() // returns "/users/repairs@genthrust.com"
 *
 * // If MS_GRAPH_SHARED_MAILBOX is not set
 * getMailboxPath() // returns "/me"
 */
export function getMailboxPath(): string {
  const sharedMailbox = process.env.MS_GRAPH_SHARED_MAILBOX;
  if (sharedMailbox) {
    return `/users/${sharedMailbox}`;
  }
  return "/me";
}

/**
 * Ensures Graph API errors (e.g., 401 Unauthorized) are handled gracefully
 * and converted into custom errors for Trigger.dev retries or reporting.
 */
function handleGraphError(error: unknown, message: string): Error {
  if (
    error instanceof TokenRefreshError ||
    error instanceof UserNotConnectedError
  ) {
    // These are critical authentication failures that require user intervention
    return error;
  }
  // General Graph API error
  console.error(message, error);
  return new Error(
    `${message}: ${error instanceof Error ? error.message : String(error)}`
  );
}

/**
 * Fetches the user's default To Do list ID.
 * This is necessary because tasks must be created within a specific list.
 */
async function getDefaultTaskListId(
  graphClient: Client,
  userId: string
): Promise<string> {
  try {
    const response = await graphClient.api("/me/todo/lists").get();
    const defaultList = response.value.find(
      (list: { wellknownListName?: string; id: string }) =>
        list.wellknownListName === "defaultList"
    );

    if (!defaultList) {
      // Fallback: use the first list found
      if (response.value.length > 0) {
        return response.value[0].id;
      }
      throw new Error("No Microsoft To Do lists found for user.");
    }
    return defaultList.id;
  } catch (error) {
    throw handleGraphError(
      error,
      `Failed to fetch default To Do list for user ${userId}`
    );
  }
}

// --- Exported Helper Functions ---

/**
 * 1. Creates an all-day or time-bound event in the user's default calendar.
 */
export async function createCalendarEvent(
  userId: string,
  subject: string,
  startTime: Date,
  endTime: Date,
  description: string
): Promise<{ id: string }> {
  const graphClient = await getGraphClient(userId);

  // Convert Dates to ISO 8601 strings in UTC
  const start = { dateTime: startTime.toISOString(), timeZone: "UTC" };
  const end = { dateTime: endTime.toISOString(), timeZone: "UTC" };

  const event = {
    subject: `[GenThrust RO Reminder] ${subject}`,
    body: {
      // Use text since our reminder content is plain text
      contentType: "text",
      content: description,
    },
    start,
    end,
    isAllDay:
      startTime.toDateString() === endTime.toDateString() &&
      startTime.getHours() === 0 &&
      endTime.getHours() === 0,
    reminderMinutesBeforeStart: 60, // Remind 1 hour before the follow-up day
  };

  try {
    // Use /me/ because we're using delegated auth with user's access token
    const result = await graphClient.api("/me/calendar/events").post(event);
    return { id: result.id };
  } catch (error) {
    throw handleGraphError(
      error,
      `Failed to create calendar event for user ${userId}`
    );
  }
}

/**
 * 2. Creates a task in the user's default Microsoft To Do list.
 */
export async function createToDoTask(
  userId: string,
  title: string,
  dueDate: Date,
  content: string
): Promise<{ id: string }> {
  const graphClient = await getGraphClient(userId);

  // Get the ID of the default task list
  const taskListId = await getDefaultTaskListId(graphClient, userId);

  const task = {
    title: `[GenThrust] ${title}`,
    // Set the due date for the task (using ISO 8601 string)
    dueDateTime: {
      dateTime: dueDate.toISOString().split("T")[0],
      timeZone: "UTC",
    },
    body: {
      // To Do API only accepts "text" content type, not "HTML"
      contentType: "text",
      content: content,
    },
    isReminderOn: true,
    reminderDateTime: { dateTime: dueDate.toISOString(), timeZone: "UTC" },
  };

  try {
    // Use /me/ because we're using delegated auth with user's access token
    const result = await graphClient
      .api(`/me/todo/lists/${taskListId}/tasks`)
      .post(task);
    return { id: result.id };
  } catch (error) {
    throw handleGraphError(
      error,
      `Failed to create To Do task for user ${userId}`
    );
  }
}

/**
 * Email options for sendEmail function.
 */
export interface SendEmailOptions {
  /** CC recipient email address */
  cc?: string;
  /** Optional internetMessageId for threading (In-Reply-To header) */
  replyToMessageId?: string;
}

/**
 * 3. Sends an email immediately from the user's account (or shared mailbox).
 * Supports email threading via In-Reply-To header when replyToMessageId is provided.
 * Supports CC recipients for visibility.
 *
 * @param userId - The user ID for Graph API authentication
 * @param to - Recipient email address
 * @param subject - Email subject line
 * @param body - HTML email body
 * @param options - Optional settings: cc, replyToMessageId
 * @returns SentEmailResult with message IDs for thread tracking
 */
export async function sendEmail(
  userId: string,
  to: string,
  subject: string,
  body: string,
  options?: SendEmailOptions
): Promise<SentEmailResult> {
  const graphClient = await getGraphClient(userId);
  const sendTimestamp = new Date().toISOString(); // Capture BEFORE send
  const mailboxPath = getMailboxPath();

  // Build message payload
  const message: Record<string, unknown> = {
    subject: `[GenThrust Follow-Up] ${subject}`,
    body: {
      contentType: "HTML",
      content: body,
    },
    toRecipients: [{ emailAddress: { address: to } }],
  };

  // Add CC recipients if provided (supports comma-separated list)
  if (options?.cc) {
    const ccAddresses = options.cc.split(',').map(email => email.trim()).filter(Boolean);
    message.ccRecipients = ccAddresses.map(address => ({ emailAddress: { address } }));
  }

  // Add threading headers if replying to existing thread
  if (options?.replyToMessageId) {
    message.internetMessageHeaders = [
      { name: "In-Reply-To", value: options.replyToMessageId },
      { name: "References", value: options.replyToMessageId },
    ];
  }

  try {
    // Use mailbox path for shared mailbox support
    await graphClient.api(`${mailboxPath}/sendMail`).post({ message, saveToSentItems: true });

    // SAFER QUERY: Filter by time, match recipient in TypeScript memory
    const sentMessage = await findSentMessage(graphClient, to, sendTimestamp);

    return sentMessage;
  } catch (error) {
    throw handleGraphError(
      error,
      `Failed to send email for user ${userId} to ${to}`
    );
  }
}

/**
 * Helper: Safe SentItems lookup with retry and exponential backoff.
 * Filters by createdDateTime (safe OData filter) and matches recipient in TypeScript.
 * Does NOT filter by subject (brittle with special characters).
 * Uses getMailboxPath() for shared mailbox support.
 */
async function findSentMessage(
  client: Client,
  toAddress: string,
  afterTimestamp: string,
  maxRetries = 3
): Promise<SentEmailResult> {
  const delays = [1000, 2000, 4000]; // Exponential backoff
  const mailboxPath = getMailboxPath();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await new Promise((r) => setTimeout(r, delays[attempt]));

    try {
      // Query by createdDateTime only (safe OData filter - ISO timestamp has no special chars)
      const response = await client
        .api(`${mailboxPath}/mailFolders/SentItems/messages`)
        .filter(`createdDateTime ge ${afterTimestamp}`)
        .orderby("createdDateTime desc")
        .top(10)
        .select("id,conversationId,internetMessageId,toRecipients,createdDateTime")
        .get();

      // Match toRecipient in TypeScript (avoids OData escaping issues with email addresses)
      const match = response.value?.find(
        (msg: {
          toRecipients?: Array<{ emailAddress?: { address?: string } }>;
        }) =>
          msg.toRecipients?.some(
            (r) =>
              r.emailAddress?.address?.toLowerCase() === toAddress.toLowerCase()
          )
      );

      if (match) {
        return {
          messageId: match.id,
          conversationId: match.conversationId,
          internetMessageId: match.internetMessageId,
        };
      }
    } catch (error) {
      console.warn(`findSentMessage attempt ${attempt + 1} failed:`, error);
      // Continue to next retry
    }
  }

  throw new Error(`Sent message not found after ${maxRetries} retries`);
}

/**
 * 4. Fetches all messages in a conversation thread.
 * Returns messages from both sent and inbox folders.
 * Used for displaying full email thread history (inbound + outbound).
 *
 * @param userId - The user ID for Graph API authentication
 * @param conversationId - The Outlook conversation ID to fetch
 * @returns Array of GraphMessage objects ordered by sentDateTime ascending
 */
export async function getConversationMessages(
  userId: string,
  conversationId: string
): Promise<GraphMessage[]> {
  const graphClient = await getGraphClient(userId);
  const mailboxPath = getMailboxPath();

  try {
    const response = await graphClient
      .api(`${mailboxPath}/messages`)
      .filter(`conversationId eq '${conversationId}'`)
      .select(
        "id,conversationId,internetMessageId,subject,bodyPreview,from,toRecipients,sentDateTime,webLink,isDraft"
      )
      .orderby("sentDateTime asc")
      .top(50)
      .get();

    return response.value || [];
  } catch (error) {
    throw handleGraphError(
      error,
      `Failed to fetch conversation messages for user ${userId}`
    );
  }
}

/**
 * 5. Creates an email draft in the user's mailbox.
 */
export async function createDraftEmail(
  userId: string,
  to: string,
  subject: string,
  body: string
): Promise<{ messageId: string; webLink: string }> {
  const graphClient = await getGraphClient(userId);

  const draft = {
    subject: `[GenThrust DRAFT] ${subject}`,
    body: {
      contentType: "HTML",
      content: body,
    },
    toRecipients: [{ emailAddress: { address: to } }],
  };

  try {
    // Use /me/ because we're using delegated auth with user's access token
    const result = await graphClient.api("/me/messages").post(draft);
    return { messageId: result.id, webLink: result.webLink };
  } catch (error) {
    throw handleGraphError(
      error,
      `Failed to create draft email for user ${userId} to ${to}`
    );
  }
}
