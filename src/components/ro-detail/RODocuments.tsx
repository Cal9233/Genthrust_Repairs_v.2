"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { TurbineSpinner } from "@/components/ui/TurbineSpinner";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  File,
  FileImage,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import {
  uploadDocument,
  deleteDocument,
  getDownloadUrl,
  type SharePointFile,
} from "@/app/actions/documents";

interface RODocumentsProps {
  repairOrderId: number;
  roNumber: number | null;
  documents: SharePointFile[];
  onDocumentsChanged: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) {
    return FileImage;
  }
  if (["xls", "xlsx", "csv"].includes(ext || "")) {
    return FileSpreadsheet;
  }
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateString));
}

export function RODocuments({
  repairOrderId,
  roNumber,
  documents,
  onDocumentsChanged,
}: RODocumentsProps) {
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !roNumber) return;

      setError(null);
      setUploading(true);

      try {
        for (const file of Array.from(files)) {
          // Validate file size
          if (file.size > MAX_FILE_SIZE) {
            setError(`File "${file.name}" exceeds 10MB limit`);
            continue;
          }

          // Convert to base64
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              // Remove the data:*/*;base64, prefix
              const base64Data = result.split(",")[1];
              resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          const result = await uploadDocument(
            roNumber,
            repairOrderId,
            file.name,
            base64
          );

          if (!result.success) {
            setError(result.error);
          }
        }

        onDocumentsChanged();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [roNumber, repairOrderId, onDocumentsChanged]
  );

  const handleDownload = async (fileId: string, fileName: string) => {
    setDownloadingId(fileId);
    setError(null);

    try {
      const result = await getDownloadUrl(fileId);
      if (result.success) {
        window.open(result.data, "_blank");
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Delete "${fileName}"?`)) return;

    setDeletingId(fileId);
    setError(null);

    try {
      const result = await deleteDocument(fileId, fileName, repairOrderId);
      if (result.success) {
        onDocumentsChanged();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-danger/70 hover:text-danger"
          >
            ×
          </button>
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={(e) => handleUpload(e.target.files)}
          disabled={uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <TurbineSpinner size="md" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              Drag & drop files or click to upload
            </p>
            <p className="text-xs text-muted-foreground">
              Max file size: 10MB
            </p>
          </div>
        )}
      </div>

      {/* Documents List */}
      {documents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No documents uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            {documents.length} {documents.length === 1 ? "document" : "documents"}
          </h4>

          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {documents.map((doc) => {
              const Icon = getFileIcon(doc.name);
              const isDownloading = downloadingId === doc.id;
              const isDeleting = deletingId === doc.id;

              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 bg-background hover:bg-muted/50 transition-colors"
                >
                  <Icon className="h-8 w-8 text-muted-foreground shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.size)} • {formatDate(doc.lastModifiedDateTime)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(doc.id, doc.name)}
                      disabled={isDownloading}
                    >
                      {isDownloading ? (
                        <TurbineSpinner size="sm" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc.id, doc.name)}
                      disabled={isDeleting}
                      className="text-danger hover:text-danger"
                    >
                      {isDeleting ? (
                        <TurbineSpinner size="sm" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
