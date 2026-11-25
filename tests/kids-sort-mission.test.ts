import { describe, expect, it } from 'vitest';
import { sortMission } from '../src/lib/kids/activities/sorting/sortMission';
import { MISSIONS, nextMissionForArea, missionsForArea } from '../src/lib/kids/data/missions';
import { MAX_SORT, MAX_SORT_GROUP, MIN_SORT, SortSession } from '../src/lib/kids/activities/sorting/SortSession';

const base = {
	id: 'sort-test',
	title: 'Urutkan',
	instruction: 'Urutkan dari sedikit'
};

describe('sortMission — build-time validation', () => {
	it('stores the groups in the order the child must build', () => {
		const mission = sortMission({ ...base, groups: [3, 1, 2] });
		expect(mission.kind).toBe('sort-groups');
		expect(mission.sort).toEqual([1, 2, 3]);
	});

	it('offers one button per group, labelled by size', () => {
		const mission = sortMission({ ...base, groups: [4, 2, 5, 3] });
		expect(mission.choices).toEqual(['2', '3', '4', '5']);
		expect(new Set(mission.choices).size).toBe(mission.choices.length);
	});

	it('rejects equal groups, which have no single right order', () => {
		expect(() => sortMission({ ...base, groups: [1, 2, 2] })).toThrow();
	});

	it('rejects too few or too many groups', () => {
		expect(() => sortMission({ ...base, groups: [1] })).toThrow();
		expect(() => sortMission({ ...base, groups: [1, 2, 3, 4, 5] })).toThrow();
	});

	it('rejects an uncountable group', () => {
		expect(() => sortMission({ ...base, groups: [1, 2, MAX_SORT_GROUP + 1] })).toThrow();
	});

	it('sorts a mission the session accepts', () => {
		const mission = sortMission({ ...base, groups: [4, 2, 5, 3] });
		expect(() => new SortSession({ answer: mission.sort ?? [] })).not.toThrow();
	});

	it('is issued in the counting area and teaches its numbers', () => {
		const mission = sortMission({ ...base, groups: [1, 2, 3] });
		expect(mission.area).toBe('counting');
		expect(mission.teaches?.numbers).toEqual([1, 2, 3]);
		expect(mission.stars).toBe(1);
	});
});

describe('sort content in the mission table', () => {
	const sorting = Object.values(MISSIONS).filter((m) => m.kind === 'sort-groups');

	it('there are sorting missions to play', () => {
		expect(sorting.length).toBeGreaterThanOrEqual(2);
	});

	it('every sorting mission has a valid, strictly increasing order', () => {
		for (const mission of sorting) {
			const sorted = mission.sort ?? [];
			expect(sorted.length, mission.id).toBeGreaterThanOrEqual(MIN_SORT);
			expect(sorted.length, mission.id).toBeLessThanOrEqual(MAX_SORT);
			for (let i = 1; i < sorted.length; i++) {
				expect(sorted[i], mission.id).toBeGreaterThan(sorted[i - 1]);
			}
			// The child must be able to answer it: the session is the authority.
			expect(() => new SortSession({ answer: sorted }), mission.id).not.toThrow();
		}
	});

	it('a sorting mission answers with groups that are all buttons', () => {
		for (const mission of sorting) {
			for (const group of mission.sort ?? []) {
				expect(mission.choices, mission.id).toContain(String(group));
			}
		}
	});

	it('sorting missions are reachable in the counting rotation', () => {
		const ids = missionsForArea('counting').map((m) => m.id);
		const sortIds = sorting.map((m) => m.id);
		for (const id of sortIds) expect(ids).toContain(id);
		// Offered after the comparisons, never before the first counting task.
		expect(nextMissionForArea('counting', ['count-apples-3', 'count-apples-5', 'count-apples-10'])).not.toMatch(
			/^sort-/
		);
	});
});
