import { getGraphClient } from "../graph";

/**
 * SharePoint file metadata returned from Graph API
 */
export interface SharePointFile {
  id: string;
  name: string;
  size: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  webUrl: string;
  downloadUrl?: string;
}

/**
 * Result of a file upload operation
 */
export interface UploadResult {
  success: boolean;
  file?: SharePointFile;
  error?: string;
}

/**
 * Get the base path for SharePoint drive operations
 * Uses the same SHAREPOINT_SITE_ID as Excel operations
 */
function getDriveBasePath(): string {
  const siteId = process.env.SHAREPOINT_SITE_ID;
  if (!siteId) {
    throw new Error("SHAREPOINT_SITE_ID environment variable not configured");
  }
  return `/sites/${siteId}/drive`;
}

/**
 * Get the path to the Repair Orders folder
 * Assumes: Documents > Repair Orders already exists per user requirements
 */
function getRepairOrdersFolderPath(): string {
  return `${getDriveBasePath()}/root:/Repair Orders:`;
}

/**
 * Get the path to a specific RO's folder
 */
function getROFolderPath(roNumber: string | number): string {
  const sanitizedRO = String(roNumber).replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${getDriveBasePath()}/root:/Repair Orders/RO-${sanitizedRO}:`;
}

/**
 * Ensure the RO-specific folder exists
 * Creates /Repair Orders/RO-{roNumber}/ if it doesn't exist
 */
export async function ensureROFolder(
  userId: string,
  roNumber: string | number
): Promise<{ folderId: string; folderPath: string }> {
  const client = await getGraphClient(userId);
  const sanitizedRO = String(roNumber).replace(/[^a-zA-Z0-9-_]/g, "_");
  const folderName = `RO-${sanitizedRO}`;

  try {
    // Try to get the folder first
    const existingFolder = await client
      .api(`${getROFolderPath(roNumber)}`)
      .get();

    return {
      folderId: existingFolder.id,
      folderPath: existingFolder.webUrl,
    };
  } catch {
    // Folder doesn't exist, create it
    const repairOrdersPath = getRepairOrdersFolderPath();

    // Get the parent folder ID first
    let parentFolder;
    try {
      parentFolder = await client.api(repairOrdersPath).get();
    } catch (parentErr) {
      // Check if it's a 404 (parent folder doesn't exist)
      const errMsg = parentErr instanceof Error ? parentErr.message : "";
      if (errMsg.includes("itemNotFound") || errMsg.includes("404")) {
        throw new Error(
          "SharePoint folder 'Repair Orders' not found. Please create it in the document library first."
        );
      }
      throw parentErr;
    }

    // Create the RO folder
    const newFolder = await client
      .api(`${getDriveBasePath()}/items/${parentFolder.id}/children`)
      .post({
        name: folderName,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      });

    return {
      folderId: newFolder.id,
      folderPath: newFolder.webUrl,
    };
  }
}

/**
 * Upload a document to an RO's folder
 * For files < 4MB, uses simple upload
 * The file content should be an ArrayBuffer or Buffer
 */
export async function uploadRODocument(
  userId: string,
  roNumber: string | number,
  fileName: string,
  fileContent: ArrayBuffer | Buffer,
  _contentType?: string
): Promise<UploadResult> {
  try {
    // Ensure the RO folder exists
    const { folderId } = await ensureROFolder(userId, roNumber);

    const client = await getGraphClient(userId);

    // Sanitize filename
    const sanitizedFileName = fileName.replace(/[<>:"/\\|?*]/g, "_");

    // Upload the file (simple upload for files < 4MB)
    // For larger files, would need to use upload session
    const uploadPath = `${getDriveBasePath()}/items/${folderId}:/${sanitizedFileName}:/content`;

    const response = await client
      .api(uploadPath)
      .putStream(fileContent);

    return {
      success: true,
      file: {
        id: response.id,
        name: response.name,
        size: response.size,
        createdDateTime: response.createdDateTime,
        lastModifiedDateTime: response.lastModifiedDateTime,
        webUrl: response.webUrl,
        downloadUrl: response["@microsoft.graph.downloadUrl"],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload document",
    };
  }
}

/**
 * Upload a document from base64 string (for server actions)
 */
export async function uploadRODocumentBase64(
  userId: string,
  roNumber: string | number,
  fileName: string,
  base64Content: string,
  contentType?: string
): Promise<UploadResult> {
  // Remove data URL prefix if present
  const base64Data = base64Content.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  return uploadRODocument(userId, roNumber, fileName, buffer, contentType);
}

/**
 * List all documents in an RO's folder
 */
export async function listRODocuments(
  userId: string,
  roNumber: string | number
): Promise<SharePointFile[]> {
  try {
    const client = await getGraphClient(userId);

    // Get folder contents
    const folderPath = getROFolderPath(roNumber);
    const response = await client.api(`${folderPath}/children`).get();

    // Filter to only files (not subfolders)
    const files = (response.value || [])
      .filter((item: { file?: object }) => item.file)
      .map(
        (item: {
          id: string;
          name: string;
          size: number;
          createdDateTime: string;
          lastModifiedDateTime: string;
          webUrl: string;
          "@microsoft.graph.downloadUrl"?: string;
        }) => ({
          id: item.id,
          name: item.name,
          size: item.size,
          createdDateTime: item.createdDateTime,
          lastModifiedDateTime: item.lastModifiedDateTime,
          webUrl: item.webUrl,
          downloadUrl: item["@microsoft.graph.downloadUrl"],
        })
      );

    return files;
  } catch {
    // Folder might not exist yet - return empty array
    return [];
  }
}

/**
 * Delete a document by its ID
 */
export async function deleteRODocument(
  userId: string,
  fileId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getGraphClient(userId);

    await client.api(`${getDriveBasePath()}/items/${fileId}`).delete();

    return { success: true };
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
export async function getDocumentDownloadUrl(
  userId: string,
  fileId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const client = await getGraphClient(userId);

    const response = await client
      .api(`${getDriveBasePath()}/items/${fileId}`)
      .select("@microsoft.graph.downloadUrl")
      .get();

    return {
      success: true,
      url: response["@microsoft.graph.downloadUrl"],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get download URL",
    };
  }
}

/**
 * Get file metadata by ID
 */
export async function getDocumentMetadata(
  userId: string,
  fileId: string
): Promise<SharePointFile | null> {
  try {
    const client = await getGraphClient(userId);

    const response = await client
      .api(`${getDriveBasePath()}/items/${fileId}`)
      .get();

    return {
      id: response.id,
      name: response.name,
      size: response.size,
      createdDateTime: response.createdDateTime,
      lastModifiedDateTime: response.lastModifiedDateTime,
      webUrl: response.webUrl,
      downloadUrl: response["@microsoft.graph.downloadUrl"],
    };
  } catch {
    return null;
  }
}
