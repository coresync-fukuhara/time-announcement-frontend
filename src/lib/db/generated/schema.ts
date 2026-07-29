import { sqliteTable, foreignKey, primaryKey, uniqueIndex, unique, integer, text, numeric } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

export const wavTracks = sqliteTable("wav_tracks", {
	id: integer().primaryKey(),
	name: text().notNull(),
	filePath: text("file_path").notNull(),
	createdAt: numeric("created_at").notNull(),
	updatedAt: numeric("updated_at").notNull(),
},
(table) => [uniqueIndex("ix_wav_tracks_name").on(table.name),
]);

export const audioTypes = sqliteTable("audio_types", {
	id: integer().primaryKey(),
	name: text().notNull(),
	description: text(),
	createdAt: numeric("created_at").notNull(),
},
(table) => [uniqueIndex("ix_audio_types_name").on(table.name),
]);

export const trackAudioTypes = sqliteTable("track_audio_types", {
	trackId: integer("track_id").notNull().references(() => wavTracks.id, { onDelete: "cascade" } ),
	audioTypeId: integer("audio_type_id").notNull().references(() => audioTypes.id, { onDelete: "cascade" } ),
	createdAt: numeric("created_at").notNull(),
},
(table) => [primaryKey({ columns: [table.trackId, table.audioTypeId], name: "track_audio_types_pk"}),
unique("uq_track_audio_type").on(table.trackId, table.audioTypeId),
]);

