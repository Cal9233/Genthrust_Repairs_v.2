import {
  mysqlTable,
  varchar,
  text,
  int,
  bigint,
  double,
  timestamp,
  datetime,
  primaryKey,
  boolean,
  index,
} from "drizzle-orm/mysql-core";
import { relations, sql } from "drizzle-orm";

// ==========================================
// EXISTING INVENTORY TABLES (from introspection)
// ==========================================

export const active = mysqlTable(
  "active",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    ro: double("RO"),
    dateMade: varchar("DATE_MADE", { length: 500 }),
    shopName: varchar("SHOP_NAME", { length: 500 }),
    part: varchar("PART", { length: 500 }),
    serial: varchar("SERIAL", { length: 500 }),
    partDescription: varchar("PART_DESCRIPTION", { length: 500 }),
    reqWork: varchar("REQ_WORK", { length: 500 }),
    dateDroppedOff: varchar("DATE_DROPPED_OFF", { length: 500 }),
    estimatedCost: double("ESTIMATED_COST"),
    finalCost: double("FINAL_COST"),
    terms: varchar("TERMS", { length: 500 }),
    shopRef: varchar("SHOP_REF", { length: 500 }),
    estimatedDeliveryDate: varchar("ESTIMATED_DELIVERY_DATE", { length: 500 }),
    curentStatus: varchar("CURENT_STATUS", { length: 500 }),
    curentStatusDate: varchar("CURENT_STATUS_DATE", { length: 500 }),
    genthrustStatus: varchar("GENTHRUST_STATUS", { length: 500 }),
    shopStatus: varchar("SHOP_STATUS", { length: 500 }),
    trackingNumberPickingUp: varchar("TRACKING_NUMBER_PICKING_UP", {
      length: 500,
    }),
    notes: varchar("NOTES", { length: 500 }),
    lastDateUpdated: varchar("LAST_DATE_UPDATED", { length: 500 }),
    nextDateToUpdate: varchar("NEXT_DATE_TO_UPDATE", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id], name: "active_id" })]
);

export const bERRAI = mysqlTable(
  "b_e_r_r_a_i",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    pnBERRAI: varchar("PN_B_E_R_R_A_I", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id], name: "b_e_r_r_a_i_id" })]
);

export const binsInventoryActual = mysqlTable(
  "bins_inventory_actual",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    partNumber: varchar("PART_NUMBER", { length: 500 }),
    description: varchar("DESCRIPTION", { length: 500 }),
    qty: varchar("QTY", { length: 500 }),
    location: varchar("LOCATION", { length: 500 }),
    bin: varchar("BIN", { length: 500 }),
    condition: varchar("CONDITION", { length: 500 }),
    suggestedSellPriceMax30: double("SUGGESTED_SELL_PRICE_MAX_30"),
    cost: varchar("COST", { length: 500 }),
    suggestedSellPriceMin15: double("SUGGESTED_SELL_PRICE_MIN_15"),
    suggestedSellPriceMax302: double("SUGGESTED_SELL_PRICE_MAX_30_2"),
    coment: varchar("COMENT", { length: 500 }),
    column1: varchar("Column1", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: "bins_inventory_actual_id" }),
  ]
);

export const deltaApa = mysqlTable(
  "delta_apa",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    deltaApa: varchar("DELTA_APA", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id], name: "delta_apa_id" })]
);

export const hold = mysqlTable(
  "hold",
  {
    "38418": bigint({ mode: "number" }),
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    "20250826000000": datetime("2025_08_26_00_00_00", { mode: "string" }),
    floridaAeroSystems: varchar("FLORIDA_AERO_SYSTEMS", { length: 500 }),
    "314232": varchar("3_1423_2", { length: 500 }),
    "19872201": varchar("1987_2201", { length: 500 }),
    noseWheel: varchar("NOSE_WHEEL", { length: 500 }),
    oh: varchar("OH", { length: 500 }),
    shipping: varchar("SHIPPING", { length: 500 }),
    net30: varchar("NET_30", { length: 500 }),
    waitingQuote: varchar("WAITING_QUOTE", { length: 500 }),
    "202508260000001": varchar("2025_08_26_00_00_00_1", { length: 500 }),
    "202508260000002": varchar("2025_08_26_00_00_00_2", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id], name: "hold_id" })]
);

export const inventoryindex = mysqlTable(
  "inventoryindex",
  {
    indexId: int("IndexId").autoincrement().notNull(),
    partNumber: varchar("PartNumber", { length: 255 }),
    tableName: varchar("TableName", { length: 100 }),
    rowId: int("RowId"),
    qty: int("Qty"),
    serialNumber: varchar("SerialNumber", { length: 255 }),
    condition: varchar("Condition", { length: 50 }),
    location: varchar("Location", { length: 255 }),
    description: text("Description"),
    lastSeen: datetime("LastSeen", { mode: "string" }).default(
      sql`(CURRENT_TIMESTAMP)`
    ),
  },
  (table) => [
    index("idx_partnumber").on(table.partNumber),
    index("idx_qty").on(table.qty),
    primaryKey({ columns: [table.indexId], name: "inventoryindex_IndexId" }),
  ]
);

export const logs = mysqlTable(
  "logs",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    timestamp: varchar("Timestamp", { length: 500 }),
    date: datetime("Date", { mode: "string" }),
    user: varchar("User", { length: 500 }),
    userMessage: varchar("User_Message", { length: 500 }),
    aiResponse: varchar("AI_Response", { length: 500 }),
    context: double("Context"),
    model: double("Model"),
    durationMs: double("Duration_ms"),
    success: varchar("Success", { length: 500 }),
    error: varchar("Error", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id], name: "logs_id" })]
);

export const net = mysqlTable(
  "net",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    ro: double("RO"),
    dateMade: datetime("DATE_MADE", { mode: "string" }),
    shopName: varchar("SHOP_NAME", { length: 500 }),
    part: varchar("PART", { length: 500 }),
    serial: varchar("SERIAL", { length: 500 }),
    partDescription: varchar("PART_DESCRIPTION", { length: 500 }),
    reqWork: varchar("REQ_WORK", { length: 500 }),
    dateDroppedOff: varchar("DATE_DROPPED_OFF", { length: 500 }),
    estimatedCost: double("ESTIMATED_COST"),
    finalCost: double("FINAL_COST"),
    terms: varchar("TERMS", { length: 500 }),
    shopRef: varchar("SHOP_REF", { length: 500 }),
    estimatedDeliveryDate: varchar("ESTIMATED_DELIVERY_DATE", { length: 500 }),
    curentStatus: varchar("CURENT_STATUS", { length: 500 }),
    curentStatusDate: varchar("CURENT_STATUS_DATE", { length: 500 }),
    genthrustStatus: varchar("GENTHRUST_STATUS", { length: 500 }),
    shopStatus: varchar("SHOP_STATUS", { length: 500 }),
    trackingNumberPickingUp: varchar("TRACKING_NUMBER_PICKING_UP", {
      length: 500,
    }),
    notes: varchar("NOTES", { length: 500 }),
    lastDateUpdated: varchar("LAST_DATE_UPDATED", { length: 500 }),
    nextDateToUpdate: varchar("NEXT_DATE_TO_UPDATE", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id], name: "net_id" })]
);

export const paid = mysqlTable(
  "paid",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    ro: double("RO"),
    dateMade: datetime("DATE_MADE", { mode: "string" }),
    shopName: varchar("SHOP_NAME", { length: 500 }),
    part: varchar("PART", { length: 500 }),
    serial: varchar("SERIAL", { length: 500 }),
    partDescription: varchar("PART_DESCRIPTION", { length: 500 }),
    reqWork: varchar("REQ_WORK", { length: 500 }),
    dateDroppedOff: varchar("DATE_DROPPED_OFF", { length: 500 }),
    estimatedCost: double("ESTIMATED_COST"),
    finalCost: varchar("FINAL_COST", { length: 500 }),
    terms: varchar("TERMS", { length: 500 }),
    shopRef: varchar("SHOP_REF", { length: 500 }),
    estimatedDeliveryDate: varchar("ESTIMATED_DELIVERY_DATE", { length: 500 }),
    curentStatus: varchar("CURENT_STATUS", { length: 500 }),
    curentStatusDate: varchar("CURENT_STATUS_DATE", { length: 500 }),
    genthrustStatus: varchar("GENTHRUST_STATUS", { length: 500 }),
    shopStatus: varchar("SHOP_STATUS", { length: 500 }),
    trackingNumberPickingUp: varchar("TRACKING_NUMBER_PICKING_UP", {
      length: 500,
    }),
    notes: varchar("NOTES", { length: 500 }),
    lastDateUpdated: varchar("LAST_DATE_UPDATED", { length: 500 }),
    nextDateToUpdate: varchar("NEXT_DATE_TO_UPDATE", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id], name: "paid_id" })]
);

export const partesArAsia = mysqlTable(
  "partes_ar_asia",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    pnApa: varchar("PN_APA", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id], name: "partes_ar_asia_id" })]
);

export const partesArAsiaSanford = mysqlTable(
  "partes_ar_asia_sanford",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    pnApaSanford: varchar("PN_APA_SANFORD", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: "partes_ar_asia_sanford_id" }),
  ]
);

export const partesBolivia = mysqlTable(
  "partes_bolivia",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    pnBolivia: varchar("PN_BOLIVIA", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id], name: "partes_bolivia_id" })]
);

export const pnNoReparadas727 = mysqlTable(
  "pn_no_reparadas_727",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    partNo: varchar("PART_No", { length: 500 }),
    serial: varchar("SERIAL", { length: 500 }),
    description: varchar("DESCRIPTION", { length: 500 }),
    qty: varchar("QTY", { length: 500 }),
    stockRoom: double("STOCK_ROOM"),
    location: varchar("LOCATION", { length: 500 }),
    comment: varchar("COMMENT", { length: 500 }),
    sistema: varchar("SISTEMA", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: "pn_no_reparadas_727_id" }),
  ]
);

export const pnNoReparadasMd82 = mysqlTable(
  "pn_no_reparadas_md82",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    partNo: varchar("PART_No", { length: 500 }),
    serial: varchar("SERIAL", { length: 500 }),
    description: varchar("DESCRIPTION", { length: 500 }),
    qty: varchar("QTY", { length: 500 }),
    stockRoom: varchar("STOCK_ROOM", { length: 500 }),
    location: varchar("LOCATION", { length: 500 }),
    bin: varchar("BIN", { length: 500 }),
    comment: varchar("COMMENT", { length: 500 }),
    sistema: varchar("SISTEMA", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: "pn_no_reparadas_md82_id" }),
  ]
);

export const returns = mysqlTable(
  "returns",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    ro: double("RO"),
    dateMade: varchar("DATE_MADE", { length: 500 }),
    shopName: varchar("SHOP_NAME", { length: 500 }),
    part: varchar("PART", { length: 500 }),
    serial: varchar("SERIAL", { length: 500 }),
    partDescription: varchar("PART_DESCRIPTION", { length: 500 }),
    reqWork: varchar("REQ_WORK", { length: 500 }),
    dateDroppedOff: varchar("DATE_DROPPED_OFF", { length: 500 }),
    estimatedCost: double("ESTIMATED_COST"),
    finalCost: varchar("FINAL_COST", { length: 500 }),
    terms: varchar("TERMS", { length: 500 }),
    shopRef: varchar("SHOP_REF", { length: 500 }),
    estimatedDeliveryDate: varchar("ESTIMATED_DELIVERY_DATE", { length: 500 }),
    curentStatus: varchar("CURENT_STATUS", { length: 500 }),
    curentStatusDate: varchar("CURENT_STATUS_DATE", { length: 500 }),
    genthrustStatus: varchar("GENTHRUST_STATUS", { length: 500 }),
    shopStatus: varchar("SHOP_STATUS", { length: 500 }),
    trackingNumberPickingUp: varchar("TRACKING_NUMBER_PICKING_UP", {
      length: 500,
    }),
    notes: varchar("NOTES", { length: 500 }),
    lastDateUpdated: varchar("LAST_DATE_UPDATED", { length: 500 }),
    nextDateToUpdate: varchar("NEXT_DATE_TO_UPDATE", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id], name: "returns_id" })]
);

export const shops = mysqlTable(
  "shops",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    customer: bigint("Customer", { mode: "number" }),
    businessName: varchar("Business_Name", { length: 500 }),
    addressLine1: varchar("Address_Line_1", { length: 500 }),
    addressLine2: varchar("Address_Line_2", { length: 500 }),
    addressLine3: varchar("Address_Line_3", { length: 500 }),
    addressLine4: varchar("Address_Line_4", { length: 500 }),
    city: varchar("City", { length: 500 }),
    state: varchar("State", { length: 500 }),
    zip: varchar("ZIP", { length: 500 }),
    country: varchar("Country", { length: 500 }),
    phone: varchar("Phone", { length: 500 }),
    tollFree: varchar("Toll_Free", { length: 500 }),
    fax: varchar("Fax", { length: 500 }),
    email: varchar("Email", { length: 500 }),
    website: varchar("Website", { length: 500 }),
    contact: varchar("Contact", { length: 500 }),
    paymentTerms: varchar("Payment_Terms", { length: 500 }),
    ilsCode: varchar("ILS_Code", { length: 500 }),
    lastSaleDate: varchar("Last_Sale_Date", { length: 500 }),
    ytdSales: double("YTD_Sales"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id], name: "shops_id" })]
);

export const stockRoomActual = mysqlTable(
  "stock_room_actual",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    genthrustXviiInventory: varchar("GENTHRUST_XVII_INVENTORY", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id], name: "stock_room_actual_id" })]
);

export const terra = mysqlTable(
  "terra",
  {
    id: bigint({ mode: "number" }).autoincrement().notNull(),
    partNo: varchar("PART_No", { length: 500 }),
    serial: varchar("SERIAL", { length: 500 }),
    description: varchar("DESCRIPTION", { length: 500 }),
    qty: double("QTY"),
    stockRoom: double("STOCK_ROOM"),
    location: varchar("LOCATION", { length: 500 }),
    comment: varchar("COMMENT", { length: 500 }),
    sistema: varchar("SISTEMA", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.id], name: "terra_id" })]
);

// ==========================================
// AUTH.JS TABLES
// ==========================================

export const users = mysqlTable("users", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).unique(),
  emailVerified: timestamp("emailVerified", { mode: "date", fsp: 3 }),
  image: text("image"),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow(),
});

export const accounts = mysqlTable(
  "accounts",
  {
    userId: varchar("userId", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 })
      .$type<"email" | "oauth" | "oidc" | "webauthn">()
      .notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
    // CRITICAL: OAuth tokens - refresh_token is needed for background workers
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: int("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (table) => [
    primaryKey({
      columns: [table.provider, table.providerAccountId],
    }),
  ]
);

export const sessions = mysqlTable("sessions", {
  sessionToken: varchar("sessionToken", { length: 255 }).primaryKey(),
  userId: varchar("userId", { length: 255 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = mysqlTable(
  "verificationTokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.identifier, table.token],
    }),
  ]
);

export const authenticators = mysqlTable(
  "authenticators",
  {
    credentialID: varchar("credentialID", { length: 255 }).notNull().unique(),
    userId: varchar("userId", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: int("counter").notNull(),
    credentialDeviceType: varchar("credentialDeviceType", {
      length: 255,
    }).notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: varchar("transports", { length: 255 }),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.credentialID],
    }),
  ]
);

// ==========================================
// AUTH.JS RELATIONS
// ==========================================

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  authenticators: many(authenticators),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const authenticatorsRelations = relations(authenticators, ({ one }) => ({
  user: one(users, {
    fields: [authenticators.userId],
    references: [users.id],
  }),
}));

// ==========================================
// TYPE EXPORTS
// ==========================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
