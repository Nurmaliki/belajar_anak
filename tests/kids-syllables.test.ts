import { describe, expect, it } from 'vitest';
import { BuildSession } from '../src/lib/kids/activities/syllables/BuildSession';
import { SYLLABLE_WORDS } from '../src/lib/kids/data/syllables';

function session(answer = ['BA', 'JU'], choices = ['BA', 'JU', 'BU', 'LA']) {
	return new BuildSession({ answer, choices });
}

describe('BuildSession — assembling', () => {
	it('starts empty and expects the first syllable', () => {
		const s = session();
		expect(s.currentStep).toBe('building');
		expect(s.placed).toEqual([]);
		expect(s.nextExpected).toBe('BA');
	});

	it('places the first syllable and moves to the second', () => {
		const s = session();
		const r = s.pick('BA');
		expect(r.correct).toBe(true);
		expect(r.placed).toBe(1);
		expect(r.completed).toBe(false);
		expect(s.nextExpected).toBe('JU');
		expect(s.builtWord).toBe('BA');
	});

	it('completes the word on the last syllable', () => {
		const s = session();
		s.pick('BA');
		const r = s.pick('JU');
		expect(r.correct).toBe(true);
		expect(r.completed).toBe(true);
		expect(s.currentStep).toBe('complete');
		expect(s.builtWord).toBe('BAJU');
	});
});

describe('BuildSession — mistakes', () => {
	it('rejects a wrong syllable without losing progress', () => {
		const s = session();
		s.pick('BA');
		const r = s.pick('LA');
		expect(r.correct).toBe(false);
		expect(r.step).toBe('answered-wrong');
		// The BA already placed must survive the mistake.
		expect(s.builtWord).toBe('BA');
		expect(s.placed).toHaveLength(1);
	});

	it('allows a retry after a wrong pick is acknowledged', () => {
		const s = session();
		s.pick('BA');
		s.pick('LA');
		s.acknowledgeWrong();
		expect(s.currentStep).toBe('building');
		expect(s.pick('JU').correct).toBe(true);
	});

	it('records wrong choices for dimming, without duplicates', () => {
		const s = session();
		s.pick('LA');
		s.acknowledgeWrong();
		s.pick('LA');
		expect(s.wrongChoices).toEqual(['LA']);
	});

	it('refuses picks while latched on a wrong answer', () => {
		const s = session();
		s.pick('LA');
		expect(s.canAnswer()).toBe(false);
		expect(s.pick('BA').correct).toBe(false);
		expect(s.placed).toEqual([]);
	});

	it('refuses a syllable that was never offered', () => {
		const s = session();
		const r = s.pick('ZZ');
		expect(r.correct).toBe(false);
		expect(s.wrongAttempts).toBe(0);
		expect(s.currentStep).toBe('building');
	});

	it('refuses further picks once the word is complete', () => {
		const s = session();
		s.pick('BA');
		s.pick('JU');
		expect(s.pick('BA').correct).toBe(false);
		expect(s.builtWord).toBe('BAJU');
	});
});

describe('BuildSession — construction guards', () => {
	it('needs at least two syllables to build', () => {
		expect(() => new BuildSession({ answer: ['BA'], choices: ['BA', 'JU'] })).toThrow();
	});

	it('needs every answer syllable to be offered', () => {
		expect(() => new BuildSession({ answer: ['BA', 'JU'], choices: ['BA', 'LA'] })).toThrow();
	});
});

describe('BuildSession — content contract', () => {
	it('every syllable word in the dataset can be built', () => {
		for (const entry of SYLLABLE_WORDS) {
			const choices = [...new Set([...entry.syllables, 'ZZ'])];
			const s = new BuildSession({ answer: entry.syllables, choices });
			for (const syllable of entry.syllables) {
				expect(s.pick(syllable).correct, `${entry.word}: ${syllable}`).toBe(true);
			}
			expect(s.builtWord).toBe(entry.word);
			expect(s.currentStep).toBe('complete');
		}
	});
});
