import { task, metadata, logger, tasks } from "@trigger.dev/sdk/v3";
import { generateText, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { searchInventoryTool, getRepairOrderTool } from "./ai-tools";

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

Guidelines:
- Be concise and professional
- When presenting inventory results, summarize key details (part number, quantity, location, condition)
- When presenting repair orders, highlight status, shop, part info, and estimated dates
- If no results are found, suggest alternative searches
- Format responses in markdown when helpful for readability`,
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
      },
      stopWhen: stepCountIs(5), // Allow up to 5 sequential tool calls
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
