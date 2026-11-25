/**
 * Reading content for Kota Membaca.
 *
 * Indonesian syllables are blissfully simple: almost all are consonant+vowel
 * (BA, BI, BU, BE, BO), which is why syllable building works for a five year
 * old where English phonics would not.
 */

export interface SyllableWordEntry {
	/** The finished word, e.g. "BAJU". */
	word: string;
	/** The syllables, in order, e.g. ["BA", "JU"]. */
	syllables: string[];
	/** Emoji illustration of the object. */
	icon: string;
	/** Spoken once the word is assembled: "BA-JU, BAJU!" */
	spoken: string;
}

export const SYLLABLE_WORDS: SyllableWordEntry[] = [
	{ word: 'BAJU', syllables: ['BA', 'JU'], icon: '👕', spoken: 'BA JU, BAJU!' },
	{ word: 'BOLA', syllables: ['BO', 'LA'], icon: '⚽', spoken: 'BO LA, BOLA!' },
	{ word: 'BUKU', syllables: ['BU', 'KU'], icon: '📗', spoken: 'BU KU, BUKU!' },
	{ word: 'MATA', syllables: ['MA', 'TA'], icon: '👁️', spoken: 'MA TA, MATA!' },
	{ word: 'SAPI', syllables: ['SA', 'PI'], icon: '🐄', spoken: 'SA PI, SAPI!' },
	{ word: 'ROTI', syllables: ['RO', 'TI'], icon: '🍞', spoken: 'RO TI, ROTI!' }
];

/** All syllables used by the reading activity, for the block palette. */
export const SYLLABLES: string[] = [
	...['BA', 'BI', 'BU', 'BE', 'BO'],
	...['MA', 'MI', 'MU', 'ME', 'MO'],
	...['SA', 'SI', 'SU', 'SE', 'SO'],
	...['JU', 'LA', 'KU', 'TA', 'PI', 'TI', 'RO', 'DA', 'NA', 'RI'],
	// Inserted in the order the activity expects to display them, then deduped.
].filter((s, i, arr) => arr.indexOf(s) === i);

export function getWord(word: string): SyllableWordEntry | undefined {
	return SYLLABLE_WORDS.find((w) => w.word === word.toUpperCase());
}
