-- IF NOT EXISTS: esta tabela já existia como 0009_escolha_times em alguns bancos
-- (antes do merge com os escudos), e esta migração pode rodar de novo neles.
CREATE TABLE IF NOT EXISTS `team_choices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`kind` text NOT NULL,
	`team` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `team_choices_edition_idx` ON `team_choices` (`edition_id`);