"use client";

import { useState, useEffect, useTransition } from "react";
import { Bell, X, Check, Mail, Clock, CheckCircle, XCircle, Send, Eye } from "lucide-react";
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
} from "@/app/actions/notifications";
import { EmailThreadView } from "@/components/notifications/EmailThreadView";
import { EmailPreviewDialog } from "@/components/notifications/EmailPreviewDialog";
import type { NotificationQueueItem } from "@/lib/schema";
import type { EmailDraftPayload, NotificationStatus } from "@/lib/types/notification";

const statusConfig: Record<NotificationStatus, { label: string; className: string; icon: typeof Clock }> = {
  PENDING_APPROVAL: { label: "Pending", className: "bg-warning text-warning-foreground", icon: Clock },
  APPROVED: { label: "Approved", className: "bg-success text-success-foreground", icon: CheckCircle },
  REJECTED: { label: "Rejected", className: "bg-danger text-danger-foreground", icon: XCircle },
  SENT: { label: "Sent", className: "bg-sky-500 text-sky-50", icon: Send },
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
  const [notifications, setNotifications] = useState<NotificationQueueItem[]>([]);
  const [historyNotifications, setHistoryNotifications] = useState<NotificationQueueItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isHistoryPending, startHistoryTransition] = useTransition();
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [previewNotification, setPreviewNotification] = useState<NotificationQueueItem | null>(null);

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
    const result = await approveNotification(id);
    if (result.success) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setPreviewNotification(null); // Close preview dialog if open
    }
    setActioningId(null);
  };

  const handleReject = async (id: number) => {
    setActioningId(id);
    const result = await rejectNotification(id);
    if (result.success) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setPreviewNotification(null); // Close preview dialog if open
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
                        <p className="text-sm text-muted-foreground">
                          To: {payload.toAddress}
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
                        onClick={() => setPreviewNotification(notification)}
                      >
                        <Eye className="h-4 w-4" />
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
                                    {formatDate(notification.createdAt)}
                                  </p>
                                </div>
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
          </TabsContent>
        </Tabs>

        <EmailPreviewDialog
          notification={previewNotification}
          open={!!previewNotification}
          onOpenChange={(open) => !open && setPreviewNotification(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          isActioning={!!actioningId}
        />
      </SheetContent>
    </Sheet>
  );
}
