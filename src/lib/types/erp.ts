/**
 * ERP.aero API Type Definitions
 *
 * These types define the structure of responses from the ERP.aero API
 * used for fetching repair order data.
 */

// ============================================
// Authentication Types
// ============================================

export interface ERPAuthResponse {
  res: number;
  error?: string;
  msg?: string;
  data?: {
    token: string;
    token_expire: number; // unix timestamp
  };
}

// ============================================
// Generic API Response Wrapper
// ============================================

export interface ERPApiResponse<T> {
  res: number;
  data: T;
  msg?: string;
  error?: string;
}

// ============================================
// Shared Types
// ============================================

export interface ERPStatus {
  status: string;
}

export interface ERPAddress {
  company: string | null;
  city: string | null;
  state: string | null;
}

export interface ERPAddressBlock {
  ship: ERPAddress;
}

// ============================================
// List Endpoint Types (/repair_order/list)
// ============================================

export interface ERPRepairOrderBody {
  po_id: number;  // NOTE: number, not string
  po_no: string;  // e.g., "RO171"
  type: string;
  status: ERPStatus;
  modified_time: string;
  created_time: string;
}

export interface ERPRepairOrderListItem {
  body: ERPRepairOrderBody;
}

export interface ERPExternalListResponse {
  list: ERPRepairOrderListItem[];
}

// ============================================
// Details Endpoint Types (/repair_order/details)
// ============================================

export interface ERPRepairOrderDetailsBody extends ERPRepairOrderBody {
  vendor: { vendorname: string };
  ship_via: string | null;
  address?: ERPAddressBlock;
  total: string | number;
  term_sale?: string | null;
  modified_time?: string | null;
}

export interface ERPPartItem {
  id: number;
  product: { id?: number; name: string };
  quantity: { qty: number; received: number };
  status: string;
  unit_price: number;
  serial_number?: string | null;
  comment?: string | null;
  condition?: string | null;
  leadtime?: string | null;
  tags?: {
    sn?: string | null;
    trace?: string | null;
    certs?: string[];
    warranty?: string;
    is_hazmat?: boolean;
    shop?: string;
  };
  json_data?: {
    pn_sn?: string | null;
    v_repair_priceBCheck?: string;
    v_repair_priceMAX?: string;
    v_repair_deliveryBCheck?: string;
  };
}

export interface ERPExternalDetailsResponse {
  body: ERPRepairOrderDetailsBody;
  partsList: ERPPartItem[];
}

// ============================================
// Error Classes
// ============================================

export class ERPAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ERPAuthError";
  }
}

export class ERPApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ERPApiError";
  }
}
