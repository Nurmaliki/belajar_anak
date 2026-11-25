import { describe, expect, it } from 'vitest';
import type { AreaId } from '../src/lib/kids/types';
import { AREA_ORDER } from '../src/lib/kids/data/areas';
import {
	nextMissionForArea,
	areaMissionCount,
	AREA_START_MISSION,
	getMission,
	MISSIONS
} from '../src/lib/kids/data/missions';

describe('nextMissionForArea', () => {
	it('offers the start mission to a child who has completed nothing', () => {
		for (const id of AREA_ORDER) {
			expect(nextMissionForArea(id, [])).toBe(AREA_START_MISSION[id]);
		}
	});

	it('advances to the next mission once the first is done', () => {
		const first = AREA_START_MISSION.alphabet;
		const second = nextMissionForArea('alphabet', [first]);
		expect(second).not.toBe(first);
		expect(getMission(second)?.area).toBe('alphabet');
	});

	it('walks the whole rotation in order without repeats', () => {
		const completed: string[] = [];
		const seen: string[] = [];
		for (let i = 0; i < areaMissionCount('reading'); i++) {
			const next = nextMissionForArea('reading', completed);
			expect(seen).not.toContain(next);
			seen.push(next);
			completed.push(next);
		}
		expect(seen).toHaveLength(areaMissionCount('reading'));
	});

	it('falls back to the first mission when an area is fully completed', () => {
		const all = Object.values(MISSIONS)
			.filter((m) => m.area === 'colors')
			.map((m) => m.id);
		expect(nextMissionForArea('colors', all)).toBe(AREA_START_MISSION.colors);
	});

	it('ignores completed missions belonging to other areas', () => {
		expect(nextMissionForArea('alphabet', ['count-apples-3', 'read-ba'])).toBe(
			AREA_START_MISSION.alphabet
		);
	});

	it('only ever returns a mission that exists and belongs to the area', () => {
		for (const area of AREA_ORDER) {
			const id = nextMissionForArea(area as AreaId, []);
			const mission = getMission(id);
			expect(mission, `${id} is not defined`).toBeDefined();
			expect(mission!.area).toBe(area);
		}
	});
});

describe('nextMissionForArea — gentle adaptive (ZPD)', () => {
	it('keeps the normal forward path when no mission is hard', () => {
		// A single stumble is not "hard": the rotation should not stall on it.
		const perf = { 'count-apples-5': { wrongCount: 1, firstTry: false, completedCount: 0 } };
		expect(nextMissionForArea('counting', [], perf)).toBe('count-apples-3');
	});

	it('re-offers an unfinished mission the child has clearly struggled with', () => {
		const perf = { 'count-apples-5': { wrongCount: 3, firstTry: false, completedCount: 0 } };
		// Even though count-apples-3 is first in the rotation, the child has
		// not struggled with it; the hard one gets another shot first.
		const next = nextMissionForArea('counting', [], perf);
		expect(next).toBe('count-apples-5');
	});

	it('never re-offers a mission that is already completed', () => {
		const perf = { 'count-apples-3': { wrongCount: 4, firstTry: false, completedCount: 1 } };
		const next = nextMissionForArea('counting', ['count-apples-3'], perf);
		expect(next).not.toBe('count-apples-3');
		expect(next).toBe('count-apples-5');
	});

	it('prefers the easiest win once an area is fully done', () => {
		const all = Object.values(MISSIONS)
			.filter((m) => m.area === 'colors')
			.map((m) => m.id);
		const perf = {
			'color-merah': { wrongCount: 4, firstTry: false, completedCount: 1 },
			'color-biru': { wrongCount: 0, firstTry: true, completedCount: 2 }
		};
		expect(nextMissionForArea('colors', all, perf)).toBe('color-biru');
	});
});

describe('areaMissionCount', () => {
	it('matches the number of missions actually defined per area', () => {
		for (const area of AREA_ORDER) {
			const defined = Object.values(MISSIONS).filter((m) => m.area === area).length;
			expect(areaMissionCount(area as AreaId)).toBe(defined);
		}
	});
});
