/**
 * The persisted shape of a child's progress.
 *
 * `version` gates migration. Nothing here identifies the child: no name, no
 * age, no email. It is a tally of what was shown and what was answered
 * correctly, and it never leaves the device.
 */

export const PROGRESS_VERSION = 2;

export interface LearningProgress {
	introducedNumbers: number[];
	correctNumbers: number[];
	introducedLetters: string[];
	correctLetters: string[];
	introducedSyllables: string[];
	correctSyllables: string[];
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
			correctSyllables: []
		},
		totalPlayTimeSeconds: 0,
		lastPlayedAt: null,
		wearing: 'none'
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
				correctSyllables
			},
			totalPlayTimeSeconds,
			lastPlayedAt: lastPlayedAt ?? base.lastPlayedAt,
			wearing
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
	return { ...obj, version: PROGRESS_VERSION };
}
