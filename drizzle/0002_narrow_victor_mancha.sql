ALTER TABLE `notification_queue` ADD `outlook_message_id` varchar(255);--> statement-breakpoint
ALTER TABLE `notification_queue` ADD `outlook_conversation_id` varchar(255);--> statement-breakpoint
CREATE INDEX `idx_notification_outlook_message` ON `notification_queue` (`outlook_message_id`);