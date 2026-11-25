import { describe, expect, it } from 'vitest';
import {
	PROGRESS_VERSION,
	emptyProgress,
	migrateProgress,
	validateProgress
} from '../src/lib/kids/game/ProgressTypes';
import { ProgressRepository } from '../src/lib/kids/storage/ProgressRepository';

/**
 * Version 2 added `wearing` — which accessory Bubu has on.
 *
 * A child who played on version 1 has a stored record with no such field. That
 * record must load, keep every star, and come back wearing nothing — not be
 * rejected as corrupt, and not be silently reset.
 */
describe('migrating a version-1 record', () => {
	const v1 = {
		version: 1,
		totalStars: 7,
		unlockedAreas: ['counting', 'animals'],
		completedMissions: ['count-apples-3', 'animal-kucing'],
		learningProgress: {
			introducedNumbers: [3],
			correctNumbers: [3],
			introducedLetters: ['K'],
			correctLetters: ['K'],
			introducedSyllables: [],
			correctSyllables: []
		},
		totalPlayTimeSeconds: 420,
		lastPlayedAt: '2025-01-01T10:00:00.000Z'
	};

	it('defaults to wearing nothing', () => {
		const migrated = migrateProgress(v1) as Record<string, unknown>;
		expect(migrated.wearing).toBe('none');
	});

	it('bumps the version', () => {
		const migrated = migrateProgress(v1) as Record<string, unknown>;
		expect(migrated.version).toBe(PROGRESS_VERSION);
	});

	it('keeps every star, mission and minute', () => {
		const migrated = migrateProgress(v1);
		const result = validateProgress(migrated);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.totalStars).toBe(7);
		expect(result.value.completedMissions).toEqual(v1.completedMissions);
		expect(result.value.totalPlayTimeSeconds).toBe(420);
		expect(result.value.lastPlayedAt).toBe(v1.lastPlayedAt);
	});

	it('does not mutate the input record', () => {
		const copy = JSON.parse(JSON.stringify(v1));
		migrateProgress(v1);
		expect(v1).toEqual(copy);
	});

	it('accepts a version-1 record even without running the migration first', () => {
		// `validateProgress` is the last line of defence: it must repair too.
		const result = validateProgress(v1);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.wearing).toBe('none');
	});
});

describe('validating `wearing`', () => {
	it('keeps a real accessory id', () => {
		const result = validateProgress({ ...emptyProgress(), wearing: 'mahkota' });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.wearing).toBe('mahkota');
	});

	it('falls back to "none" for a non-string', () => {
		const result = validateProgress({ ...emptyProgress(), wearing: 42 });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.wearing).toBe('none');
	});

	it('falls back to "none" for an empty string', () => {
		const result = validateProgress({ ...emptyProgress(), wearing: '' });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.wearing).toBe('none');
	});

	it('does not reject an id the catalogue no longer knows', () => {
		// Storage's job is to return what was saved. Deciding that an id is
		// unknown belongs to the catalogue, at render time.
		const result = validateProgress({ ...emptyProgress(), wearing: 'topi-lama' });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.wearing).toBe('topi-lama');
	});

	it('a brand-new record wears nothing', () => {
		expect(emptyProgress().wearing).toBe('none');
	});
});

describe('ProgressRepository.setWearing', () => {
	it('records the choice', () => {
		const p = ProgressRepository.setWearing(emptyProgress(), 'syal-biru');
		expect(p.wearing).toBe('syal-biru');
	});

	it('returns the same object when nothing changes', () => {
		const p = ProgressRepository.setWearing(emptyProgress(), 'syal-biru');
		expect(ProgressRepository.setWearing(p, 'syal-biru')).toBe(p);
	});

	it('does not touch stars, which are a record, not a wallet', () => {
		const rich = { ...emptyProgress(), totalStars: 12 };
		const dressed = ProgressRepository.setWearing(rich, 'mahkota');
		expect(dressed.totalStars).toBe(12);
	});

	it('can take everything off again', () => {
		let p = ProgressRepository.setWearing(emptyProgress(), 'mahkota');
		p = ProgressRepository.setWearing(p, 'none');
		expect(p.wearing).toBe('none');
	});
});
