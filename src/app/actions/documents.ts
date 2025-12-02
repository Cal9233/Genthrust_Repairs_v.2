"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { roActivityLog } from "@/lib/schema";
import {
  uploadRODocumentBase64,
  listRODocuments,
  deleteRODocument,
  getDocumentDownloadUrl,
  type SharePointFile,
} from "@/lib/graph/files";
export type { SharePointFile };

type Result<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Upload a document to SharePoint for a specific RO
 * Creates folder /Repair Orders/RO-{roNumber}/ if it doesn't exist
 */
export async function uploadDocument(
  roNumber: string | number,
  repairOrderId: number,
  fileName: string,
  fileBase64: string
): Promise<Result<SharePointFile>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Validate file size (10MB limit)
    const sizeInBytes = Math.ceil((fileBase64.length * 3) / 4);
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (sizeInBytes > maxSize) {
      return {
        success: false,
        error: "File size exceeds 10MB limit",
      };
    }

    // Upload to SharePoint
    const result = await uploadRODocumentBase64(
      session.user.id,
      roNumber,
      fileName,
      fileBase64
    );

    if (!result.success || !result.file) {
      return {
        success: false,
        error: result.error ?? "Failed to upload document",
      };
    }

    // Log activity
    await db.insert(roActivityLog).values({
      repairOrderId,
      action: "DOCUMENT_UPLOADED",
      field: "documents",
      newValue: fileName,
      userId: session.user.id,
    });

    return { success: true, data: result.file };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload document",
    };
  }
}

/**
 * Get all documents for a specific RO
 */
export async function getDocuments(
  roNumber: string | number
): Promise<Result<SharePointFile[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const files = await listRODocuments(session.user.id, roNumber);

    return { success: true, data: files };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get documents",
    };
  }
}

/**
 * Delete a document from SharePoint
 */
export async function deleteDocument(
  fileId: string,
  fileName: string,
  repairOrderId: number
): Promise<Result<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const result = await deleteRODocument(session.user.id, fileId);

    if (!result.success) {
      return {
        success: false,
        error: result.error ?? "Failed to delete document",
      };
    }

    // Log activity
    await db.insert(roActivityLog).values({
      repairOrderId,
      action: "DOCUMENT_DELETED",
      field: "documents",
      oldValue: fileName,
      userId: session.user.id,
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete document",
    };
  }
}

/**
 * Get a temporary download URL for a document
 */
export async function getDownloadUrl(
  fileId: string
): Promise<Result<string>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const result = await getDocumentDownloadUrl(session.user.id, fileId);

    if (!result.success || !result.url) {
      return {
        success: false,
        error: result.error ?? "Failed to get download URL",
      };
    }

    return { success: true, data: result.url };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get download URL",
    };
  }
}
