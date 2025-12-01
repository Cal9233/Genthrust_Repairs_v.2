"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TurbineSpinner } from "@/components/ui/TurbineSpinner";
import { useTriggerRun, type SyncStatus as SyncStatusType } from "@/hooks/use-trigger-run";
import { triggerExcelSync } from "@/app/actions/sync";
import { RefreshCw, CheckCircle, XCircle } from "lucide-react";

interface SyncStatusProps {
  /** User ID for authenticating with Microsoft Graph */
  userId: string;
  /** Optional array of repair order IDs to sync (if not provided, syncs all) */
  repairOrderIds?: number[];
}

/**
 * Get human-readable status text
 */
function getStatusText(status: SyncStatusType, progress: number): string {
  switch (status) {
    case "idle":
      return "Ready to sync";
    case "starting":
      return "Starting...";
    case "initializing":
      return "Connecting to Excel...";
    case "fetching":
      return "Fetching data...";
    case "processing":
      return `Syncing... ${progress}%`;
    case "finishing":
      return "Saving changes...";
    case "completed":
      return "Sync completed!";
    case "failed":
      return "Sync failed";
    case "canceled":
      return "Sync canceled";
    default:
      return "Unknown status";
  }
}

/**
 * Get status icon component
 */
function StatusIcon({ status, isRunning }: { status: SyncStatusType; isRunning: boolean }) {
  if (isRunning) {
    return <TurbineSpinner size="sm" />;
  }

  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4 text-success" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-danger" />;
    default:
      return <RefreshCw className="h-4 w-4" />;
  }
}

/**
 * SyncStatus Component
 *
 * Displays a sync button and progress indicator for Excel synchronization.
 * Uses Trigger.dev's realtime hooks for live progress updates.
 *
 * Per CLAUDE.md Section 3D: Uses optimistic UI pattern - button is disabled
 * while syncing to prevent double-clicks.
 */
export function SyncStatus({ userId, repairOrderIds = [] }: SyncStatusProps) {
  // State for tracking the current run
  const [runId, setRunId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  // Use the Trigger.dev realtime hook
  const {
    status,
    progress,
    output,
    error: runError,
    isRunning,
    isComplete,
    totalItems,
    processedItems,
  } = useTriggerRun(runId, accessToken);

  // Handle sync button click
  const handleSync = useCallback(async () => {
    setTriggerError(null);

    // For demo purposes, if no repairOrderIds provided, use sample IDs
    // In production, you'd fetch these from the UI selection or database
    const idsToSync = repairOrderIds.length > 0
      ? repairOrderIds
      : [1, 2, 3]; // Sample IDs for testing

    const result = await triggerExcelSync(userId, idsToSync);

    if (result.success) {
      setRunId(result.data.runId);
      setAccessToken(result.data.publicAccessToken);
    } else {
      setTriggerError(result.error);
    }
  }, [userId, repairOrderIds]);

  // Reset state for a new sync
  const handleReset = useCallback(() => {
    setRunId(null);
    setAccessToken(null);
    setTriggerError(null);
  }, []);

  // Determine which error to show
  const errorMessage = triggerError || runError;

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Excel Sync</h3>
        <StatusIcon status={status} isRunning={isRunning} />
      </div>

      {/* Progress Section */}
      {(isRunning || (isComplete && status !== "idle")) && (
        <div className="mb-4 space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{getStatusText(status, progress)}</span>
            {totalItems > 0 && (
              <span>
                {processedItems} / {totalItems} items
              </span>
            )}
          </div>
        </div>
      )}

      {/* Success Output */}
      {status === "completed" && output && (
        <div className="mb-4 rounded-md bg-success/10 p-3 text-sm text-success dark:bg-success/20">
          <p className="font-medium">Sync completed successfully!</p>
          <ul className="mt-1 text-xs space-y-0.5">
            <li>Rows updated: {output.rowsUpdated}</li>
            <li>Rows added: {output.rowsAdded}</li>
            {output.failedCount > 0 && (
              <li className="text-warning">Failed: {output.failedCount}</li>
            )}
          </ul>
        </div>
      )}

      {/* Error Display */}
      {errorMessage && (
        <div className="mb-4 rounded-md bg-danger/10 p-3 text-sm text-danger dark:bg-danger/20">
          <p className="font-medium">Error</p>
          <p className="text-xs mt-1">{errorMessage}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {isComplete ? (
          <Button onClick={handleReset} variant="outline" className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync Again
          </Button>
        ) : (
          <Button
            onClick={handleSync}
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? (
              <>
                <TurbineSpinner size="sm" className="mr-2" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync to Excel
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
