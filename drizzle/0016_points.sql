CREATE TABLE `point_events` (
	`amount` integer NOT NULL,
	`created_at` integer NOT NULL,
	`day_key` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`season` text NOT NULL,
	`source_id` text
);
