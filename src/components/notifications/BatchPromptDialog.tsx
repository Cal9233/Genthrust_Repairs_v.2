"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Mail, Layers } from "lucide-react";
import type { SiblingNotification } from "@/app/actions/notifications";

interface BatchPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shopName: string;
  currentRo: {
    roNumber: number | null;
    partNumber: string | null;
    serialNumber: string | null;
  };
  siblings: SiblingNotification[];
  onConfirmBatch: (selectedIds: number[]) => void;
  onSkipBatch: () => void;
  isLoading?: boolean;
}

const BATCH_PROMPT_DISABLED_KEY = "disableBatchPrompt";

/**
 * Check if batch prompts are disabled in localStorage
 */
export function isBatchPromptDisabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(BATCH_PROMPT_DISABLED_KEY) === "true";
}

/**
 * Disable batch prompts (user clicked "Don't ask again")
 */
export function disableBatchPrompt(): void {
  localStorage.setItem(BATCH_PROMPT_DISABLED_KEY, "true");
}

/**
 * Re-enable batch prompts (user clicked reset in settings)
 */
export function enableBatchPrompt(): void {
  localStorage.removeItem(BATCH_PROMPT_DISABLED_KEY);
}

export function BatchPromptDialog({
  open,
  onOpenChange,
  shopName,
  currentRo,
  siblings,
  onConfirmBatch,
  onSkipBatch,
  isLoading = false,
}: BatchPromptDialogProps) {
  // Track which siblings are selected (all selected by default)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(siblings.map((s) => s.notificationId))
  );
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const handleToggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirmBatch = () => {
    if (dontAskAgain) {
      disableBatchPrompt();
    }
    onConfirmBatch(Array.from(selectedIds));
  };

  const handleSkip = () => {
    if (dontAskAgain) {
      disableBatchPrompt();
    }
    onSkipBatch();
  };

  const selectedCount = selectedIds.size;
  const _totalCount = siblings.length + 1; // Including current RO

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <DialogTitle>Batch Email Available</DialogTitle>
          </div>
          <DialogDescription>
            There {siblings.length === 1 ? "is" : "are"}{" "}
            <strong>{siblings.length}</strong> other pending RO
            {siblings.length === 1 ? "" : "s"} from{" "}
            <strong>{shopName}</strong>. Would you like to combine them into one
            email?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* Current RO (always included, not toggleable) */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/30">
            <Mail className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-mono font-medium">
                RO #{currentRo.roNumber ?? "-"}
              </span>
              <span className="text-muted-foreground mx-2">-</span>
              <span className="text-sm text-muted-foreground font-mono">
                {currentRo.partNumber ?? "-"}
              </span>
            </div>
            <Badge variant="secondary" className="shrink-0">
              Primary
            </Badge>
          </div>

          {/* Sibling ROs (toggleable) */}
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {siblings.map((sibling) => (
              <label
                key={sibling.notificationId}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selectedIds.has(sibling.notificationId)}
                  onCheckedChange={() => handleToggle(sibling.notificationId)}
                />
                <div className="flex-1 min-w-0">
                  <span className="font-mono font-medium">
                    RO #{sibling.roNumber ?? "-"}
                  </span>
                  <span className="text-muted-foreground mx-2">-</span>
                  <span className="text-sm text-muted-foreground font-mono">
                    {sibling.partNumber ?? "-"}
                  </span>
                  {sibling.serialNumber && (
                    <span className="text-xs text-muted-foreground ml-2">
                      S/N: {sibling.serialNumber}
                    </span>
                  )}
                </div>
              </label>
            ))}
          </div>

          {/* Don't ask again checkbox */}
          <label className="flex items-center gap-2 pt-2 border-t cursor-pointer">
            <Checkbox
              checked={dontAskAgain}
              onCheckedChange={(checked: boolean | "indeterminate") => setDontAskAgain(checked === true)}
            />
            <span className="text-sm text-muted-foreground">
              Don&apos;t ask me again
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isLoading}
          >
            Send Separately
          </Button>
          <Button
            onClick={handleConfirmBatch}
            disabled={isLoading || selectedCount === 0}
          >
            <Layers className="h-4 w-4 mr-1" />
            Combine {selectedCount > 0 ? selectedCount + 1 : 1} RO
            {selectedCount > 0 ? "s" : ""} into One Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
