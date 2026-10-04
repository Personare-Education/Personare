CREATE TABLE `unlock_requirements` (
	`created_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`required_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`subject_kind` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `activities` ADD `completed_at` integer;--> statement-breakpoint
ALTER TABLE `activities` ADD `parent_activity_id` text REFERENCES activities(id);--> statement-breakpoint
ALTER TABLE `activities` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `activities` ADD `unlock_mode` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `modules` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `modules` ADD `unlock_mode` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
UPDATE `modules` SET `position` = (SELECT `rn` FROM (SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `program_id` ORDER BY `name`) - 1 AS `rn` FROM `modules`) AS `ordered` WHERE `ordered`.`id` = `modules`.`id`);--> statement-breakpoint
UPDATE `activities` SET `position` = (SELECT `rn` FROM (SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `module_id` ORDER BY `created_at`, `rowid`) - 1 AS `rn` FROM `activities`) AS `ordered` WHERE `ordered`.`id` = `activities`.`id`);--> statement-breakpoint
UPDATE `activities` SET `completed_at` = (SELECT MIN(`r`.`last_reviewed_at`) FROM `review_items` AS `r` LEFT JOIN `flashcards` AS `f` ON `f`.`id` = `r`.`flashcard_id` WHERE (`r`.`activity_id` = `activities`.`id` OR `f`.`activity_id` = `activities`.`id`) AND `r`.`last_reviewed_at` IS NOT NULL);
