CREATE TABLE `review_logs` (
	`desired_retention` real NOT NULL,
	`difficulty_after` real NOT NULL,
	`difficulty_before` real NOT NULL,
	`due_after` integer NOT NULL,
	`duration_ms` integer,
	`elapsed_days` real,
	`id` text PRIMARY KEY NOT NULL,
	`item_kind` text NOT NULL,
	`rating` text NOT NULL,
	`retrievability_before` real,
	`reviewed_at` integer NOT NULL,
	`review_item_id` text NOT NULL,
	`stability_after` real NOT NULL,
	`stability_before` real NOT NULL,
	`state_after` text NOT NULL,
	`state_before` text NOT NULL,
	`study_goal` text,
	FOREIGN KEY (`review_item_id`) REFERENCES `review_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `review_logs_review_item_id_idx` ON `review_logs` (`review_item_id`);--> statement-breakpoint
CREATE INDEX `review_logs_reviewed_at_idx` ON `review_logs` (`reviewed_at`);