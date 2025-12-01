"use server";

import { auth } from "@/auth";
import { tasks } from "@trigger.dev/sdk/v3";
import { researchAgent } from "@/trigger/ai-agent";

/**
 * Result type per CLAUDE.md Section 4
 * All Server Actions must return this standardized type.
 */
type Result<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Trigger handle returned when starting an agent run
 */
export interface AgentRunResult {
  /** The Trigger.dev run ID for tracking */
  runId: string;
  /** Public access token for realtime updates */
  publicAccessToken: string;
}

/**
 * askAgent Server Action
 *
 * Authenticates the user and dispatches the research-agent task
 * to Trigger.dev for background processing.
 *
 * The AI agent runs in a durable container and can use tools
 * (search_inventory, get_repair_order) that are themselves
 * isolated sub-tasks for maximum reliability.
 *
 * @param prompt - The user's question or request
 * @returns Result with runId and publicAccessToken for realtime tracking
 */
export async function askAgent(
  prompt: string
): Promise<Result<AgentRunResult>> {
  try {
    // ==========================================
    // AUTHENTICATION CHECK
    // ==========================================
    const session = await auth();

    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized: You must be signed in to use the assistant",
      };
    }

    // Check for token errors (e.g., expired refresh token)
    if (session.error) {
      return {
        success: false,
        error: `Authentication error: ${session.error}. Please sign in again.`,
      };
    }

    // ==========================================
    // VALIDATION
    // ==========================================
    if (!prompt || prompt.trim().length < 2) {
      return {
        success: false,
        error: "Validation error: Prompt must be at least 2 characters",
      };
    }

    // ==========================================
    // TRIGGER THE BACKGROUND TASK
    // ==========================================
    const handle = await tasks.trigger<typeof researchAgent>(
      "research-agent",
      {
        prompt: prompt.trim(),
        userId: session.user.id,
      }
    );

    // Get the public access token for realtime updates
    const publicAccessToken = await handle.publicAccessToken;

    return {
      success: true,
      data: {
        runId: handle.id,
        publicAccessToken,
      },
    };
  } catch (error) {
    console.error("askAgent error:", error);
    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Failed to start assistant",
    };
  }
}
