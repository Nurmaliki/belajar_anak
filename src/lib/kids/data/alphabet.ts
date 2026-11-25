/**
 * Indonesian alphabet content for Hutan Huruf.
 *
 * Each letter carries a familiar object, which is the whole point of the
 * activity: a child of three does not learn "B" in the abstract, they learn
 * "B like bola".
 */

export interface LetterEntry {
	letter: string;
	/** Example word, capitalised the way it is shown on the tree. */
	word: string;
	/** Emoji illustration for the example word. */
	icon: string;
	isVowel: boolean;
	/** How the letter is pronounced in Indonesian, spelled out. */
	sound: string;
}

export const LETTERS: LetterEntry[] = [
	{ letter: 'A', word: 'Ayam', icon: '🐔', isVowel: true, sound: 'a' },
	{ letter: 'B', word: 'Bola', icon: '⚽', isVowel: false, sound: 'be' },
	{ letter: 'C', word: 'Cicak', icon: '🦎', isVowel: false, sound: 'ce' },
	{ letter: 'D', word: 'Dadu', icon: '🎲', isVowel: false, sound: 'de' },
	{ letter: 'E', word: 'Ember', icon: '🪣', isVowel: true, sound: 'e' },
	{ letter: 'F', word: 'Foto', icon: '📷', isVowel: false, sound: 'ef' },
	{ letter: 'G', word: 'Gajah', icon: '🐘', isVowel: false, sound: 'ge' },
	{ letter: 'H', word: 'Harimau', icon: '🐯', isVowel: false, sound: 'ha' },
	{ letter: 'I', word: 'Ikan', icon: '🐟', isVowel: true, sound: 'i' },
	{ letter: 'J', word: 'Jeruk', icon: '🍊', isVowel: false, sound: 'je' },
	{ letter: 'K', word: 'Kucing', icon: '🐱', isVowel: false, sound: 'ka' },
	{ letter: 'L', word: 'Lilin', icon: '🕯️', isVowel: false, sound: 'el' },
	{ letter: 'M', word: 'Mangga', icon: '🥭', isVowel: false, sound: 'em' },
	{ letter: 'N', word: 'Nanas', icon: '🍍', isVowel: false, sound: 'en' },
	{ letter: 'O', word: 'Ombak', icon: '🌊', isVowel: true, sound: 'o' },
	{ letter: 'P', word: 'Pisang', icon: '🍌', isVowel: false, sound: 'pe' },
	{ letter: 'Q', word: 'Quran', icon: '📖', isVowel: false, sound: 'ki' },
	{ letter: 'R', word: 'Rusa', icon: '🦌', isVowel: false, sound: 'er' },
	{ letter: 'S', word: 'Sapi', icon: '🐄', isVowel: false, sound: 'es' },
	{ letter: 'T', word: 'Topi', icon: '🎩', isVowel: false, sound: 'te' },
	{ letter: 'U', word: 'Ular', icon: '🐍', isVowel: true, sound: 'u' },
	{ letter: 'V', word: 'Vas', icon: '🏺', isVowel: false, sound: 've' },
	{ letter: 'W', word: 'Wortel', icon: '🥕', isVowel: false, sound: 'we' },
	{ letter: 'X', word: 'Xilofon', icon: '🎼', isVowel: false, sound: 'eks' },
	{ letter: 'Y', word: 'Yoyo', icon: '🪀', isVowel: false, sound: 'ye' },
	{ letter: 'Z', word: 'Zebra', icon: '🦓', isVowel: false, sound: 'zet' }
];

const BY_LETTER = new Map(LETTERS.map((l) => [l.letter, l]));

export function getLetter(letter: string): LetterEntry | undefined {
	return BY_LETTER.get(letter.toUpperCase());
}

export function vowelLetters(): string[] {
	return LETTERS.filter((l) => l.isVowel).map((l) => l.letter);
}

export function consonantLetters(): string[] {
	return LETTERS.filter((l) => !l.isVowel).map((l) => l.letter);
}
