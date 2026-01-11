"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { syncAllFromERP } from "@/app/actions/external-repair-orders";

/**
 * ERPSyncButton - Manual ERP sync trigger
 *
 * Allows users to manually sync repair orders from ERP.aero.
 * Shows loading state during sync and toast notifications for results.
 */
export function ERPSyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    toast.info("Syncing from ERP...");

    try {
      const result = await syncAllFromERP();

      if (result.success) {
        const { total, created, updated, failed } = result.data;
        toast.success(
          `ERP Sync complete: ${created} created, ${updated} updated${failed > 0 ? `, ${failed} failed` : ""}`
        );
        // Refresh page to show updated data
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        toast.error(`ERP Sync failed: ${result.error}`);
      }
    } catch (error) {
      toast.error("ERP Sync failed: Unexpected error");
      console.error("ERP sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={isSyncing}
    >
      <RefreshCw className={isSyncing ? "animate-spin" : ""} />
      {isSyncing ? "Syncing..." : "Sync ERP"}
    </Button>
  );
}
