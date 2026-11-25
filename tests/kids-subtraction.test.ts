import { describe, expect, it } from 'vitest';
import {
	MAX_SUBTRACT_START,
	SubtractionSession
} from '../src/lib/kids/activities/subtraction/SubtractionSession';
import { subtractionMission } from '../src/lib/kids/activities/subtraction/subtractionMission';
import { MISSIONS } from '../src/lib/kids/data/missions';

function session(start = 5, removed = 2, choices = ['2', '3', '4']) {
	return new SubtractionSession({ start, removed, choices });
}

describe('SubtractionSession — setup', () => {
	it('reports the operands and what is left', () => {
		const s = session(5, 2);
		expect(s.start).toBe(5);
		expect(s.removed).toBe(2);
		expect(s.remaining).toBe(3);
	});

	it('starts asking', () => {
		expect(session().currentStep).toBe('asking');
	});

	it('exposes the label of the correct choice', () => {
		expect(session(4, 1).correctChoice).toBe('3');
	});

	it('refuses a remainder that is not on offer', () => {
		expect(() => session(5, 2, ['1', '2'])).toThrow();
	});

	it('refuses taking away everything, which leaves nothing to count', () => {
		expect(() => session(3, 3, ['0', '1'])).toThrow();
	});

	it('refuses removing more than there is', () => {
		expect(() => session(2, 3, ['1'])).toThrow();
	});

	it('refuses removing nothing', () => {
		expect(() => session(3, 0, ['1', '2'])).toThrow();
	});

	it('refuses a start larger than a child can count at a glance', () => {
		expect(() => session(MAX_SUBTRACT_START + 1, 1, ['1', '2'])).toThrow();
	});

	it('refuses a fractional operand', () => {
		expect(() => session(3, 1.5, ['1', '2'])).toThrow();
	});

	it('refuses a single choice', () => {
		expect(() => session(5, 2, ['3'])).toThrow();
	});
});

describe('SubtractionSession — answering', () => {
	it('accepts the remainder', () => {
		const s = session();
		expect(s.answer('3').correct).toBe(true);
		expect(s.currentStep).toBe('answered-correct');
	});

	it('a wrong answer is not a dead end', () => {
		const s = session();
		expect(s.answer('4').correct).toBe(false);
		expect(s.currentStep).toBe('answered-wrong');
		s.acknowledgeWrong();
		expect(s.answer('3').correct).toBe(true);
	});

	it('never accepts the number taken away as the answer', () => {
		// 5 - 2: "2" is on the buttons as a distractor and must be wrong.
		const s = session(5, 2, ['1', '2', '3']);
		expect(s.answer('2').correct).toBe(false);
	});

	it('records the wrong choice for dimming, without duplicates', () => {
		const s = session();
		s.answer('4');
		s.acknowledgeWrong();
		s.answer('4');
		expect(s.wrongChoices).toEqual(['4']);
	});

	it('ignores a value that was never offered', () => {
		const s = session();
		expect(s.answer('9').correct).toBe(false);
		expect(s.wrongAttempts).toBe(0);
		expect(s.currentStep).toBe('asking');
	});

	it('refuses to answer twice after success', () => {
		const s = session();
		s.answer('3');
		expect(s.answer('3').correct).toBe(false);
	});

	it('restart returns a fresh session with the same operands', () => {
		const s = session(4, 1, ['2', '3', '4']);
		s.answer('3');
		const fresh = s.restart();
		expect(fresh.currentStep).toBe('asking');
		expect(fresh.remaining).toBe(3);
		expect(fresh.choices).toEqual(['2', '3', '4']);
	});
});

describe('SubtractionSession — every case', () => {
	it('has exactly one correct button, and the remainder is positive', () => {
		for (let start = 2; start <= MAX_SUBTRACT_START; start++) {
			for (let removed = 1; removed < start; removed++) {
				const remaining = start - removed;
				expect(remaining).toBeGreaterThan(0);
				const choices = [remaining - 1, remaining, remaining + 1]
					.filter((n) => n >= 1)
					.map(String);
				const s = new SubtractionSession({ start, removed, choices });
				expect(s.answer(String(remaining)).correct, `${start}-${removed}`).toBe(true);
			}
		}
	});
});

describe('subtractionMission — build-time validation', () => {
	const base = { id: 'sub-test', title: 'Sisa apel', instruction: 'Sisa berapa?' };

	it('produces a subtract-groups mission with its remainder', () => {
		const m = subtractionMission({ ...base, start: 5, removed: 2, choices: [2, 3, 4] });
		expect(m.kind).toBe('subtract-groups');
		expect(m.area).toBe('counting');
		expect(m.subtract).toEqual({ start: 5, removed: 2 });
		expect(m.targetNumber).toBe(3);
		expect(m.choices).toEqual(['2', '3', '4']);
		expect(m.teaches?.numbers).toEqual([3]);
	});

	it('rejects choices that omit the remainder', () => {
		expect(() => subtractionMission({ ...base, start: 5, removed: 2, choices: [1, 2] })).toThrow();
	});

	it('rejects repeating an answer button', () => {
		expect(() => subtractionMission({ ...base, start: 5, removed: 2, choices: [3, 3, 4] })).toThrow();
	});

	it('rejects a subtraction that leaves nothing', () => {
		expect(() => subtractionMission({ ...base, start: 3, removed: 3, choices: [0, 1] })).toThrow();
	});

	it('rejects an uncountable start', () => {
		expect(() =>
			subtractionMission({ ...base, start: MAX_SUBTRACT_START + 1, removed: 1, choices: [1, 5] })
		).toThrow();
	});
});

describe('subtraction content in the mission table', () => {
	const subs = Object.values(MISSIONS).filter((m) => m.kind === 'subtract-groups');

	it('there are subtraction missions to play', () => {
		expect(subs.length).toBeGreaterThanOrEqual(2);
	});

	it('every subtraction mission builds a session the child can win', () => {
		for (const m of subs) {
			const sub = m.subtract!;
			expect(() =>
				new SubtractionSession({ start: sub.start, removed: sub.removed, choices: m.choices }),
				m.id
			).not.toThrow();
		}
	});

	it('starts with the easiest one: only one object taken away', () => {
		const easiest = subs.reduce((a, b) => (a.subtract!.removed <= b.subtract!.removed ? a : b));
		expect(easiest.subtract!.removed).toBe(1);
	});
});
