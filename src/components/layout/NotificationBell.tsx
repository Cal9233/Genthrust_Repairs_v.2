"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Bell, X, Check, Mail, Clock, CheckCircle, XCircle, Send, Eye, RotateCcw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TurbineSpinner } from "@/components/ui/TurbineSpinner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getPendingNotifications,
  approveNotification,
  rejectNotification,
  getAllNotifications,
  requeueNotification,
  getRelatedPendingNotifications,
  approveBatchNotifications,
} from "@/app/actions/notifications";
import type { SiblingNotification, NotificationWithShop } from "@/app/actions/notifications";
import { useTriggerRun } from "@/hooks/use-trigger-run";
import { toast } from "sonner";
import { EmailThreadView } from "@/components/notifications/EmailThreadView";
import { EmailPreviewDialog } from "@/components/notifications/EmailPreviewDialog";
import {
  BatchPromptDialog,
  isBatchPromptDisabled,
  enableBatchPrompt,
} from "@/components/notifications/BatchPromptDialog";
import { generateBatchEmailContent } from "@/lib/batch-email-template";
import type { NotificationQueueItem } from "@/lib/schema";
import type { EmailDraftPayload, NotificationStatus } from "@/lib/types/notification";

const statusConfig: Record<NotificationStatus, { label: string; className: string; icon: typeof Clock }> = {
  PENDING_APPROVAL: { label: "Pending", className: "bg-warning text-warning-foreground", icon: Clock },
  APPROVED: { label: "Approved", className: "bg-success text-success-foreground", icon: CheckCircle },
  REJECTED: { label: "Rejected", className: "bg-danger text-danger-foreground", icon: XCircle },
  SENT: { label: "Sent", className: "bg-sky-500 text-sky-50", icon: Send },
  FAILED: { label: "Failed", className: "bg-destructive text-destructive-foreground", icon: AlertCircle },
};

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationWithShop[]>([]);
  const [historyNotifications, setHistoryNotifications] = useState<NotificationQueueItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isHistoryPending, startHistoryTransition] = useTransition();
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [previewNotification, setPreviewNotification] = useState<NotificationQueueItem | null>(null);

  // Batch email prompt state
  const [batchPromptOpen, setBatchPromptOpen] = useState(false);
  const [batchShopName, setBatchShopName] = useState("");
  const [batchCurrentRo, setBatchCurrentRo] = useState<{
    roNumber: number | null;
    partNumber: string | null;
    serialNumber: string | null;
  }>({ roNumber: null, partNumber: null, serialNumber: null });
  const [batchSiblings, setBatchSiblings] = useState<SiblingNotification[]>([]);
  const [pendingBatchNotification, setPendingBatchNotification] = useState<NotificationQueueItem | null>(null);
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  // Track sibling IDs when batch is confirmed - passed to EmailPreviewDialog for batch approval
  const [batchedSiblingIds, setBatchedSiblingIds] = useState<number[]>([]);
  // Track batch prompt preference for showing reset button
  const [batchPromptDisabled, setBatchPromptDisabled] = useState(false);

  // Check batch prompt preference on mount
  useEffect(() => {
    setBatchPromptDisabled(isBatchPromptDisabled());
  }, [isOpen]);

  // Reset batch prompt preference
  const handleResetBatchPrompt = () => {
    enableBatchPrompt();
    setBatchPromptDisabled(false);
    toast.success("Batch email prompts re-enabled");
  };

  // Track active email send for toast notifications
  const [emailRunId, setEmailRunId] = useState<string | null>(null);
  const [emailAccessToken, setEmailAccessToken] = useState<string | null>(null);
  const { status: emailRunStatus } = useTriggerRun(emailRunId, emailAccessToken);

  // Show toast when email send completes or fails
  useEffect(() => {
    if (emailRunStatus === "completed") {
      toast.success("Email sent successfully");
      setEmailRunId(null);
      setEmailAccessToken(null);
      fetchHistory(); // Refresh history to show the sent email
    } else if (emailRunStatus === "failed") {
      toast.error("Failed to send email");
      setEmailRunId(null);
      setEmailAccessToken(null);
      fetchHistory(); // Refresh to show FAILED status
    }
  }, [emailRunStatus]);

  // Fetch notifications on mount and when sheet opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      if (activeTab === "history") {
        fetchHistory();
      }
    }
  }, [isOpen, activeTab]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, []);

  // Listen for refresh events from AutoImportTrigger
  // This ensures notifications are updated after Excel import deletes orphaned records
  useEffect(() => {
    const handleRefresh = () => {
      fetchNotifications();
      if (activeTab === "history") {
        fetchHistory();
      }
    };
    window.addEventListener("notifications-refresh", handleRefresh);
    return () => window.removeEventListener("notifications-refresh", handleRefresh);
  }, [activeTab]);

  const fetchNotifications = () => {
    startTransition(async () => {
      const result = await getPendingNotifications();
      if (result.success) {
        setNotifications(result.data);
      }
    });
  };

  const fetchHistory = () => {
    startHistoryTransition(async () => {
      const result = await getAllNotifications(50);
      if (result.success) {
        // Filter out pending notifications (they're shown in the Pending tab)
        setHistoryNotifications(
          result.data.filter((n) => n.status !== "PENDING_APPROVAL")
        );
      }
    });
  };

  const handleApprove = async (id: number) => {
    setActioningId(id);
    toast.info("Sending email...");

    const result = await approveNotification(id);
    if (result.success) {
      // Track the run for toast notifications
      setEmailRunId(result.data.runId);
      setEmailAccessToken(result.data.publicAccessToken);

      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setPreviewNotification(null); // Close preview dialog if open
    } else {
      toast.error(result.error || "Failed to approve notification");
    }
    setActioningId(null);
  };

  const handleReject = async (id: number) => {
    setActioningId(id);
    const result = await rejectNotification(id);
    if (result.success) {
      toast.info("Email draft rejected");
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setPreviewNotification(null); // Close preview dialog if open
    } else {
      toast.error(result.error || "Failed to reject notification");
    }
    setActioningId(null);
  };

  const handleRequeue = async (id: number) => {
    setActioningId(id);
    const result = await requeueNotification(id);
    if (result.success) {
      toast.success("Email requeued for approval");
      // Refresh both lists
      fetchNotifications();
      fetchHistory();
    } else {
      toast.error(result.error || "Failed to requeue notification");
    }
    setActioningId(null);
  };

  // Handle preview click - check for siblings first
  const handlePreviewClick = async (notification: NotificationQueueItem) => {
    // Only check for siblings on EMAIL_DRAFT notifications
    if (notification.type !== "EMAIL_DRAFT") {
      setPreviewNotification(notification);
      setBatchedSiblingIds([]);
      return;
    }

    // Check if batch prompts are disabled
    if (isBatchPromptDisabled()) {
      setPreviewNotification(notification);
      setBatchedSiblingIds([]);
      return;
    }

    // Check for siblings from the same shop
    setIsBatchLoading(true);
    const result = await getRelatedPendingNotifications(notification.id);
    setIsBatchLoading(false);

    if (!result.success || result.data.siblings.length === 0) {
      // No siblings - open normal preview
      setPreviewNotification(notification);
      setBatchedSiblingIds([]);
      return;
    }

    // Has siblings - show batch prompt
    setPendingBatchNotification(notification);
    setBatchShopName(result.data.shopName);
    setBatchCurrentRo(result.data.currentRo);
    setBatchSiblings(result.data.siblings);
    setBatchPromptOpen(true);
  };

  // User confirmed batch - generate merged email and open preview
  const handleConfirmBatch = (selectedSiblingIds: number[]) => {
    if (!pendingBatchNotification) return;

    const currentPayload = pendingBatchNotification.payload as EmailDraftPayload;

    // Build RO details array for the batch email
    const roDetails = [
      batchCurrentRo,
      ...batchSiblings.filter((s) => selectedSiblingIds.includes(s.notificationId)),
    ];

    // Generate merged email content
    const { subject, body } = generateBatchEmailContent(batchShopName, roDetails);

    // Create a modified notification with merged payload
    const mergedNotification: NotificationQueueItem = {
      ...pendingBatchNotification,
      payload: {
        ...currentPayload,
        subject,
        body,
      },
    };

    // Track which siblings are included
    setBatchedSiblingIds(selectedSiblingIds);

    // Open preview with merged content
    setPreviewNotification(mergedNotification);
    setBatchPromptOpen(false);
    setPendingBatchNotification(null);
  };

  // User skipped batch - open normal preview
  const handleSkipBatch = () => {
    if (!pendingBatchNotification) return;

    setPreviewNotification(pendingBatchNotification);
    setBatchedSiblingIds([]);
    setBatchPromptOpen(false);
    setPendingBatchNotification(null);
  };

  // Handle batch approve - use special batch action
  const handleBatchApprove = async (id: number, siblingIds: number[], payload: EmailDraftPayload) => {
    setActioningId(id);
    toast.info(`Sending batch email (${siblingIds.length + 1} ROs)...`);

    const result = await approveBatchNotifications(id, siblingIds, payload);
    if (result.success) {
      // Track the run for toast notifications
      setEmailRunId(result.data.runId);
      setEmailAccessToken(result.data.publicAccessToken);

      // Remove all batched notifications from the list
      const allIds = [id, ...siblingIds];
      setNotifications((prev) => prev.filter((n) => !allIds.includes(n.id)));
      setPreviewNotification(null);
      setBatchedSiblingIds([]);
    } else {
      toast.error(result.error || "Failed to send batch email");
    }
    setActioningId(null);
  };

  const count = notifications.length;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-header-foreground hover:bg-header-hover">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-danger text-danger-foreground p-0 text-xs flex items-center justify-center">
              {count}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Notifications
          </SheetTitle>
        </SheetHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending" className="gap-1">
              Pending
              {count > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1">
                  {count}
                </Badge>
              )}
              {isPending && <TurbineSpinner size="sm" />}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              History
              {isHistoryPending && <TurbineSpinner size="sm" />}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
            {notifications.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No pending notifications
              </p>
            ) : (
              notifications.map((notification) => {
                const payload = notification.payload as EmailDraftPayload;
                const isActioning = actioningId === notification.id;

                return (
                  <div
                    key={notification.id}
                    className="rounded-lg border p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-mono">
                          RO #{notification.repairOrderId}
                        </p>
                        <p className="font-medium line-clamp-2">
                          {payload.subject}
                        </p>
                        {notification.shopName && (
                          <p className="text-sm text-muted-foreground font-medium">
                            {notification.shopName}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          To: {payload.to || payload.toAddress}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {notification.type === "EMAIL_DRAFT" ? "Email Draft" : notification.type}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="px-2"
                        onClick={() => handlePreviewClick(notification)}
                        disabled={isBatchLoading}
                      >
                        {isBatchLoading ? (
                          <TurbineSpinner size="sm" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-success text-success-foreground hover:bg-success/90"
                        onClick={() => handleApprove(notification.id)}
                        disabled={isActioning}
                      >
                        {isActioning ? (
                          <TurbineSpinner size="sm" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Approve & Send
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-danger border-danger hover:bg-danger/10"
                        onClick={() => handleReject(notification.id)}
                        disabled={isActioning}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
            {historyNotifications.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No notification history
              </p>
            ) : (
              <>
                {/* Email Threads Section - Group sent emails by RO */}
                {(() => {
                  const sentEmails = historyNotifications.filter(
                    (n) => n.type === "EMAIL_DRAFT" && n.status === "SENT"
                  );
                  const uniqueROs = [...new Set(sentEmails.map((n) => n.repairOrderId))];

                  if (uniqueROs.length === 0) return null;

                  return (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground px-1">
                        Email Threads
                      </h3>
                      <div className="space-y-2">
                        {uniqueROs.map((roId) => (
                          <EmailThreadView
                            key={roId}
                            repairOrderId={roId}
                            roNumber={roId}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Other Activity Section - Non-sent notifications */}
                {(() => {
                  const otherNotifications = historyNotifications.filter(
                    (n) => !(n.type === "EMAIL_DRAFT" && n.status === "SENT")
                  );

                  if (otherNotifications.length === 0) return null;

                  return (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground px-1">
                        Other Activity
                      </h3>
                      <div className="space-y-2">
                        {otherNotifications.map((notification) => {
                          const payload = notification.payload as EmailDraftPayload;
                          const status = notification.status as NotificationStatus;
                          const config = statusConfig[status];
                          const StatusIcon = config.icon;
                          const isActioning = actioningId === notification.id;

                          return (
                            <div
                              key={notification.id}
                              className="rounded-lg border p-3 space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1 flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs text-muted-foreground font-mono">
                                      RO #{notification.repairOrderId}
                                    </p>
                                    <Badge className={`${config.className} text-xs px-1.5 py-0 h-5`}>
                                      <StatusIcon className="h-3 w-3 mr-1" />
                                      {config.label}
                                    </Badge>
                                  </div>
                                  <p className="font-medium text-sm line-clamp-1">
                                    {payload.subject}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    To: {payload.to || payload.toAddress}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDate(notification.createdAt)}
                                  </p>
                                </div>
                                {(status === "REJECTED" || status === "FAILED") && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRequeue(notification.id)}
                                    disabled={isActioning}
                                    className="shrink-0"
                                  >
                                    {isActioning ? (
                                      <TurbineSpinner size="sm" />
                                    ) : (
                                      <>
                                        <RotateCcw className="h-3 w-3 mr-1" />
                                        Requeue
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            {/* Reset batch prompt preference */}
            {batchPromptDisabled && (
              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={handleResetBatchPrompt}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                >
                  Re-enable batch email prompts
                </button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <EmailPreviewDialog
          notification={previewNotification}
          open={!!previewNotification}
          onOpenChange={(open) => {
            if (!open) {
              setPreviewNotification(null);
              setBatchedSiblingIds([]);
            }
          }}
          onApprove={(id) => {
            if (batchedSiblingIds.length > 0 && previewNotification) {
              // Batch approval
              const payload = previewNotification.payload as EmailDraftPayload;
              handleBatchApprove(id, batchedSiblingIds, payload);
            } else {
              // Single approval
              handleApprove(id);
            }
          }}
          onReject={handleReject}
          isActioning={!!actioningId}
          onUpdate={fetchNotifications}
          isBatch={batchedSiblingIds.length > 0}
          batchCount={batchedSiblingIds.length + 1}
        />

        {/* Batch prompt dialog */}
        <BatchPromptDialog
          open={batchPromptOpen}
          onOpenChange={setBatchPromptOpen}
          shopName={batchShopName}
          currentRo={batchCurrentRo}
          siblings={batchSiblings}
          onConfirmBatch={handleConfirmBatch}
          onSkipBatch={handleSkipBatch}
          isLoading={isBatchLoading}
        />
      </SheetContent>
    </Sheet>
  );
}
