import type { MissionDefinition } from '../../types';
import { MAX_SUBTRACT_START } from './SubtractionSession';

export interface SubtractionMissionInput {
	id: string;
	title: string;
	instruction: string;
	/** How many objects there are at the start. */
	start: number;
	/** How many are taken away. */
	removed: number;
	/** The answers offered, as numbers. */
	choices: number[];
	stars?: number;
}

/**
 * Builds a "some are taken away — how many are left?" mission.
 *
 * The choices are stringified here and only here, matching `additionMission`,
 * so the answer buttons have exactly one representation to compare against.
 * An unanswerable question (the remainder missing from the buttons, everything
 * taken away) throws when this module loads rather than reaching a child.
 */
export function subtractionMission(input: SubtractionMissionInput): MissionDefinition {
	const { start, removed } = input;
	if (!Number.isInteger(start) || start < 2 || start > MAX_SUBTRACT_START) {
		throw new Error(
			`start for "${input.id}" must be an integer from 2 to ${MAX_SUBTRACT_START}, got ${start}`
		);
	}
	if (!Number.isInteger(removed) || removed < 1 || removed >= start) {
		throw new Error(`"${input.id}" must remove between 1 and ${start - 1} objects, got ${removed}`);
	}
	const remaining = start - removed;
	if (!input.choices.includes(remaining)) {
		throw new Error(`choices for "${input.id}" must contain the remainder ${remaining}`);
	}
	if (new Set(input.choices).size !== input.choices.length) {
		throw new Error(`choices for "${input.id}" repeat an answer`);
	}
	return {
		id: input.id,
		area: 'counting',
		title: input.title,
		instruction: input.instruction,
		kind: 'subtract-groups',
		subtract: { start, removed },
		targetNumber: remaining,
		choices: input.choices.map(String),
		teaches: { numbers: [remaining] },
		stars: input.stars ?? 1
	};
}
