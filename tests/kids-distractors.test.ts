import { describe, expect, it } from 'vitest';
import { distractors, choiceMission } from '../src/lib/kids/activities/choices/choiceMission';
import { SHAPES } from '../src/lib/kids/data/colors';

describe('distractors', () => {
	const pool = ['A', 'B', 'C', 'D', 'E'];

	it('never includes the answer', () => {
		for (let seed = 0; seed < 12; seed++) {
			expect(distractors(pool, 'C', 4, seed)).not.toContain('C');
		}
	});

	it('returns the requested number when the pool is large enough', () => {
		const got = distractors(pool, 'C', 3, 0);
		expect(got).toHaveLength(3);
		expect(new Set(got).size).toBe(3);
	});

	it('never returns duplicates', () => {
		const got = distractors(pool, 'C', 4, 7);
		expect(new Set(got).size).toBe(got.length);
	});

	it('caps at the pool size rather than looping forever', () => {
		const got = distractors(pool, 'C', 99, 0);
		expect(got).toHaveLength(4);
	});

	it('is deterministic for a given seed', () => {
		expect(distractors(pool, 'C', 3, 5)).toEqual(distractors(pool, 'C', 3, 5));
	});

	it('uses every seed without repeating an item', () => {
		for (let seed = 0; seed < 20; seed++) {
			const got = distractors(pool, 'A', 4, seed);
			expect(new Set(got).size, `seed ${seed}`).toBe(got.length);
			expect(got, `seed ${seed}`).not.toContain('A');
		}
	});

	it('returns an empty list when the pool holds only the answer', () => {
		expect(distractors(['A'], 'A', 3)).toEqual([]);
	});
});

describe('shape missions offer a full set of buttons', () => {
	it('a shape mission gets three distractors when the pool allows', () => {
		// Four shapes exist, so a shape question should offer all four.
		const names = SHAPES.map((s) => s.name);
		expect(distractors(names, 'Lingkaran', 3, 0)).toHaveLength(3);
		expect(distractors(names, 'Lingkaran', 3, 2)).toHaveLength(3);
	});

	it('choiceMission rejects a duplicate choice', () => {
		expect(() =>
			choiceMission({
				id: 'dup',
				area: 'colors',
				title: 't',
				instruction: 'i',
				kind: 'pick-picture',
				answer: 'A',
				choices: ['A', 'A', 'B']
			})
		).toThrow();
	});
});
