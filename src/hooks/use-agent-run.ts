"use client";

import { useRealtimeRun } from "@trigger.dev/react-hooks";
import { useMemo } from "react";
import type { AgentOutput } from "@/trigger/ai-agent";

/**
 * Status type for agent operations
 */
export type AgentStatus =
  | "idle"
  | "thinking"
  | "searching_inventory"
  | "fetching_repair_order"
  | "completed"
  | "failed"
  | "canceled";

/**
 * Hook return type for useAgentRun
 */
export interface UseAgentRunResult {
  /** Current status of the agent */
  status: AgentStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Agent output when completed */
  output: AgentOutput | null;
  /** Error message if agent failed */
  error: string | null;
  /** Whether the agent is currently running */
  isRunning: boolean;
  /** Whether the agent has completed (success or failure) */
  isComplete: boolean;
}

/**
 * useAgentRun Hook
 *
 * Wraps Trigger.dev's useRealtimeRun hook for the research-agent task.
 * Exposes agent status, output, and progress to UI components.
 *
 * @param runId - The Trigger.dev run ID to monitor (or null/undefined if no run)
 * @param accessToken - Public access token for the run
 */
export function useAgentRun(
  runId: string | null | undefined,
  accessToken: string | null | undefined
): UseAgentRunResult {
  // Only call useRealtimeRun when we have both runId and accessToken
  const { run, error: runError } = useRealtimeRun(runId ?? undefined, {
    accessToken: accessToken ?? undefined,
    enabled: Boolean(runId && accessToken),
  });

  return useMemo(() => {
    // Default state when no run is active
    if (!runId || !accessToken || !run) {
      return {
        status: "idle" as AgentStatus,
        progress: 0,
        output: null,
        error: null,
        isRunning: false,
        isComplete: false,
      };
    }

    // Extract metadata from the run
    const metadata = run.metadata as Record<string, unknown> | undefined;
    const taskStatus = (metadata?.status as AgentStatus) ?? "thinking";
    const progress = (metadata?.progress as number) ?? 0;

    // Determine run state
    const isRunning = ["EXECUTING", "PENDING", "WAITING"].includes(run.status);
    const isComplete = ["COMPLETED", "FAILED", "CANCELED"].includes(run.status);

    // Map run status to our status type
    let status: AgentStatus = taskStatus;
    if (run.status === "FAILED") {
      status = "failed";
    } else if (run.status === "CANCELED") {
      status = "canceled";
    } else if (run.status === "COMPLETED") {
      status = "completed";
    }

    // Extract output if completed
    const output = run.status === "COMPLETED"
      ? (run.output as AgentOutput)
      : null;

    // Build error message
    let error: string | null = null;
    if (runError) {
      error = runError.message;
    } else if (run.status === "FAILED") {
      error = "Agent execution failed";
    }

    return {
      status,
      progress,
      output,
      error,
      isRunning,
      isComplete,
    };
  }, [run, runId, accessToken, runError]);
}
