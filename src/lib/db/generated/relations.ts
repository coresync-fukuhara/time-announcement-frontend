import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
	audioTypes: {
		wavTracks: r.many.wavTracks({
			from: r.audioTypes.id.through(r.trackAudioTypes.audioTypeId),
			to: r.wavTracks.id.through(r.trackAudioTypes.trackId)
		}),
	},
	wavTracks: {
		audioTypes: r.many.audioTypes(),
	},
}))