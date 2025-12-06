"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport, type UIMessage } from "ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageCircle, Send, Bot, User } from "lucide-react";
import { TurbineSpinner } from "@/components/ui/TurbineSpinner";

/**
 * Assistant Component
 *
 * Floating AI chat assistant for GenThrust.
 * Provides a chat bubble in the bottom-right corner that expands
 * into a dialog for interacting with the research agent.
 *
 * Uses Vercel AI SDK v5's useChat hook for streaming responses.
 * READ operations stream instantly; WRITE operations are queued to Trigger.dev.
 */
export function Assistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Create transport with memoization to avoid recreating on every render
  const transport = useMemo(
    () => new TextStreamChatTransport({ api: "/api/chat" }),
    []
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    // In AI SDK v5, sendMessage takes parts array for user messages
    await sendMessage({
      role: "user",
      parts: [{ type: "text", text: userMessage }],
    });
  };

  // Get text content from message parts
const getMessageText = (msg: UIMessage): string => {
  // Fallback to top-level content if parts are missing (common in simple text streams)
  // Use type assertion for backward compatibility with text stream responses
  const msgAny = msg as unknown as { content?: string };
  if (msgAny.content && (!msg.parts || msg.parts.length === 0)) {
    return msgAny.content;
  }

  // Otherwise parse parts (for tool calls/multi-modal)
  if (!msg.parts || msg.parts.length === 0) {
    return "";
  }
  return msg.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { type: "text"; text: string }).text)
    .join("");
};

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

            {messages.map((msg: UIMessage) => (
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
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{getMessageText(msg)}</p>
                </div>
                {msg.role === "user" && (
                  <div className="shrink-0 mt-1">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="shrink-0 mt-1">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="rounded-lg px-3 py-2 bg-muted">
                  <div className="flex items-center gap-2 text-sm">
                    <TurbineSpinner size="sm" />
                    <span>Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="flex gap-2 justify-start">
                <div className="shrink-0 mt-1">
                  <Bot className="h-5 w-5 text-danger-red" />
                </div>
                <div className="rounded-lg px-3 py-2 bg-danger-red/10 text-danger-red">
                  <p className="text-sm">Error: {error.message}</p>
                </div>
              </div>
            )}

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
              disabled={isLoading}
              className="flex-1"
              autoComplete="off"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
            >
              {isLoading ? (
                <TurbineSpinner size="sm" />
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
