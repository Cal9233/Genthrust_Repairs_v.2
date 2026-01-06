"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TurbineSpinner } from "@/components/ui/TurbineSpinner";
import { useTriggerRun } from "@/hooks/use-trigger-run";
import { triggerSyncAllActive } from "@/app/actions/sync";
import { FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExcelSyncButtonProps {
  userId: string;
}

/**
 * ExcelSyncButton - Header badge button for Excel sync
 *
 * Shows FileSpreadsheet icon by default, TurbineSpinner while syncing,
 * and colored glow shadow (green/red) for 3 seconds after completion.
 */
export function ExcelSyncButton({ userId }: ExcelSyncButtonProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [resultStatus, setResultStatus] = useState<"idle" | "success" | "error">("idle");

  const { status, isRunning } = useTriggerRun(runId, accessToken);

  // Set result status when sync completes (react to status changes)
  useEffect(() => {
    if (status === "completed") {
      setResultStatus("success");
    } else if (status === "failed" || status === "canceled") {
      setResultStatus("error");
    }
  }, [status]);

  // Auto-clear result status after 3 seconds
  useEffect(() => {
    if (resultStatus !== "idle") {
      const timer = setTimeout(() => setResultStatus("idle"), 3000);
      return () => clearTimeout(timer);
    }
  }, [resultStatus]);

  const handleSync = useCallback(async () => {
    setResultStatus("idle");

    // Sync ALL active repair orders from the database
    const result = await triggerSyncAllActive();

    if (result.success) {
      setRunId(result.data.runId);
      setAccessToken(result.data.publicAccessToken);
    } else {
      console.error("Sync failed:", result.error);
      setResultStatus("error");
    }
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleSync}
      disabled={isRunning}
      className={cn(
        "text-header-foreground transition-shadow duration-300",
        resultStatus === "success" && "glow-success",
        resultStatus === "error" && "glow-error"
      )}
      aria-label="Sync to Excel"
    >
      {isRunning ? (
        <TurbineSpinner size="sm" />
      ) : (
        <FileSpreadsheet className="h-5 w-5" />
      )}
    </Button>
  );
}
