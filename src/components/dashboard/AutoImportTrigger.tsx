"use client";

import { useEffect, useRef, useState } from "react";
import { triggerExcelImport } from "@/app/actions/import";
import { useTriggerRun } from "@/hooks/use-trigger-run";
import { useRefresh } from "@/contexts/RefreshContext";
import { toast } from "sonner";

interface AutoImportTriggerProps {
  userId: string;
}

/**
 * AutoImportTrigger - Session-based auto-import on dashboard load
 *
 * Triggers Excel → MySQL import once per browser session.
 * Uses sessionStorage to prevent duplicate imports on page refreshes.
 *
 * Flow:
 * 1. Check if already imported this session
 * 2. If not, trigger background import via Trigger.dev
 * 3. Show toast notifications for status
 * 4. Refresh dashboard when complete
 */
export function AutoImportTrigger({ userId }: AutoImportTriggerProps) {
  const hasTriggeredRef = useRef(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const { status } = useTriggerRun(runId, accessToken);
  const { triggerRefresh } = useRefresh();

  // Track completion status
  useEffect(() => {
    if (status === "completed") {
      toast.success("Excel data synced");
      triggerRefresh();
      setRunId(null);
      setAccessToken(null);
    } else if (status === "failed") {
      toast.error("Excel sync failed");
      setRunId(null);
      setAccessToken(null);
    }
  }, [status, triggerRefresh]);

  // Trigger import on mount (once per session)
  useEffect(() => {
    // Prevent double triggers from React StrictMode
    if (hasTriggeredRef.current) return;

    const hasImported = sessionStorage.getItem("excel-imported");
    if (hasImported) return;

    // Mark as triggered immediately
    hasTriggeredRef.current = true;
    sessionStorage.setItem("excel-imported", "true");

    // Trigger background import (non-blocking)
    triggerExcelImport(userId).then((result) => {
      if (result.success) {
        setRunId(result.data.runId);
        setAccessToken(result.data.publicAccessToken);
        toast.info("Syncing from Excel...");
      } else {
        // Don't show error toast - user didn't initiate this
        console.error("Auto-import failed:", result.error);
      }
    });
  }, [userId]);

  // No UI, just side effect
  return null;
}
