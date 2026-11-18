ALTER TABLE `players` ADD `access_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `players_access_hash_idx` ON `players` (`access_hash`);