import { describe, expect, it } from 'vitest';
import {
	MAX_SORT,
	MAX_SORT_GROUP,
	MIN_SORT,
	SortSession
} from '../src/lib/kids/activities/sorting/SortSession';

function session(answer: number[] = [1, 2, 3]) {
	return new SortSession({ answer });
}

describe('SortSession — setup guards', () => {
	it('refuses fewer groups than a sort needs', () => {
		expect(() => session([1, 2])).toThrow();
	});

	it('refuses more groups than a child can hold in mind', () => {
		expect(() => session([1, 2, 3, 4, MAX_SORT + 1])).toThrow();
	});

	it('accepts the full allowed range', () => {
		expect(() => session([1, 2, 3])).not.toThrow();
		expect(() => session([1, 2, 3, 4])).not.toThrow();
		expect(MIN_SORT).toBe(3);
		expect(MAX_SORT).toBe(4);
	});

	it('refuses equal groups, which would have no single order', () => {
		expect(() => session([1, 2, 2])).toThrow();
	});

	it('refuses groups that are not already fewest-first', () => {
		expect(() => session([2, 1, 3])).toThrow();
	});

	it('refuses a group outside the countable range', () => {
		expect(() => session([0, 1, 2])).toThrow();
		expect(() => session([1, 2, MAX_SORT_GROUP + 1])).toThrow();
	});

	it('refuses a fractional group', () => {
		expect(() => session([1, 2.5, 3])).toThrow();
	});

	it('copies its input so a caller cannot mutate the answer', () => {
		const groups = [1, 2, 3];
		const s = new SortSession({ answer: groups });
		groups[0] = 99;
		expect(s.answer).toEqual([1, 2, 3]);
	});
});

describe('SortSession — placing groups', () => {
	it('starts sorting with nothing placed', () => {
		const s = session();
		expect(s.currentStep).toBe('sorting');
		expect(s.placed).toEqual([]);
		expect(s.total).toBe(3);
		expect(s.nextExpected).toBe(1);
	});

	it('accepts the fewest group first and keeps going', () => {
		const s = session();
		const result = s.place(1);
		expect(result.correct).toBe(true);
		expect(result.completed).toBe(false);
		expect(s.placed).toEqual([1]);
		expect(s.nextExpected).toBe(2);
		expect(s.canAnswer()).toBe(true);
	});

	it('a wrong pick is not a dead end and loses no progress', () => {
		const s = session();
		s.place(1);
		expect(s.place(3).correct).toBe(false);
		expect(s.currentStep).toBe('answered-wrong');
		expect(s.placed).toEqual([1]);
		s.acknowledgeWrong();
		expect(s.place(2).correct).toBe(true);
		expect(s.placed).toEqual([1, 2]);
	});

	it('refuses answers while the wobble is playing', () => {
		const s = session();
		s.place(3);
		expect(s.canAnswer()).toBe(false);
		expect(s.place(1).correct).toBe(false);
	});

	it('records the wrong group for dimming, without duplicates', () => {
		const s = session();
		s.place(3);
		s.acknowledgeWrong();
		s.place(3);
		expect(s.wrongChoices).toEqual([3]);
		expect(s.wrongAttempts).toBe(1);
	});

	it('ignores a group that is not offered', () => {
		const s = session();
		expect(s.place(9).correct).toBe(false);
		expect(s.currentStep).toBe('sorting');
		expect(s.wrongAttempts).toBe(0);
	});

	it('does not offer a group already placed', () => {
		const s = session();
		expect(s.offerable()).toEqual([1, 2, 3]);
		s.place(1);
		expect(s.offerable()).toEqual([2, 3]);
		expect(s.place(1).correct).toBe(false);
	});

	it('completes when every group is placed in order', () => {
		const s = session();
		s.place(1);
		s.place(2);
		const last = s.place(3);
		expect(last.correct).toBe(true);
		expect(last.completed).toBe(true);
		expect(s.currentStep).toBe('complete');
		expect(s.canAnswer()).toBe(false);
		expect(s.nextExpected).toBeNull();
	});

	it('refuses to answer twice after completion', () => {
		const s = session();
		s.place(1);
		s.place(2);
		s.place(3);
		expect(s.place(2).correct).toBe(false);
		expect(s.placed).toEqual([1, 2, 3]);
	});

	it('restart returns a fresh session with the same groups', () => {
		const s = session([2, 4, 5]);
		s.place(2);
		const fresh = s.restart();
		expect(fresh.placed).toEqual([]);
		expect(fresh.answer).toEqual([2, 4, 5]);
		expect(fresh.currentStep).toBe('sorting');
	});
});

describe('SortSession — every ascending triple', () => {
	it('has exactly one valid order, and every other first pick is wrong', () => {
		for (let a = 1; a <= MAX_SORT_GROUP; a++) {
			for (let b = a + 1; b <= MAX_SORT_GROUP; b++) {
				for (let c = b + 1; c <= MAX_SORT_GROUP; c++) {
					const answer = [a, b, c];
					// Only the smallest may start the line.
					for (const first of answer) {
						const s = new SortSession({ answer });
						const expected = first === a;
						expect(s.place(first).correct, `${answer} first ${first}`).toBe(expected);
					}
					// And the whole line wins.
					const s = new SortSession({ answer });
					s.place(a);
					s.place(b);
					expect(s.place(c).completed, `${answer} full line`).toBe(true);
				}
			}
		}
	});
});
