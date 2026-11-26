import { describe, expect, it } from 'vitest';
import { SoundSession } from '../src/lib/kids/activities/sounds/SoundSession';
import { soundMission } from '../src/lib/kids/activities/sounds/soundMission';
import { PatternSession } from '../src/lib/kids/activities/patterns/PatternSession';
import { patternMission } from '../src/lib/kids/activities/patterns/patternMission';
import { getMission, MISSIONS, AREA_ROTATION } from '../src/lib/kids/data/missions';

describe('SoundSession — the question is audio, not a picture', () => {
	const make = () => new SoundSession({ answer: 'Kucing', choices: ['Kucing', 'Sapi', 'Bebek'] });

	it('refuses every answer before the sound has been heard', () => {
		const s = make();
		const r = s.answer('Kucing');
		// The child has not been asked anything yet: scoring this would be a trap.
		expect(r.correct).toBe(false);
		expect(r.refused).toBe(true);
		expect(s.currentStep).toBe('listening');
		expect(s.wrongAttempts).toBe(0);
	});

	it('a refused tap is never recorded as a wrong answer', () => {
		const s = make();
		s.answer('Sapi');
		s.answer('Bebek');
		expect(s.wrongChoices).toEqual([]);
	});

	it('accepts the right answer once the sound has been heard', () => {
		const s = make();
		s.markSoundHeard();
		expect(s.answer('Kucing').correct).toBe(true);
		expect(s.currentStep).toBe('answered-correct');
	});

	it('tells the truth about whether the sound played', () => {
		const s = make();
		expect(s.soundWasHeard).toBe(false);
		s.markSoundHeard();
		expect(s.soundWasHeard).toBe(true);
	});

	it('a wrong answer latches but is never a dead end', () => {
		const s = make();
		s.markSoundHeard();
		const r = s.answer('Sapi');
		expect(r.correct).toBe(false);
		expect(r.refused).toBe(false);
		expect(s.currentStep).toBe('answered-wrong');
		expect(s.wrongChoices).toEqual(['Sapi']);
		s.acknowledgeWrong();
		expect(s.currentStep).toBe('listening');
		expect(s.answer('Kucing').correct).toBe(true);
	});

	it('a second tap after success does not award twice', () => {
		const s = make();
		s.markSoundHeard();
		s.answer('Kucing');
		const again = s.answer('Kucing');
		expect(again.correct).toBe(false);
		expect(again.refused).toBe(true);
	});

	it('refuses a value that was never a button', () => {
		const s = make();
		s.markSoundHeard();
		expect(s.answer('Gajah').refused).toBe(true);
		expect(s.wrongChoices).toEqual([]);
	});

	it('replays unlimited wrong attempts without ever locking out', () => {
		const s = make();
		s.markSoundHeard();
		for (let i = 0; i < 20; i++) {
			s.answer('Sapi');
			s.acknowledgeWrong();
		}
		expect(s.wrongChoices).toEqual(['Sapi']);
		expect(s.answer('Kucing').correct).toBe(true);
	});

	it('a restart keeps the sound heard, so the replay is answerable', () => {
		const s = make();
		s.markSoundHeard();
		const again = s.restart();
		expect(again.soundWasHeard).toBe(true);
		expect(again.answer('Kucing').correct).toBe(true);
	});

	it('refuses a question whose answer is not offered', () => {
		expect(() => new SoundSession({ answer: 'Gajah', choices: ['Kucing', 'Sapi'] })).toThrow();
	});

	it('refuses a one-option question and a repeated one', () => {
		expect(() => new SoundSession({ answer: 'Kucing', choices: ['Kucing'] })).toThrow();
		expect(() => new SoundSession({ answer: 'Kucing', choices: ['Kucing', 'Kucing'] })).toThrow();
	});
});

describe('soundMission — builder', () => {
	const base = {
		id: 'sound-x',
		title: 'Siapa?',
		instruction: 'Dengarkan.',
		answer: 'Kucing',
		choices: ['Kucing', 'Sapi'],
		sound: 'Meong',
		depth: 0.5
	};

	it('carries the cry and the voice depth', () => {
		const m = soundMission(base);
		expect(m.sound).toEqual({ cry: 'Meong', depth: 0.5 });
	});

	it('shows no prompt picture, because one would answer the question', () => {
		const m = soundMission(base);
		expect(m.prompt).toBeUndefined();
	});

	it('records the animal it teaches', () => {
		expect(soundMission(base).teaches?.animals).toEqual(['Kucing']);
	});

	it('throws when the answer is not among the buttons', () => {
		expect(() => soundMission({ ...base, choices: ['Sapi', 'Bebek'] })).toThrow(/no button/);
	});

	it('throws when there is no sound to play', () => {
		expect(() => soundMission({ ...base, sound: '  ' })).toThrow(/no sound/);
	});

	it('throws on a repeated animal', () => {
		expect(() => soundMission({ ...base, choices: ['Kucing', 'Kucing'] })).toThrow(/repeats/);
	});
});

describe('PatternSession — continuing a repeating rule', () => {
	it('shows the cycle repeated to the visible length', () => {
		const s = new PatternSession({ cycle: ['Merah', 'Kuning'], visible: 5, choices: ['Merah', 'Kuning'] });
		expect(s.shown).toEqual(['Merah', 'Kuning', 'Merah', 'Kuning', 'Merah']);
	});

	it('predicts the next item from the rule, not from the choices', () => {
		// cycle length 2, 5 shown → next is index 5 % 2 = 1 → 'Kuning'
		const s = new PatternSession({ cycle: ['Merah', 'Kuning'], visible: 5, choices: ['Merah', 'Kuning'] });
		expect(s.correctChoice).toBe('Kuning');
	});

	it('handles a three-item cycle correctly', () => {
		// cycle length 3, 5 shown → next is index 5 % 3 = 2 → 'Kuning'
		const s = new PatternSession({
			cycle: ['Biru', 'Merah', 'Kuning'],
			visible: 5,
			choices: ['Biru', 'Merah', 'Kuning']
		});
		expect(s.shown).toEqual(['Biru', 'Merah', 'Kuning', 'Biru', 'Merah']);
		expect(s.correctChoice).toBe('Kuning');
	});

	it('accepts the right answer exactly once', () => {
		const s = new PatternSession({ cycle: ['Merah', 'Kuning'], choices: ['Merah', 'Kuning'] });
		expect(s.answer('Kuning').correct).toBe(true);
		expect(s.answer('Kuning').correct).toBe(false);
		expect(s.currentStep).toBe('answered-correct');
	});

	it('a wrong answer latches but recovers', () => {
		const s = new PatternSession({ cycle: ['Merah', 'Kuning'], choices: ['Merah', 'Kuning'] });
		expect(s.answer('Merah').correct).toBe(false);
		expect(s.currentStep).toBe('answered-wrong');
		s.acknowledgeWrong();
		expect(s.answer('Kuning').correct).toBe(true);
	});

	it('refuses a stray value without recording it', () => {
		const s = new PatternSession({ cycle: ['Merah', 'Kuning'], choices: ['Merah', 'Kuning', 'Biru'] });
		s.answer('Biru');
		expect(s.currentStep).toBe('answered-wrong');
		s.acknowledgeWrong();
		s.answer('Hijau');
		expect(s.wrongChoices).toEqual(['Biru']);
	});

	it('refuses a cycle of one item, which is not a pattern', () => {
		expect(() => new PatternSession({ cycle: ['Merah'], choices: ['Merah', 'Kuning'] })).toThrow();
	});

	it('refuses a cycle that repeats inside one turn', () => {
		// [red, red, yellow] is really [red, yellow]; allowing it makes the
		// "what comes next" question ambiguous.
		expect(() =>
			new PatternSession({ cycle: ['Merah', 'Merah', 'Kuning'], choices: ['Merah', 'Kuning'] })
		).toThrow(/repeat/);
	});

	it('refuses an answer that is not on offer', () => {
		expect(() =>
			new PatternSession({ cycle: ['Merah', 'Kuning'], visible: 5, choices: ['Merah', 'Biru'] })
		).toThrow(/not among/);
	});

	it('refuses a pattern longer than a child can hold in mind', () => {
		expect(() =>
			new PatternSession({ cycle: ['Merah', 'Kuning'], visible: 99, choices: ['Merah', 'Kuning'] })
		).toThrow();
	});
});

describe('patternMission — builder', () => {
	it('computes the answer from the cycle and the visible length', () => {
		const m = patternMission({
			id: 'p',
			title: 'Pola',
			instruction: 'Lihat polanya.',
			cycle: ['Merah', 'Kuning'],
			visible: 5,
			choices: ['Merah', 'Kuning', 'Biru']
		});
		expect(m.targetAnswer).toBe('Kuning');
		expect(m.cycle).toEqual(['Merah', 'Kuning']);
		expect(m.visible).toBe(5);
	});

	it('records every colour in the cycle as taught, once each', () => {
		const m = patternMission({
			id: 'p',
			title: 'Pola',
			instruction: 'i',
			cycle: ['Biru', 'Merah', 'Kuning'],
			visible: 5,
			choices: ['Biru', 'Merah', 'Kuning']
		});
		expect(m.teaches?.colors?.sort()).toEqual(['Biru', 'Kuning', 'Merah']);
	});

	it('throws when the answer is not offered', () => {
		expect(() =>
			patternMission({
				id: 'p',
				title: 't',
				instruction: 'i',
				cycle: ['Merah', 'Kuning'],
				visible: 5,
				choices: ['Merah', 'Biru']
			})
		).toThrow(/no button/);
	});
});

describe('the new missions are wired into the game', () => {
	it('the animals area offers a sound mission', () => {
		const soundIds = AREA_ROTATION.animals.filter((id) => getMission(id)?.kind === 'pick-by-sound');
		expect(soundIds.length).toBeGreaterThan(0);
	});

	it('the colours area offers a pattern mission', () => {
		const patternIds = AREA_ROTATION.colors.filter(
			(id) => getMission(id)?.kind === 'continue-pattern'
		);
		expect(patternIds.length).toBeGreaterThan(0);
	});

	it('every sound mission has a cry and every pattern mission has a cycle', () => {
		for (const m of Object.values(MISSIONS)) {
			if (m.kind === 'pick-by-sound') {
				expect(m.sound?.cry, `${m.id} has no cry`).toBeTruthy();
			}
			if (m.kind === 'continue-pattern') {
				expect(m.cycle?.length, `${m.id} has no cycle`).toBeGreaterThanOrEqual(2);
			}
		}
	});

	it('every mission id in every rotation exists', () => {
		for (const [area, ids] of Object.entries(AREA_ROTATION)) {
			for (const id of ids) {
				expect(getMission(id), `${area} rotation names a missing mission ${id}`).toBeDefined();
			}
		}
	});

	it('no mission is in a rotation for the wrong area', () => {
		for (const [area, ids] of Object.entries(AREA_ROTATION)) {
			for (const id of ids) {
				expect(getMission(id)?.area, `${id} is listed under ${area}`).toBe(area);
			}
		}
	});
});
