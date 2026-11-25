import type { MissionDefinition } from '../../types';
import { MAX_SORT, MAX_SORT_GROUP, MIN_SORT } from './SortSession';

export interface SortMissionInput {
	id: string;
	title: string;
	instruction: string;
	/**
	 * The group sizes in any order. They are sorted here, so the mission's
	 * `sort` field is always the correct order and the UI never has to know
	 * how to compare.
	 */
	groups: number[];
	stars?: number;
}

/**
 * Builds an "order the groups from fewest to most" mission.
 *
 * Validated at module load: a mission with equal groups, too few groups or an
 * uncountable pile is rejected here rather than shown to a child who cannot
 * answer it.
 */
export function sortMission(input: SortMissionInput): MissionDefinition {
	const groups = [...input.groups];
	if (groups.length < MIN_SORT || groups.length > MAX_SORT) {
		throw new Error(
			`mission "${input.id}" must sort ${MIN_SORT} to ${MAX_SORT} groups, got ${groups.length}`
		);
	}
	for (const value of groups) {
		if (!Number.isInteger(value) || value < 1 || value > MAX_SORT_GROUP) {
			throw new Error(
				`mission "${input.id}" has a group outside 1..${MAX_SORT_GROUP}: ${value}`
			);
		}
	}
	const sorted = [...groups].sort((a, b) => a - b);
	for (let i = 1; i < sorted.length; i++) {
		if (sorted[i] === sorted[i - 1]) {
			throw new Error(`mission "${input.id}" repeats the group size ${sorted[i]}`);
		}
	}
	return {
		id: input.id,
		area: 'counting',
		title: input.title,
		instruction: input.instruction,
		kind: 'sort-groups',
		sort: sorted,
		// One button per group, labelled by its size. Two equal sizes would
		// collapse into one button, which the guard above already refuses.
		choices: sorted.map(String),
		teaches: { numbers: sorted },
		stars: input.stars ?? 1
	};
}
