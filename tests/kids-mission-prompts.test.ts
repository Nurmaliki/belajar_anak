import { describe, expect, it } from 'vitest';
import { MISSIONS, AREA_START_MISSION, nextMissionForArea, areaMissionCount, getMission } from '../src/lib/kids/data/missions';
import { AREA_ORDER } from '../src/lib/kids/data/areas';
import { SHAPES, COLORS } from '../src/lib/kids/data/colors';
import type { MissionDefinition } from '../src/lib/kids/types';

/**
 * The prompt must ask the question, not answer it.
 *
 * Every one of these checks failed before a fix, and each failure was the same
 * mistake in a different area: the mission printed, beside the picture, the very
 * word the child was supposed to choose. A child who can read wins without
 * looking; a child who cannot read is shown text they cannot use.
 */
describe('a prompt never prints its own answer', () => {
	const pickPicture = Object.values(MISSIONS).filter(
		(m: MissionDefinition) => m.kind === 'pick-picture' || m.kind === 'pick-letter'
	);

	it('has such missions to check', () => {
		expect(pickPicture.length).toBeGreaterThan(0);
	});

	it('never shows the answer as the caption', () => {
		for (const mission of pickPicture) {
			const caption = mission.prompt?.caption ?? '';
			// A swatch (`#rrggbb`) and a shape marker (`@shape:...`) carry no text.
			if (caption.startsWith('#') || caption.startsWith('@shape:')) continue;
			expect(caption.toLowerCase(), `${mission.id} prints its answer`).not.toBe(
				(mission.targetAnswer ?? '').toLowerCase()
			);
		}
	});

	it('letter missions show a picture and speak the example word instead', () => {
		const letters = Object.values(MISSIONS).filter((m: MissionDefinition) => m.kind === 'pick-letter');
		expect(letters.length).toBe(26);
		for (const mission of letters) {
			expect(mission.prompt?.icon, `${mission.id} has no picture`).toBeTruthy();
			expect(mission.prompt?.caption, `${mission.id} still prints a word`).toBe('');
			// The example word must still be *reachable* — by ear, in the
			// instruction — or the picture would have no anchor at all.
			expect(mission.instruction, `${mission.id} loses the example word`).toMatch(
				new RegExp(`${mission.targetAnswer}`)
			);
		}
	});
});

describe('shape missions are drawn, not emoji', () => {
	const shapes = Object.values(MISSIONS).filter((m: MissionDefinition) =>
		(m.prompt?.caption ?? '').startsWith('@shape:')
	);

	it('every shape in the catalogue has a drawable form', () => {
		expect(shapes.length).toBe(SHAPES.length);
		const valid = ['circle', 'square', 'triangle', 'star'];
		for (const shape of SHAPES) {
			expect(valid, `${shape.id} has no draw instruction`).toContain(shape.draw);
		}
	});

	it('each shape mission names a real form', () => {
		for (const mission of shapes) {
			const form = (mission.prompt?.caption ?? '').replace('@shape:', '');
			expect(['circle', 'square', 'triangle', 'star']).toContain(form);
		}
	});

	it('the four shapes are four different forms', () => {
		const forms = SHAPES.map((s) => s.draw);
		expect(new Set(forms).size).toBe(forms.length);
	});
});

describe('colour missions keep a real swatch', () => {
	it('the prompt is a hex colour with no text', () => {
		const colours = Object.values(MISSIONS).filter((m: MissionDefinition) =>
			(m.prompt?.caption ?? '').startsWith('#')
		);
		expect(colours.length).toBeGreaterThan(0);
		for (const mission of colours) {
			const hex = (mission.prompt?.caption ?? '').slice(1);
			expect(hex, `${mission.id} is not a hex colour`).toMatch(/^[0-9a-f]{6}$/);
		}
	});

	it('each swatch is the colour it asks about', () => {
		for (const mission of Object.values(MISSIONS)) {
			const caption = mission.prompt?.caption ?? '';
			if (!caption.startsWith('#')) continue;
			const entry = COLORS.find((c) => c.name === mission.targetAnswer);
			expect(entry, `${mission.id} has no colour entry`).toBeDefined();
			expect(parseInt(caption.slice(1), 16)).toBe(entry!.hex);
		}
	});
});

describe('an area offers the next mission once one is finished', () => {
	it('does not repeat a completed mission inside the same session', () => {
		// This is the regression the engine's `markMissionComplete` exists for:
		// the list used to be a constructor snapshot, so a child who finished
		// a mission and walked back into the same area got it again.
		const first = AREA_START_MISSION.alphabet;
		expect(nextMissionForArea('alphabet', [])).toBe(first);

		const second = nextMissionForArea('alphabet', [first]);
		expect(second).not.toBe(first);
		expect(getMission(second)?.area).toBe('alphabet');
	});

	it('walks the whole rotation before it wraps', () => {
		const seen: string[] = [];
		let done: string[] = [];
		const total = areaMissionCount('animals');
		for (let i = 0; i < total; i++) {
			const next = nextMissionForArea('animals', done);
			expect(seen, `repeated ${next} at step ${i}`).not.toContain(next);
			seen.push(next);
			done = [...done, next];
		}
		expect(seen).toHaveLength(total);
		// Only now does it come back around.
		expect(nextMissionForArea('animals', done)).toBe(AREA_START_MISSION.animals);
	});

	it('every area has more than one mission to advance through', () => {
		for (const area of AREA_ORDER) {
			expect(areaMissionCount(area), `${area} has nothing to advance to`).toBeGreaterThan(1);
		}
	});
});
