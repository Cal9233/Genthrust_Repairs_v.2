-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `active` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`RO` double,
	`DATE_MADE` varchar(500),
	`SHOP_NAME` varchar(500),
	`PART` varchar(500),
	`SERIAL` varchar(500),
	`PART_DESCRIPTION` varchar(500),
	`REQ_WORK` varchar(500),
	`DATE_DROPPED_OFF` varchar(500),
	`ESTIMATED_COST` double,
	`FINAL_COST` double,
	`TERMS` varchar(500),
	`SHOP_REF` varchar(500),
	`ESTIMATED_DELIVERY_DATE` varchar(500),
	`CURENT_STATUS` varchar(500),
	`CURENT_STATUS_DATE` varchar(500),
	`GENTHRUST_STATUS` varchar(500),
	`SHOP_STATUS` varchar(500),
	`TRACKING_NUMBER_PICKING_UP` varchar(500),
	`NOTES` varchar(500),
	`LAST_DATE_UPDATED` varchar(500),
	`NEXT_DATE_TO_UPDATE` varchar(500),
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `active_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `b_e_r_r_a_i` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`PN_B_E_R_R_A_I` varchar(500),
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `b_e_r_r_a_i_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bins_inventory_actual` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`PART_NUMBER` varchar(500),
	`DESCRIPTION` varchar(500),
	`QTY` varchar(500),
	`LOCATION` varchar(500),
	`BIN` varchar(500),
	`CONDITION` varchar(500),
	`SUGGESTED_SELL_PRICE_MAX_30` double,
	`COST` varchar(500),
	`SUGGESTED_SELL_PRICE_MIN_15` double,
	`SUGGESTED_SELL_PRICE_MAX_30_2` double,
	`COMENT` varchar(500),
	`Column1` varchar(500),
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `bins_inventory_actual_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delta_apa` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`DELTA_APA` varchar(500),
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `delta_apa_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hold` (
	`38418` bigint,
	`id` bigint AUTO_INCREMENT NOT NULL,
	`2025_08_26_00_00_00` datetime,
	`FLORIDA_AERO_SYSTEMS` varchar(500),
	`3_1423_2` varchar(500),
	`1987_2201` varchar(500),
	`NOSE_WHEEL` varchar(500),
	`OH` varchar(500),
	`SHIPPING` varchar(500),
	`NET_30` varchar(500),
	`WAITING_QUOTE` varchar(500),
	`2025_08_26_00_00_00_1` varchar(500),
	`2025_08_26_00_00_00_2` varchar(500),
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `hold_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryindex` (
	`IndexId` int AUTO_INCREMENT NOT NULL,
	`PartNumber` varchar(255),
	`TableName` varchar(100),
	`RowId` int,
	`Qty` int,
	`SerialNumber` varchar(255),
	`Condition` varchar(50),
	`Location` varchar(255),
	`Description` text,
	`LastSeen` datetime DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `inventoryindex_IndexId` PRIMARY KEY(`IndexId`)
);
--> statement-breakpoint
CREATE TABLE `logs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`Timestamp` varchar(500),
	`Date` datetime,
	`User` varchar(500),
	`User_Message` varchar(500),
	`AI_Response` varchar(500),
	`Context` double,
	`Model` double,
	`Duration_ms` double,
	`Success` varchar(500),
	`Error` varchar(500),
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `net` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`RO` double,
	`DATE_MADE` datetime,
	`SHOP_NAME` varchar(500),
	`PART` varchar(500),
	`SERIAL` varchar(500),
	`PART_DESCRIPTION` varchar(500),
	`REQ_WORK` varchar(500),
	`DATE_DROPPED_OFF` varchar(500),
	`ESTIMATED_COST` double,
	`FINAL_COST` double,
	`TERMS` varchar(500),
	`SHOP_REF` varchar(500),
	`ESTIMATED_DELIVERY_DATE` varchar(500),
	`CURENT_STATUS` varchar(500),
	`CURENT_STATUS_DATE` varchar(500),
	`GENTHRUST_STATUS` varchar(500),
	`SHOP_STATUS` varchar(500),
	`TRACKING_NUMBER_PICKING_UP` varchar(500),
	`NOTES` varchar(500),
	`LAST_DATE_UPDATED` varchar(500),
	`NEXT_DATE_TO_UPDATE` varchar(500),
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `net_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paid` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`RO` double,
	`DATE_MADE` datetime,
	`SHOP_NAME` varchar(500),
	`PART` varchar(500),
	`SERIAL` varchar(500),
	`PART_DESCRIPTION` varchar(500),
	`REQ_WORK` varchar(500),
	`DATE_DROPPED_OFF` varchar(500),
	`ESTIMATED_COST` double,
	`FINAL_COST` varchar(500),
	`TERMS` varchar(500),
	`SHOP_REF` varchar(500),
	`ESTIMATED_DELIVERY_DATE` varchar(500),
	`CURENT_STATUS` varchar(500),
	`CURENT_STATUS_DATE` varchar(500),
	`GENTHRUST_STATUS` varchar(500),
	`SHOP_STATUS` varchar(500),
	`TRACKING_NUMBER_PICKING_UP` varchar(500),
	`NOTES` varchar(500),
	`LAST_DATE_UPDATED` varchar(500),
	`NEXT_DATE_TO_UPDATE` varchar(500),
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `paid_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partes_ar_asia` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`PN_APA` varchar(500),
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `partes_ar_asia_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partes_ar_asia_sanford` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`PN_APA_SANFORD` varchar(500),
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `partes_ar_asia_sanford_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partes_bolivia` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`PN_BOLIVIA` varchar(500),
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `partes_bolivia_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pn_no_reparadas_727` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`PART_No` varchar(500),
	`SERIAL` varchar(500),
	`DESCRIPTION` varchar(500),
	`QTY` varchar(500),
	`STOCK_ROOM` double,
	`LOCATION` varchar(500),
	`COMMENT` varchar(500),
	`SISTEMA` varchar(500),
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `pn_no_reparadas_727_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pn_no_reparadas_md82` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`PART_No` varchar(500),
	`SERIAL` varchar(500),
	`DESCRIPTION` varchar(500),
	`QTY` varchar(500),
	`STOCK_ROOM` varchar(500),
	`LOCATION` varchar(500),
	`BIN` varchar(500),
	`COMMENT` varchar(500),
	`SISTEMA` varchar(500),
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `pn_no_reparadas_md82_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `returns` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`RO` double,
	`DATE_MADE` varchar(500),
	`SHOP_NAME` varchar(500),
	`PART` varchar(500),
	`SERIAL` varchar(500),
	`PART_DESCRIPTION` varchar(500),
	`REQ_WORK` varchar(500),
	`DATE_DROPPED_OFF` varchar(500),
	`ESTIMATED_COST` double,
	`FINAL_COST` varchar(500),
	`TERMS` varchar(500),
	`SHOP_REF` varchar(500),
	`ESTIMATED_DELIVERY_DATE` varchar(500),
	`CURENT_STATUS` varchar(500),
	`CURENT_STATUS_DATE` varchar(500),
	`GENTHRUST_STATUS` varchar(500),
	`SHOP_STATUS` varchar(500),
	`TRACKING_NUMBER_PICKING_UP` varchar(500),
	`NOTES` varchar(500),
	`LAST_DATE_UPDATED` varchar(500),
	`NEXT_DATE_TO_UPDATE` varchar(500),
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `returns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`Customer` bigint,
	`Business_Name` varchar(500),
	`Address_Line_1` varchar(500),
	`Address_Line_2` varchar(500),
	`Address_Line_3` varchar(500),
	`Address_Line_4` varchar(500),
	`City` varchar(500),
	`State` varchar(500),
	`ZIP` varchar(500),
	`Country` varchar(500),
	`Phone` varchar(500),
	`Toll_Free` varchar(500),
	`Fax` varchar(500),
	`Email` varchar(500),
	`Website` varchar(500),
	`Contact` varchar(500),
	`Payment_Terms` varchar(500),
	`ILS_Code` varchar(500),
	`Last_Sale_Date` varchar(500),
	`YTD_Sales` double,
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `shops_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_room_actual` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`GENTHRUST_XVII_INVENTORY` varchar(500),
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `stock_room_actual_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `terra` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`PART_No` varchar(500),
	`SERIAL` varchar(500),
	`DESCRIPTION` varchar(500),
	`QTY` double,
	`STOCK_ROOM` double,
	`LOCATION` varchar(500),
	`COMMENT` varchar(500),
	`SISTEMA` varchar(500),
	`created_at` timestamp DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `terra_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_partnumber` ON `inventoryindex` (`PartNumber`);--> statement-breakpoint
CREATE INDEX `idx_qty` ON `inventoryindex` (`Qty`);
*/