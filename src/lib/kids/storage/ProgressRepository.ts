import Dexie, { type EntityTable } from 'dexie';
import {
	PROGRESS_VERSION,
	emptyProgress,
	migrateProgress,
	validateProgress,
	type ChildProgress
} from '../game/ProgressTypes';

/**
 * IndexedDB persistence for child progress.
 *
 * Browser-only by nature. Every method is defensive: private-mode Safari and
 * blocked storage both throw, and a child should still be able to play, so the
 * repository falls back to an in-memory mirror and reports `persistent: false`
 * rather than crashing.
 */

interface ProgressRecord {
	/** Always 1: one profile per device, no accounts. */
	id: number;
	progress: ChildProgress;
	updatedAt: string;
}

class KidsDatabase extends Dexie {
	progress!: EntityTable<ProgressRecord, 'id'>;

	constructor() {
		super('dunia-pintar-3d');
		this.version(1).stores({ progress: 'id' });
	}
}

const RECORD_ID = 1;

/**
 * Strip any reactivity from a progress record, leaving a plain cloneable object.
 *
 * JSON round-tripping is deliberate rather than `structuredClone`: it also
 * drops functions and class instances, which is exactly what we want to keep
 * out of the database. The record is plain data (numbers, strings, arrays), so
 * nothing is lost.
 */
function toPlainProgress(p: ChildProgress): ChildProgress {
	return JSON.parse(JSON.stringify(p)) as ChildProgress;
}

export class ProgressRepository {
	private db: KidsDatabase | null = null;
	private memory: ChildProgress = emptyProgress();
	/** False when IndexedDB is unavailable; progress then lives only in memory. */
	persistent = false;
	private lastError: string | null = null;

	/** Whether IndexedDB can actually be used right now. */
	static isAvailable(): boolean {
		return typeof indexedDB !== 'undefined';
	}

	async open(): Promise<void> {
		if (!ProgressRepository.isAvailable()) {
			this.persistent = false;
			this.lastError = 'IndexedDB tidak tersedia di browser ini.';
			return;
		}
		try {
			this.db = new KidsDatabase();
			await this.db.open();
			this.persistent = true;
		} catch (e) {
			this.persistent = false;
			this.db = null;
			this.lastError = e instanceof Error ? e.message : String(e);
		}
	}

	get error(): string | null {
		return this.lastError;
	}

	/** Load progress, migrating and validating whatever is stored. */
	async load(): Promise<ChildProgress> {
		if (!this.db) return { ...this.memory };
		try {
			const rec = await this.db.progress.get(RECORD_ID);
			if (!rec) {
				this.memory = emptyProgress();
				return this.memory;
			}
			const migrated = migrateProgress(rec.progress);
			const result = validateProgress(migrated);
			if (!result.ok) {
				// Corrupt save: keep stars if we can, otherwise start clean.
				this.lastError = `Data tersimpan tidak valid (${result.error}).`;
				const salvaged = validateProgress({
					...emptyProgress(),
					totalStars: rec.progress?.totalStars ?? 0
				});
				this.memory = salvaged.ok ? salvaged.value : emptyProgress();
				return this.memory;
			}
			this.memory = result.value;
			return result.value;
		} catch (e) {
			this.lastError = e instanceof Error ? e.message : String(e);
			return { ...this.memory };
		}
	}

	/** Persist progress. Always updates the in-memory mirror first. */
	async save(progress: ChildProgress): Promise<boolean> {
		// Copy to a plain object before storing.
		//
		// IndexedDB structured-clones what it is given, and a Svelte 5 `$state`
		// value is a *Proxy*, which `structuredClone` refuses with
		// `DataCloneError`. The caller is allowed to hand us reactive state, so
		// the copy happens here rather than being a rule callers must remember.
		const plain = toPlainProgress(progress);
		// Stamp the record so a stale write cannot resurrect an older shape.
		const toStore: ChildProgress = {
			...plain,
			version: PROGRESS_VERSION,
			lastPlayedAt: new Date().toISOString()
		};
		this.memory = toStore;
		if (!this.db) return false;
		try {
			await this.db.progress.put({ id: RECORD_ID, progress: toStore, updatedAt: new Date().toISOString() });
			return true;
		} catch (e) {
			this.lastError = e instanceof Error ? e.message : String(e);
			return false;
		}
	}

	/** Wipe everything. Used by the parent reset control. */
	async reset(): Promise<void> {
		this.memory = emptyProgress();
		if (!this.db) return;
		try {
			await this.db.progress.clear();
		} catch (e) {
			this.lastError = e instanceof Error ? e.message : String(e);
		}
	}

	/** Record that a number was shown to the child. */
	static introduceNumber(p: ChildProgress, value: number): ChildProgress {
		if (p.learningProgress.introducedNumbers.includes(value)) return p;
		return {
			...p,
			learningProgress: {
				...p.learningProgress,
				introducedNumbers: [...p.learningProgress.introducedNumbers, value]
			}
		};
	}

	/** Record that the child answered a number correctly. */
	static correctNumber(p: ChildProgress, value: number): ChildProgress {
		const introduced = p.learningProgress.introducedNumbers.includes(value)
			? p.learningProgress.introducedNumbers
			: [...p.learningProgress.introducedNumbers, value];
		const correct = p.learningProgress.correctNumbers.includes(value)
			? p.learningProgress.correctNumbers
			: [...p.learningProgress.correctNumbers, value];
		return {
			...p,
			learningProgress: {
				...p.learningProgress,
				introducedNumbers: introduced,
				correctNumbers: correct
			}
		};
	}

	/** Record a completed mission and award its stars exactly once. */
	static completeMission(p: ChildProgress, missionId: string, stars: number): ChildProgress {
		if (p.completedMissions.includes(missionId)) return p;
		return {
			...p,
			completedMissions: [...p.completedMissions, missionId],
			totalStars: p.totalStars + stars
		};
	}

	/** Record that the child gave a wrong answer on a mission. */
	static recordWrong(p: ChildProgress, missionId: string): ChildProgress {
		const prev = p.missionPerformance[missionId] ?? {
			wrongCount: 0,
			completedCount: 0,
			firstTry: false
		};
		return {
			...p,
			missionPerformance: {
				...p.missionPerformance,
				[missionId]: { ...prev, wrongCount: prev.wrongCount + 1, firstTry: false }
			}
		};
	}

	/**
	 * Record that a mission was completed, updating its performance signal.
	 *
	 * Each successful completion halves the struggle weight (`wrongCount`), so
	 * a mission that was once hard stops being flagged as such once the child
	 * masters it — gentle, no permanent label. `firstTry` is sticky-once-true,
	 * i.e. it records "was ever finished cleanly", and a mission the child
	 * ever fumbled counts toward review regardless of later clean plays.
	 */
	static recordCompleted(p: ChildProgress, missionId: string): ChildProgress {
		const prev = p.missionPerformance[missionId] ?? {
			wrongCount: 0,
			completedCount: 0,
			firstTry: true
		};
		return {
			...p,
			missionPerformance: {
				...p.missionPerformance,
				[missionId]: {
					wrongCount: Math.floor(prev.wrongCount / 2),
					completedCount: prev.completedCount + 1,
					firstTry: prev.firstTry && prev.wrongCount === 0
				}
			}
		};
	}

	/** Record that a letter was shown to the child. */
	static introduceLetter(p: ChildProgress, letter: string): ChildProgress {
		const l = letter.toUpperCase();
		if (p.learningProgress.introducedLetters.includes(l)) return p;
		return {
			...p,
			learningProgress: {
				...p.learningProgress,
				introducedLetters: [...p.learningProgress.introducedLetters, l]
			}
		};
	}

	/** Record that the child answered a letter correctly. */
	static correctLetter(p: ChildProgress, letter: string): ChildProgress {
		const introduced = ProgressRepository.introduceLetter(p, letter);
		const l = letter.toUpperCase();
		if (introduced.learningProgress.correctLetters.includes(l)) return introduced;
		return {
			...introduced,
			learningProgress: {
				...introduced.learningProgress,
				correctLetters: [...introduced.learningProgress.correctLetters, l]
			}
		};
	}

	/** Record that a syllable was shown to the child. */
	static introduceSyllable(p: ChildProgress, syllable: string): ChildProgress {
		const s = syllable.toUpperCase();
		if (p.learningProgress.introducedSyllables.includes(s)) return p;
		return {
			...p,
			learningProgress: {
				...p.learningProgress,
				introducedSyllables: [...p.learningProgress.introducedSyllables, s]
			}
		};
	}

	/** Record that the child read a syllable correctly. */
	static correctSyllable(p: ChildProgress, syllable: string): ChildProgress {
		const introduced = ProgressRepository.introduceSyllable(p, syllable);
		const s = syllable.toUpperCase();
		if (introduced.learningProgress.correctSyllables.includes(s)) return introduced;
		return {
			...introduced,
			learningProgress: {
				...introduced.learningProgress,
				correctSyllables: [...introduced.learningProgress.correctSyllables, s]
			}
		};
	}

	/** Record that an animal was shown to the child. */
	static introduceAnimal(p: ChildProgress, animal: string): ChildProgress {
		if (p.learningProgress.introducedAnimals.includes(animal)) return p;
		return {
			...p,
			learningProgress: {
				...p.learningProgress,
				introducedAnimals: [...p.learningProgress.introducedAnimals, animal]
			}
		};
	}

	/** Record that the child recognised an animal. */
	static correctAnimal(p: ChildProgress, animal: string): ChildProgress {
		const introduced = ProgressRepository.introduceAnimal(p, animal);
		if (introduced.learningProgress.correctAnimals.includes(animal)) return introduced;
		return {
			...introduced,
			learningProgress: {
				...introduced.learningProgress,
				correctAnimals: [...introduced.learningProgress.correctAnimals, animal]
			}
		};
	}

	/** Record that a shape was shown to the child. */
	static introduceShape(p: ChildProgress, shape: string): ChildProgress {
		if (p.learningProgress.introducedShapes.includes(shape)) return p;
		return {
			...p,
			learningProgress: {
				...p.learningProgress,
				introducedShapes: [...p.learningProgress.introducedShapes, shape]
			}
		};
	}

	/** Record that the child recognised a shape. */
	static correctShape(p: ChildProgress, shape: string): ChildProgress {
		const introduced = ProgressRepository.introduceShape(p, shape);
		if (introduced.learningProgress.correctShapes.includes(shape)) return introduced;
		return {
			...introduced,
			learningProgress: {
				...introduced.learningProgress,
				correctShapes: [...introduced.learningProgress.correctShapes, shape]
			}
		};
	}

	/** Record that a colour was shown to the child. */
	static introduceColor(p: ChildProgress, color: string): ChildProgress {
		if (p.learningProgress.introducedColors.includes(color)) return p;
		return {
			...p,
			learningProgress: {
				...p.learningProgress,
				introducedColors: [...p.learningProgress.introducedColors, color]
			}
		};
	}

	/** Record that the child recognised a colour. */
	static correctColor(p: ChildProgress, color: string): ChildProgress {
		const introduced = ProgressRepository.introduceColor(p, color);
		if (introduced.learningProgress.correctColors.includes(color)) return introduced;
		return {
			...introduced,
			learningProgress: {
				...introduced.learningProgress,
				correctColors: [...introduced.learningProgress.correctColors, color]
			}
		};
	}

	/** Record that a musical concept was shown to the child. */
	static introduceMusic(p: ChildProgress, concept: string): ChildProgress {
		if (p.learningProgress.introducedMusic.includes(concept)) return p;
		return {
			...p,
			learningProgress: {
				...p.learningProgress,
				introducedMusic: [...p.learningProgress.introducedMusic, concept]
			}
		};
	}

	/** Record that the child recognised a musical concept. */
	static correctMusic(p: ChildProgress, concept: string): ChildProgress {
		const introduced = ProgressRepository.introduceMusic(p, concept);
		if (introduced.learningProgress.correctMusic.includes(concept)) return introduced;
		return {
			...introduced,
			learningProgress: {
				...introduced.learningProgress,
				correctMusic: [...introduced.learningProgress.correctMusic, concept]
			}
		};
	}

	/** Add an area to the unlocked set. */
	static unlockArea(p: ChildProgress, areaId: string): ChildProgress {
		if (p.unlockedAreas.includes(areaId)) return p;
		return { ...p, unlockedAreas: [...p.unlockedAreas, areaId] };
	}

	/** Add elapsed seconds, ignoring nonsense values. */
	static addPlayTime(p: ChildProgress, seconds: number): ChildProgress {
		if (!Number.isFinite(seconds) || seconds <= 0) return p;
		return { ...p, totalPlayTimeSeconds: p.totalPlayTimeSeconds + Math.floor(seconds) };
	}

	/**
	 * Remember which accessory Bubu is wearing.
	 *
	 * No validation of the id belongs here: the catalogue, not storage, decides
	 * what exists, and an unknown id must fall back to "nothing" at render time
	 * rather than blocking a save.
	 */
	static setWearing(p: ChildProgress, accessoryId: string): ChildProgress {
		if (p.wearing === accessoryId) return p;
		return { ...p, wearing: accessoryId };
	}
}
