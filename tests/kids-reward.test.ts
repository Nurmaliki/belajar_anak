import { describe, expect, it } from 'vitest';
import { emptyProgress } from '../src/lib/kids/game/ProgressTypes';
import { applyMissionResult, applyMissionIntroduced, unlockedAreas } from '../src/lib/kids/game/MissionReward';
import { getMission, MISSIONS } from '../src/lib/kids/data/missions';
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

describe('animal, shape and colour missions record what they teach', () => {
	// Regression: these three mission builders used to emit `teaches: {}`.
	// A child could complete every animal, shape and colour mission and the
	// parent dashboard would still report nothing was learned, because there
	// was nothing in the record for the dashboard to read.
	const shape = getMission('shape-lingkaran')!;

	it('the animal mission names its animal in `teaches`', () => {
		expect(animal.teaches?.animals, 'animal mission teaches nothing').toEqual(['Sapi']);
	});

	it('the shape mission names its shape in `teaches`', () => {
		expect(shape.teaches?.shapes, 'shape mission teaches nothing').toEqual(['Lingkaran']);
	});

	it('the colour mission names its colour in `teaches`', () => {
		expect(color.teaches?.colors, 'colour mission teaches nothing').toEqual(['Merah']);
	});

	it('completing an animal mission records the animal as correct', () => {
		const p = applyMissionResult(emptyProgress(), animal);
		expect(p.learningProgress.correctAnimals).toEqual(['Sapi']);
		expect(p.learningProgress.introducedAnimals).toEqual(['Sapi']);
	});

	it('completing a shape mission records the shape as correct', () => {
		const p = applyMissionResult(emptyProgress(), shape);
		expect(p.learningProgress.correctShapes).toEqual(['Lingkaran']);
	});

	it('completing a colour mission records the colour as correct', () => {
		const p = applyMissionResult(emptyProgress(), color);
		expect(p.learningProgress.correctColors).toEqual(['Merah']);
	});

	it('seeing a mission records the content as introduced but not correct', () => {
		const p = applyMissionIntroduced(emptyProgress(), animal);
		expect(p.learningProgress.introducedAnimals).toEqual(['Sapi']);
		expect(p.learningProgress.correctAnimals).toEqual([]);
	});

	it('replaying a mission does not duplicate the entry', () => {
		let p = applyMissionResult(emptyProgress(), animal);
		p = applyMissionResult(p, animal);
		expect(p.learningProgress.correctAnimals).toEqual(['Sapi']);
	});

	it('every mission teaches something', () => {
		// A mission with no learning content cannot feed the dashboard. If one
		// is ever added deliberately, this test is the place to record why.
		for (const mission of Object.values(MISSIONS)) {
			const t = mission.teaches ?? {};
			const count =
				(t.numbers?.length ?? 0) +
				(t.letters?.length ?? 0) +
				(t.syllables?.length ?? 0) +
				(t.animals?.length ?? 0) +
				(t.shapes?.length ?? 0) +
				(t.colors?.length ?? 0) +
				(t.music?.length ?? 0);
			expect(count, `${mission.id} teaches nothing the dashboard can record`).toBeGreaterThan(0);
		}
	});
});
