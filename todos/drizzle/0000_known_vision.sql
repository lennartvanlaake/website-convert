CREATE TABLE `tasks` (
	`id` text NOT NULL,
	`status` text,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY (`id`)
);
--> statement-breakpoint
CREATE TABLE `subtasks` (
	`id` text NOT NULL,
	`status` text,
	`taskId` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY (`id`),
	FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
