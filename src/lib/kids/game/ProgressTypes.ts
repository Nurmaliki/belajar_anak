/**
 * The persisted shape of a child's progress.
 *
 * `version` gates migration. Nothing here identifies the child: no name, no
 * age, no email. It is a tally of what was shown and what was answered
 * correctly, and it never leaves the device.
 */

export const PROGRESS_VERSION = 4;

/** Per-mission performance, recorded so the area rotation can adapt. */
export interface MissionPerformance {
	/** Number of wrong answers the child gave while trying this mission. */
	wrongCount: number;
	/** True when the mission was completed on the first try (no wrong answer). */
	firstTry: boolean;
	/** Number of times this mission has been completed. */
	completedCount: number;
}

export interface LearningProgress {
	introducedNumbers: number[];
	correctNumbers: number[];
	introducedLetters: string[];
	correctLetters: string[];
	introducedSyllables: string[];
	correctSyllables: string[];
	/**
	 * Animal names shown and recognised.
	 *
	 * Version 4 added these, together with the animals/shapes lists below. The
	 * animal and colour missions used to send `teaches: {}` — an empty object —
	 * so a child could finish every one of them and the dashboard still said
	 * nothing had been learned. Recording content the child *was not taught* is
	 * the bug this schema prevents: the field exists so `teaches` has somewhere
	 * honest to point.
	 */
	introducedAnimals: string[];
	correctAnimals: string[];
	/** Shape names (lingkaran, kotak, …) shown and recognised. */
	introducedShapes: string[];
	correctShapes: string[];
	/**
	 * Colour names recognised, from Kebun Warna's colour missions.
	 *
	 * Separate from shapes because the two are different skills even though
	 * they share an area: "this is merah" and "this is a segitiga" are not the
	 * same question, and a parent reading the dashboard should be able to see
	 * which one their child has practised.
	 */
	introducedColors: string[];
	correctColors: string[];
	/**
	 * Musical concepts recognised, from Pulau Musik.
	 *
	 * Values are the child-facing words themselves ("Tinggi", "Rendah"),
	 * not note names: a preschooler learning that a sound can be high or low
	 * has learned a concept, not a frequency. Storing "C5" would be true about
	 * the audio and false about the child.
	 */
	introducedMusic: string[];
	correctMusic: string[];
}

export interface ChildProgress {
	version: number;
	totalStars: number;
	unlockedAreas: string[];
	completedMissions: string[];
	learningProgress: LearningProgress;
	totalPlayTimeSeconds: number;
	lastPlayedAt: string | null;
	/**
	 * The accessory Bubu is wearing, by catalogue id.
	 *
	 * A preference, not an achievement: every accessory is available from the
	 * first launch. Defaults to `'none'`.
	 */
	wearing: string;
	/**
	 * Performance signal per mission id, for gentle adaptive difficulty.
	 * Keys absent mean "never attempted"; every call records here before any
	 * reward, so a mission a child struggles with is offered again sooner.
	 */
	missionPerformance: Record<string, MissionPerformance>;
}

export function emptyProgress(): ChildProgress {
	return {
		version: PROGRESS_VERSION,
		totalStars: 0,
		unlockedAreas: [],
		completedMissions: [],
		learningProgress: {
			introducedNumbers: [],
			correctNumbers: [],
			introducedLetters: [],
			correctLetters: [],
			introducedSyllables: [],
			correctSyllables: [],
			introducedAnimals: [],
			correctAnimals: [],
			introducedShapes: [],
			correctShapes: [],
			introducedColors: [],
			correctColors: [],
			introducedMusic: [],
			correctMusic: []
		},
		totalPlayTimeSeconds: 0,
		lastPlayedAt: null,
		wearing: 'none',
		missionPerformance: {}
	};
}

export type ValidationResult = { ok: true; value: ChildProgress } | { ok: false; error: string };

function numberArray(value: unknown, field: string): number[] | string {
	if (!Array.isArray(value)) return `${field} must be an array`;
	const out: number[] = [];
	for (const item of value) {
		if (typeof item !== 'number' || !Number.isFinite(item)) return `${field} contains a non-number`;
		out.push(item);
	}
	return out;
}

function stringArray(value: unknown, field: string): string[] | string {
	if (!Array.isArray(value)) return `${field} must be an array`;
	const out: string[] = [];
	for (const item of value) {
		if (typeof item !== 'string') return `${field} contains a non-string`;
		out.push(item);
	}
	return out;
}

/**
 * Validate, repair what is safely repairable, and reject what is not.
 *
 * Repair rather than reject matters here: a partially corrupt save should not
 * wipe a child's stars. Missing sections are filled with empty defaults, while
 * the top-level shape being entirely wrong is an error.
 */
export function validateProgress(raw: unknown): ValidationResult {
	if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'progress must be an object' };
	const obj = raw as Record<string, unknown>;
	const base = emptyProgress();

	const version = typeof obj.version === 'number' ? obj.version : PROGRESS_VERSION;
	if (version > PROGRESS_VERSION) {
		return { ok: false, error: `progress version ${version} is newer than this app understands` };
	}

	const totalStars = typeof obj.totalStars === 'number' && obj.totalStars >= 0 ? obj.totalStars : 0;
	const totalPlayTimeSeconds =
		typeof obj.totalPlayTimeSeconds === 'number' && obj.totalPlayTimeSeconds >= 0
			? obj.totalPlayTimeSeconds
			: 0;
	const lastPlayedAt = typeof obj.lastPlayedAt === 'string' ? obj.lastPlayedAt : null;
	// A missing or non-string `wearing` (a version-1 record) falls back to
	// "nothing on"; `resolveWearing` handles an id that no longer exists.
	const wearing = typeof obj.wearing === 'string' && obj.wearing ? obj.wearing : 'none';

	const missionPerformance: Record<string, MissionPerformance> = {};
	const perfRaw =
		typeof obj.missionPerformance === 'object' && obj.missionPerformance !== null
			? (obj.missionPerformance as Record<string, unknown>)
			: {};
	for (const [id, p] of Object.entries(perfRaw)) {
		const rec = (typeof p === 'object' && p !== null ? p : {}) as Record<string, unknown>;
		const wrongCount = typeof rec.wrongCount === 'number' && rec.wrongCount >= 0 ? Math.floor(rec.wrongCount) : 0;
		const completedCount =
			typeof rec.completedCount === 'number' && rec.completedCount >= 0 ? Math.floor(rec.completedCount) : 0;
		missionPerformance[id] = {
			wrongCount,
			completedCount,
			firstTry: typeof rec.firstTry === 'boolean' ? rec.firstTry : wrongCount === 0 && completedCount === 0
		};
	}

	const unlockedAreas = stringArray(obj.unlockedAreas ?? [], 'unlockedAreas');
	if (typeof unlockedAreas === 'string') return { ok: false, error: unlockedAreas };
	const completedMissions = stringArray(obj.completedMissions ?? [], 'completedMissions');
	if (typeof completedMissions === 'string') return { ok: false, error: completedMissions };

	const lpRaw = (typeof obj.learningProgress === 'object' && obj.learningProgress !== null
		? obj.learningProgress
		: {}) as Record<string, unknown>;

	const introducedNumbers = numberArray(lpRaw.introducedNumbers ?? [], 'introducedNumbers');
	if (typeof introducedNumbers === 'string') return { ok: false, error: introducedNumbers };
	const correctNumbers = numberArray(lpRaw.correctNumbers ?? [], 'correctNumbers');
	if (typeof correctNumbers === 'string') return { ok: false, error: correctNumbers };
	const introducedLetters = stringArray(lpRaw.introducedLetters ?? [], 'introducedLetters');
	if (typeof introducedLetters === 'string') return { ok: false, error: introducedLetters };
	const correctLetters = stringArray(lpRaw.correctLetters ?? [], 'correctLetters');
	if (typeof correctLetters === 'string') return { ok: false, error: correctLetters };
	const introducedSyllables = stringArray(lpRaw.introducedSyllables ?? [], 'introducedSyllables');
	if (typeof introducedSyllables === 'string') return { ok: false, error: introducedSyllables };
	const correctSyllables = stringArray(lpRaw.correctSyllables ?? [], 'correctSyllables');
	if (typeof correctSyllables === 'string') return { ok: false, error: correctSyllables };
	const introducedAnimals = stringArray(lpRaw.introducedAnimals ?? [], 'introducedAnimals');
	if (typeof introducedAnimals === 'string') return { ok: false, error: introducedAnimals };
	const correctAnimals = stringArray(lpRaw.correctAnimals ?? [], 'correctAnimals');
	if (typeof correctAnimals === 'string') return { ok: false, error: correctAnimals };
	const introducedShapes = stringArray(lpRaw.introducedShapes ?? [], 'introducedShapes');
	if (typeof introducedShapes === 'string') return { ok: false, error: introducedShapes };
	const correctShapes = stringArray(lpRaw.correctShapes ?? [], 'correctShapes');
	if (typeof correctShapes === 'string') return { ok: false, error: correctShapes };
	const introducedColors = stringArray(lpRaw.introducedColors ?? [], 'introducedColors');
	if (typeof introducedColors === 'string') return { ok: false, error: introducedColors };
	const correctColors = stringArray(lpRaw.correctColors ?? [], 'correctColors');
	if (typeof correctColors === 'string') return { ok: false, error: correctColors };
	const introducedMusic = stringArray(lpRaw.introducedMusic ?? [], 'introducedMusic');
	if (typeof introducedMusic === 'string') return { ok: false, error: introducedMusic };
	const correctMusic = stringArray(lpRaw.correctMusic ?? [], 'correctMusic');
	if (typeof correctMusic === 'string') return { ok: false, error: correctMusic };

	return {
		ok: true,
		value: {
			version: PROGRESS_VERSION,
			totalStars,
			unlockedAreas,
			completedMissions,
			learningProgress: {
				introducedNumbers,
				correctNumbers,
				introducedLetters,
				correctLetters,
				introducedSyllables,
				correctSyllables,
				introducedAnimals,
				correctAnimals,
				introducedShapes,
				correctShapes,
				introducedColors,
				correctColors,
				introducedMusic,
				correctMusic
			},
			totalPlayTimeSeconds,
			lastPlayedAt: lastPlayedAt ?? base.lastPlayedAt,
			wearing,
			missionPerformance
		}
	};
}

/**
 * A plain, storage-free record of the small preferences.
 *
 * The wardrobe is not an achievement: it has no unlock condition and nothing in
 * it can be lost, because nothing in it can be earned. So it does not belong in
 * the progress database — and keeping it there cost the child their outfit every
 * time IndexedDB was unavailable (private mode, a full disk, a locked-down
 * WebView), even though `localStorage` was working perfectly well.
 *
 * `localStorage` is the right size of tool: one short string, read once at
 * start-up. Every access is guarded, because a browser in private mode raises on
 * *access*, not just on write.
 */
const WEARING_KEY = 'dunia-pintar-wearing';

/** The remembered accessory id, or `'none'`. Never throws. */
export function readWearingPreference(): string {
	try {
		if (typeof localStorage === 'undefined') return 'none';
		return localStorage.getItem(WEARING_KEY) ?? 'none';
	} catch {
		return 'none';
	}
}

/** Remember an accessory. Silently does nothing where storage is refused. */
export function writeWearingPreference(accessoryId: string): void {
	try {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(WEARING_KEY, accessoryId);
	} catch {
		/* the child still wears it for this session */
	}
}

/**
 * Bring an older stored record up to the current version.
 *
 * Version 2 added `wearing` (the accessory Bubu has on). A version-1 record
 * simply has nothing on, which is also the correct default for a child who
 * never opened the dressing-up box — so the migration is a default, not a
 * guess. `validateProgress` repairs the field either way; this keeps parity
 * so the *next* schema change has an obvious home.
 */
export function migrateProgress(raw: unknown): unknown {
	if (typeof raw !== 'object' || raw === null) return raw;
	const obj = { ...(raw as Record<string, unknown>) };
	const version = typeof obj.version === 'number' ? obj.version : 0;
	if (version >= PROGRESS_VERSION) return obj;

	if (version < 2 && typeof obj.wearing !== 'string') obj.wearing = 'none';
	// Version 3 added `missionPerformance` (gentle adaptive difficulty). A
	// v2 record simply has no performance history, which is the correct
	// default: nothing adapted yet.
	if (typeof obj.missionPerformance !== 'object') obj.missionPerformance = {};
	// Version 4 added the animals and shapes learning lists. An older record
	// has simply never had them tracked — the animal and colour missions sent
	// an empty `teaches`, so there is nothing to recover and empty is the
	// truthful answer. `validateProgress` fills them either way; doing it here
	// keeps every schema change in one visible place.
	if (typeof obj.learningProgress !== 'object' || obj.learningProgress === null) {
		obj.learningProgress = {};
	}
	const lp = obj.learningProgress as Record<string, unknown>;
	for (const key of [
		'introducedAnimals',
		'correctAnimals',
		'introducedShapes',
		'correctShapes',
		'introducedColors',
		'correctColors',
		'introducedMusic',
		'correctMusic'
	]) {
		if (!Array.isArray(lp[key])) lp[key] = [];
	}
	obj.learningProgress = lp;
	return { ...obj, version: PROGRESS_VERSION };
}
