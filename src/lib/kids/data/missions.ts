import type { AreaId, MissionDefinition } from '../types';
import type { MissionPerformance } from '../game/ProgressTypes';
import { countAndAnswerMission } from '../activities/counting/countingMission';
import { additionMission } from '../activities/addition/additionMission';
import { compareMission } from '../activities/compare/compareMission';
import { sortMission } from '../activities/sorting/sortMission';
import { subtractionMission } from '../activities/subtraction/subtractionMission';
import { choiceMission, assembleWordMission, distractors } from '../activities/choices/choiceMission';
import { LETTERS } from './alphabet';
import { SYLLABLE_WORDS, SYLLABLES } from './syllables';
import { ANIMALS } from './animals';
import { COLORS, SHAPES } from './colors';

/**
 * All missions, keyed by id.
 *
 * Content lives here so components stay generic. Counting missions come from
 * one helper because the three levels differ only in numbers; the rest are
 * built explicitly, because what each one *teaches* is the interesting part and
 * deserves to be readable rather than generated.
 *
 * Every area has a fixed rotation of missions; `AREA_START_MISSION` names the
 * one offered first, and finishing it advances to the next on a later visit
 * (see `nextMissionForArea`).
 */
/**
 * Look up content, and say which id was wrong when it is not there.
 *
 * These used to be `array.find(...)!`. A non-null assertion protects nothing;
 * it only silences the compiler. If a mission named an id that was not in its
 * dataset, the property access on `undefined` threw while this module was being
 * *evaluated* — taking down every route that imports it, including the parent
 * dashboard, with a stack trace that named no mission. Failing with the id in
 * the message turns "the whole app is broken" into "no animal with id bebek".
 */
function requireEntry<T>(list: readonly T[], match: (item: T) => boolean, what: string, id: string): T {
	const found = list.find(match);
	if (!found) throw new Error(`missions.ts: no ${what} with id "${id}"`);
	return found;
}

function countMission(
	id: string,
	title: string,
	instruction: string,
	count: number,
	target: number,
	choices: number[],
	stars = 1
): MissionDefinition {
	return countAndAnswerMission({
		id,
		title,
		instruction,
		collectCount: count,
		targetNumber: target,
		choices,
		stars,
		teaches: { numbers: [target] }
	});
}

/** The 26 letter labels, for building distractor buttons. */
const ALL_LETTERS = LETTERS.map((l) => l.letter);
/** Every animal name, used as picture-choice distractors across areas. */
const ALL_ANIMAL_NAMES = ANIMALS.map((a) => a.name);
/** Colour names, for the colour missions. */
const ALL_COLOR_NAMES = COLORS.map((c) => c.name);
/** Shape names, for the shape missions. */
const ALL_SHAPE_NAMES = SHAPES.map((s) => s.name);

function letterMission(
	id: string,
	letter: string,
	title: string,
	instruction: string,
	seed: number
): MissionDefinition {
	const entry = requireEntry(LETTERS, (l) => l.letter === letter, 'letter', letter);
	return choiceMission({
		id,
		area: 'alphabet',
		title,
		instruction,
		kind: 'pick-letter',
		answer: entry.letter,
		choices: [entry.letter, ...distractors(ALL_LETTERS, entry.letter, 3, seed)],
		teaches: { letters: [entry.letter] },
		// The picture only. The example word is *spoken* in the instruction
		// ("A seperti Ayam") and never printed here: showing "Ayam" beside the
		// chicken answers a different question than the one the buttons ask.
		prompt: { icon: entry.icon, caption: '' }
	});
}

function syllableMission(
	id: string,
	wordIndex: number,
	title: string,
	instruction: string
): MissionDefinition {
	const entry = SYLLABLE_WORDS[wordIndex];
	// The child picks the missing *first* syllable, with the rest of the word
	// shown. That is the smallest step from "hearing a word" to "reading it".
	const missing = entry.syllables[0];
	return choiceMission({
		id,
		area: 'reading',
		title,
		instruction,
		kind: 'build-syllables',
		answer: missing,
		choices: [missing, ...distractors(SYLLABLES, missing, 3, wordIndex)],
		teaches: { syllables: entry.syllables },
		// Show the whole word with the asked-for syllable blanked out.
		prompt: { icon: entry.icon, caption: `_${entry.syllables.slice(1).join('')}` }
	});
}

function animalMission(
	id: string,
	animalId: string,
	title: string,
	instruction: string,
	seed: number
): MissionDefinition {
	const entry = requireEntry(ANIMALS, (a) => a.id === animalId, 'animal', animalId);
	return choiceMission({
		id,
		area: 'animals',
		title,
		instruction,
		kind: 'pick-picture',
		answer: entry.name,
		choices: [entry.name, ...distractors(ALL_ANIMAL_NAMES, entry.name, 3, seed)],
		teaches: {},
		prompt: { icon: entry.icon, caption: entry.sound }
	});
}

function colorMission(
	id: string,
	colorName: string,
	title: string,
	instruction: string,
	seed: number
): MissionDefinition {
	const entry = requireEntry(COLORS, (c) => c.name === colorName, 'colour', colorName);
	return choiceMission({
		id,
		area: 'colors',
		title,
		instruction,
		kind: 'pick-picture',
		answer: colorName,
		choices: [colorName, ...distractors(ALL_COLOR_NAMES, colorName, 3, seed)],
		teaches: {},
		// A colour has no emoji of its own, so the prompt is a paint splat in
		// the colour being asked about would need a real swatch; the caption
		// carries the colour name instead and the swatch is drawn in CSS.
		prompt: { icon: '🎨', caption: `#${entry.hex.toString(16).padStart(6, '0')}` }
	});
}

/**
 * A shape-recognition mission.
 *
 * The prompt is the shape itself, drawn as real geometry in the panel — not an
 * emoji. The child matches an outline to a name, which is the same skill a
 * colour mission asks for; shapes are included because recognising a triangle
 * is a pre-reading skill that needs no letters at all.
 *
 * The caption is a `@shape:` marker rather than the shape's name. Printing the
 * name beside the picture would answer the question for a child who can read.
 */
function shapeMission(
	id: string,
	shapeId: string,
	title: string,
	instruction: string,
	seed: number
): MissionDefinition {
	const entry = requireEntry(SHAPES, (s) => s.id === shapeId, 'shape', shapeId);
	return choiceMission({
		id,
		area: 'colors',
		title,
		instruction,
		kind: 'pick-picture',
		answer: entry.name,
		choices: [entry.name, ...distractors(ALL_SHAPE_NAMES, entry.name, 3, seed)],
		teaches: {},
		prompt: { icon: entry.icon, caption: `@shape:${entry.draw}` }
	});
}

/**
 * A "assemble the whole word" mission.
 *
 * The child fills every slot, not just the first. This is the step beyond
 * `syllableMission`, which only asks for the leading syllable.
 */
function assembleMission(id: string, wordIndex: number, title: string, instruction: string): MissionDefinition {
	const entry = SYLLABLE_WORDS[wordIndex];
	const extra = distractors(SYLLABLES, entry.syllables[0], 2, wordIndex);
	return assembleWordMission({
		id,
		area: 'reading',
		title,
		instruction,
		answerSyllables: entry.syllables,
		choices: [...new Set([...entry.syllables, ...extra])],
		teaches: { syllables: entry.syllables },
		prompt: { icon: entry.icon, caption: entry.word.replace(/[A-Z]/g, '_') }
	});
}

export const MISSIONS: Record<string, MissionDefinition> = {
	// --- Pulau Berhitung ----------------------------------------------------
	'count-apples-3': countMission(
		'count-apples-3',
		'Kumpulkan tiga apel',
		'Halo Bubu! Ayo kumpulkan tiga apel!',
		3,
		3,
		[1, 2, 3, 4, 5]
	),
	'count-apples-5': countMission(
		'count-apples-5',
		'Kumpulkan lima apel',
		'Ayo kumpulkan lima apel!',
		5,
		5,
		[3, 4, 5, 6, 7]
	),
	'count-apples-10': countMission(
		'count-apples-10',
		'Kumpulkan sepuluh apel',
		'Ayo kumpulkan sepuluh apel!',
		10,
		10,
		[7, 8, 9, 10]
	),
	'add-2-1': additionMission({
		id: 'add-2-1',
		title: 'Dua apel tambah satu',
		instruction: 'Lihat apelnya. Dua apel tambah satu apel. Ada berapa semuanya?',
		addends: [2, 1],
		choices: [2, 3, 4]
	}),
	'add-3-2': additionMission({
		id: 'add-3-2',
		title: 'Tiga apel tambah dua',
		instruction: 'Lihat apelnya. Tiga apel tambah dua apel. Ada berapa semuanya?',
		addends: [3, 2],
		choices: [4, 5, 6]
	}),
	'compare-more': compareMission({
		id: 'compare-more',
		title: 'Mana yang lebih banyak?',
		instruction: 'Lihat kedua kelompok apel. Mana yang lebih banyak?',
		left: 4,
		right: 2,
		mode: 'more'
	}),
	'compare-fewer': compareMission({
		id: 'compare-fewer',
		title: 'Mana yang lebih sedikit?',
		instruction: 'Lihat kedua kelompok apel. Mana yang lebih sedikit?',
		left: 3,
		right: 5,
		mode: 'fewer'
	}),
	'sort-three': sortMission({
		id: 'sort-three',
		title: 'Urutkan dari sedikit',
		instruction: 'Ayo urutkan apel dari yang paling sedikit sampai yang paling banyak. Ketuk dulu kelompok yang paling sedikit.',
		groups: [3, 1, 2]
	}),
	'sort-four': sortMission({
		id: 'sort-four',
		title: 'Urutkan empat kelompok',
		instruction: 'Sekarang empat kelompok. Ketuk kelompok apel yang paling sedikit dulu.',
		groups: [4, 2, 5, 3]
	}),
	'subtract-4-1': subtractionMission({
		id: 'subtract-4-1',
		title: 'Empat apel, satu diambil',
		instruction: 'Ada empat apel. Satu apel diambil Bubu. Sisa berapa apel?',
		start: 4,
		removed: 1,
		choices: [2, 3, 4]
	}),
	'subtract-5-2': subtractionMission({
		id: 'subtract-5-2',
		title: 'Lima apel, dua diambil',
		instruction: 'Ada lima apel. Dua apel diambil Bubu. Sisa berapa apel?',
		start: 5,
		removed: 2,
		choices: [2, 3, 4]
	}),

	// --- Hutan Huruf --------------------------------------------------------
	'letter-a': letterMission(
		'letter-a',
		'A',
		'Huruf A',
		'Huruf apa ini? A seperti Ayam.',
		0
	),
	'letter-b': letterMission(
		'letter-b',
		'B',
		'Huruf B',
		'Huruf apa ini? B seperti Bola.',
		2
	),
	'letter-i': letterMission(
		'letter-i',
		'I',
		'Huruf I',
		'Huruf apa ini? I seperti Ikan.',
		4
	),
	'letter-m': letterMission(
		'letter-m',
		'M',
		'Huruf M',
		'Huruf apa ini? M seperti Mangga.',
		6
	),
	'letter-c': letterMission('letter-c', 'C', 'Huruf C', 'Huruf apa ini? C seperti Cicak.', 8),
	'letter-d': letterMission('letter-d', 'D', 'Huruf D', 'Huruf apa ini? D seperti Dadu.', 10),
	'letter-e': letterMission('letter-e', 'E', 'Huruf E', 'Huruf apa ini? E seperti Ember.', 12),
	'letter-f': letterMission('letter-f', 'F', 'Huruf F', 'Huruf apa ini? F seperti Foto.', 14),
	'letter-g': letterMission('letter-g', 'G', 'Huruf G', 'Huruf apa ini? G seperti Gajah.', 16),
	'letter-h': letterMission('letter-h', 'H', 'Huruf H', 'Huruf apa ini? H seperti Harimau.', 18),
	'letter-j': letterMission('letter-j', 'J', 'Huruf J', 'Huruf apa ini? J seperti Jeruk.', 20),
	'letter-k': letterMission('letter-k', 'K', 'Huruf K', 'Huruf apa ini? K seperti Kucing.', 22),
	'letter-l': letterMission('letter-l', 'L', 'Huruf L', 'Huruf apa ini? L seperti Lilin.', 24),
	'letter-n': letterMission('letter-n', 'N', 'Huruf N', 'Huruf apa ini? N seperti Nanas.', 26),
	'letter-o': letterMission('letter-o', 'O', 'Huruf O', 'Huruf apa ini? O seperti Ombak.', 28),
	'letter-p': letterMission('letter-p', 'P', 'Huruf P', 'Huruf apa ini? P seperti Pisang.', 30),
	'letter-q': letterMission('letter-q', 'Q', 'Huruf Q', 'Huruf apa ini? Q seperti Quran.', 32),
	'letter-r': letterMission('letter-r', 'R', 'Huruf R', 'Huruf apa ini? R seperti Rusa.', 34),
	'letter-s': letterMission('letter-s', 'S', 'Huruf S', 'Huruf apa ini? S seperti Sapi.', 36),
	'letter-t': letterMission('letter-t', 'T', 'Huruf T', 'Huruf apa ini? T seperti Topi.', 38),
	'letter-u': letterMission('letter-u', 'U', 'Huruf U', 'Huruf apa ini? U seperti Ular.', 40),
	'letter-v': letterMission('letter-v', 'V', 'Huruf V', 'Huruf apa ini? V seperti Vas.', 42),
	'letter-w': letterMission('letter-w', 'W', 'Huruf W', 'Huruf apa ini? W seperti Wortel.', 44),
	'letter-x': letterMission('letter-x', 'X', 'Huruf X', 'Huruf apa ini? X seperti Xilofon.', 46),
	'letter-y': letterMission('letter-y', 'Y', 'Huruf Y', 'Huruf apa ini? Y seperti Yoyo.', 48),
	'letter-z': letterMission('letter-z', 'Z', 'Huruf Z', 'Huruf apa ini? Z seperti Zebra.', 50),

	// --- Kota Membaca -------------------------------------------------------
	'read-ba': syllableMission(
		'read-ba',
		0,
		'Baju',
		'Ayo susun kata BAJU. Suku kata pertama apa?'
	),
	'read-bo': syllableMission('read-bo', 1, 'Bola', 'Ayo susun kata BOLA. Suku kata pertama apa?'),
	'read-ma': syllableMission('read-ma', 3, 'Mata', 'Ayo susun kata MATA. Suku kata pertama apa?'),
	'read-ro': syllableMission('read-ro', 5, 'Roti', 'Ayo susun kata ROTI. Suku kata pertama apa?'),
	'assemble-baju': assembleMission(
		'assemble-baju',
		0,
		'Susun BAJU',
		'Ayo susun kata BAJU. Ketuk suku katanya satu per satu.'
	),
	'assemble-buku': assembleMission(
		'assemble-buku',
		2,
		'Susun BUKU',
		'Ayo susun kata BUKU. Ketuk suku katanya satu per satu.'
	),

	// --- Kebun Warna --------------------------------------------------------
	'color-merah': colorMission(
		'color-merah',
		'Merah',
		'Warna Merah',
		'Mana yang berwarna merah?',
		0
	),
	'color-biru': colorMission('color-biru', 'Biru', 'Warna Biru', 'Mana yang berwarna biru?', 3),
	'color-kuning': colorMission(
		'color-kuning',
		'Kuning',
		'Warna Kuning',
		'Mana yang berwarna kuning?',
		2
	),
	'shape-lingkaran': shapeMission(
		'shape-lingkaran',
		'lingkaran',
		'Bentuk Lingkaran',
		'Mana bentuk lingkaran? Lingkaran itu bulat.',
		0
	),
	'shape-segitiga': shapeMission(
		'shape-segitiga',
		'segitiga',
		'Bentuk Segitiga',
		'Mana bentuk segitiga? Segitiga punya tiga sisi.',
		2
	),
	'shape-kotak': shapeMission(
		'shape-kotak',
		'kotak',
		'Bentuk Kotak',
		'Mana bentuk kotak? Kotak punya empat sisi.',
		1
	),
	'shape-bintang': shapeMission(
		'shape-bintang',
		'bintang',
		'Bentuk Bintang',
		'Mana bentuk bintang? Bintang ada di langit malam.',
		3
	),

	// --- Hutan Hewan --------------------------------------------------------
	'animal-kucing': animalMission(
		'animal-kucing',
		'kucing',
		'Kucing',
		'Mana kucing? Kucing bersuara meong.',
		0
	),
	'animal-sapi': animalMission(
		'animal-sapi',
		'sapi',
		'Sapi',
		'Mana sapi? Sapi bersuara moo.',
		5
	),
	'animal-ayam': animalMission(
		'animal-ayam',
		'ayam',
		'Ayam',
		'Mana ayam? Ayam berkokok kukuruyuk.',
		3
	)
};

/** The order in which an area's missions are offered. */
export const AREA_ROTATION: Record<AreaId, string[]> = {
	counting: [
		'count-apples-3',
		'count-apples-5',
		'count-apples-10',
		'add-2-1',
		'add-3-2',
		'compare-more',
		'compare-fewer',
		'sort-three',
		'sort-four',
		'subtract-4-1',
		'subtract-5-2'
	],
	alphabet: [
		'letter-a',
		'letter-b',
		'letter-c',
		'letter-d',
		'letter-e',
		'letter-f',
		'letter-g',
		'letter-h',
		'letter-i',
		'letter-j',
		'letter-k',
		'letter-l',
		'letter-m',
		'letter-n',
		'letter-o',
		'letter-p',
		'letter-q',
		'letter-r',
		'letter-s',
		'letter-t',
		'letter-u',
		'letter-v',
		'letter-w',
		'letter-x',
		'letter-y',
		'letter-z'
	],
	reading: ['read-ba', 'read-bo', 'read-ma', 'read-ro', 'assemble-baju', 'assemble-buku'],
	colors: [
		'color-merah',
		'color-biru',
		'color-kuning',
		'shape-lingkaran',
		'shape-segitiga',
		'shape-kotak',
		'shape-bintang'
	],
	animals: ['animal-kucing', 'animal-sapi', 'animal-ayam']
};

/** The first mission of each area, which is what entering the area offers. */
export const AREA_START_MISSION: Record<AreaId, string> = {
	counting: 'count-apples-3',
	alphabet: 'letter-a',
	reading: 'read-ba',
	colors: 'color-merah',
	animals: 'animal-kucing'
};

export function getMission(id: string): MissionDefinition | undefined {
	return MISSIONS[id];
}

export function missionsForArea(area: AreaId): MissionDefinition[] {
	return Object.values(MISSIONS).filter((m) => m.area === area);
}

/**
 * The mission an area should offer next — gentle adaptive (ZPD): a child who
 * struggled with a mission is offered it again before anything new, so they
 * practise where they need it; a child who sails through keeps moving through
 * the rotation. All missions stay reachable and nothing is ever locked.
 *
 * `performance` maps mission id → { wrongCount, firstTry, completedCount }.
 * A mission the child is still struggling with (`wrongCount >= 2`) is offered
 * first. Otherwise the first *unfinished* mission in the rotation is offered
 * (the plain forward path), falling back to the start once the area is
 * finished so there is always something to do.
 */
export function nextMissionForArea(
	area: AreaId,
	completed: readonly string[],
	performance: Readonly<Record<string, MissionPerformance>> = {}
): string {
	const rotation = AREA_ROTATION[area];

	// A mission the child is *still* struggling with (unfinished, 2+ wrong
	// answers) is offered again before moving further along the rotation —
	// practise where it is needed. Gentle: only unfinished missions compete,
	// nothing is ever locked, and a single stumble never triggers this.
	for (const id of rotation) {
		if (completed.includes(id)) continue;
		if ((performance[id]?.wrongCount ?? 0) >= 2) return id;
	}

	// Plain forward path: the first unfinished mission in rotation order.
	const firstUnfinished = rotation.find((id) => !completed.includes(id));
	if (firstUnfinished) return firstUnfinished;

	// Area finished: keep it alive with the easiest win so replaying after
	// mastery feels smooth, not punishing.
	let best = rotation[0];
	for (const id of rotation) {
		const w = performance[id]?.wrongCount ?? 0;
		if (w < (performance[best]?.wrongCount ?? 0)) best = id;
	}
	return best;
}

/** Exposed so the menu can show how many missions each area holds. */
export function areaMissionCount(area: AreaId): number {
	return AREA_ROTATION[area].length;
}
