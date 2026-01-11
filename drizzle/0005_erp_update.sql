-- Add ERP Columns to Active Table
ALTER TABLE `active` ADD COLUMN `erp_po_id` varchar(50);

ALTER TABLE `active` ADD COLUMN `erp_last_sync_at` varchar(50);

ALTER TABLE `active`
ADD COLUMN `erp_sync_status` varchar(20) DEFAULT 'LOCAL_ONLY';

-- Add Missing Foreign Keys (Safe to run)
ALTER TABLE `files_upload`
ADD CONSTRAINT `files_upload_repair_order_id_active_id_fk` FOREIGN KEY (`repair_order_id`) REFERENCES `active` (`id`) ON DELETE cascade ON UPDATE no action;

ALTER TABLE `files_upload`
ADD CONSTRAINT `files_upload_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE set null ON UPDATE no action;

ALTER TABLE `notification_queue`
ADD CONSTRAINT `notification_queue_repair_order_id_active_id_fk` FOREIGN KEY (`repair_order_id`) REFERENCES `active` (`id`) ON DELETE cascade ON UPDATE no action;

ALTER TABLE `notification_queue`
ADD CONSTRAINT `notification_queue_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE cascade ON UPDATE no action;

ALTER TABLE `ro_activity_log`
ADD CONSTRAINT `ro_activity_log_repair_order_id_active_id_fk` FOREIGN KEY (`repair_order_id`) REFERENCES `active` (`id`) ON DELETE cascade ON UPDATE no action;

ALTER TABLE `ro_activity_log`
ADD CONSTRAINT `ro_activity_log_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE set null ON UPDATE no action;

ALTER TABLE `ro_relations`
ADD CONSTRAINT `ro_relations_source_ro_id_active_id_fk` FOREIGN KEY (`source_ro_id`) REFERENCES `active` (`id`) ON DELETE cascade ON UPDATE no action;

ALTER TABLE `ro_relations`
ADD CONSTRAINT `ro_relations_target_ro_id_active_id_fk` FOREIGN KEY (`target_ro_id`) REFERENCES `active` (`id`) ON DELETE cascade ON UPDATE no action;

ALTER TABLE `ro_relations`
ADD CONSTRAINT `ro_relations_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE set null ON UPDATE no action;

ALTER TABLE `ro_status_history`
ADD CONSTRAINT `ro_status_history_repair_order_id_active_id_fk` FOREIGN KEY (`repair_order_id`) REFERENCES `active` (`id`) ON DELETE cascade ON UPDATE no action;

ALTER TABLE `ro_status_history`
ADD CONSTRAINT `ro_status_history_changed_by_users_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE set null ON UPDATE no action;

-- Add Missing Indexes
CREATE INDEX `idx_files_upload_ro` ON `files_upload` (`repair_order_id`);

CREATE INDEX `idx_files_upload_user` ON `files_upload` (`uploaded_by`);

CREATE INDEX `idx_files_upload_sharepoint` ON `files_upload` (`sharepoint_file_id`);

CREATE INDEX `idx_notification_status` ON `notification_queue` (`status`);

CREATE INDEX `idx_notification_user` ON `notification_queue` (`user_id`);

CREATE INDEX `idx_activity_log_ro` ON `ro_activity_log` (`repair_order_id`);

CREATE INDEX `idx_activity_log_date` ON `ro_activity_log` (`created_at`);

CREATE INDEX `idx_ro_relations_source` ON `ro_relations` (`source_ro_id`);

CREATE INDEX `idx_ro_relations_target` ON `ro_relations` (`target_ro_id`);

CREATE INDEX `idx_status_history_ro` ON `ro_status_history` (`repair_order_id`);

CREATE INDEX `idx_status_history_date` ON `ro_status_history` (`changed_at`);