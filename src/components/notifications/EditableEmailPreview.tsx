"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X, AlertCircle } from "lucide-react";
import type { EmailDraftPayload } from "@/lib/types/notification";

interface EditableEmailPreviewProps {
  payload: EmailDraftPayload;
  onSave: (updates: { to: string; cc: string; subject: string; body: string }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

export function EditableEmailPreview({
  payload,
  onSave,
  onCancel,
  isSaving,
}: EditableEmailPreviewProps) {
  const [to, setTo] = useState(payload.to || payload.toAddress || "");
  const [cc, setCc] = useState(payload.cc || "");
  const [subject, setSubject] = useState(payload.subject);
  const [body, setBody] = useState(stripHtmlToPlainText(payload.body));
  const [hasChanges, setHasChanges] = useState(false);

  // Track if any field has changed from original
  useEffect(() => {
    const originalTo = payload.to || payload.toAddress || "";
    const originalCc = payload.cc || "";
    const originalSubject = payload.subject;
    const originalBody = stripHtmlToPlainText(payload.body);

    const changed =
      to !== originalTo ||
      cc !== originalCc ||
      subject !== originalSubject ||
      body !== originalBody;

    setHasChanges(changed);
  }, [to, cc, subject, body, payload]);

  const handleSave = async () => {
    // Convert plain text body back to HTML (preserve line breaks)
    const htmlBody = body
      .split("\n")
      .map((line) => `<p>${line || "&nbsp;"}</p>`)
      .join("");

    await onSave({ to, cc, subject, body: htmlBody });
  };

  return (
    <div className="space-y-4">
      {hasChanges && (
        <div className="flex items-center gap-2 text-amber-500 text-sm bg-amber-500/10 px-3 py-2 rounded-md">
          <AlertCircle className="h-4 w-4" />
          <span>You have unsaved changes</span>
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email-to" className="text-sm font-medium">
            To:
          </Label>
          <Input
            id="email-to"
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email-cc" className="text-sm font-medium">
            CC: <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="email-cc"
            type="text"
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="cc@example.com, another@example.com"
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email-subject" className="text-sm font-medium">
            Subject:
          </Label>
          <Input
            id="email-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            className="text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email-body" className="text-sm font-medium">
            Body:
          </Label>
          <Textarea
            id="email-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Email body..."
            rows={10}
            className="font-mono text-sm resize-none"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="flex-1"
        >
          <Save className="h-4 w-4 mr-1" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * Strips HTML tags and converts to plain text for editing
 */
function stripHtmlToPlainText(html: string): string {
  // Replace <br> and </p> with newlines
  let text = html.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<p>/gi, "");
  // Remove remaining HTML tags
  text = text.replace(/<[^>]*>/g, "");
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  // Trim extra whitespace
  return text.trim();
}
