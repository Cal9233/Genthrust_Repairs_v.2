// Notification type definitions for the notification_queue table
// Uses const arrays + type inference pattern for type-safe enums

export const NotificationTypes = ["EMAIL_DRAFT", "TASK_REMINDER"] as const;
export type NotificationType = (typeof NotificationTypes)[number];

export const NotificationStatuses = [
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "SENT",
] as const;
export type NotificationStatus = (typeof NotificationStatuses)[number];

// Payload structure for EMAIL_DRAFT notifications
export interface EmailDraftPayload {
  toAddress?: string;  // Deprecated, use 'to' instead
  to?: string;         // Recipient email address
  subject: string;
  body: string;
  cc?: string;
  draftMessageId?: string;   // Outlook draft message ID
  draftWebLink?: string;     // Link to open draft in Outlook
}

// Payload structure for TASK_REMINDER notifications
export interface TaskReminderPayload {
  title: string;
  dueDate: string;
  notes?: string;
}

// Union type for all payload types
export type NotificationPayload = EmailDraftPayload | TaskReminderPayload;

// Type guard for EmailDraftPayload
export function isEmailDraftPayload(
  payload: NotificationPayload
): payload is EmailDraftPayload {
  return "toAddress" in payload && "subject" in payload && "body" in payload;
}

// Type guard for TaskReminderPayload
export function isTaskReminderPayload(
  payload: NotificationPayload
): payload is TaskReminderPayload {
  return "title" in payload && "dueDate" in payload;
}

// Result type for sendEmail() - used for email threading
export interface SentEmailResult {
  messageId: string;           // Graph API message ID
  conversationId: string;      // Thread grouping ID (outlook_conversation_id)
  internetMessageId: string;   // RFC 2822 ID for In-Reply-To header
}

// Graph API message type - returned from getConversationMessages()
export interface GraphMessage {
  id: string;
  conversationId: string;
  internetMessageId: string;
  subject: string;
  bodyPreview: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  sentDateTime: string;
  webLink: string;
  isDraft: boolean;
}

// Unified thread message type - used by EmailThreadView
export interface ThreadMessage {
  id: string;
  internetMessageId?: string;
  subject: string;
  bodyPreview: string;
  sender: {
    name: string;
    email: string;
  };
  sentDateTime: Date;
  direction: "inbound" | "outbound";
  webLink?: string;
  isDraft: boolean;
  // DB-only fields (for outbound messages from notification_queue)
  dbStatus?: NotificationStatus;
  dbId?: number;
}

// Result type for getFullThreadHistory server action
export interface ThreadHistoryResult {
  messages: ThreadMessage[];
  graphError?: boolean; // True if Graph API call failed (graceful degradation)
}
