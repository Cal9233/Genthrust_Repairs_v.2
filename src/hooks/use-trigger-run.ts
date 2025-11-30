"use client";

import { useRealtimeRun, useRealtimeRunWithStreams } from "@trigger.dev/react-hooks";
import { useMemo } from "react";
import type { SyncRepairOrdersOutput } from "@/trigger/excel-sync";

/**
 * Status type for sync operations
 */
export type SyncStatus =
  | "idle"
  | "starting"
  | "initializing"
  | "processing"
  | "finishing"
  | "completed"
  | "failed"
  | "canceled";

/**
 * Hook return type for useTriggerRun
 */
export interface UseTriggerRunResult {
  /** Current status of the task */
  status: SyncStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Task output when completed */
  output: SyncRepairOrdersOutput | null;
  /** Error message if task failed */
  error: string | null;
  /** Whether the task is currently running */
  isRunning: boolean;
  /** Whether the task has completed (success or failure) */
  isComplete: boolean;
  /** Total items being processed */
  totalItems: number;
  /** Number of items processed so far */
  processedItems: number;
}

/**
 * useTriggerRun Hook
 *
 * Wraps Trigger.dev's useRealtimeRun hook to expose status, output,
 * and progress (0-100) to UI components.
 *
 * Per CLAUDE.md Section 3C: Use useRealtimeRun hooks to show progress
 * bars in the UI. No WebSockets required.
 *
 * @param runId - The Trigger.dev run ID to monitor (or null/undefined if no run)
 * @param accessToken - Public access token for the run
 */
export function useTriggerRun(
  runId: string | null | undefined,
  accessToken: string | null | undefined
): UseTriggerRunResult {
  // Only call useRealtimeRun when we have both runId and accessToken
  const { run, error: runError } = useRealtimeRun(runId ?? undefined, {
    accessToken: accessToken ?? undefined,
    enabled: Boolean(runId && accessToken),
  });

  return useMemo(() => {
    // Default state when no run is active
    if (!runId || !accessToken || !run) {
      return {
        status: "idle" as SyncStatus,
        progress: 0,
        output: null,
        error: null,
        isRunning: false,
        isComplete: false,
        totalItems: 0,
        processedItems: 0,
      };
    }

    // Extract metadata from the run
    const metadata = run.metadata as Record<string, unknown> | undefined;
    const taskStatus = (metadata?.status as SyncStatus) ?? "idle";
    const progress = (metadata?.progress as number) ?? 0;
    const totalItems = (metadata?.totalItems as number) ?? 0;
    const processedItems = (metadata?.processedItems as number) ?? 0;

    // Determine run state
    const isRunning = ["EXECUTING", "PENDING", "WAITING"].includes(run.status);
    const isComplete = ["COMPLETED", "FAILED", "CANCELED"].includes(run.status);

    // Map run status to our status type
    let status: SyncStatus = taskStatus;
    if (run.status === "FAILED") {
      status = "failed";
    } else if (run.status === "CANCELED") {
      status = "canceled";
    } else if (run.status === "COMPLETED") {
      status = "completed";
    }

    // Extract output if completed
    const output = run.status === "COMPLETED"
      ? (run.output as SyncRepairOrdersOutput)
      : null;

    // Build error message
    let error: string | null = null;
    if (runError) {
      error = runError.message;
    } else if (run.status === "FAILED") {
      error = "Task execution failed";
    }

    return {
      status,
      progress,
      output,
      error,
      isRunning,
      isComplete,
      totalItems,
      processedItems,
    };
  }, [run, runId, accessToken, runError]);
}

/**
 * useTriggerRunWithProgress Hook
 *
 * Extended version that includes stream support for real-time logs.
 * Use this when you need to display task logs in the UI.
 *
 * @param runId - The Trigger.dev run ID to monitor
 * @param accessToken - Public access token for the run
 */
export function useTriggerRunWithProgress(
  runId: string | null | undefined,
  accessToken: string | null | undefined
) {
  const basicResult = useTriggerRun(runId, accessToken);

  const { streams } = useRealtimeRunWithStreams(runId ?? undefined, {
    accessToken: accessToken ?? undefined,
    enabled: Boolean(runId && accessToken),
  });

  return {
    ...basicResult,
    streams,
  };
}
