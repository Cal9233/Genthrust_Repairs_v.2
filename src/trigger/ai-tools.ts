import { task, logger, tasks } from "@trigger.dev/sdk/v3";
import { db } from "../lib/db";
import { active, inventoryindex, notificationQueue, roActivityLog } from "../lib/schema";
import { eq, like, or, max } from "drizzle-orm";
import { createDraftEmail } from "../lib/graph/productivity";
import { TRACKED_STATUSES } from "../lib/constants/statuses";

// Type exports for tool outputs
export type InventoryItem = typeof inventoryindex.$inferSelect;
export type RepairOrder = typeof active.$inferSelect;

// Sub-task: Search Inventory
// Isolated, durable task that can retry independently
export const searchInventoryTool = task({
  id: "ai-tool-search-inventory",
  machine: { preset: "micro" },
  retry: { maxAttempts: 3 },
  run: async (payload: { query: string; limit?: number }) => {
    const { query, limit = 20 } = payload;

    logger.info("Searching inventory", { query, limit });

    const pattern = `%${query}%`;

    const results = await db
      .select()
      .from(inventoryindex)
      .where(
        or(
          like(inventoryindex.partNumber, pattern),
          like(inventoryindex.description, pattern)
        )
      )
      .limit(limit);

    logger.info("Inventory search complete", { count: results.length });

    return {
      items: results,
      count: results.length,
    };
  },
});

// Sub-task: Get Repair Order
// Isolated, durable task that can retry independently
export const getRepairOrderTool = task({
  id: "ai-tool-get-repair-order",
  machine: { preset: "micro" },
  retry: { maxAttempts: 3 },
  run: async (payload: { roNumber?: number; roId?: number }) => {
    const { roNumber, roId } = payload;

    logger.info("Fetching repair order", { roNumber, roId });

    let results: RepairOrder[];

    if (roId) {
      results = await db
        .select()
        .from(active)
        .where(eq(active.id, roId));
    } else if (roNumber) {
      results = await db
        .select()
        .from(active)
        .where(eq(active.ro, roNumber));
    } else {
      logger.warn("No roNumber or roId provided");
      return { repairOrder: null, error: "Must provide roNumber or roId" };
    }

    const repairOrder = results[0] ?? null;

    logger.info("Repair order lookup complete", {
      found: repairOrder !== null,
      roNumber: repairOrder?.ro,
    });

    return { repairOrder };
  },
});

// Sub-task: Create Repair Order
// Creates a new repair order in the database and triggers Excel sync
export const createRepairOrderTool = task({
  id: "ai-tool-create-repair-order",
  machine: { preset: "micro" },
  retry: { maxAttempts: 2 },
  run: async (payload: {
    userId: string;
    shopName: string;
    part: string;
    serial?: string;
    partDescription?: string;
    reqWork?: string;
    estimatedCost?: number;
  }) => {
    const { userId, shopName, part, serial, partDescription, reqWork, estimatedCost } = payload;

    logger.info("Creating repair order", { shopName, part });

    // Generate next RO number (max + 1)
    const [maxRO] = await db
      .select({ maxRo: max(active.ro) })
      .from(active);

    const nextRO = Math.floor((maxRO?.maxRo ?? 0) + 1);

    // Prepare the insert data
    const today = new Date().toISOString().split("T")[0];
    const insertData = {
      ro: nextRO,
      dateMade: today,
      shopName,
      part,
      serial: serial ?? null,
      partDescription: partDescription ?? null,
      reqWork: reqWork ?? null,
      estimatedCost: estimatedCost ?? null,
      curentStatus: "WAITING QUOTE",
      curentStatusDate: today,
      lastDateUpdated: today,
      nextDateToUpdate: today,
    };

    // Insert into MySQL
    const insertResult = await db.insert(active).values(insertData).$returningId();
    const result = insertResult[0] as { id: number } | undefined;

    if (!result?.id) {
      throw new Error("Failed to create repair order - database did not return ID");
    }

    // Log activity
    await db.insert(roActivityLog).values({
      repairOrderId: result.id,
      action: "CREATE",
      field: null,
      oldValue: null,
      newValue: `Created RO #${nextRO} via AI Assistant`,
      userId,
    });

    // Trigger Excel sync
    try {
      await tasks.trigger("sync-repair-orders", {
        userId,
        repairOrderIds: [result.id],
      });
    } catch (e) {
      logger.error("Failed to trigger Excel sync for new RO", { error: e });
    }

    logger.info("Repair order created", { id: result.id, ro: nextRO });

    return { success: true, id: result.id, ro: nextRO };
  },
});

// Sub-task: Update Repair Order
// Updates fields on an existing repair order, triggers lifecycle automation for status changes, and syncs to Excel
export const updateRepairOrderTool = task({
  id: "ai-tool-update-repair-order",
  machine: { preset: "micro" },
  retry: { maxAttempts: 2 },
  run: async (payload: {
    userId: string;
    roNumber: number;
    fields: {
      // Basic information
      shopName?: string;
      part?: string;
      serial?: string | null;
      partDescription?: string | null;
      reqWork?: string | null;
      // Status and dates
      curentStatus?: string;
      curentStatusDate?: string | null;
      estimatedDeliveryDate?: string | null;
      dateDroppedOff?: string | null;
      dateMade?: string | null;
      lastDateUpdated?: string | null;
      nextDateToUpdate?: string | null;
      // Costs and terms
      estimatedCost?: number | null;
      finalCost?: number | null;
      terms?: string | null;
      // References and tracking
      shopRef?: string | null;
      trackingNumberPickingUp?: string | null;
      // Status fields
      genthrustStatus?: string | null;
      shopStatus?: string | null;
      // Notes
      notes?: string | null;
    };
  }) => {
    const { userId, roNumber, fields } = payload;

    logger.info("Updating repair order", { roNumber, fields });

    // Find the repair order
    const [existing] = await db
      .select()
      .from(active)
      .where(eq(active.ro, roNumber));

    if (!existing) {
      logger.warn("Repair order not found", { roNumber });
      return { success: false, error: `RO #${roNumber} not found` };
    }

    // Track old status for lifecycle flow trigger
    const oldStatus = existing.curentStatus ?? "";
    let statusChanged = false;
    let newStatus = "";

    // Build update object
    const today = new Date().toISOString().split("T")[0];
    const updateData: Record<string, unknown> = {};

    const changes: string[] = [];

    // Basic information fields
    if (fields.shopName !== undefined) {
      updateData.shopName = fields.shopName;
      changes.push(`shop name: ${fields.shopName}`);
    }
    if (fields.part !== undefined) {
      updateData.part = fields.part;
      changes.push(`part: ${fields.part}`);
    }
    if (fields.serial !== undefined) {
      updateData.serial = fields.serial;
      changes.push(`serial: ${fields.serial ?? "removed"}`);
    }
    if (fields.partDescription !== undefined) {
      updateData.partDescription = fields.partDescription;
      changes.push("part description updated");
    }
    if (fields.reqWork !== undefined) {
      updateData.reqWork = fields.reqWork;
      changes.push("requested work updated");
    }

    // Status and dates
    if (fields.curentStatus !== undefined) {
      updateData.curentStatus = fields.curentStatus;
      updateData.curentStatusDate = fields.curentStatusDate ?? today;
      newStatus = fields.curentStatus;
      statusChanged = fields.curentStatus.toUpperCase().trim() !== oldStatus.toUpperCase().trim();
      changes.push(`status: ${fields.curentStatus}`);
    }
    if (fields.estimatedDeliveryDate !== undefined) {
      updateData.estimatedDeliveryDate = fields.estimatedDeliveryDate;
      changes.push(`delivery date: ${fields.estimatedDeliveryDate ?? "removed"}`);
    }
    if (fields.dateDroppedOff !== undefined) {
      updateData.dateDroppedOff = fields.dateDroppedOff;
      changes.push(`drop-off date: ${fields.dateDroppedOff ?? "removed"}`);
    }
    if (fields.dateMade !== undefined) {
      updateData.dateMade = fields.dateMade;
      changes.push(`date made: ${fields.dateMade ?? "removed"}`);
    }
    if (fields.lastDateUpdated !== undefined) {
      updateData.lastDateUpdated = fields.lastDateUpdated;
    } else {
      // Auto-update lastDateUpdated if not explicitly set
      updateData.lastDateUpdated = today;
    }
    if (fields.nextDateToUpdate !== undefined) {
      updateData.nextDateToUpdate = fields.nextDateToUpdate;
      changes.push(`next update date: ${fields.nextDateToUpdate ?? "removed"}`);
    }

    // Costs and terms
    if (fields.estimatedCost !== undefined) {
      updateData.estimatedCost = fields.estimatedCost;
      changes.push(`estimated cost: $${fields.estimatedCost ?? 0}`);
    }
    if (fields.finalCost !== undefined) {
      updateData.finalCost = fields.finalCost;
      changes.push(`final cost: $${fields.finalCost ?? 0}`);
    }
    if (fields.terms !== undefined) {
      updateData.terms = fields.terms;
      changes.push(`terms: ${fields.terms ?? "removed"}`);
    }

    // References and tracking
    if (fields.shopRef !== undefined) {
      updateData.shopRef = fields.shopRef;
      changes.push(`shop ref: ${fields.shopRef ?? "removed"}`);
    }
    if (fields.trackingNumberPickingUp !== undefined) {
      updateData.trackingNumberPickingUp = fields.trackingNumberPickingUp;
      changes.push(`tracking: ${fields.trackingNumberPickingUp ?? "removed"}`);
    }

    // Status fields
    if (fields.genthrustStatus !== undefined) {
      updateData.genthrustStatus = fields.genthrustStatus;
      changes.push(`Genthrust status: ${fields.genthrustStatus ?? "removed"}`);
    }
    if (fields.shopStatus !== undefined) {
      updateData.shopStatus = fields.shopStatus;
      changes.push(`shop status: ${fields.shopStatus ?? "removed"}`);
    }

    // Notes
    if (fields.notes !== undefined) {
      updateData.notes = fields.notes;
      changes.push("notes updated");
    }

    // Only update if there are changes
    if (Object.keys(updateData).length === 0) {
      return { success: true, roNumber, updated: [], message: "No fields to update" };
    }

    // Update in MySQL
    await db.update(active).set(updateData).where(eq(active.id, existing.id));

    // Log activity
    await db.insert(roActivityLog).values({
      repairOrderId: existing.id,
      action: "UPDATE",
      field: null,
      oldValue: null,
      newValue: `Updated via AI: ${changes.join(", ")}`,
      userId,
    });

    // Trigger lifecycle flow if status changed to a tracked status
    if (statusChanged && newStatus) {
      const normalizedNew = newStatus.toUpperCase().trim();
      if (TRACKED_STATUSES.some(s => s === normalizedNew)) {
        try {
          await tasks.trigger("handle-ro-status-change", {
            repairOrderId: existing.id,
            newStatus: normalizedNew,
            oldStatus: oldStatus.toUpperCase().trim(),
            userId,
          });
          logger.info("Triggered lifecycle flow for status change", {
            roNumber,
            oldStatus,
            newStatus: normalizedNew,
          });
        } catch (e) {
          logger.error("Failed to trigger lifecycle flow", { error: e });
          // Don't fail the update if lifecycle flow fails
        }
      }
    }

    // Trigger Excel sync
    try {
      await tasks.trigger("sync-repair-orders", {
        userId,
        repairOrderIds: [existing.id],
      });
    } catch (e) {
      logger.error("Failed to trigger Excel sync", { error: e });
    }

    logger.info("Repair order updated", { roNumber, changes, statusChanged });

    return { success: true, roNumber, updated: changes };
  },
});

// Sub-task: Archive Repair Order
// Moves a repair order to Returns/Paid/Net sheet
export const archiveRepairOrderTool = task({
  id: "ai-tool-archive-repair-order",
  machine: { preset: "micro" },
  retry: { maxAttempts: 2 },
  run: async (payload: {
    userId: string;
    roNumber: number;
    destination: "returns" | "paid" | "net";
    reason?: string;
  }) => {
    const { userId, roNumber, destination, reason } = payload;

    logger.info("Archiving repair order", { roNumber, destination });

    // Find the repair order
    const [existing] = await db
      .select()
      .from(active)
      .where(eq(active.ro, roNumber));

    if (!existing) {
      logger.warn("Repair order not found", { roNumber });
      return { success: false, error: `RO #${roNumber} not found` };
    }

    // Map destination to status
    const statusMap: Record<string, string> = {
      returns: "RETURN",
      paid: "COMPLETE",
      net: "COMPLETE",
    };

    // Map destination to sheet name for Excel
    const sheetMap: Record<string, string> = {
      returns: "Returns",
      paid: "Paid",
      net: "NET",
    };

    // Update status in MySQL
    const today = new Date().toISOString().split("T")[0];
    await db
      .update(active)
      .set({
        curentStatus: statusMap[destination],
        curentStatusDate: today,
        lastDateUpdated: today,
        notes: reason
          ? `${existing.notes ? existing.notes + " | " : ""}Archived: ${reason}`
          : existing.notes,
      })
      .where(eq(active.id, existing.id));

    // Log activity
    await db.insert(roActivityLog).values({
      repairOrderId: existing.id,
      action: "STATUS_CHANGE",
      field: "curentStatus",
      oldValue: existing.curentStatus,
      newValue: statusMap[destination],
      userId,
    });

    // Trigger move-ro-sheet task to move row in Excel
    try {
      await tasks.trigger("move-ro-sheet", {
        userId,
        roId: existing.id,
        fromSheet: "Active",
        toSheet: sheetMap[destination],
      });
    } catch (e) {
      logger.error("Failed to trigger move-ro-sheet", { error: e });
    }

    logger.info("Repair order archived", { roNumber, destination });

    return { success: true, roNumber, destination, sheet: sheetMap[destination] };
  },
});

// Sub-task: Create Email Draft
// Creates an email draft and logs to notification queue for approval
export const createEmailDraftTool = task({
  id: "ai-tool-create-email-draft",
  machine: { preset: "micro" },
  retry: { maxAttempts: 2 },
  run: async (payload: {
    userId: string;
    roNumber: number;
    toAddress: string;
    subject: string;
    body: string;
  }) => {
    const { userId, roNumber, toAddress, subject, body } = payload;

    logger.info("Creating email draft", { roNumber, toAddress, subject });

    // Find the repair order to link to notification queue
    const [existing] = await db
      .select()
      .from(active)
      .where(eq(active.ro, roNumber));

    if (!existing) {
      logger.warn("Repair order not found", { roNumber });
      return { success: false, error: `RO #${roNumber} not found` };
    }

    // Create draft in Outlook
    let draftResult;
    try {
      draftResult = await createDraftEmail(userId, toAddress, subject, body);
    } catch (e) {
      logger.error("Failed to create draft in Outlook", { error: e });
      return { success: false, error: "Failed to create draft in Outlook" };
    }

    // Log to notification queue for tracking/approval
    await db.insert(notificationQueue).values({
      repairOrderId: existing.id,
      userId,
      type: "EMAIL_DRAFT",
      status: "PENDING_APPROVAL",
      payload: {
        subject,
        body,
        to: toAddress,
        draftMessageId: draftResult.messageId,
        draftWebLink: draftResult.webLink,
      },
      scheduledFor: new Date(),
    });

    // Log activity
    await db.insert(roActivityLog).values({
      repairOrderId: existing.id,
      action: "DRAFT_CREATED",
      field: null,
      oldValue: null,
      newValue: `Email draft created for ${toAddress}: ${subject}`,
      userId,
    });

    logger.info("Email draft created", {
      roNumber,
      messageId: draftResult.messageId,
      webLink: draftResult.webLink,
    });

    return {
      success: true,
      roNumber,
      messageId: draftResult.messageId,
      webLink: draftResult.webLink,
    };
  },
});
