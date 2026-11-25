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

describe('areaMissionCount', () => {
	it('matches the number of missions actually defined per area', () => {
		for (const area of AREA_ORDER) {
			const defined = Object.values(MISSIONS).filter((m) => m.area === area).length;
			expect(areaMissionCount(area as AreaId)).toBe(defined);
		}
	});
});
