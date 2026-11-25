import { describe, expect, it } from 'vitest';
import { AdditionSession, MAX_GROUP } from '../src/lib/kids/activities/addition/AdditionSession';

function session(left = 2, right = 1, choices = ['2', '3', '4', '5']) {
	return new AdditionSession({ left, right, choices });
}

describe('AdditionSession — setup', () => {
	it('reports the operands and the sum', () => {
		const s = session(2, 3);
		expect(s.left).toBe(2);
		expect(s.right).toBe(3);
		expect(s.total).toBe(5);
	});

	it('starts asking', () => {
		expect(session().currentStep).toBe('asking');
	});

	it('exposes the label of the correct choice', () => {
		expect(session(2, 1).correctChoice).toBe('3');
	});

	it('refuses a sum that is not on offer', () => {
		expect(() => session(2, 2, ['1', '2'])).toThrow();
	});

	it('refuses a group larger than a child can count at a glance', () => {
		expect(() => session(MAX_GROUP + 1, 1)).toThrow();
	});

	it('refuses a zero or negative group', () => {
		expect(() => session(0, 1)).toThrow();
		expect(() => session(1, -2)).toThrow();
	});

	it('refuses a fractional group', () => {
		expect(() => session(1.5, 1)).toThrow();
	});
});

describe('AdditionSession — answering', () => {
	it('accepts the sum', () => {
		const s = session();
		expect(s.answer('3').correct).toBe(true);
		expect(s.currentStep).toBe('answered-correct');
	});

	it('a wrong sum is not a dead end', () => {
		const s = session();
		expect(s.answer('5').correct).toBe(false);
		expect(s.currentStep).toBe('answered-wrong');
		s.acknowledgeWrong();
		expect(s.currentStep).toBe('asking');
		expect(s.answer('3').correct).toBe(true);
	});

	it('records wrong choices for dimming without duplicates', () => {
		const s = session();
		s.answer('5');
		s.acknowledgeWrong();
		s.answer('5');
		expect(s.wrongChoices).toEqual(['5']);
	});

	it('compares numerically, not by string identity', () => {
		const s = session(2, 1, ['3', '4', '5']);
		// "03" is not on offer, so it is refused rather than counted as right.
		expect(s.answer('03').correct).toBe(false);
		// But the offered "3" is accepted.
		expect(s.answer('3').correct).toBe(true);
	});

	it('refuses a choice that was never offered', () => {
		const s = session();
		expect(s.answer('9').correct).toBe(false);
		expect(s.wrongAttempts).toBe(0);
		expect(s.currentStep).toBe('asking');
	});

	it('refuses to answer twice after success', () => {
		const s = session();
		s.answer('3');
		expect(s.answer('3').correct).toBe(false);
		expect(s.currentStep).toBe('answered-correct');
	});

	it('refuses to answer while the wobble is playing', () => {
		const s = session();
		s.answer('5');
		expect(s.canAnswer()).toBe(false);
		expect(s.answer('3').correct).toBe(false);
	});
});

describe('AdditionSession — sums a child can see', () => {
	it('every pair up to five has a winnable configuration', () => {
		for (let a = 1; a <= MAX_GROUP; a++) {
			for (let b = 1; b <= MAX_GROUP; b++) {
				const total = a + b;
				const choices = [total, total + 1, total - 1].map(String);
				const s = new AdditionSession({ left: a, right: b, choices });
				expect(s.answer(String(total)).correct, `${a}+${b}`).toBe(true);
			}
		}
	});
});
