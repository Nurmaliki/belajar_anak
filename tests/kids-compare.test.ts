import { describe, expect, it } from 'vitest';
import {
	CompareSession,
	MAX_COMPARE,
	type CompareMode
} from '../src/lib/kids/activities/compare/CompareSession';

function session(left = 3, right = 1, mode: CompareMode = 'more') {
	return new CompareSession({ left, right, mode });
}

describe('CompareSession — which side is right', () => {
	it('picks the larger group for "more"', () => {
		expect(session(3, 1, 'more').correctChoice).toBe('left');
		expect(session(1, 3, 'more').correctChoice).toBe('right');
	});

	it('picks the smaller group for "fewer"', () => {
		expect(session(3, 1, 'fewer').correctChoice).toBe('right');
		expect(session(1, 3, 'fewer').correctChoice).toBe('left');
	});
});

describe('CompareSession — setup guards', () => {
	it('refuses equal groups, which would have no right answer', () => {
		expect(() => session(2, 2)).toThrow();
	});

	it('refuses a non-integer group', () => {
		expect(() => session(2.5, 1)).toThrow();
	});

	it('refuses a group of zero or below', () => {
		expect(() => session(0, 1)).toThrow();
	});

	it('refuses a group larger than the display limit', () => {
		expect(() => session(MAX_COMPARE + 1, 1)).toThrow();
	});
});

describe('CompareSession — answering', () => {
	it('accepts the right side', () => {
		const s = session();
		expect(s.answer('left').correct).toBe(true);
		expect(s.currentStep).toBe('answered-correct');
	});

	it('a wrong side is not a dead end', () => {
		const s = session();
		expect(s.answer('right').correct).toBe(false);
		expect(s.currentStep).toBe('answered-wrong');
		s.acknowledgeWrong();
		expect(s.answer('left').correct).toBe(true);
	});

	it('records the wrong side for dimming, without duplicates', () => {
		const s = session();
		s.answer('right');
		s.acknowledgeWrong();
		s.answer('right');
		expect(s.wrongChoices).toEqual(['right']);
	});

	it('ignores a value that is not a side', () => {
		const s = session();
		expect(s.answer('middle').correct).toBe(false);
		expect(s.wrongAttempts).toBe(0);
		expect(s.currentStep).toBe('asking');
	});

	it('refuses to answer twice after success', () => {
		const s = session();
		s.answer('left');
		expect(s.answer('left').correct).toBe(false);
	});

	it('refuses to answer while the wobble is playing', () => {
		const s = session();
		s.answer('right');
		expect(s.canAnswer()).toBe(false);
		expect(s.answer('left').correct).toBe(false);
	});
});

describe('CompareSession — every pair', () => {
	it('every unequal pair has exactly one correct side', () => {
		for (let a = 1; a <= MAX_COMPARE; a++) {
			for (let b = 1; b <= MAX_COMPARE; b++) {
				if (a === b) continue;
				for (const mode of ['more', 'fewer'] as CompareMode[]) {
					const s = new CompareSession({ left: a, right: b, mode });
					const correct = s.correctChoice;
					const other = correct === 'left' ? 'right' : 'left';
					expect(s.answer(other).correct, `${a}/${b} ${mode}`).toBe(false);
					s.acknowledgeWrong();
					expect(s.answer(correct).correct, `${a}/${b} ${mode}`).toBe(true);
				}
			}
		}
	});
});
