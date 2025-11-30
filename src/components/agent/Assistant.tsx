"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageCircle, Send, Loader2, Bot, User } from "lucide-react";
import { askAgent } from "@/app/actions/agent";
import { useAgentRun, type AgentStatus } from "@/hooks/use-agent-run";

/**
 * Message type for the chat interface
 */
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "pending" | "complete" | "error";
}

/**
 * Map agent status to human-readable text
 */
function getStatusText(status: AgentStatus): string {
  switch (status) {
    case "thinking":
      return "Thinking...";
    case "searching_inventory":
      return "Searching inventory...";
    case "fetching_repair_order":
      return "Looking up repair order...";
    case "completed":
      return "Done";
    case "failed":
      return "Failed";
    default:
      return "Processing...";
  }
}

/**
 * Assistant Component
 *
 * Floating AI chat assistant for GenThrust.
 * Provides a chat bubble in the bottom-right corner that expands
 * into a dialog for interacting with the research agent.
 *
 * Per CLAUDE.md: Uses Trigger.dev realtime hooks for progress updates.
 * Session-only chat (no database persistence).
 */
export function Assistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to agent run updates
  const { status, output, isComplete, error } = useAgentRun(
    currentRunId,
    accessToken
  );

  // Update assistant message when run completes
  useEffect(() => {
    if (isComplete && output?.response) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.status === "pending"
            ? { ...msg, content: output.response, status: "complete" }
            : msg
        )
      );
      setCurrentRunId(null);
      setAccessToken(null);
    }
    if (error) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.status === "pending"
            ? { ...msg, content: `Error: ${error}`, status: "error" }
            : msg
        )
      );
      setCurrentRunId(null);
      setAccessToken(null);
    }
  }, [isComplete, output, error]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isPending || currentRunId) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      status: "pending",
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    const prompt = input.trim();
    setInput("");

    startTransition(async () => {
      const result = await askAgent(prompt);
      if (result.success) {
        setCurrentRunId(result.data.runId);
        setAccessToken(result.data.publicAccessToken);
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? { ...msg, content: result.error, status: "error" }
              : msg
          )
        );
      }
    });
  };

  const isProcessing = isPending || !!currentRunId;

  return (
    <>
      {/* Floating Chat Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
        aria-label="Open AI Assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {/* Chat Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="fixed bottom-24 right-6 top-auto left-auto translate-x-0 translate-y-0 w-[400px] h-[500px] flex flex-col p-0 gap-0 sm:max-w-[400px]"
          showCloseButton={true}
        >
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Bot className="h-5 w-5" />
              GenThrust Assistant
            </DialogTitle>
          </DialogHeader>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Ask me about inventory or repair orders</p>
                <p className="text-xs mt-2 opacity-70">
                  Try: &quot;Find parts with PN 12345&quot; or &quot;What&apos;s
                  the status of RO 67890?&quot;
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="shrink-0 mt-1">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div
                  className={`rounded-lg px-3 py-2 max-w-[85%] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : msg.status === "error"
                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                      : "bg-muted"
                  }`}
                >
                  {msg.status === "pending" ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{getStatusText(status)}</span>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="shrink-0 mt-1">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={handleSubmit}
            className="p-3 border-t flex gap-2 shrink-0 bg-background"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search inventory, lookup RO..."
              disabled={isProcessing}
              className="flex-1"
              autoComplete="off"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isProcessing}
              aria-label="Send message"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
