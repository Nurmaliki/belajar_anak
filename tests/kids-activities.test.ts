import { describe, expect, it } from 'vitest';
import { ChoiceSession } from '../src/lib/kids/activities/choices/ChoiceSession';
import { assembleWordMission } from '../src/lib/kids/activities/choices/choiceMission';
import { BuildSession } from '../src/lib/kids/activities/syllables/BuildSession';
import { AdditionSession } from '../src/lib/kids/activities/addition/AdditionSession';
import { additionMission } from '../src/lib/kids/activities/addition/additionMission';
import { compareMission } from '../src/lib/kids/activities/compare/compareMission';
import { CompareSession } from '../src/lib/kids/activities/compare/CompareSession';
import {
	getMission,
	missionsForArea,
	AREA_START_MISSION,
	MISSIONS
} from '../src/lib/kids/data/missions';
import { AREAS, AREA_ORDER } from '../src/lib/kids/data/areas';
import type { MissionDefinition } from '../src/lib/kids/types';
import { LETTERS, getLetter } from '../src/lib/kids/data/alphabet';
import { SYLLABLE_WORDS, SYLLABLES, getWord } from '../src/lib/kids/data/syllables';
import { COLORS, SHAPES, getColor, getShape } from '../src/lib/kids/data/colors';
import { ANIMALS, getAnimal } from '../src/lib/kids/data/animals';

function session(overrides: Partial<{ choices: string[]; answer: string }> = {}) {
	return new ChoiceSession({
		choices: overrides.choices ?? ['A', 'B', 'C'],
		answer: overrides.answer ?? 'B'
	});
}

describe('ChoiceSession — question flow', () => {
	it('starts in the asking step', () => {
		expect(session().currentStep).toBe('asking');
	});

	it('accepts the right answer exactly once', () => {
		const s = session();
		expect(s.answer('B').correct).toBe(true);
		expect(s.currentStep).toBe('answered-correct');
		// A second tap after success must not re-trigger the reward.
		expect(s.answer('B').correct).toBe(false);
		expect(s.currentStep).toBe('answered-correct');
	});

	it('a wrong answer does not end the session', () => {
		const s = session();
		const r = s.answer('A');
		expect(r.correct).toBe(false);
		expect(s.currentStep).toBe('answered-wrong');
	});

	it('allows a retry after a wrong answer is acknowledged', () => {
		const s = session();
		s.answer('A');
		s.acknowledgeWrong();
		expect(s.currentStep).toBe('asking');
		expect(s.answer('B').correct).toBe(true);
	});

	it('records wrong attempts so the UI can dim them', () => {
		const s = session();
		s.answer('A');
		s.acknowledgeWrong();
		s.answer('C');
		expect(s.wrongChoices).toEqual(['A', 'C']);
		expect(s.wrongAttempts).toBe(2);
	});

	it('never records the same wrong choice twice', () => {
		const s = session();
		s.answer('A');
		s.acknowledgeWrong();
		s.answer('A');
		expect(s.wrongChoices).toEqual(['A']);
	});

	it('refuses an answer that is not offered', () => {
		const s = session();
		expect(s.answer('Z').correct).toBe(false);
		// A stray answer must not be logged as a wrong attempt.
		expect(s.wrongAttempts).toBe(0);
	});

	it('refuses to answer while latched on a wrong choice', () => {
		const s = session();
		s.answer('A');
		// Not acknowledged yet: the wobble is still playing.
		expect(s.canAnswer()).toBe(false);
		expect(s.answer('B').correct).toBe(false);
	});

	it('refuses to answer once correct', () => {
		const s = session();
		s.answer('B');
		expect(s.canAnswer()).toBe(false);
	});

	it('requires at least two choices', () => {
		expect(() => new ChoiceSession({ choices: ['A'], answer: 'A' })).toThrow();
	});

	it('requires the answer to be one of the choices', () => {
		expect(() => new ChoiceSession({ choices: ['A', 'B'], answer: 'C' })).toThrow();
	});

	it('accepts a picture-choice session whose answer is an emoji', () => {
		const s = new ChoiceSession({ choices: ['🐱', '🐶'], answer: '🐱' });
		expect(s.answer('🐱').correct).toBe(true);
	});
});

describe('assembleWordMission', () => {
	it('keeps the syllable order and the choices', () => {
		const m = assembleWordMission({
			id: 'a',
			area: 'reading',
			title: 't',
			instruction: 'i',
			answerSyllables: ['BA', 'JU'],
			choices: ['BA', 'JU', 'LA']
		});
		expect(m.kind).toBe('assemble-word');
		expect(m.answerSyllables).toEqual(['BA', 'JU']);
	});

	it('refuses a mission with only one syllable', () => {
		expect(() =>
			assembleWordMission({
				id: 'a',
				area: 'reading',
				title: 't',
				instruction: 'i',
				answerSyllables: ['BA'],
				choices: ['BA', 'JU']
			})
		).toThrow();
	});

	it('refuses a mission whose syllable is not offered', () => {
		expect(() =>
			assembleWordMission({
				id: 'a',
				area: 'reading',
				title: 't',
				instruction: 'i',
				answerSyllables: ['BA', 'JU'],
				choices: ['BA', 'LA']
			})
		).toThrow();
	});

	it('every assemble-word mission in the catalogue is winnable', () => {
		for (const mission of Object.values(MISSIONS)) {
			if (mission.kind !== 'assemble-word') continue;
			const s = new BuildSession({
				answer: mission.answerSyllables!,
				choices: mission.choices
			});
			for (const syllable of mission.answerSyllables!) s.pick(syllable);
			expect(s.currentStep, mission.id).toBe('complete');
		}
	});
});

describe('compare missions', () => {
	it('offers exactly two tappable sides', () => {
		const m = compareMission({
			id: 'c',
			title: 't',
			instruction: 'i',
			left: 3,
			right: 1,
			mode: 'more'
		});
		expect(m.kind).toBe('compare-groups');
		expect(m.choices).toEqual(['left', 'right']);
		expect(m.compare).toEqual({ left: 3, right: 1, mode: 'more' });
	});

	it('refuses equal groups, which have no right answer', () => {
		expect(() =>
			compareMission({ id: 'c', title: 't', instruction: 'i', left: 2, right: 2, mode: 'more' })
		).toThrow();
	});

	it('refuses a group too large to see at a glance', () => {
		expect(() =>
			compareMission({ id: 'c', title: 't', instruction: 'i', left: 99, right: 1, mode: 'more' })
		).toThrow();
	});

	it('every compare-groups mission in the catalogue is winnable', () => {
		for (const mission of Object.values(MISSIONS)) {
			if (mission.kind !== 'compare-groups') continue;
			const cmp = mission.compare!;
			const s = new CompareSession(cmp);
			expect(s.answer(s.correctChoice).correct, mission.id).toBe(true);
		}
	});
});

describe('addition missions', () => {
	it('every add-groups mission in the catalogue is winnable', () => {
		for (const mission of Object.values(MISSIONS)) {
			if (mission.kind !== 'add-groups') continue;
			const [left, right] = mission.addends!;
			const s = new AdditionSession({ left, right, choices: mission.choices });
			expect(s.answer(String(left + right)).correct, mission.id).toBe(true);
		}
	});

	it('additionMission refuses a mission whose choices omit the sum', () => {
		expect(() =>
			additionMission({
				id: 'bad',
				title: 't',
				instruction: 'i',
				addends: [2, 2],
				choices: [1, 2]
			})
		).toThrow();
	});

	it('additionMission stringifies the choices', () => {
		const m = additionMission({
			id: 'ok',
			title: 't',
			instruction: 'i',
			addends: [1, 2],
			choices: [2, 3]
		});
		expect(m.choices).toEqual(['2', '3']);
		expect(m.targetNumber).toBe(3);
		expect(m.addends).toEqual([1, 2]);
	});
});

describe('mission data', () => {
	it('defines at least one mission for every area', () => {
		for (const id of AREA_ORDER) {
			expect(missionsForArea(id).length, `area ${id} has no missions`).toBeGreaterThan(0);
		}
	});

	it('gives every area a start mission that exists', () => {
		for (const id of AREA_ORDER) {
			const start = AREA_START_MISSION[id];
			expect(start, `area ${id} has no start mission`).toBeTruthy();
			expect(getMission(start!), `start mission for ${id} is not defined`).toBeDefined();
			expect(getMission(start!)!.area).toBe(id);
		}
	});

	it('uses ids that match their record key', () => {
		for (const [key, mission] of Object.entries(MISSIONS)) {
			expect(mission.id).toBe(key);
		}
	});

	it('every mission asks for at least one star and offers real choices', () => {
		for (const mission of Object.values(MISSIONS)) {
			expect(mission.stars).toBeGreaterThanOrEqual(1);
			expect(mission.choices.length).toBeGreaterThanOrEqual(2);
			expect(mission.instruction.length).toBeGreaterThan(0);
		}
	});

	it('every mission in the catalogue is answerable', () => {
		// A mission whose answer cannot be reached is unwinnable, and a
		// preschooler cannot report that. Each kind is checked by its own rule.
		//
		// The switch below is exhaustive: adding a mission kind without a case
		// is a *type* error (`never`), not a silent pass, so this test cannot
		// quietly stop covering a new kind — which it twice did before.
		for (const mission of Object.values(MISSIONS)) {
			checkMissionIsAnswerable(mission);
		}
	});
});


/**
 * Assert that a mission can be completed, using the rules of its own kind.
 *
 * Exhaustive by construction: the `default` branch narrows `MissionKind` to
 * `never`, so TypeScript rejects this file the moment a new kind appears
 * without a rule. That is deliberate — two earlier revisions of this test
 * failed at runtime instead, once per new mission kind.
 */
function checkMissionIsAnswerable(mission: MissionDefinition): void {
	const id = mission.id;
	switch (mission.kind) {
		case 'count-and-answer':
			// Validated by `countAndAnswerMission`: the target is among the choices.
			expect(mission.targetNumber, `${id} has no target number`).toBeGreaterThanOrEqual(1);
			expect(mission.choices, `${id} omits its number`).toContain(
				String(mission.targetNumber)
			);
			return;
		case 'add-groups': {
			const [a, b] = mission.addends ?? [0, 0];
			expect(mission.targetNumber, `${id} has no total`).toBe(a + b);
			expect(mission.choices, `${id} omits its sum`).toContain(String(a + b));
			return;
		}
		case 'compare-groups': {
			const cmp = mission.compare;
			expect(cmp, `${id} has no groups`).toBeTruthy();
			// Equal groups would make "which is more" unanswerable.
			expect(cmp!.left, `${id} compares equal groups`).not.toBe(cmp!.right);
			expect(mission.choices, `${id} omits a tappable side`).toEqual(['left', 'right']);
			return;
		}
		case 'assemble-word':
			// Assembly missions carry a whole ordered sequence instead.
			expect(
				mission.answerSyllables?.length,
				`${id} has no syllables`
			).toBeGreaterThan(1);
			for (const syllable of mission.answerSyllables ?? []) {
				expect(mission.choices, `${id} omits ${syllable}`).toContain(syllable);
			}
			return;
		case 'subtract-groups': {
			const sub = mission.subtract;
			expect(sub, `${id} has no groups`).toBeTruthy();
			// Everything taken away would leave nothing to count.
			expect(sub!.removed, `${id} removes everything`).toBeLessThan(sub!.start);
			expect(sub!.removed, `${id} removes nothing`).toBeGreaterThan(0);
			const remaining = sub!.start - sub!.removed;
			expect(mission.targetNumber, `${id} has no remainder`).toBe(remaining);
			expect(mission.choices, `${id} omits its remainder`).toContain(String(remaining));
			return;
		}
		case 'sort-groups': {			const groups = mission.sort ?? [];
			expect(groups.length, `${id} has too few groups`).toBeGreaterThanOrEqual(3);
			// Strictly increasing: equal piles would have no single right order.
			for (let i = 1; i < groups.length; i++) {
				expect(groups[i], `${id} is not in ascending order`).toBeGreaterThan(groups[i - 1]);
			}
			for (const group of groups) {
				expect(mission.choices, `${id} omits the group ${group}`).toContain(String(group));
			}
			return;
		}
		case 'pick-letter':
		case 'build-syllables':
		case 'pick-picture':
			expect(mission.targetAnswer, `${id} has no targetAnswer`).toBeTruthy();
			expect(mission.choices, `${id} omits its answer`).toContain(mission.targetAnswer);
			return;
		default: {
			// If this line fails to compile, a mission kind was added without a
			// rule here. Add a case rather than widening the type.
			const unhandled: never = mission.kind;
			throw new Error(`no answerability rule for mission kind "${unhandled}"`);
		}
	}
}

describe('alphabet content', () => {
	it('covers all 26 letters exactly once', () => {
		const letters = LETTERS.map((l) => l.letter);
		expect(letters).toHaveLength(26);
		expect(new Set(letters).size).toBe(26);
	});

	it('marks exactly the five Indonesian vowels', () => {
		expect(LETTERS.filter((l) => l.isVowel).map((l) => l.letter).sort()).toEqual([
			'A',
			'E',
			'I',
			'O',
			'U'
		]);
	});

	it('every letter word starts with its letter', () => {
		for (const entry of LETTERS) {
			expect(
				entry.word.toUpperCase().startsWith(entry.letter),
				`${entry.letter} is illustrated by "${entry.word}"`
			).toBe(true);
		}
	});

	it('looks letters up case-insensitively', () => {
		expect(getLetter('b')?.word).toBe('Bola');
		expect(getLetter('B')?.word).toBe('Bola');
		expect(getLetter('?')).toBeUndefined();
	});
});

describe('reading content', () => {
	it('every word is exactly the concatenation of its syllables', () => {
		for (const entry of SYLLABLE_WORDS) {
			expect(entry.syllables.join(''), `${entry.word} syllables do not build it`).toBe(entry.word);
		}
	});

	it('offers every used syllable in the palette', () => {
		for (const entry of SYLLABLE_WORDS) {
			for (const syl of entry.syllables) {
				expect(SYLLABLES, `palette is missing ${syl}`).toContain(syl);
			}
		}
	});

	it('has no duplicate syllables in the palette', () => {
		expect(new Set(SYLLABLES).size).toBe(SYLLABLES.length);
	});

	it('looks words up case-insensitively', () => {
		expect(getWord('baju')?.word).toBe('BAJU');
	});

	it('every syllable is a consonant followed by a vowel', () => {
		for (const syl of SYLLABLES) {
			expect(/^[A-Z][AIUEO]$/.test(syl), `${syl} is not CV`).toBe(true);
		}
	});
});

describe('colour and animal content', () => {
	it('every colour has a six-digit hex and an Indonesian name', () => {
		for (const c of COLORS) {
			expect(c.hex).toBeGreaterThanOrEqual(0);
			expect(c.hex).toBeLessThanOrEqual(0xffffff);
			expect(c.name.length).toBeGreaterThan(0);
		}
	});

	it('every shape has an icon', () => {
		for (const s of SHAPES) expect(s.icon.length).toBeGreaterThan(0);
	});

	it('looks shapes up by id', () => {
		expect(getShape('segitiga')?.name).toBe('Segitiga');
		expect(getShape('nope')).toBeUndefined();
	});

	it('has unique shape icons, so a child can tell them apart by picture', () => {
		expect(new Set(SHAPES.map((s) => s.icon)).size).toBe(SHAPES.length);
	});

	it('looks colours up by id', () => {
		expect(getColor('merah')?.name).toBe('Merah');
		expect(getColor('nope')).toBeUndefined();
	});

	it('every animal has a name, an icon and a sound', () => {
		for (const a of ANIMALS) {
			expect(a.name.length).toBeGreaterThan(0);
			expect(a.icon.length).toBeGreaterThan(0);
			expect(a.sound.length).toBeGreaterThan(0);
		}
	});

	it('has unique animal ids', () => {
		expect(new Set(ANIMALS.map((a) => a.id)).size).toBe(ANIMALS.length);
		expect(getAnimal('kucing')?.sound).toBe('Meong');
	});
});

describe('area data', () => {
	it('every area id in AREA_ORDER has a definition', () => {
		for (const id of AREA_ORDER) expect(AREAS[id].id).toBe(id);
	});

	it('places every area inside the island and apart from the others', () => {
		for (const id of AREA_ORDER) {
			const a = AREAS[id];
			expect(Math.hypot(a.position.x, a.position.z)).toBeLessThan(34);
		}
		for (let i = 0; i < AREA_ORDER.length; i++) {
			for (let j = i + 1; j < AREA_ORDER.length; j++) {
				const a = AREAS[AREA_ORDER[i]];
				const b = AREAS[AREA_ORDER[j]];
				const d = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
				// Area stages are 3 units in radius, so closer than 8 would overlap.
				expect(d, `${a.id} and ${b.id} are too close`).toBeGreaterThan(8);
			}
		}
	});
});
