/**
 * Shared vocabulary for Dunia Pintar 3D.
 *
 * Kept free of Three.js and Svelte imports so the rules layer can be unit
 * tested in a plain node environment.
 */

/** The five learning areas of the island. */
export type AreaId = 'counting' | 'alphabet' | 'reading' | 'colors' | 'animals';

export interface AreaDefinition {
	id: AreaId;
	/** Shown in the HUD, e.g. "Pulau Berhitung". */
	name: string;
	/** One short line, spoken by the narrator when the area is entered. */
	tagline: string;
	/** Emoji used as a large, language-free icon on buttons. */
	icon: string;
	/** Where the area's landmark sits on the island. */
	position: { x: number; z: number };
	/** Colour of the landmark's banner, as a hex number. */
	color: number;
}

/**
 * Game phases.
 *
 * The FSM is explicit on purpose: a UI component that flips a flag on its own
 * is how a game ends up in two states at once. Every transition below is an
 * edge in `ALLOWED_TRANSITIONS`.
 */
export type GamePhase =
	| 'BOOT'
	| 'LOADING'
	| 'MAIN_MENU'
	| 'WORLD_EXPLORATION'
	| 'MISSION_INTRO'
	| 'MISSION_ACTIVE'
	| 'MISSION_SUCCESS'
	| 'PAUSED'
	| 'GAME_EXIT';

/** How a mission's question is answered, which decides the UI panel. */
export type AnswerMode = 'number' | 'letter' | 'syllables' | 'picture';

export type MissionKind =
	| 'count-and-answer'
	| 'pick-letter'
	| 'build-syllables'
	| 'pick-picture'
	/** Assemble a word by tapping its syllables in order. */
	| 'assemble-word'
	/** Two groups of objects, how many altogether. */
	| 'add-groups'
	/** Compare two groups: which has more, or fewer. */
	| 'compare-groups'
	/** Put three or more groups in order from fewest to most. */
	| 'sort-groups'
	/** Some objects are taken away; how many are left. */
	| 'subtract-groups';

export interface MissionDefinition {
	id: string;
	area: AreaId;
	/** Short title for the HUD. */
	title: string;
	/** Spoken instruction, in Indonesian. */
	instruction: string;
	/** What the child must do. */
	kind: MissionKind;
	/** How many pickable objects to scatter in the world, for count missions. */
	collectCount?: number;
	/** The number the child should answer, for count missions. */
	targetNumber?: number;
	/** The two groups to add, for `add-groups` missions. */
	addends?: [number, number];
	/** The two groups to compare, for `compare-groups` missions. */
	compare?: { left: number; right: number; mode: 'more' | 'fewer' };
	/**
	 * The groups to order, for `sort-groups` missions, in the order the child
	 * must build: fewest first. Stored sorted so the answer is never a lookup.
	 */
	sort?: number[];
	/**
	 * The groups to subtract, for `subtract-groups` missions: `start` objects,
	 * of which `removed` are taken away. Both counts, so the UI can draw the
	 * ones that stay and the ones that leave.
	 */
	subtract?: { start: number; removed: number };
	/**
	 * The correct choice, for every kind except counting.
	 *
	 * Counting keeps using `targetNumber` (a number the answer buttons compare
	 * against); the other kinds answer with a label — a letter, a syllable or
	 * an emoji — so it is stored as the same string that appears in `choices`.
	 */
	targetAnswer?: string;
	/**
	 * The full syllable sequence, for `assemble-word` missions.
	 *
	 * Unlike `targetAnswer`, this is the whole ordered answer: the child fills
	 * every slot, not just the first one.
	 */
	answerSyllables?: string[];
	/** Choices offered as big buttons. */
	choices: string[];
	/**
	 * The learning item this mission teaches, recorded in progress.
	 *
	 * Deliberately not derived from `title` or `choices`: progress must key off
	 * a stable, explicit value, or renaming a mission silently orphans a
	 * child's record of it.
	 */
	teaches?: {
		numbers?: number[];
		letters?: string[];
		syllables?: string[];
	};
	/**
	 * What the question panel shows above the answer buttons.
	 *
	 * Explicit rather than looked up from `title`, because the panel must not
	 * have to guess whether a mission is about a letter, a word or a picture —
	 * and because a lookup by title breaks the moment a title is reworded.
	 */
	prompt?: {
		/** Large glyph: an emoji, or the letter/syllable itself. */
		icon: string;
		/** Short caption printed beside it, e.g. the word being built. */
		caption: string;
	};
	/** Stars awarded on success. */
	stars: number;
}

/** A single spoken line. `id` keys the audio cache. */
export interface AudioLine {
	id: string;
	text: string;
}
