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
import { Badge } from "@/components/ui/badge";
import { Check, X, Pencil } from "lucide-react";
import { EditableEmailPreview } from "./EditableEmailPreview";
import { updateNotificationPayload } from "@/app/actions/notifications";
import type { NotificationQueueItem } from "@/lib/schema";
import type { EmailDraftPayload } from "@/lib/types/notification";

interface EmailPreviewDialogProps {
  notification: NotificationQueueItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  isActioning: boolean;
  onUpdate?: () => void; // Callback to refresh notification list after edit
}

export function EmailPreviewDialog({
  notification,
  open,
  onOpenChange,
  onApprove,
  onReject,
  isActioning,
  onUpdate,
}: EmailPreviewDialogProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localPayload, setLocalPayload] = useState<EmailDraftPayload | null>(null);

  if (!notification) return null;

  // Use local payload if we've edited, otherwise use notification payload
  const payload = (localPayload || notification.payload) as EmailDraftPayload;

  const handleSave = async (updates: { to: string; cc: string; subject: string; body: string }) => {
    setIsSaving(true);
    try {
      const result = await updateNotificationPayload(notification.id, updates);
      if (result.success) {
        // Update local state with new values
        setLocalPayload({
          ...payload,
          to: updates.to,
          cc: updates.cc || undefined,
          subject: updates.subject,
          body: updates.body,
        });
        setIsEditMode(false);
        onUpdate?.(); // Refresh parent list
      } else {
        console.error("Failed to save:", result.error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      // Reset state when closing
      setIsEditMode(false);
      setLocalPayload(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{isEditMode ? "Edit Email Draft" : "Email Preview"}</DialogTitle>
            <Badge variant="outline">RO #{notification.repairOrderId}</Badge>
          </div>
          <DialogDescription className="sr-only">
            {isEditMode ? "Edit email draft before sending" : "Preview email draft before sending"}
          </DialogDescription>
        </DialogHeader>

        {isEditMode ? (
          <EditableEmailPreview
            payload={payload}
            onSave={handleSave}
            onCancel={handleCancel}
            isSaving={isSaving}
          />
        ) : (
          <>
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

            <DialogFooter className="gap-3 sm:gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditMode(true)}
                disabled={isActioning}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <div className="flex gap-2">
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
              </div>
            </DialogFooter>
          </>
        )}
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
