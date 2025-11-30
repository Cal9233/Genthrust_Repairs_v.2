/**
 * Microsoft Graph API Types for Excel Operations
 */

// OAuth Token Response from Microsoft Identity endpoint
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

// Excel Session Response
export interface ExcelSession {
  id: string;
  persistChanges: boolean;
}

// Excel Range for reading/writing cells
export interface ExcelRange {
  address: string;
  values: (string | number | boolean | null)[][];
  text?: string[][];
  formulas?: string[][];
  rowCount?: number;
  columnCount?: number;
}

// Graph API Batch Request Item
export interface BatchRequestItem {
  id: string;
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

// Graph API Batch Response Item
export interface BatchResponseItem {
  id: string;
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
}

// Graph API Batch Response
export interface BatchResponse {
  responses: BatchResponseItem[];
}

// Repair Order Row for Excel (matches active table structure)
export interface RepairOrderExcelRow {
  ro: number | null;
  dateMade: string | null;
  shopName: string | null;
  part: string | null;
  serial: string | null;
  partDescription: string | null;
  reqWork: string | null;
  dateDroppedOff: string | null;
  estimatedCost: number | null;
  finalCost: number | null;
  terms: string | null;
  shopRef: string | null;
  estimatedDeliveryDate: string | null;
  curentStatus: string | null;
  curentStatusDate: string | null;
  genthrustStatus: string | null;
  shopStatus: string | null;
  trackingNumberPickingUp: string | null;
  notes: string | null;
  lastDateUpdated: string | null;
  nextDateToUpdate: string | null;
}

// User not connected error
export class UserNotConnectedError extends Error {
  constructor(userId: string) {
    super(`User ${userId} has no Microsoft account connected`);
    this.name = "UserNotConnectedError";
  }
}

// Token refresh error
export class TokenRefreshError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenRefreshError";
  }
}
