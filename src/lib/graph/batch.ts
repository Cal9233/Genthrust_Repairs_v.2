import { Client } from "@microsoft/microsoft-graph-client";
import type {
  BatchRequestItem,
  BatchResponse,
  BatchResponseItem,
} from "../types/graph";
import { getColumnLetter, EXCEL_COLUMNS } from "./excel-mapping";
import { getWorksheetPath } from "../graph";

/**
 * Execute a batch request to the Graph API
 *
 * Per CLAUDE.md Section 3C: Always chunk Graph API writes into groups of 20
 * (JSON Batching limit).
 *
 * @param client - Graph client
 * @param requests - Array of batch request items (max 20)
 * @param sessionId - Workbook session ID for Excel operations
 * @returns Batch response with individual request results
 */
export async function executeBatch(
  client: Client,
  requests: BatchRequestItem[],
  sessionId: string
): Promise<BatchResponse> {
  if (requests.length > 20) {
    throw new Error("Batch request exceeds 20 item limit");
  }

  if (requests.length === 0) {
    return { responses: [] };
  }

  const response = await client
    .api("/$batch")
    .header("workbook-session-id", sessionId)
    .post({ requests });

  return response as BatchResponse;
}

/**
 * Check if a batch response item indicates a rate limit error
 */
export function isRateLimitError(item: BatchResponseItem): boolean {
  return item.status === 429;
}

/**
 * Check if a batch response item indicates success
 */
export function isSuccessful(item: BatchResponseItem): boolean {
  return item.status >= 200 && item.status < 300;
}

/**
 * Check if any batch response indicates a rate limit
 */
export function hasRateLimitError(response: BatchResponse): boolean {
  return response.responses.some(isRateLimitError);
}

/**
 * Get all failed responses from a batch
 */
export function getFailedResponses(
  response: BatchResponse
): BatchResponseItem[] {
  return response.responses.filter((item) => !isSuccessful(item));
}

/**
 * Build a PATCH request to update a single Excel row
 *
 * @param id - Unique request ID within the batch
 * @param workbookId - Workbook item ID
 * @param worksheetName - Worksheet name
 * @param rowNumber - 1-based row number to update
 * @param values - Row values array
 * @returns BatchRequestItem for updating the row
 */
export function buildUpdateRowRequest(
  id: string,
  workbookId: string,
  worksheetName: string,
  rowNumber: number,
  values: (string | number | null)[]
): BatchRequestItem {
  const lastCol = getColumnLetter(EXCEL_COLUMNS.length - 1);
  const worksheetPath = getWorksheetPath(workbookId, worksheetName);
  return {
    id,
    method: "PATCH",
    url: `${worksheetPath}/range(address='A${rowNumber}:${lastCol}${rowNumber}')`,
    headers: { "Content-Type": "application/json" },
    body: { values: [values] },
  };
}

/**
 * Build multiple update row requests for a batch
 *
 * @param workbookId - Workbook item ID
 * @param worksheetName - Worksheet name
 * @param updates - Array of { rowNumber, values } to update
 * @returns Array of BatchRequestItems
 */
export function buildBatchUpdateRequests(
  workbookId: string,
  worksheetName: string,
  updates: Array<{ rowNumber: number; values: (string | number | null)[] }>
): BatchRequestItem[] {
  return updates.map((update, index) =>
    buildUpdateRowRequest(
      `update-${index}`,
      workbookId,
      worksheetName,
      update.rowNumber,
      update.values
    )
  );
}

/**
 * Analyze batch response results
 */
export function analyzeBatchResponse(response: BatchResponse): {
  successful: number;
  failed: number;
  rateLimited: boolean;
  errors: string[];
} {
  let successful = 0;
  let failed = 0;
  let rateLimited = false;
  const errors: string[] = [];

  for (const item of response.responses) {
    if (isSuccessful(item)) {
      successful++;
    } else {
      failed++;
      if (isRateLimitError(item)) {
        rateLimited = true;
      }
      errors.push(
        `Request ${item.id} failed with status ${item.status}: ${JSON.stringify(item.body)}`
      );
    }
  }

  return { successful, failed, rateLimited, errors };
}
