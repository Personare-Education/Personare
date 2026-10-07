CREATE TABLE `exam_attempts` (
	`correct` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`exam_id` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`total` integer NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exam_modules` (
	`exam_id` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exams` (
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`passing_score` integer DEFAULT 70 NOT NULL,
	`program_id` text NOT NULL,
	`question_count` integer NOT NULL,
	`time_limit_minutes` integer,
	`title` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_quiz_questions` (
	`activity_id` text,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text,
	`image_path` text,
	`text` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_quiz_questions`("activity_id", "created_at", "deleted_at", "id", "exam_id", "image_path", "text", "updated_at") SELECT "activity_id", "created_at", "deleted_at", "id", NULL, "image_path", "text", "updated_at" FROM `quiz_questions`;--> statement-breakpoint
DROP TABLE `quiz_questions`;--> statement-breakpoint
ALTER TABLE `__new_quiz_questions` RENAME TO `quiz_questions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;