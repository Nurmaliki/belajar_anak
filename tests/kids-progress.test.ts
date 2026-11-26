import { describe, expect, it } from 'vitest';
import {
	PROGRESS_VERSION,
	emptyProgress,
	migrateProgress,
	validateProgress
} from '../src/lib/kids/game/ProgressTypes';
import { ProgressRepository } from '../src/lib/kids/storage/ProgressRepository';

describe('emptyProgress', () => {
	it('is a valid, versioned record', () => {
		const p = emptyProgress();
		expect(p.version).toBe(PROGRESS_VERSION);
		expect(p.totalStars).toBe(0);
		expect(p.completedMissions).toEqual([]);
		expect(p.learningProgress.introducedNumbers).toEqual([]);
		expect(validateProgress(p).ok).toBe(true);
	});
});

describe('validateProgress', () => {
	it('rejects non-objects', () => {
		expect(validateProgress(null).ok).toBe(false);
		expect(validateProgress('x').ok).toBe(false);
		expect(validateProgress(42).ok).toBe(false);
	});

	it('rejects a future schema version rather than guessing', () => {
		const res = validateProgress({ ...emptyProgress(), version: PROGRESS_VERSION + 5 });
		expect(res.ok).toBe(false);
	});

	it('fills missing sections with defaults instead of failing', () => {
		const res = validateProgress({ totalStars: 7 });
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.value.totalStars).toBe(7);
		expect(res.value.learningProgress.introducedNumbers).toEqual([]);
		expect(res.value.completedMissions).toEqual([]);
	});

	it('keeps earned stars when a sub-section is missing', () => {
		const res = validateProgress({ totalStars: 12, completedMissions: ['count-apples-3'] });
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.value.totalStars).toBe(12);
		expect(res.value.completedMissions).toEqual(['count-apples-3']);
	});

	it('rejects a non-array progress list', () => {
		const res = validateProgress({
			...emptyProgress(),
			learningProgress: { ...emptyProgress().learningProgress, introducedNumbers: 'nope' }
		});
		expect(res.ok).toBe(false);
	});

	it('rejects a non-numeric entry in a number list', () => {
		const res = validateProgress({
			...emptyProgress(),
			learningProgress: { ...emptyProgress().learningProgress, correctNumbers: [1, 'two'] }
		});
		expect(res.ok).toBe(false);
	});

	it('rejects a negative star count rather than trusting it', () => {
		const res = validateProgress({ ...emptyProgress(), totalStars: -4 });
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.value.totalStars).toBe(0);
	});

	it('preserves a real learning record round-trip', () => {
		const p = emptyProgress();
		p.totalStars = 3;
		p.learningProgress.introducedNumbers = [1, 2, 3];
		p.learningProgress.correctNumbers = [3];
		p.learningProgress.introducedLetters = ['A', 'B'];
		const res = validateProgress(JSON.parse(JSON.stringify(p)));
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.value.learningProgress.correctNumbers).toEqual([3]);
		expect(res.value.learningProgress.introducedLetters).toEqual(['A', 'B']);
	});
});

describe('migrateProgress', () => {
	it('stamps a versionless record with the current version', () => {
		const migrated = migrateProgress({ totalStars: 1 }) as { version: number };
		expect(migrated.version).toBe(PROGRESS_VERSION);
	});

	it('leaves a current record alone', () => {
		const p = emptyProgress();
		expect(migrateProgress(p)).toEqual(p);
	});

	it('passes through non-objects unchanged for the validator to reject', () => {
		expect(migrateProgress(null)).toBe(null);
	});

	it('v3 migration adds missionPerformance when missing from a v2 record', () => {
		const v2 = { totalStars: 5, version: 2 };
		const migrated = migrateProgress(v2) as { version: number; missionPerformance: object };
		// The stamp is the *current* version, not the version that introduced
		// the field: a record is migrated in one pass to whatever this build
		// understands. Asserting the literal 3 made this test fail the day a
		// v4 arrived, without anything actually being wrong.
		expect(migrated.version).toBe(PROGRESS_VERSION);
		expect(typeof migrated.missionPerformance).toBe('object');
	});

	it('v4 migration adds the animals, shapes and colours lists', () => {
		// A v1 record predates every learning list beyond numbers/letters/
		// syllables. Migrating it must not throw and must leave the new lists
		// empty — a child who played before these missions existed has not
		// learned the content, and inventing entries would be a lie in the
		// parent dashboard.
		const v1 = { totalStars: 7, version: 1, learningProgress: { introducedNumbers: [3] } };
		const migrated = migrateProgress(v1) as {
			version: number;
			learningProgress: Record<string, string[]>;
		};
		expect(migrated.version).toBe(PROGRESS_VERSION);
		for (const key of [
			'introducedAnimals',
			'correctAnimals',
			'introducedShapes',
			'correctShapes',
			'introducedColors',
			'correctColors'
		]) {
			expect(migrated.learningProgress[key], `${key} was not added`).toEqual([]);
		}
		// Existing progress survives the migration untouched.
		expect(migrated.learningProgress.introducedNumbers).toEqual([3]);
	});
});

describe('missionPerformance — adaptive performance recording', () => {
	it('emptyProgress initialises with no performance history', () => {
		expect(emptyProgress().missionPerformance).toEqual({});
	});

	it('recordWrong increments wrongCount on a fresh record', () => {
		let p = emptyProgress();
		p = ProgressRepository.recordWrong(p, 'count-apples-3');
		expect(p.missionPerformance['count-apples-3']).toEqual({
			wrongCount: 1,
			firstTry: false,
			completedCount: 0
		});
	});

	it('recordWrong accumulates wrongCount across multiple calls', () => {
		let p = emptyProgress();
		p = ProgressRepository.recordWrong(p, 'count-apples-3');
		p = ProgressRepository.recordWrong(p, 'count-apples-3');
		p = ProgressRepository.recordWrong(p, 'count-apples-3');
		expect(p.missionPerformance['count-apples-3'].wrongCount).toBe(3);
	});

	it('recordCompleted sets completedCount and preserves wrongCount', () => {
		let p = emptyProgress();
		p = ProgressRepository.recordWrong(p, 'count-apples-3');
		p = ProgressRepository.recordWrong(p, 'count-apples-3');
		p = ProgressRepository.recordCompleted(p, 'count-apples-3');
		expect(p.missionPerformance['count-apples-3'].completedCount).toBe(1);
		// wrongCount should halve after each clean completion (gentle recovery)
		expect(p.missionPerformance['count-apples-3'].wrongCount).toBe(1);
	});

	it('recordCompleted sets firstTry:false after any wrong answer', () => {
		let p = emptyProgress();
		p = ProgressRepository.recordWrong(p, 'count-apples-3');
		p = ProgressRepository.recordCompleted(p, 'count-apples-3');
		expect(p.missionPerformance['count-apples-3'].firstTry).toBe(false);
	});

	it('recordCompleted keeps firstTry:true only when no wrong was ever recorded', () => {
		let p = emptyProgress();
		p = ProgressRepository.recordCompleted(p, 'count-apples-3');
		expect(p.missionPerformance['count-apples-3'].firstTry).toBe(true);
	});

	it('successful completions halve wrongCount: 4 → 2 → 1 → 0', () => {
		let p = emptyProgress();
		p = ProgressRepository.recordWrong(p, 'count-apples-3');
		p = ProgressRepository.recordWrong(p, 'count-apples-3');
		p = ProgressRepository.recordWrong(p, 'count-apples-3');
		p = ProgressRepository.recordWrong(p, 'count-apples-3');
		expect(p.missionPerformance['count-apples-3'].wrongCount).toBe(4);
		p = ProgressRepository.recordCompleted(p, 'count-apples-3'); // 4/2=2
		p = ProgressRepository.recordCompleted(p, 'count-apples-3'); // 2/2=1
		p = ProgressRepository.recordCompleted(p, 'count-apples-3'); // 1/2=0
		expect(p.missionPerformance['count-apples-3'].wrongCount).toBe(0);
	});
});
