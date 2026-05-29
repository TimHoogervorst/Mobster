CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `build_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`prd_id` text NOT NULL,
	`status` text NOT NULL,
	`agent_log` text,
	`pr_url` text,
	`branch_name` text,
	`error` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`max_retries` integer DEFAULT 3 NOT NULL,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`prd_id`) REFERENCES `prds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `github_repos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`full_name` text NOT NULL,
	`default_branch` text DEFAULT 'main' NOT NULL,
	`description` text,
	`language` text,
	`stars` integer DEFAULT 0,
	`synced_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `github_repos_full_name_unique` ON `github_repos` (`full_name`);--> statement-breakpoint
CREATE TABLE `issues` (
	`id` text PRIMARY KEY NOT NULL,
	`repo_id` text NOT NULL,
	`github_id` integer NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`state` text NOT NULL,
	`issue_type` text,
	`labels` text,
	`assignee` text,
	`milestone` text,
	`github_url` text NOT NULL,
	`github_created_at` text,
	`github_updated_at` text,
	`user_notes` text,
	`user_tags` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`repo_id`) REFERENCES `github_repos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `prds` (
	`id` text PRIMARY KEY NOT NULL,
	`issue_id` text,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`status` text NOT NULL,
	`agent_model` text,
	`agent_prompt` text,
	`version` integer DEFAULT 1 NOT NULL,
	`parent_prd_id` text,
	`scheduled_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`github_id` text NOT NULL,
	`github_token` text NOT NULL,
	`name` text,
	`email` text,
	`avatar_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_github_id_unique` ON `users` (`github_id`);