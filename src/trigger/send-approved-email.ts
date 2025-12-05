import { task, logger, tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { db } from "../lib/db";
import { notificationQueue, active } from "../lib/schema";
import { eq, inArray } from "drizzle-orm";
import {
  getNotificationById,
  updateNotificationStatus,
  getEmailThreadForRO,
  updateNotificationOutlookIds,
} from "../lib/data/notifications";
import { getShopEmailByName, updateShopEmail } from "../lib/data/shops";
import { sendEmail, createToDoTask, createCalendarEvent } from "../lib/graph/productivity";
import type { EmailDraftPayload, TaskReminderPayload } from "../lib/types/notification";

/**
 * Payload schema for send-approved-email task
 */
export const sendApprovedEmailPayloadSchema = z.object({
  notificationId: z.number(),
  userId: z.string(),
  /**
   * Optional array of sibling notification IDs when sending a batch email.
   * These siblings will also be marked as SENT after the primary email is sent.
   */
  batchedNotificationIds: z.array(z.number()).optional(),
});

export type SendApprovedEmailPayload = z.infer<typeof sendApprovedEmailPayloadSchema>;

/**
 * Output schema for send-approved-email task
 */
export const sendApprovedEmailOutputSchema = z.object({
  success: z.boolean(),
  notificationId: z.number(),
  action: z.enum(["sent", "skipped", "failed"]),
  error: z.string().optional(),
});

export type SendApprovedEmailOutput = z.infer<typeof sendApprovedEmailOutputSchema>;

/**
 * send-approved-email Task (Task A)
 *
 * Processes human-approved notifications with guaranteed delivery via retries.
 * Implements the "Write-Behind" pattern per CLAUDE.md Section 3C.
 *
 * Flow:
 * 1. Fetch notification from notificationQueue by ID
 * 2. Validate status is APPROVED (exit if SENT, REJECTED, or PENDING_APPROVAL)
 * 3. Execute based on type:
 *    - EMAIL_DRAFT: Call sendEmail() with payload's toAddress, subject, body
 *    - TASK_REMINDER: Call createToDoTask() and createCalendarEvent()
 * 4. Update status to SENT on success
 */
export const sendApprovedEmail = task({
  id: "send-approved-email",
  // Use small-1x for consistent execution
  machine: {
    preset: "small-1x",
  },
  // Retry configuration - 3 retries with exponential backoff
  retry: {
    maxAttempts: 3,
  },
  // Update status to FAILED when all retries are exhausted
  onFailure: async ({ payload }) => {
    const { notificationId } = payload as SendApprovedEmailPayload;
    logger.info("All retries exhausted, marking notification as FAILED", { notificationId });

    await db
      .update(notificationQueue)
      .set({ status: "FAILED" })
      .where(eq(notificationQueue.id, notificationId));
  },
  run: async (payload: SendApprovedEmailPayload): Promise<SendApprovedEmailOutput> => {
    const { notificationId, userId, batchedNotificationIds = [] } = payload;
    const isBatch = batchedNotificationIds.length > 0;

    logger.info("Processing approved notification", {
      notificationId,
      userId,
      isBatch,
      batchedCount: batchedNotificationIds.length,
    });

    try {
      // Step 1: Fetch notification from database
      const notification = await getNotificationById(notificationId);

      if (!notification) {
        logger.warn("Notification not found", { notificationId });
        return {
          success: false,
          notificationId,
          action: "skipped",
          error: "Notification not found",
        };
      }

      // Step 2: Validate status
      if (notification.status === "SENT") {
        logger.info("Notification already sent, skipping", { notificationId });
        return {
          success: true,
          notificationId,
          action: "skipped",
        };
      }

      if (notification.status === "REJECTED") {
        logger.info("Notification was rejected, skipping", { notificationId });
        return {
          success: true,
          notificationId,
          action: "skipped",
        };
      }

      if (notification.status === "FAILED") {
        logger.info("Notification previously failed, skipping", { notificationId });
        return {
          success: true,
          notificationId,
          action: "skipped",
        };
      }

      if (notification.status === "PENDING_APPROVAL") {
        logger.warn("Notification not yet approved, skipping", { notificationId });
        return {
          success: false,
          notificationId,
          action: "skipped",
          error: "Notification is still pending approval",
        };
      }

      // Status should be APPROVED at this point
      if (notification.status !== "APPROVED") {
        logger.error("Unexpected notification status", {
          notificationId,
          status: notification.status,
        });
        return {
          success: false,
          notificationId,
          action: "failed",
          error: `Unexpected status: ${notification.status}`,
        };
      }

      // Step 3: Execute based on type
      const notificationPayload = notification.payload;

      if (notification.type === "EMAIL_DRAFT") {
        const emailPayload = notificationPayload as EmailDraftPayload;

        // Step 3a: Validate recipient address (support both 'to' and legacy 'toAddress' fields)
        const recipientAddress = (emailPayload.to || emailPayload.toAddress || "").trim();
        if (!recipientAddress) {
          // User-recoverable error: missing email address
          // Mark as FAILED without retrying - user needs to fill in email first
          logger.error("Cannot send email: recipient address is empty", { notificationId });
          await updateNotificationStatus(notificationId, "FAILED");
          return {
            success: false,
            notificationId,
            action: "failed",
            error: "Recipient email address is required. Please edit the notification to add an email address.",
          };
        }

        // Step 3b: Look up existing thread for this RO
        const existingMessageId = await getEmailThreadForRO(notification.repairOrderId);

        logger.info("Sending email", {
          notificationId,
          to: recipientAddress,
          cc: emailPayload.cc,
          subject: emailPayload.subject,
          hasExistingThread: !!existingMessageId,
        });

        // Step 3c: Send with threading and CC support
        const result = await sendEmail(
          userId,
          recipientAddress,
          emailPayload.subject,
          emailPayload.body,
          {
            cc: emailPayload.cc,
            replyToMessageId: existingMessageId ?? undefined,
          }
        );

        // Step 3d: Store Outlook IDs in schema columns (not JSON)
        const idsUpdated = await updateNotificationOutlookIds(
          notificationId,
          result.internetMessageId, // Store internetMessageId (used for threading)
          result.conversationId
        );

        if (!idsUpdated) {
          logger.warn("Failed to update Outlook IDs, but email was sent", { notificationId });
        }

        // Step 3d-batch: Update Outlook IDs for all batched siblings (same message/conversation)
        if (isBatch) {
          for (const siblingId of batchedNotificationIds) {
            await updateNotificationOutlookIds(
              siblingId,
              result.internetMessageId,
              result.conversationId
            );
          }
          logger.info("Updated Outlook IDs for batched siblings", {
            count: batchedNotificationIds.length,
            conversationId: result.conversationId,
          });
        }

        logger.info("Email sent and tracked", {
          notificationId,
          conversationId: result.conversationId,
          hasThread: !!existingMessageId,
          isBatch,
        });

        // Step 3e: Update shop email if it was edited (for future emails)
        if (recipientAddress && notification.repairOrderId) {
          try {
            const ro = await db
              .select({ shopName: active.shopName })
              .from(active)
              .where(eq(active.id, notification.repairOrderId))
              .limit(1);

            if (ro[0]?.shopName) {
              const currentShopEmail = await getShopEmailByName(ro[0].shopName);

              // Only update if email is different (case-insensitive comparison)
              const emailChanged =
                !currentShopEmail ||
                currentShopEmail.toLowerCase().trim() !== recipientAddress.toLowerCase().trim();

              if (emailChanged) {
                const updateResult = await updateShopEmail(ro[0].shopName, recipientAddress);
                if (updateResult.success) {
                  logger.info("Updated shop email for future use", {
                    shop: ro[0].shopName,
                    oldEmail: currentShopEmail,
                    newEmail: recipientAddress,
                  });
                } else {
                  logger.warn("Failed to update shop email", {
                    shop: ro[0].shopName,
                    error: updateResult.error,
                  });
                }
              }
            }
          } catch (shopError) {
            // Non-critical error - don't fail the task if shop update fails
            logger.warn("Error updating shop email, continuing anyway", {
              notificationId,
              error: shopError instanceof Error ? shopError.message : String(shopError),
            });
          }
        }

        // Step 3f: Update RO dates to reset overdue status (for primary and batch)
        // Collect all RO IDs: primary + all batched siblings
        const allRoIds: number[] = [];
        if (notification.repairOrderId) {
          allRoIds.push(notification.repairOrderId);
        }

        // Get RO IDs from batched siblings
        if (isBatch) {
          const siblingNotifications = await db
            .select({ repairOrderId: notificationQueue.repairOrderId })
            .from(notificationQueue)
            .where(inArray(notificationQueue.id, batchedNotificationIds));

          for (const sibling of siblingNotifications) {
            if (sibling.repairOrderId && !allRoIds.includes(sibling.repairOrderId)) {
              allRoIds.push(sibling.repairOrderId);
            }
          }
        }

        if (allRoIds.length > 0) {
          try {
            const today = new Date();
            const nextFollowUp = new Date();
            nextFollowUp.setDate(today.getDate() + 7);

            // Format dates as M/D/YYYY (matches existing schema format)
            const formatDate = (d: Date) =>
              `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

            const todayFormatted = formatDate(today);
            const nextFollowUpFormatted = formatDate(nextFollowUp);

            // Update dates for all ROs in the batch
            await db
              .update(active)
              .set({
                lastDateUpdated: todayFormatted,
                nextDateToUpdate: nextFollowUpFormatted,
              })
              .where(inArray(active.id, allRoIds));

            logger.info("Updated RO dates after email sent", {
              roIds: allRoIds,
              count: allRoIds.length,
              lastDateUpdated: todayFormatted,
              nextDateToUpdate: nextFollowUpFormatted,
              isBatch,
            });

            // Step 3g: Trigger Excel sync to update columns T & U for ALL ROs
            await tasks.trigger("sync-repair-orders", {
              userId,
              repairOrderIds: allRoIds,
            });

            logger.info("Triggered Excel sync for date update", {
              roIds: allRoIds,
              count: allRoIds.length,
            });
          } catch (dateError) {
            // Non-critical error - don't fail the task
            logger.warn("Error updating RO dates, continuing anyway", {
              notificationId,
              error: dateError instanceof Error ? dateError.message : String(dateError),
            });
          }
        }
      } else if (notification.type === "TASK_REMINDER") {
        const taskPayload = notificationPayload as TaskReminderPayload;
        const dueDate = new Date(taskPayload.dueDate);

        logger.info("Creating task reminder", {
          notificationId,
          title: taskPayload.title,
          dueDate: taskPayload.dueDate,
        });

        // Create both a To Do task and a Calendar event
        await Promise.all([
          createToDoTask(
            userId,
            taskPayload.title,
            dueDate,
            taskPayload.notes || ""
          ),
          createCalendarEvent(
            userId,
            taskPayload.title,
            dueDate,
            dueDate, // Same day event
            taskPayload.notes || ""
          ),
        ]);

        logger.info("Task reminder created successfully", { notificationId });
      } else {
        logger.error("Unknown notification type", {
          notificationId,
          type: notification.type,
        });
        return {
          success: false,
          notificationId,
          action: "failed",
          error: `Unknown notification type: ${notification.type}`,
        };
      }

      // Step 4: Update status to SENT
      const updated = await updateNotificationStatus(notificationId, "SENT");

      if (!updated) {
        logger.error("Failed to update notification status to SENT", { notificationId });
        // Don't fail the task - the email/task was already sent
        // This is a non-critical error
      }

      // Step 4-batch: Update all batched siblings to SENT as well
      if (isBatch && batchedNotificationIds.length > 0) {
        try {
          await db
            .update(notificationQueue)
            .set({ status: "SENT" })
            .where(inArray(notificationQueue.id, batchedNotificationIds));

          logger.info("Updated batched siblings to SENT", {
            count: batchedNotificationIds.length,
            siblingIds: batchedNotificationIds,
          });
        } catch (batchError) {
          // Non-critical - the email was sent, siblings just won't show as SENT
          logger.warn("Failed to update batched siblings status", {
            error: batchError instanceof Error ? batchError.message : String(batchError),
          });
        }
      }

      return {
        success: true,
        notificationId,
        action: "sent",
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Failed to process notification", {
        notificationId,
        error: errorMessage,
      });

      // Re-throw for Trigger.dev retry
      throw error;
    }
  },
});
