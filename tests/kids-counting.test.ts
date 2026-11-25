import { describe, expect, it } from 'vitest';
import { CountSession } from '../src/lib/kids/activities/counting/CountSession';
import { countAndAnswerMission } from '../src/lib/kids/activities/counting/countingMission';

function session(overrides: Partial<{ collectCount: number; targetNumber: number; choices: string[] }> = {}) {
	return new CountSession({
		collectCount: overrides.collectCount ?? 3,
		targetNumber: overrides.targetNumber ?? 3,
		choices: overrides.choices ?? ['1', '2', '3', '4', '5']
	});
}

describe('CountSession — collecting', () => {
	it('counts each object exactly once', () => {
		const s = session();
		expect(s.tap('a').accepted).toBe(true);
		expect(s.count).toBe(1);
		expect(s.tap('b').accepted).toBe(true);
		expect(s.count).toBe(2);
		expect(s.tap('c').accepted).toBe(true);
		expect(s.count).toBe(3);
	});

	it('refuses to count the same object twice', () => {
		const s = session();
		s.tap('a');
		const again = s.tap('a');
		expect(again.accepted).toBe(false);
		expect(s.count).toBe(1);
	});

	it('refuses a double tap that would overflow the object count', () => {
		const s = session({ collectCount: 3 });
		s.tap('a');
		s.tap('a');
		s.tap('a');
		expect(s.count).toBe(1);
	});

	it('reports completed on the final object only', () => {
		const s = session({ collectCount: 3 });
		expect(s.tap('a').completed).toBe(false);
		expect(s.tap('b').completed).toBe(false);
		expect(s.tap('c').completed).toBe(true);
		expect(s.allCollected).toBe(true);
	});

	it('does not unlock answering until everything is collected', () => {
		const s = session({ collectCount: 3 });
		s.tap('a');
		s.tap('b');
		expect(s.canAnswer()).toBe(false);
		s.tap('c');
		expect(s.canAnswer()).toBe(true);
	});

	it('tracks collection order', () => {
		const s = session();
		s.tap('b');
		s.tap('a');
		s.tap('c');
		expect(s.collectedIds).toEqual(['b', 'a', 'c']);
	});
});

describe('CountSession — answering', () => {
	it('accepts the right answer and moves to answered-correct', () => {
		const s = session();
		['a', 'b', 'c'].forEach((id) => s.tap(id));
		const res = s.answer('3');
		expect(res.correct).toBe(true);
		expect(s.currentStep).toBe('answered-correct');
	});

	it('rejects a wrong answer without losing progress', () => {
		const s = session();
		['a', 'b', 'c'].forEach((id) => s.tap(id));
		const res = s.answer('5');
		expect(res.correct).toBe(false);
		expect(s.currentStep).toBe('answered-wrong');
		// The apples are still counted: a retry must not become a chore.
		expect(s.count).toBe(3);
	});

	it('allows a retry after a wrong answer', () => {
		const s = session();
		['a', 'b', 'c'].forEach((id) => s.tap(id));
		s.answer('1');
		s.acknowledgeWrong();
		expect(s.currentStep).toBe('answering');
		expect(s.answer('3').correct).toBe(true);
	});

	it('counts wrong attempts', () => {
		const s = session();
		['a', 'b', 'c'].forEach((id) => s.tap(id));
		s.answer('1');
		s.acknowledgeWrong();
		s.answer('2');
		expect(s.wrongAttempts).toBe(2);
	});

	it('ignores answering before all objects are collected', () => {
		const s = session();
		s.tap('a');
		const res = s.answer('3');
		expect(res.correct).toBe(false);
		expect(s.currentStep).toBe('collecting');
	});

	it('does not accept taps after the answer is correct', () => {
		const s = session();
		['a', 'b', 'c'].forEach((id) => s.tap(id));
		s.answer('3');
		const late = s.tap('d');
		expect(late.accepted).toBe(false);
		expect(s.count).toBe(3);
	});

	it('compares numerically-sound strings, not by identity', () => {
		const s = session({ targetNumber: 10, collectCount: 10, choices: ['8', '9', '10'] });
		for (let i = 0; i < 10; i++) s.tap(`o${i}`);
		expect(s.answer('10').correct).toBe(true);
	});
});

describe('CountSession — restart', () => {
	it('restarts with the same configuration and a clean count', () => {
		const s = session();
		s.tap('a');
		const fresh = s.restart();
		expect(fresh.count).toBe(0);
		expect(fresh.collectCount).toBe(3);
		expect(fresh.targetNumber).toBe(3);
		expect(fresh.choices).toEqual(['1', '2', '3', '4', '5']);
	});
});

describe('countAndAnswerMission', () => {
	it('stringifies the choices and keeps the target', () => {
		const m = countAndAnswerMission({
			id: 'm',
			title: 't',
			instruction: 'i',
			collectCount: 3,
			targetNumber: 3,
			choices: [1, 2, 3]
		});
		expect(m.choices).toEqual(['1', '2', '3']);
		expect(m.targetNumber).toBe(3);
		expect(m.kind).toBe('count-and-answer');
	});

	it('refuses a mission whose choices omit the answer', () => {
		expect(() =>
			countAndAnswerMission({
				id: 'm',
				title: 't',
				instruction: 'i',
				collectCount: 3,
				targetNumber: 3,
				choices: [1, 2]
			})
		).toThrow(/must contain the answer/);
	});

	it('refuses a non-positive collect count', () => {
		expect(() =>
			countAndAnswerMission({
				id: 'm',
				title: 't',
				instruction: 'i',
				collectCount: 0,
				targetNumber: 1,
				choices: [1]
			})
		).toThrow();
	});
});
