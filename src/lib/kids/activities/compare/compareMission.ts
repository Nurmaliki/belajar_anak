import type { MissionDefinition } from '../../types';
import { MAX_COMPARE, type CompareMode } from './CompareSession';

export interface CompareMissionInput {
	id: string;
	title: string;
	instruction: string;
	/** The two groups shown to the child. */
	left: number;
	right: number;
	/** Whether the child should find the group with more or with fewer. */
	mode: CompareMode;
	stars?: number;
}

/**
 * Builds a "which group has more/fewer?" mission.
 *
 * The answer is a *side*, not a number — the panel offers the left group and
 * the right group as the two buttons, so the child taps objects rather than
 * reading digits. Validated here so an unanswerable question (equal groups, or
 * a group too large to see) never reaches the child.
 */
export function compareMission(input: CompareMissionInput): MissionDefinition {
	const { left, right, mode } = input;
	for (const [name, value] of [
		['left', left],
		['right', right]
	] as const) {
		if (!Number.isInteger(value) || value < 1 || value > MAX_COMPARE) {
			throw new Error(`${name} must be an integer from 1 to ${MAX_COMPARE}, got ${value}`);
		}
	}
	if (left === right) {
		throw new Error(`mission "${input.id}" compares two equal groups`);
	}
	return {
		id: input.id,
		area: 'counting',
		title: input.title,
		instruction: input.instruction,
		kind: 'compare-groups',
		compare: { left, right, mode },
		choices: ['left', 'right'],
		// Comparing two groups teaches both quantities: the child has to see
		// "four" and "two" to say which is more. Leaving this empty meant the
		// dashboard's number list never grew from compare missions, even though
		// the child had just practised exactly those numbers.
		teaches: { numbers: [left, right] },
		stars: input.stars ?? 1
	};
}
