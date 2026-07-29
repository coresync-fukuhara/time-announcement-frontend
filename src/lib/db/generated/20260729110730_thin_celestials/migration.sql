-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `wav_tracks` (
	`id` integer,
	`name` text(255) NOT NULL,
	`file_path` text(1024) NOT NULL,
	`created_at` numeric NOT NULL,
	`updated_at` numeric NOT NULL,
	CONSTRAINT `wav_tracks_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audio_types` (
	`id` integer,
	`name` text(255) NOT NULL,
	`description` text(1024),
	`created_at` numeric NOT NULL,
	CONSTRAINT `audio_types_pk` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `track_audio_types` (
	`track_id` integer NOT NULL,
	`audio_type_id` integer NOT NULL,
	`created_at` numeric NOT NULL,
	CONSTRAINT `track_audio_types_pk` PRIMARY KEY(`track_id`, `audio_type_id`),
	CONSTRAINT `fk_track_audio_types_audio_type_id_audio_types_id_fk` FOREIGN KEY (`audio_type_id`) REFERENCES `audio_types`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_track_audio_types_track_id_wav_tracks_id_fk` FOREIGN KEY (`track_id`) REFERENCES `wav_tracks`(`id`) ON DELETE CASCADE,
	CONSTRAINT `uq_track_audio_type` UNIQUE(`track_id`,`audio_type_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ix_audio_types_name` ON `audio_types` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `ix_wav_tracks_name` ON `wav_tracks` (`name`);
*/