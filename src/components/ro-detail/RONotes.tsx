"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TurbineSpinner } from "@/components/ui/TurbineSpinner";
import { MessageSquare, Plus, Send } from "lucide-react";
import { appendRONote } from "@/app/actions/repair-orders";

interface RONotesProps {
  repairOrderId: number;
  notes: string | null | undefined;
  onNoteAdded: () => void;
}

export function RONotes({ repairOrderId, notes, onNoteAdded }: RONotesProps) {
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const result = await appendRONote(repairOrderId, newNote.trim());
      if (result.success) {
        setNewNote("");
        setShowEditor(false);
        onNoteAdded();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setSaving(false);
    }
  };

  // Parse existing notes (each entry is timestamped)
  const noteEntries = notes
    ? notes
        .split(/(?=\[\d{4}-\d{2}-\d{2})/)
        .filter((n) => n.trim())
        .reverse()
    : [];

  return (
    <div className="bg-muted/30 rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Notes
        </h3>

        {!showEditor && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEditor(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Note
          </Button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-2 bg-danger/10 border border-danger/30 rounded text-danger text-sm">
          {error}
        </div>
      )}

      {/* New Note Editor */}
      {showEditor && (
        <div className="mb-4 space-y-2">
          <Textarea
            value={newNote}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewNote(e.target.value)}
            placeholder="Enter your note..."
            className="min-h-[100px] bg-background"
            disabled={saving}
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowEditor(false);
                setNewNote("");
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={saving || !newNote.trim()}
            >
              {saving ? (
                <TurbineSpinner size="sm" className="mr-1" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Save Note
            </Button>
          </div>
        </div>
      )}

      {/* Notes Display */}
      {noteEntries.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No notes yet</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {noteEntries.map((note, index) => {
            // Try to parse timestamp from note format: [2024-01-15 10:30:00] User: Note content
            const timestampMatch = note.match(
              /^\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]\s*([^:]*)?:\s*/
            );
            const timestamp = timestampMatch?.[1];
            const user = timestampMatch?.[2]?.trim();
            const content = timestampMatch
              ? note.slice(timestampMatch[0].length)
              : note;

            return (
              <div
                key={index}
                className="p-3 bg-background/50 rounded-lg border border-border/50"
              >
                <p className="text-sm whitespace-pre-wrap">{content.trim().replace(/\*\*/g, "")}</p>
                {timestamp && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {user && <span className="font-medium">{user} • </span>}
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(timestamp))}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Raw Notes Fallback (if parsing fails) */}
      {notes && noteEntries.length === 0 && (
        <div className="p-3 bg-background/50 rounded-lg">
          <p className="text-sm whitespace-pre-wrap">{notes.replace(/\*\*/g, "")}</p>
        </div>
      )}
    </div>
  );
}
