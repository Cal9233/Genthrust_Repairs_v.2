"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, X, AlertCircle, Plus, Trash2 } from "lucide-react";
import type { EmailDraftPayload } from "@/lib/types/notification";
import {
  parseTableToRODetails,
  generateTableHtml,
  type RODetail,
} from "@/lib/batch-email-template";

interface EditableEmailPreviewProps {
  payload: EmailDraftPayload;
  onSave: (updates: { to: string; cc: string; subject: string; body: string }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

/**
 * Check if body contains an HTML table
 */
function containsTable(html: string): boolean {
  return /<table[\s>]/i.test(html);
}

/**
 * Parse body into parts: before table, table itself, after table
 */
function parseBodyWithTable(html: string): {
  intro: string;
  table: string;
  outro: string;
} | null {
  const tableMatch = html.match(/(<table[\s\S]*?<\/table>)/i);
  if (!tableMatch) return null;

  const tableIndex = html.indexOf(tableMatch[0]);
  const intro = html.substring(0, tableIndex);
  const table = tableMatch[0];
  const outro = html.substring(tableIndex + table.length);

  return { intro, table, outro };
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

/**
 * Convert plain text back to HTML paragraphs
 */
function textToHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => `<p>${line || "&nbsp;"}</p>`)
    .join("");
}

/**
 * Editable table row component
 */
function EditableTableRow({
  row,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  row: RODetail;
  index: number;
  onChange: (index: number, field: keyof RODetail, value: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}) {
  return (
    <tr className="group">
      <td className="p-1">
        <Input
          type="text"
          value={row.roNumber?.toString() ?? ""}
          onChange={(e) => onChange(index, "roNumber", e.target.value)}
          placeholder="RO #"
          className="h-8 text-xs font-mono text-center w-20"
        />
      </td>
      <td className="p-1">
        <Input
          type="text"
          value={row.partNumber ?? ""}
          onChange={(e) => onChange(index, "partNumber", e.target.value)}
          placeholder="Part Number"
          className="h-8 text-xs font-mono"
        />
      </td>
      <td className="p-1">
        <Input
          type="text"
          value={row.serialNumber ?? ""}
          onChange={(e) => onChange(index, "serialNumber", e.target.value)}
          placeholder="Serial Number"
          className="h-8 text-xs font-mono"
        />
      </td>
      <td className="p-1 w-10">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

export function EditableEmailPreview({
  payload,
  onSave,
  onCancel,
  isSaving,
}: EditableEmailPreviewProps) {
  // Detect if email contains a table (batch email)
  const hasTable = useMemo(() => containsTable(payload.body), [payload.body]);
  const tableParts = useMemo(
    () => (hasTable ? parseBodyWithTable(payload.body) : null),
    [hasTable, payload.body]
  );

  // Parse table rows for editing
  const initialRows = useMemo(() => {
    if (tableParts?.table) {
      return parseTableToRODetails(tableParts.table);
    }
    return [];
  }, [tableParts]);

  const [to, setTo] = useState(payload.to || payload.toAddress || "");
  const [cc, setCc] = useState(payload.cc || "");
  const [subject, setSubject] = useState(payload.subject);

  // For table-containing emails: separate intro/outro + editable rows
  const [intro, setIntro] = useState(
    tableParts ? stripHtmlToPlainText(tableParts.intro) : ""
  );
  const [outro, setOutro] = useState(
    tableParts ? stripHtmlToPlainText(tableParts.outro) : ""
  );
  const [tableRows, setTableRows] = useState<RODetail[]>(initialRows);

  // For simple emails: single body
  const [body, setBody] = useState(
    !hasTable ? stripHtmlToPlainText(payload.body) : ""
  );

  const [hasChanges, setHasChanges] = useState(false);

  // Handle table row changes
  const handleRowChange = (index: number, field: keyof RODetail, value: string) => {
    setTableRows((prev) => {
      const updated = [...prev];
      if (field === "roNumber") {
        updated[index] = {
          ...updated[index],
          roNumber: value === "" ? null : parseInt(value, 10) || null,
        };
      } else {
        updated[index] = {
          ...updated[index],
          [field]: value === "" ? null : value,
        };
      }
      return updated;
    });
  };

  // Add new row
  const handleAddRow = () => {
    setTableRows((prev) => [
      ...prev,
      { roNumber: null, partNumber: null, serialNumber: null },
    ]);
  };

  // Remove row
  const handleRemoveRow = (index: number) => {
    setTableRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Track if any field has changed from original
  useEffect(() => {
    const originalTo = payload.to || payload.toAddress || "";
    const originalCc = payload.cc || "";
    const originalSubject = payload.subject;

    let changed =
      to !== originalTo || cc !== originalCc || subject !== originalSubject;

    if (tableParts) {
      const originalIntro = stripHtmlToPlainText(tableParts.intro);
      const originalOutro = stripHtmlToPlainText(tableParts.outro);
      changed = changed || intro !== originalIntro || outro !== originalOutro;

      // Check if table rows changed
      const rowsMatch =
        tableRows.length === initialRows.length &&
        tableRows.every(
          (row, i) =>
            row.roNumber === initialRows[i].roNumber &&
            row.partNumber === initialRows[i].partNumber &&
            row.serialNumber === initialRows[i].serialNumber
        );
      changed = changed || !rowsMatch;
    } else {
      const originalBody = stripHtmlToPlainText(payload.body);
      changed = changed || body !== originalBody;
    }

    setHasChanges(changed);
  }, [to, cc, subject, body, intro, outro, tableRows, payload, tableParts, initialRows]);

  const handleSave = async () => {
    let htmlBody: string;

    if (tableParts) {
      // Reconstruct with editable table
      const htmlIntro = textToHtml(intro);
      const htmlOutro = textToHtml(outro);
      const newTableHtml = generateTableHtml(tableRows);
      htmlBody = htmlIntro + newTableHtml + htmlOutro;
    } else {
      // Simple email - just paragraphs
      htmlBody = textToHtml(body);
    }

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

        {/* Body section - different UI for table vs simple emails */}
        {hasTable && tableParts ? (
          <>
            {/* Intro section - editable */}
            <div className="space-y-1.5">
              <Label htmlFor="email-intro" className="text-sm font-medium">
                Opening Text:
              </Label>
              <Textarea
                id="email-intro"
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                placeholder="Hello,..."
                rows={3}
                className="font-mono text-sm resize-none"
              />
            </div>

            {/* Table section - editable */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center justify-between">
                <span>RO Table:</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddRow}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Row
                </Button>
              </Label>
              <div className="bg-muted/30 rounded-lg p-3 border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-1 text-left text-xs font-medium text-muted-foreground w-24">
                        RO #
                      </th>
                      <th className="p-1 text-left text-xs font-medium text-muted-foreground">
                        Part Number
                      </th>
                      <th className="p-1 text-left text-xs font-medium text-muted-foreground">
                        Serial Number
                      </th>
                      <th className="p-1 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, index) => (
                      <EditableTableRow
                        key={index}
                        row={row}
                        index={index}
                        onChange={handleRowChange}
                        onRemove={handleRemoveRow}
                        canRemove={tableRows.length > 1}
                      />
                    ))}
                  </tbody>
                </table>
                {tableRows.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No rows. Click &quot;Add Row&quot; to add an RO.
                  </div>
                )}
              </div>
            </div>

            {/* Outro section - editable */}
            <div className="space-y-1.5">
              <Label htmlFor="email-outro" className="text-sm font-medium">
                Closing Text:
              </Label>
              <Textarea
                id="email-outro"
                value={outro}
                onChange={(e) => setOutro(e.target.value)}
                placeholder="Thank you,..."
                rows={3}
                className="font-mono text-sm resize-none"
              />
            </div>
          </>
        ) : (
          /* Simple email - single body textarea */
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
        )}
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
