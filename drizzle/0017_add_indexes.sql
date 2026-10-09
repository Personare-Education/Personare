CREATE INDEX `activities_module_id_idx` ON `activities` (`module_id`);--> statement-breakpoint
CREATE INDEX `activities_parent_activity_id_idx` ON `activities` (`parent_activity_id`);--> statement-breakpoint
CREATE INDEX `exam_attempts_exam_id_idx` ON `exam_attempts` (`exam_id`);--> statement-breakpoint
CREATE INDEX `exam_modules_exam_id_idx` ON `exam_modules` (`exam_id`);--> statement-breakpoint
CREATE INDEX `exam_modules_module_id_idx` ON `exam_modules` (`module_id`);--> statement-breakpoint
CREATE INDEX `exams_program_id_idx` ON `exams` (`program_id`);--> statement-breakpoint
CREATE INDEX `flashcards_activity_id_idx` ON `flashcards` (`activity_id`);--> statement-breakpoint
CREATE INDEX `modules_program_id_idx` ON `modules` (`program_id`);--> statement-breakpoint
CREATE INDEX `point_events_season_idx` ON `point_events` (`season`);--> statement-breakpoint
CREATE INDEX `point_events_source_id_idx` ON `point_events` (`source_id`);--> statement-breakpoint
CREATE INDEX `quiz_options_question_id_idx` ON `quiz_options` (`question_id`);--> statement-breakpoint
CREATE INDEX `quiz_questions_activity_id_idx` ON `quiz_questions` (`activity_id`);--> statement-breakpoint
CREATE INDEX `quiz_questions_exam_id_idx` ON `quiz_questions` (`exam_id`);--> statement-breakpoint
CREATE INDEX `review_items_due_date_idx` ON `review_items` (`due_date`);--> statement-breakpoint
CREATE INDEX `review_items_flashcard_id_idx` ON `review_items` (`flashcard_id`);--> statement-breakpoint
CREATE INDEX `review_items_activity_id_idx` ON `review_items` (`activity_id`);--> statement-breakpoint
CREATE INDEX `unlock_requirements_subject_id_idx` ON `unlock_requirements` (`subject_id`);--> statement-breakpoint
CREATE INDEX `unlock_requirements_required_id_idx` ON `unlock_requirements` (`required_id`);