// src/lib/graph/productivity.ts
// Microsoft Graph API helpers for Calendar, To-Do, and Mail operations.
// These functions will be used exclusively by durable Trigger.dev tasks.

import { Client } from "@microsoft/microsoft-graph-client";
import { getGraphClient } from "../graph";
import { TokenRefreshError, UserNotConnectedError } from "../types/graph";

// --- Utility Functions ---

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
 * 3. Sends an email immediately from the user's account.
 */
export async function sendEmail(
  userId: string,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  const graphClient = await getGraphClient(userId);

  const email = {
    message: {
      subject: `[GenThrust Follow-Up] ${subject}`,
      body: {
        contentType: "HTML",
        content: body,
      },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: true,
  };

  try {
    // Use /me/ because we're using delegated auth with user's access token
    await graphClient.api("/me/sendMail").post(email);
  } catch (error) {
    throw handleGraphError(
      error,
      `Failed to send email for user ${userId} to ${to}`
    );
  }
}

/**
 * 4. Creates an email draft in the user's mailbox.
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
