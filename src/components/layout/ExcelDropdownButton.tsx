"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TurbineSpinner } from "@/components/ui/TurbineSpinner";
import { useTriggerRun } from "@/hooks/use-trigger-run";
import { triggerSyncAllActive } from "@/app/actions/sync";
import { triggerExcelImport } from "@/app/actions/import";
import { FileSpreadsheet, Download, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRefresh } from "@/contexts/RefreshContext";

interface ExcelDropdownButtonProps {
  userId: string;
}

type ActionType = "import" | "sync" | null;

/**
 * ExcelDropdownButton - Combined Import/Sync dropdown for Excel operations
 *
 * Shows FileSpreadsheet icon by default, expands to dropdown with:
 * - Import (Download icon): Excel → MySQL
 * - Sync (Upload icon): MySQL → Excel
 *
 * Features TurbineSpinner while running and colored glow shadow for 3 seconds after completion.
 */
export function ExcelDropdownButton({ userId }: ExcelDropdownButtonProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [resultStatus, setResultStatus] = useState<"idle" | "success" | "error">("idle");
  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [isOpen, setIsOpen] = useState(false);

  const { status, isRunning } = useTriggerRun(runId, accessToken);
  const { triggerRefresh } = useRefresh();

  // Set result status when action completes
  useEffect(() => {
    if (status === "completed") {
      setResultStatus("success");
      const actionName = activeAction === "import" ? "Import" : "Sync";
      toast.success(`${actionName} completed successfully`);
      triggerRefresh(); // Refresh the RepairOrderTable
      setActiveAction(null);
    } else if (status === "failed" || status === "canceled") {
      setResultStatus("error");
      const actionName = activeAction === "import" ? "Import" : "Sync";
      toast.error(`${actionName} failed`);
      setActiveAction(null);
    }
  }, [status, activeAction, triggerRefresh]);

  // Auto-clear result status after 3 seconds
  useEffect(() => {
    if (resultStatus !== "idle") {
      const timer = setTimeout(() => setResultStatus("idle"), 3000);
      return () => clearTimeout(timer);
    }
  }, [resultStatus]);

  // Handle Import: Excel → MySQL
  const handleImport = useCallback(async () => {
    setIsOpen(false);
    setResultStatus("idle");
    setActiveAction("import");

    const result = await triggerExcelImport(userId);
    if (result.success) {
      setRunId(result.data.runId);
      setAccessToken(result.data.publicAccessToken);
      toast.info("Importing from Excel...");
    } else {
      setResultStatus("error");
      setActiveAction(null);
      toast.error(result.error);
    }
  }, [userId]);

  // Handle Sync: MySQL → Excel (syncs all active ROs)
  const handleSync = useCallback(async () => {
    setIsOpen(false);
    setResultStatus("idle");
    setActiveAction("sync");

    // Sync all active ROs
    const result = await triggerSyncAllActive();
    if (result.success) {
      setRunId(result.data.runId);
      setAccessToken(result.data.publicAccessToken);
      toast.info("Syncing to Excel...");
    } else {
      setResultStatus("error");
      setActiveAction(null);
      toast.error(result.error);
    }
  }, []);

  // Get the appropriate icon for current state
  const getIcon = () => {
    if (isRunning) {
      return <TurbineSpinner size="sm" />;
    }
    if (activeAction === "import") {
      return <Download className="h-5 w-5" />;
    }
    if (activeAction === "sync") {
      return <Upload className="h-5 w-5" />;
    }
    return <FileSpreadsheet className="h-5 w-5" />;
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={isRunning}
          className={cn(
            "text-header-foreground transition-shadow duration-300",
            resultStatus === "success" && "glow-success",
            resultStatus === "error" && "glow-error"
          )}
          aria-label="Excel operations"
        >
          {getIcon()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={handleImport}
          disabled={isRunning}
          className="cursor-pointer"
        >
          <Download className="mr-2 h-4 w-4" />
          <span>Import from Excel</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleSync}
          disabled={isRunning}
          className="cursor-pointer"
        >
          <Upload className="mr-2 h-4 w-4" />
          <span>Sync to Excel</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
