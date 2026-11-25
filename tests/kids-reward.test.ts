import { describe, expect, it } from 'vitest';
import { emptyProgress } from '../src/lib/kids/game/ProgressTypes';
import { applyMissionResult, applyMissionIntroduced, unlockedAreas } from '../src/lib/kids/game/MissionReward';
import { getMission } from '../src/lib/kids/data/missions';
import { ProgressRepository } from '../src/lib/kids/storage/ProgressRepository';

const count = getMission('count-apples-3')!;
const letter = getMission('letter-b')!;
const read = getMission('read-ba')!;
const animal = getMission('animal-sapi')!;
const color = getMission('color-merah')!;

describe('applyMissionResult — stars', () => {
	it('awards the mission’s stars on the first completion', () => {
		const p = applyMissionResult(emptyProgress(), count);
		expect(p.totalStars).toBe(count.stars);
	});

	it('records the mission as completed', () => {
		const p = applyMissionResult(emptyProgress(), count);
		expect(p.completedMissions).toContain(count.id);
	});

	it('does not award the same mission’s stars twice', () => {
		let p = applyMissionResult(emptyProgress(), count);
		p = applyMissionResult(p, count);
		p = applyMissionResult(p, count);
		expect(p.totalStars).toBe(count.stars);
		expect(p.completedMissions.filter((m) => m === count.id)).toHaveLength(1);
	});

	it('accumulates stars across different missions', () => {
		let p = applyMissionResult(emptyProgress(), count);
		p = applyMissionResult(p, letter);
		expect(p.totalStars).toBe(count.stars + letter.stars);
	});
});

describe('applyMissionResult — learning record', () => {
	it('records the counted number as correct', () => {
		const p = applyMissionResult(emptyProgress(), count);
		expect(p.learningProgress.correctNumbers).toContain(3);
		expect(p.learningProgress.introducedNumbers).toContain(3);
	});

	it('records the letter as correct', () => {
		const p = applyMissionResult(emptyProgress(), letter);
		expect(p.learningProgress.correctLetters).toContain('B');
	});

	it('records both syllables of a reading mission', () => {
		const p = applyMissionResult(emptyProgress(), read);
		expect(p.learningProgress.correctSyllables).toEqual(expect.arrayContaining(['BA', 'JU']));
	});

	it('records nothing for a mission that teaches no tracked item', () => {
		const p = applyMissionResult(emptyProgress(), animal);
		expect(p.learningProgress.correctLetters).toEqual([]);
		expect(p.learningProgress.correctNumbers).toEqual([]);
		expect(p.learningProgress.correctSyllables).toEqual([]);
		// The child still earns the star and the completion.
		expect(p.totalStars).toBe(animal.stars);
	});

	it('never duplicates a letter recorded twice', () => {
		let p = applyMissionResult(emptyProgress(), letter);
		p = applyMissionResult(p, letter);
		expect(p.learningProgress.correctLetters).toEqual(['B']);
	});
});

describe('applyMissionResult — area unlocking', () => {
	it('unlocks the area the mission belongs to', () => {
		const p = applyMissionResult(emptyProgress(), color);
		expect(p.unlockedAreas).toContain('colors');
		expect(unlockedAreas(p)).toEqual(['colors']);
	});

	it('starts with no unlocked areas', () => {
		expect(unlockedAreas(emptyProgress())).toEqual([]);
	});

	it('lists unlocked areas in island order, not insertion order', () => {
		let p = applyMissionResult(emptyProgress(), animal);
		p = applyMissionResult(p, count);
		// Island order puts counting before animals regardless of completion order.
		expect(unlockedAreas(p)).toEqual(['counting', 'animals']);
	});
});

describe('applyMissionIntroduced', () => {
	it('records the letter as introduced without marking it correct', () => {
		const p = applyMissionIntroduced(emptyProgress(), letter);
		expect(p.learningProgress.introducedLetters).toContain('B');
		expect(p.learningProgress.correctLetters).toEqual([]);
	});

	it('does not award a star merely for starting', () => {
		const p = applyMissionIntroduced(emptyProgress(), letter);
		expect(p.totalStars).toBe(0);
	});

	it('is idempotent', () => {
		let p = applyMissionIntroduced(emptyProgress(), read);
		p = applyMissionIntroduced(p, read);
		expect(p.learningProgress.introducedSyllables).toEqual(
			expect.arrayContaining(['BA', 'JU'])
		);
		expect(new Set(p.learningProgress.introducedSyllables).size).toBe(
			p.learningProgress.introducedSyllables.length
		);
	});
});

describe('applyMissionResult — does not mutate its input', () => {
	it('leaves the original record untouched', () => {
		const before = emptyProgress();
		const snapshot = JSON.parse(JSON.stringify(before));
		applyMissionResult(before, letter);
		expect(before).toEqual(snapshot);
	});
});

describe('ProgressRepository letter and syllable helpers', () => {
	it('introduceLetter upper-cases the letter', () => {
		const p = ProgressRepository.introduceLetter(emptyProgress(), 'b');
		expect(p.learningProgress.introducedLetters).toEqual(['B']);
	});

	it('correctLetter also introduces the letter', () => {
		const p = ProgressRepository.correctLetter(emptyProgress(), 'c');
		expect(p.learningProgress.introducedLetters).toEqual(['C']);
		expect(p.learningProgress.correctLetters).toEqual(['C']);
	});

	it('correctSyllable is idempotent', () => {
		let p = ProgressRepository.correctSyllable(emptyProgress(), 'ba');
		p = ProgressRepository.correctSyllable(p, 'BA');
		expect(p.learningProgress.correctSyllables).toEqual(['BA']);
	});
});
