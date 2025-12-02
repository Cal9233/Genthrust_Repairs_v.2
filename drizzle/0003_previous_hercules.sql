CREATE TABLE `ro_activity_log` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`repair_order_id` bigint NOT NULL,
	`action` varchar(50) NOT NULL,
	`field` varchar(100),
	`old_value` text,
	`new_value` text,
	`user_id` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ro_activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ro_relations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`source_ro_id` bigint NOT NULL,
	`target_ro_id` bigint NOT NULL,
	`relation_type` varchar(50) NOT NULL,
	`created_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ro_relations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ro_status_history` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`repair_order_id` bigint NOT NULL,
	`status` varchar(100) NOT NULL,
	`previous_status` varchar(100),
	`changed_by` varchar(255),
	`changed_at` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	CONSTRAINT `ro_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ro_activity_log` ADD CONSTRAINT `ro_activity_log_repair_order_id_active_id_fk` FOREIGN KEY (`repair_order_id`) REFERENCES `active`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ro_activity_log` ADD CONSTRAINT `ro_activity_log_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ro_relations` ADD CONSTRAINT `ro_relations_source_ro_id_active_id_fk` FOREIGN KEY (`source_ro_id`) REFERENCES `active`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ro_relations` ADD CONSTRAINT `ro_relations_target_ro_id_active_id_fk` FOREIGN KEY (`target_ro_id`) REFERENCES `active`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ro_relations` ADD CONSTRAINT `ro_relations_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ro_status_history` ADD CONSTRAINT `ro_status_history_repair_order_id_active_id_fk` FOREIGN KEY (`repair_order_id`) REFERENCES `active`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ro_status_history` ADD CONSTRAINT `ro_status_history_changed_by_users_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_activity_log_ro` ON `ro_activity_log` (`repair_order_id`);--> statement-breakpoint
CREATE INDEX `idx_activity_log_date` ON `ro_activity_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ro_relations_source` ON `ro_relations` (`source_ro_id`);--> statement-breakpoint
CREATE INDEX `idx_ro_relations_target` ON `ro_relations` (`target_ro_id`);--> statement-breakpoint
CREATE INDEX `idx_status_history_ro` ON `ro_status_history` (`repair_order_id`);--> statement-breakpoint
CREATE INDEX `idx_status_history_date` ON `ro_status_history` (`changed_at`);