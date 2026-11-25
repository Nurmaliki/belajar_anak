/**
 * Indonesian number content for Pulau Berhitung.
 *
 * "introduced" and "correct" tracking both key off `value`, so a number is only
 * ever represented once here.
 */

export interface NumberEntry {
	value: number;
	/** The Indonesian word, as spoken and printed. */
	word: string;
	/** Emoji shown as the quantity illustration. */
	icon: string;
}

export const NUMBERS: NumberEntry[] = [
	{ value: 1, word: 'satu', icon: '🍎' },
	{ value: 2, word: 'dua', icon: '🍎' },
	{ value: 3, word: 'tiga', icon: '🍎' },
	{ value: 4, word: 'empat', icon: '🍎' },
	{ value: 5, word: 'lima', icon: '🍎' },
	{ value: 6, word: 'enam', icon: '🍎' },
	{ value: 7, word: 'tujuh', icon: '🍎' },
	{ value: 8, word: 'delapan', icon: '🍎' },
	{ value: 9, word: 'sembilan', icon: '🍎' },
	{ value: 10, word: 'sepuluh', icon: '🍎' }
];

const BY_VALUE = new Map(NUMBERS.map((n) => [n.value, n]));

export function numberWord(value: number): string {
	return BY_VALUE.get(value)?.word ?? String(value);
}

/** The counting words spoken as each object is tapped, in order. */
const ORDINALS = ['satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh'];

/**
 * The word for "the nth object counted".
 *
 * Deliberately separate from `numberWord`: counting aloud uses the ordinal
 * sequence, and it must stay in step with `value` for 1..10.
 */
export function countingWord(n: number): string {
	return ORDINALS[n - 1] ?? String(n);
}
