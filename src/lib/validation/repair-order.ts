// src/lib/validation/repair-order.ts
// Zod validation schemas for Repair Orders - Single Source of Truth
// Prevents "Ghost Data" by enforcing required fields at validation layer

import { z } from "zod";

// Valid RO statuses (matches curentStatus field values in DB)
export const roStatusEnum = z.enum([
  "WAITING QUOTE",
  "APPROVED",
  "IN WORK",
  "IN PROGRESS",
  "SHIPPED",
  "IN TRANSIT",
  "RECEIVED",
  "COMPLETE",
  "BER",
  "RAI",
  "CANCELLED",
  "SCRAP",
  "RETURN",
]);

export type ROStatus = z.infer<typeof roStatusEnum>;

// Base schema matching DB shape (for internal use / fetched data)
export const repairOrderSchema = z.object({
  id: z.number(),
  ro: z.number(),
  dateMade: z.string().nullable(),
  shopName: z.string().nullable(),
  part: z.string().nullable(),
  serial: z.string().nullable(),
  partDescription: z.string().nullable(),
  reqWork: z.string().nullable(),
  dateDroppedOff: z.string().nullable(),
  estimatedCost: z.number().nullable(),
  finalCost: z.number().nullable(),
  terms: z.string().nullable(),
  shopRef: z.string().nullable(),
  estimatedDeliveryDate: z.string().nullable(),
  curentStatus: z.string().nullable(),
  curentStatusDate: z.string().nullable(),
  genthrustStatus: z.string().nullable(),
  shopStatus: z.string().nullable(),
  trackingNumberPickingUp: z.string().nullable(),
  notes: z.string().nullable(),
  lastDateUpdated: z.string().nullable(),
  nextDateToUpdate: z.string().nullable(),
});

export type RepairOrder = z.infer<typeof repairOrderSchema>;

// Create schema - Form input validation with string→number coercion
// shopName and part are REQUIRED to prevent "Ghost Data"
export const createRepairOrderSchema = z.object({
  // REQUIRED fields - these prevent Ghost Data
  // Zod v4: use .min(1) with error message to enforce non-empty strings
  shopName: z.string().min(1, "Shop name is required"),
  part: z.string().min(1, "Part number is required"),

  // Optional fields
  serial: z.string().optional().nullable(),
  partDescription: z.string().optional().nullable(),
  reqWork: z.string().optional().nullable(),
  dateDroppedOff: z.string().optional().nullable(),

  // Number fields with coercion (form inputs come as strings)
  estimatedCost: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === null || val === undefined || val === "") return null;
      const num = typeof val === "string" ? parseFloat(val) : val;
      return isNaN(num) ? null : num;
    }),

  finalCost: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === null || val === undefined || val === "") return null;
      const num = typeof val === "string" ? parseFloat(val) : val;
      return isNaN(num) ? null : num;
    }),

  terms: z.string().optional().nullable(),
  shopRef: z.string().optional().nullable(),
  estimatedDeliveryDate: z.string().optional().nullable(),
  curentStatus: roStatusEnum.optional().default("WAITING QUOTE"),
  genthrustStatus: z.string().optional().nullable(),
  shopStatus: z.string().optional().nullable(),
  trackingNumberPickingUp: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateRepairOrderInput = z.infer<typeof createRepairOrderSchema>;

// Update schema - All fields optional for partial updates
// Still enforces non-empty strings if shopName/part are provided
export const updateRepairOrderSchema = z.object({
  shopName: z.string().min(1, "Shop name cannot be empty").optional(),
  part: z.string().min(1, "Part number cannot be empty").optional(),
  serial: z.string().optional().nullable(),
  partDescription: z.string().optional().nullable(),
  reqWork: z.string().optional().nullable(),
  dateDroppedOff: z.string().optional().nullable(),

  estimatedCost: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === null || val === undefined || val === "") return null;
      const num = typeof val === "string" ? parseFloat(val) : val;
      return isNaN(num) ? null : num;
    }),

  finalCost: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === null || val === undefined || val === "") return null;
      const num = typeof val === "string" ? parseFloat(val) : val;
      return isNaN(num) ? null : num;
    }),

  terms: z.string().optional().nullable(),
  shopRef: z.string().optional().nullable(),
  estimatedDeliveryDate: z.string().optional().nullable(),
  curentStatus: roStatusEnum.optional(),
  curentStatusDate: z.string().optional().nullable(),
  genthrustStatus: z.string().optional().nullable(),
  shopStatus: z.string().optional().nullable(),
  trackingNumberPickingUp: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  lastDateUpdated: z.string().optional().nullable(),
  nextDateToUpdate: z.string().optional().nullable(),
});

export type UpdateRepairOrderInput = z.infer<typeof updateRepairOrderSchema>;

// Helper: Validate and parse create input (returns typed result or throws)
export function parseCreateInput(data: unknown): CreateRepairOrderInput {
  return createRepairOrderSchema.parse(data);
}

// Helper: Safe parse for create (returns result object, never throws)
export function safeParseCreateInput(data: unknown) {
  return createRepairOrderSchema.safeParse(data);
}

// Helper: Validate and parse update input
export function parseUpdateInput(data: unknown): UpdateRepairOrderInput {
  return updateRepairOrderSchema.parse(data);
}

// Helper: Safe parse for update
export function safeParseUpdateInput(data: unknown) {
  return updateRepairOrderSchema.safeParse(data);
}
