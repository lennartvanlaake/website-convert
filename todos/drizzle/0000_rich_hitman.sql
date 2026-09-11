CREATE TABLE `subtasks` (
	`id` integer PRIMARY KEY NOT NULL,
	`status` text,
	`taskId` integer,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY NOT NULL,
	`status` text,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
