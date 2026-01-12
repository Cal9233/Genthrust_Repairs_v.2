/**
 * ERP.aero API Client
 *
 * HTTP client with JWT authentication and automatic token refresh.
 * Handles authentication via POST /auth/signin with form-urlencoded body.
 * Uses module-level singleton pattern for token caching.
 */

import {
  ERPAuthResponse,
  ERPExternalListResponse,
  ERPExternalDetailsResponse,
  ERPAuthError,
  ERPApiError
} from "@/lib/types/erp";
import {
  erpRepairOrderListSchema,
  erpRepairOrderDetailsSchema
} from "@/lib/validation/external-api";
import type { z } from "zod";

// ============================================
// Configuration
// ============================================

// Note: We use getters to read env vars at call time (not module load time)
// This allows scripts to load dotenv before calling these functions
function getConfig() {
  const cid = process.env.ERP_CID || process.env.ERP_COMPANY_ID || "";
  const email = process.env.ERP_EMAIL || "";
  const password = process.env.ERP_PASSWORD || "";
  
  if (!cid) {
    throw new ERPAuthError(
      "ERP_CID environment variable is required. " +
      "Set ERP_CID=GENTHRUST for production or ERP_CID=GENTHRUST_TEST for sandbox."
    );
  }
  
  if (!email) {
    throw new ERPAuthError(
      "ERP_EMAIL environment variable is required."
    );
  }
  
  if (!password) {
    throw new ERPAuthError(
      "ERP_PASSWORD environment variable is required."
    );
  }
  
  return {
    baseUrl: process.env.ERP_API_BASE_URL || "https://wapi.erp.aero/v1",
    companyId: cid,
    email: email,
    password: password,
    source: process.env.ERP_SOURCE || "genthrust-ro-tracker",
  };
}

// ============================================
// Token Cache (Module-level Singleton)
// ============================================

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Get a valid authentication token.
 * Returns cached token if still valid, otherwise fetches a new one.
 */
async function getAuthToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if valid (with 60s buffer)
  if (cachedToken && tokenExpiry > now + 60) {
    return cachedToken;
  }

  // Get config at call time (allows scripts to load dotenv first)
  const config = getConfig();

  // Build form-urlencoded body
  const params = new URLSearchParams();
  params.append("cid", config.companyId);
  params.append("email", config.email);
  params.append("password", config.password);
  params.append("type", "user");
  params.append("source", config.source);

  const res = await fetch(`${config.baseUrl}/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store",
  });

  // Read response body as text first (so we can parse as JSON or show as text)
  const responseText = await res.text().catch(() => "No response body");
  
  // Try to parse as JSON (API may return JSON even on error)
  let data: ERPAuthResponse;
  try {
    data = JSON.parse(responseText);
  } catch (jsonError) {
    // If JSON parsing fails, show the raw response
    throw new ERPAuthError(
      `Auth request failed: ${res.status} ${res.statusText}. ` +
      `CID: ${config.companyId}, Email: ${config.email ? "***" : "MISSING"}. ` +
      `Check that ERP_CID, ERP_EMAIL, and ERP_PASSWORD are set correctly. ` +
      `Response: ${responseText}`
    );
  }

  // Check HTTP status code (some APIs return JSON errors with non-200 status)
  if (!res.ok) {
    const errorMsg = data.error || data.msg || `HTTP ${res.status} ${res.statusText}`;
    throw new ERPAuthError(
      `Auth request failed: ${errorMsg}. ` +
      `CID: ${config.companyId}, Email: ${config.email ? "***" : "MISSING"}. ` +
      `Check that ERP_CID is set correctly (GENTHRUST for production, GENTHRUST_TEST for sandbox). ` +
      `Also verify ERP_EMAIL and ERP_PASSWORD are correct.`
    );
  }

  // SUCCESS = res: 1 (not 0)
  if (data.res !== 1 || !data.data?.token) {
    const errorMsg = data.error || data.msg || "Unknown authentication error";
    throw new ERPAuthError(
      `ERP authentication failed: ${errorMsg}. ` +
      `CID used: ${config.companyId}. ` +
      `Verify ERP_CID, ERP_EMAIL, and ERP_PASSWORD are correct.`
    );
  }

  // Cache the token
  cachedToken = data.data.token;
  tokenExpiry = data.data.token_expire || now + 3600;

  return cachedToken;
}

/**
 * Clear the cached token (useful for testing or forced re-auth)
 */
export function clearTokenCache(): void {
  cachedToken = null;
  tokenExpiry = 0;
}

// ============================================
// Generic Fetch Helper
// ============================================

/**
 * Make an authenticated request to the ERP API.
 * Automatically validates response with Zod schema.
 * Retries once on 401 (token expired).
 */
async function fetchERP<T>(
  endpoint: string,
  schema: z.ZodSchema,
  params: Record<string, string> = {}
): Promise<T> {
  let token = await getAuthToken();
  const config = getConfig();

  // Build URL with query params
  const url = new URL(`${config.baseUrl}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.append(key, value);
  });

  const doFetch = async (authToken: string) => {
    return fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      cache: "no-store",
    });
  };

  let res = await doFetch(token);

  // Retry once on 401 (token may have expired)
  if (res.status === 401) {
    cachedToken = null;
    token = await getAuthToken();
    res = await doFetch(token);
  }

  if (!res.ok) {
    throw new ERPApiError(`API Error ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();

  // Validate response with Zod
  const validation = schema.safeParse(json);
  if (!validation.success) {
    console.error("ERP Validation Error:", JSON.stringify(validation.error.format(), null, 2));
    throw new ERPApiError("Response validation failed");
  }

  // Cast validated data to expected shape
  const validatedData = validation.data as { res: number; data: T; error?: string };

  // SUCCESS = res: 1
  if (validatedData.res !== 1) {
    throw new ERPApiError(validatedData.error || "API returned error status");
  }

  return validatedData.data;
}

// ============================================
// Public API Methods
// ============================================

/**
 * Fetch list of repair orders from ERP.
 *
 * @param limit - Maximum number of results (default 50)
 * @returns List of repair order summaries
 */
export async function fetchERPRepairOrderList(
  limit = 50,
  page = 1
): Promise<ERPExternalListResponse> {
  return fetchERP<ERPExternalListResponse>(
    "/repair_order/list",
    erpRepairOrderListSchema,
    {
      order: "modified_time",
      direction: "desc",
      page_size: limit.toString(),
      page: page.toString()
    }
  );
}

/**
 * Fetch detailed information for a specific repair order.
 *
 * @param poId - The PO ID (number) from the list endpoint
 * @returns Full repair order details including parts list
 */
export async function fetchERPRepairOrderDetails(
  poId: number
): Promise<ERPExternalDetailsResponse> {
  return fetchERP<ERPExternalDetailsResponse>(
    "/repair_order/details",
    erpRepairOrderDetailsSchema,
    { po_id: poId.toString() }
  );
}

// ============================================
// Utility Functions
// ============================================

/**
 * Parse RO number from ERP po_no string.
 * Handles formats like "RO171", "RO-171", "171"
 *
 * @param roString - The po_no string from ERP
 * @returns Numeric RO number or null if unparseable
 */
export function parseERPRoNumber(roString: string): number | null {
  const match = roString.match(/(\d+)/);
  return match ? parseInt(match[0], 10) : null;
}
