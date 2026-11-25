import type { MissionDefinition } from '../../types';
import { MAX_GROUP } from './AdditionSession';

export interface AdditionMissionInput {
	id: string;
	title: string;
	instruction: string;
	/** The two groups shown to the child. */
	addends: [number, number];
	/** The answers offered, as labels. */
	choices: number[];
	stars?: number;
}

/**
 * Builds "how many altogether?" mission from two visible groups.
 *
 * The choices are stringified here and only here, matching how
 * `countAndAnswerMission` treats numbers: one representation of "3" so the
 * answer buttons have something exact to compare against.
 */
export function additionMission(input: AdditionMissionInput): MissionDefinition {
	const [left, right] = input.addends;
	const total = left + right;
	for (const [name, value] of [
		['left', left],
		['right', right]
	] as const) {
		if (!Number.isInteger(value) || value < 1 || value > MAX_GROUP) {
			throw new Error(`${name} must be an integer from 1 to ${MAX_GROUP}, got ${value}`);
		}
	}
	if (!input.choices.includes(total)) {
		throw new Error(`choices for "${input.id}" must contain the sum ${total}`);
	}
	return {
		id: input.id,
		area: 'counting',
		title: input.title,
		instruction: input.instruction,
		kind: 'add-groups',
		addends: [left, right],
		targetNumber: total,
		choices: input.choices.map(String),
		teaches: { numbers: [total] },
		stars: input.stars ?? 1
	};
}
