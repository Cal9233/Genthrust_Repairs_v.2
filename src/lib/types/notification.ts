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
  toAddress: string;
  subject: string;
  body: string;
  cc?: string;
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
