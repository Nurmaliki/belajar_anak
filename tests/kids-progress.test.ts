import { describe, expect, it } from 'vitest';
import {
	PROGRESS_VERSION,
	emptyProgress,
	migrateProgress,
	validateProgress
} from '../src/lib/kids/game/ProgressTypes';

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
});
