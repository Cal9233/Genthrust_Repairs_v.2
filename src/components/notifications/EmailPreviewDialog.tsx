"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import type { NotificationQueueItem } from "@/lib/schema";
import type { EmailDraftPayload } from "@/lib/types/notification";

interface EmailPreviewDialogProps {
  notification: NotificationQueueItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  isActioning: boolean;
}

export function EmailPreviewDialog({
  notification,
  open,
  onOpenChange,
  onApprove,
  onReject,
  isActioning,
}: EmailPreviewDialogProps) {
  if (!notification) return null;

  const payload = notification.payload as EmailDraftPayload;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Email Preview</DialogTitle>
            <Badge variant="outline">RO #{notification.repairOrderId}</Badge>
          </div>
          <DialogDescription className="sr-only">
            Preview email draft before sending
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden">
          {/* Email Header Fields */}
          <div className="space-y-2 border-b pb-4">
            <Field label="To:" value={payload.to || payload.toAddress || "-"} />
            {payload.cc && <Field label="CC:" value={payload.cc} />}
            <Field label="Subject:" value={payload.subject} />
          </div>

          {/* Email Body */}
          <div className="flex-1 overflow-y-auto">
            <div
              className="prose prose-sm dark:prose-invert max-w-none bg-muted/30 rounded-lg p-4"
              dangerouslySetInnerHTML={{ __html: payload.body }}
            />
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button
            className="bg-success-green hover:bg-success-green/90"
            onClick={() => onApprove(notification.id)}
            disabled={isActioning}
          >
            <Check className="h-4 w-4 mr-1" />
            Approve & Send
          </Button>
          <Button
            variant="outline"
            className="text-danger-red border-danger-red hover:bg-danger-red/10"
            onClick={() => onReject(notification.id)}
            disabled={isActioning}
          >
            <X className="h-4 w-4 mr-1" />
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-sm font-medium text-muted-foreground w-16 shrink-0">
        {label}
      </span>
      <span className="text-sm break-all">{value}</span>
    </div>
  );
}
