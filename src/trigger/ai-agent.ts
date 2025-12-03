import { task, metadata, logger, tasks } from "@trigger.dev/sdk/v3";
import { generateText, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import {
  searchInventoryTool,
  getRepairOrderTool,
  createRepairOrderTool,
  updateRepairOrderTool,
  archiveRepairOrderTool,
  createEmailDraftTool,
} from "./ai-tools";

// Payload schema for the research agent
const AgentPayloadSchema = z.object({
  prompt: z.string().min(1),
  userId: z.string().min(1),
});

export type AgentPayload = z.infer<typeof AgentPayloadSchema>;

// Output type for the agent
export interface AgentOutput {
  response: string;
  toolCallCount: number;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// Tool input schemas
const SearchInventorySchema = z.object({
  query: z.string().describe("Part number or description keyword to search for"),
  limit: z.number().optional().describe("Maximum number of results to return (default 20)"),
});

const GetRepairOrderSchema = z.object({
  roNumber: z.number().optional().describe("Repair order number (e.g., 12345)"),
  roId: z.number().optional().describe("Database ID of the repair order"),
});

const CreateRepairOrderSchema = z.object({
  shopName: z.string().describe("Name of the repair shop"),
  part: z.string().describe("Part number"),
  serial: z.string().optional().describe("Serial number"),
  partDescription: z.string().optional().describe("Description of the part"),
  reqWork: z.string().optional().describe("Requested work/repairs"),
  estimatedCost: z.number().optional().describe("Estimated repair cost in USD"),
});

const UpdateRepairOrderSchema = z.object({
  roNumber: z.number().describe("Repair order number to update"),
  fields: z.object({
    curentStatus: z.string().optional().describe("New status (e.g., 'IN PROCESS', 'COMPLETE', 'WAITING QUOTE')"),
    notes: z.string().optional().describe("Notes to update"),
    estimatedCost: z.number().optional().describe("Updated estimated cost"),
    finalCost: z.number().optional().describe("Final cost"),
    shopRef: z.string().optional().describe("Shop reference number"),
    estimatedDeliveryDate: z.string().optional().describe("Estimated delivery date (YYYY-MM-DD)"),
    terms: z.string().optional().describe("Payment terms (e.g., 'NET 30')"),
  }).describe("Fields to update"),
});

const ArchiveRepairOrderSchema = z.object({
  roNumber: z.number().describe("Repair order number to archive"),
  destination: z.enum(["returns", "paid", "net"]).describe("Destination sheet: 'returns' for returned items, 'paid' for paid items, 'net' for NET 30 terms"),
  reason: z.string().optional().describe("Reason for archiving"),
});

const CreateEmailDraftSchema = z.object({
  roNumber: z.number().describe("Repair order number this email relates to"),
  toAddress: z.string().email().describe("Recipient email address"),
  subject: z.string().describe("Email subject line"),
  body: z.string().describe("Email body content (HTML supported)"),
});

// Main research agent task
// Orchestrates AI reasoning with durable tool calls via sub-tasks
export const researchAgent = task({
  id: "research-agent",
  machine: { preset: "small-1x" },
  retry: { maxAttempts: 2 },
  run: async (payload: AgentPayload): Promise<AgentOutput> => {
    const { prompt, userId } = AgentPayloadSchema.parse(payload);

    logger.info("Starting research agent", { userId, promptLength: prompt.length });

    await metadata.set("status", "thinking");
    await metadata.set("progress", 10);

    const result = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      maxOutputTokens: 2048,
      system: `You are an AI assistant for GenThrust, an aviation parts and repair tracking company.

Your capabilities:
- Search the inventory database by part number or description
- Look up repair order (RO) details by RO number or database ID
- Create new repair orders
- Update existing repair orders (status, notes, costs, dates, etc.)
- Archive repair orders (move to Returns, Paid, or NET sheets)
- Create email drafts for follow-ups (saved to user's drafts folder for review)

Guidelines:
- Be concise and professional
- When presenting inventory results, summarize key details (part number, quantity, location, condition)
- When presenting repair orders, highlight status, shop, part info, and estimated dates
- If no results are found, suggest alternative searches
- Format responses in markdown when helpful for readability
- When creating or modifying records, confirm the action and show key details
- Email drafts are NOT sent automatically - they are saved to the drafts folder for user review
- All changes are automatically synced to the Excel workbook`,
      prompt,
      tools: {
        search_inventory: {
          description:
            "Search the inventory index by part number or description. Returns matching parts with quantity, location, and condition.",
          inputSchema: SearchInventorySchema,
          execute: async ({ query, limit }: z.infer<typeof SearchInventorySchema>) => {
            logger.info("Tool call: search_inventory", { query, limit });

            await metadata.set("status", "searching_inventory");
            await metadata.set("progress", 40);

            // Trigger sub-task and wait for result (durable execution)
            const handle = await tasks.triggerAndWait(
              searchInventoryTool.id,
              { query, limit }
            );

            if (!handle.ok) {
              logger.error("search_inventory sub-task failed", {
                error: handle.error,
              });
              return { error: "Failed to search inventory", items: [], count: 0 };
            }

            return handle.output;
          },
        },
        get_repair_order: {
          description:
            "Look up repair order details by RO number or database ID. Returns full RO information including status, shop, costs, and dates.",
          inputSchema: GetRepairOrderSchema,
          execute: async ({ roNumber, roId }: z.infer<typeof GetRepairOrderSchema>) => {
            logger.info("Tool call: get_repair_order", { roNumber, roId });

            await metadata.set("status", "fetching_repair_order");
            await metadata.set("progress", 40);

            // Trigger sub-task and wait for result (durable execution)
            const handle = await tasks.triggerAndWait(
              getRepairOrderTool.id,
              { roNumber, roId }
            );

            if (!handle.ok) {
              logger.error("get_repair_order sub-task failed", {
                error: handle.error,
              });
              return { error: "Failed to fetch repair order", repairOrder: null };
            }

            return handle.output;
          },
        },
        create_repair_order: {
          description:
            "Create a new repair order. Requires shop name and part number. Automatically syncs to Excel.",
          inputSchema: CreateRepairOrderSchema,
          execute: async (params: z.infer<typeof CreateRepairOrderSchema>) => {
            logger.info("Tool call: create_repair_order", params);

            await metadata.set("status", "creating_repair_order");
            await metadata.set("progress", 40);

            const handle = await tasks.triggerAndWait(
              createRepairOrderTool.id,
              { userId, ...params }
            );

            if (!handle.ok) {
              logger.error("create_repair_order sub-task failed", {
                error: handle.error,
              });
              return { success: false, error: "Failed to create repair order" };
            }

            return handle.output;
          },
        },
        update_repair_order: {
          description:
            "Update fields on an existing repair order. Can update status, notes, costs, dates, and more. Changes sync to Excel.",
          inputSchema: UpdateRepairOrderSchema,
          execute: async ({ roNumber, fields }: z.infer<typeof UpdateRepairOrderSchema>) => {
            logger.info("Tool call: update_repair_order", { roNumber, fields });

            await metadata.set("status", "updating_repair_order");
            await metadata.set("progress", 40);

            const handle = await tasks.triggerAndWait(
              updateRepairOrderTool.id,
              { userId, roNumber, fields }
            );

            if (!handle.ok) {
              logger.error("update_repair_order sub-task failed", {
                error: handle.error,
              });
              return { success: false, error: "Failed to update repair order" };
            }

            return handle.output;
          },
        },
        archive_repair_order: {
          description:
            "Archive a repair order by moving it to Returns, Paid, or NET sheet. Use 'returns' for items being returned, 'paid' for paid orders, 'net' for NET 30 terms.",
          inputSchema: ArchiveRepairOrderSchema,
          execute: async ({ roNumber, destination, reason }: z.infer<typeof ArchiveRepairOrderSchema>) => {
            logger.info("Tool call: archive_repair_order", { roNumber, destination, reason });

            await metadata.set("status", "archiving_repair_order");
            await metadata.set("progress", 40);

            const handle = await tasks.triggerAndWait(
              archiveRepairOrderTool.id,
              { userId, roNumber, destination, reason }
            );

            if (!handle.ok) {
              logger.error("archive_repair_order sub-task failed", {
                error: handle.error,
              });
              return { success: false, error: "Failed to archive repair order" };
            }

            return handle.output;
          },
        },
        create_email_draft: {
          description:
            "Create an email draft related to a repair order. The draft is saved to the user's Outlook drafts folder for review - it is NOT sent automatically. Also logged to notification queue for tracking.",
          inputSchema: CreateEmailDraftSchema,
          execute: async ({ roNumber, toAddress, subject, body }: z.infer<typeof CreateEmailDraftSchema>) => {
            logger.info("Tool call: create_email_draft", { roNumber, toAddress, subject });

            await metadata.set("status", "creating_email_draft");
            await metadata.set("progress", 40);

            const handle = await tasks.triggerAndWait(
              createEmailDraftTool.id,
              { userId, roNumber, toAddress, subject, body }
            );

            if (!handle.ok) {
              logger.error("create_email_draft sub-task failed", {
                error: handle.error,
              });
              return { success: false, error: "Failed to create email draft" };
            }

            return handle.output;
          },
        },
      },
      stopWhen: stepCountIs(8), // Allow up to 8 sequential tool calls (increased for new capabilities)
    });

    await metadata.set("status", "completed");
    await metadata.set("progress", 100);

    const toolCallCount = result.steps.reduce(
      (acc, step) => acc + step.toolCalls.length,
      0
    );

    logger.info("Research agent completed", {
      responseLength: result.text.length,
      toolCallCount,
      usage: result.usage,
    });

    return {
      response: result.text,
      toolCallCount,
      usage: {
        promptTokens: result.usage.inputTokens ?? 0,
        completionTokens: result.usage.outputTokens ?? 0,
        totalTokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
      },
    };
  },
});
