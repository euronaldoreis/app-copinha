CREATE TABLE `editions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` integer NOT NULL,
	`name` text NOT NULL,
	`game` text NOT NULL,
	`played_on` text,
	`format` text NOT NULL,
	`groups_count` integer DEFAULT 0 NOT NULL,
	`legs` integer DEFAULT 1 NOT NULL,
	`qualifiers` integer DEFAULT 0 NOT NULL,
	`third_place` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'inscricoes' NOT NULL,
	`team_pool` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`team_id` integer,
	`group_label` text,
	`seed` integer DEFAULT 0 NOT NULL,
	`result` text,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_edition_player_idx` ON `entries` (`edition_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `entries_player_idx` ON `entries` (`player_id`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` integer NOT NULL,
	`stage` text NOT NULL,
	`round` integer NOT NULL,
	`slot` integer NOT NULL,
	`group_label` text,
	`home_entry_id` integer,
	`away_entry_id` integer,
	`home_source` text,
	`away_source` text,
	`home_score` integer,
	`away_score` integer,
	`home_pens` integer,
	`away_pens` integer,
	`played_at` text,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`home_entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`away_entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `matches_edition_idx` ON `matches` (`edition_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`photo_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_name_idx` ON `players` (`name`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_name_idx` ON `teams` (`name`);