// src/lib/validation/external-api.ts
import { z } from "zod";

// Helper for status object inside ERP response
const erpStatusSchema = z.object({
  status: z.string(),
});

// Helper for address
const erpAddressSchema = z.object({
  company: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
});

const erpAddressBlockSchema = z.object({
  ship: erpAddressSchema.optional(),
  vendor: erpAddressSchema.optional(),
});

// Schema for an item in the List endpoint
export const erpRepairOrderListSchema = z.object({
  res: z.number(),
  data: z.object({
    list: z.array(
      z.object({
        body: z.object({
          po_id: z.number(),
          po_no: z.string(),
          type: z.string().optional(),
          status: erpStatusSchema,
          modified_time: z.string(),
          created_time: z.string().optional(),
          vendor: z.object({ vendorname: z.string().optional() }).optional(),
        }),
      })
    ),
  }),
});

// Schema for the Details endpoint
export const erpRepairOrderDetailsSchema = z.object({
  res: z.number(),
  data: z.object({
    body: z.object({
      po_id: z.number(),
      po_no: z.string(),
      status: erpStatusSchema,
      vendor: z.object({ vendorname: z.string().optional() }).optional(),
      ship_via: z.string().nullable().optional(),
      address: erpAddressBlockSchema.optional(),
      total: z.union([z.string(), z.number()]).optional(),
      term_sale: z.string().nullable().optional(),
      modified_time: z.string().nullable().optional(),
      created_time: z.string().nullable().optional(),
    }),
    partsList: z.array(
      z.object({
        id: z.number().optional(),
        product: z.object({ name: z.string() }).optional(),
        quantity: z.object({ qty: z.number(), received: z.number().optional() }).optional(),
        unit_price: z.number().optional(),
        serial_number: z.string().nullable().optional(),
        comment: z.string().nullable().optional(),
        // Serial number fields
        tags: z.object({
          sn: z.string().nullable().optional(),
          trace: z.string().nullable().optional(),
        }).optional(),
        json_data: z.object({
          pn_sn: z.string().nullable().optional(),
        }).optional(),
        // Additional part fields
        leadtime: z.string().nullable().optional(),
        condition: z.string().nullable().optional(),
      })
    ).optional().default([]),
  }),
});
