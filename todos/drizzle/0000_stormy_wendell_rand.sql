CREATE TABLE `blockers` (
	`id` integer PRIMARY KEY NOT NULL,
	`status` text,
	`taskId` integer,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `epics` (
	`id` integer PRIMARY KEY NOT NULL,
	`status` text,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subtasks` (
	`id` integer PRIMARY KEY NOT NULL,
	`status` text,
	`taskId` integer,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY NOT NULL,
	`status` text,
	`epicId` integer,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`epicId`) REFERENCES `epics`(`id`) ON UPDATE no action ON DELETE no action
);
