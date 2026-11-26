/**
 * Musical content for Pulau Musik.
 *
 * Two things a three-year-old can genuinely learn here, and nothing else:
 *
 *  1. **Pitch** — that a sound can be high or low. A child can tell a bird from
 *     a bear by ear long before they can read a note, and "high/low" is the
 *     same spatial vocabulary they already use for blocks and shelves.
 *  2. **Rhythm** — that a steady beat with long and short sounds is a pattern.
 *     This is the musical twin of the colour pattern in Kebun Warna, and the
 *     same skill: hear a rule, predict what comes next.
 *
 * Deliberately **no note names, no notation, no solfège.** Those are for
 * school-age children with a music teacher. What is stored here is only what
 * the engine needs to make a sound and the panel needs to draw a picture.
 *
 * Kept free of Three.js and Svelte so it can be unit tested in Node.
 */

export interface PitchEntry {
	/** Stable id, used in mission ids and for the audio lookup. */
	id: string;
	/** Spoken/short Indonesian label, e.g. "Tinggi". */
	name: string;
	/** Emoji shown on the answer button, so a non-reader can choose. */
	icon: string;
	/** Frequency in Hz. Chosen from a C-major octave so a run sounds musical. */
	frequency: number;
	/**
	 * Visual height band, 0 = low, 1 = high.
	 *
	 * The panel draws two identical shapes at different heights: if the icons
	 * differed in *shape* too, the child could answer by matching pictures
	 * instead of by hearing, and the activity would measure nothing.
	 */
	band: 0 | 1;
}

/** The two bands a question can ask about, as named constants. */
export const LOW: PitchEntry = {
	id: 'rendah',
	name: 'Rendah',
	icon: '🐻',
	frequency: 261.63,
	band: 0
};

export const HIGH: PitchEntry = {
	id: 'tinggi',
	name: 'Tinggi',
	icon: '🐦',
	frequency: 523.25,
	band: 1
};

/**
 * The two pitches a question can ask about.
 *
 * Declared from the constants above rather than typed out again, so there is
 * exactly one definition of "low" and "high" in the file. Indexing a literal
 * array would type these as possibly-undefined, which is why the constants
 * exist in the first place.
 */
export const PITCHES: PitchEntry[] = [LOW, HIGH];

export interface RhythmEntry {
	/** Stable id. */
	id: string;
	/** How the beat sounds, in child words: "panjang" or "pendek". */
	name: string;
	/** Emoji cue. */
	icon: string;
	/** Relative duration in beats. */
	beats: number;
}

export const RHYTHMS: RhythmEntry[] = [
	{ id: 'panjang', name: 'Panjang', icon: '🥁', beats: 2 },
	{ id: 'pendek', name: 'Pendek', icon: '🔔', beats: 1 }
];

/**
 * A four-beat rhythm the child can clap back, or predict the end of.
 *
 * `beats` is read left to right as a rhythm cell: `[2, 1, 1, 2]` means long,
 * short, short, long. Kept as data so the mission table stays declarative and
 * the panel can draw one dot per beat without re-deriving anything.
 */
export interface RhythmPattern {
	/** The beat lengths, in order. */
	beats: number[];
	/** The beat length the child should supply next. */
	answer: number;
}

export function getPitch(id: string): PitchEntry | undefined {
	return PITCHES.find((p) => p.id === id);
}

export function getRhythm(id: string): RhythmEntry | undefined {
	return RHYTHMS.find((r) => r.id === id);
}

/** Whether a beat length is one the game offers. */
export function isKnownBeat(beats: number): boolean {
	return RHYTHMS.some((r) => r.beats === beats);
}
