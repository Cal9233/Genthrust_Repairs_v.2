"use client";

import { useState, useTransition, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Mail,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Send,
  Inbox,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getFullThreadHistory } from "@/app/actions/notifications";
import type { ThreadMessage } from "@/lib/types/notification";

interface EmailThreadViewProps {
  repairOrderId: number;
  roNumber: string | number;
}

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function EmailThreadView({
  repairOrderId,
  roNumber,
}: EmailThreadViewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [graphError, setGraphError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  // Eager load thread data so badges are visible immediately
  useEffect(() => {
    fetchThread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchThread = () => {
    startTransition(async () => {
      const result = await getFullThreadHistory(repairOrderId);
      if (result.success) {
        setMessages(result.data.messages);
        setGraphError(result.data.graphError ?? false);
        setLoaded(true);
      }
    });
  };

  const handleToggle = () => {
    const newOpen = !isOpen;
    setIsOpen(newOpen);

    // Fetch on first open
    if (newOpen && !loaded) {
      fetchThread();
    }
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    fetchThread();
  };

  const inboundCount = messages.filter((m) => m.direction === "inbound").length;
  const outboundCount = messages.filter((m) => m.direction === "outbound").length;

  return (
    <div className="rounded-md border">
      {/* Header */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          className="flex-1 justify-start gap-2 text-left h-auto py-2 px-3"
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate flex-1">RO# G{roNumber}</span>
          {loaded && messages.length > 0 && (
            <div className="flex items-center gap-1 ml-auto">
              {inboundCount > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 gap-0.5"
                >
                  <Inbox className="h-2.5 w-2.5" />
                  {inboundCount}
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
                <Send className="h-2.5 w-2.5" />
                {outboundCount}
              </Badge>
            </div>
          )}
        </Button>
        {loaded && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 mr-1"
            onClick={handleRefresh}
            disabled={isPending}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isPending && "animate-spin")}
            />
          </Button>
        )}
      </div>

      {/* Thread Content */}
      {isOpen && (
        <div className="px-3 pb-3 space-y-2">
          {/* Graph Error Warning */}
          {graphError && (
            <div className="flex items-center gap-2 text-xs text-warning-amber bg-warning-amber/10 px-2 py-1.5 rounded">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                Could not fetch replies from Outlook. Showing sent emails only.
              </span>
            </div>
          )}

          {isPending && !loaded ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Loading conversation...
            </p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No emails in this thread yet
            </p>
          ) : (
            <div className="flex flex-col gap-2 pt-2">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Individual message bubble component
 * Inbound: Left-aligned, muted background
 * Outbound: Right-aligned, primary tint background
 */
function MessageBubble({ message }: { message: ThreadMessage }) {
  const isInbound = message.direction === "inbound";

  return (
    <div
      className={cn(
        "flex",
        isInbound ? "justify-start" : "justify-end"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-lg p-3 space-y-1",
          isInbound
            ? "bg-muted/50 border border-muted"
            : "bg-primary/5 border border-primary/20"
        )}
      >
        {/* Header: Sender + Date + Link */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{message.sender.name}</span>
          <span className="text-xs text-muted-foreground">
            {formatDate(message.sentDateTime)}
          </span>
          {message.isDraft && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              Draft
            </Badge>
          )}
          {message.dbStatus && message.dbStatus !== "SENT" && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1 py-0",
                message.dbStatus === "PENDING_APPROVAL" && "text-warning-amber border-warning-amber",
                message.dbStatus === "APPROVED" && "text-success-green border-success-green",
                message.dbStatus === "REJECTED" && "text-danger-red border-danger-red"
              )}
            >
              {message.dbStatus === "PENDING_APPROVAL"
                ? "Pending"
                : message.dbStatus}
            </Badge>
          )}
          {message.webLink && (
            <a
              href={message.webLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Subject */}
        <p className="text-sm font-medium line-clamp-1">{message.subject}</p>

        {/* Body Preview */}
        <p className="text-xs text-muted-foreground line-clamp-2">
          {message.bodyPreview}
        </p>

        {/* Direction Indicator */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1">
          {isInbound ? (
            <>
              <Inbox className="h-2.5 w-2.5" />
              <span>from {message.sender.email}</span>
            </>
          ) : (
            <>
              <Send className="h-2.5 w-2.5" />
              <span>sent</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
