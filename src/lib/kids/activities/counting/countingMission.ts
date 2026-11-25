import type { MissionDefinition } from '../../types';

export interface CountMissionInput {
	id: string;
	title: string;
	instruction: string;
	collectCount: number;
	targetNumber: number;
	choices: number[];
	stars?: number;
	/** What the mission teaches, carried through so progress can record it. */
	teaches?: MissionDefinition['teaches'];
}

/**
 * Builds a count-and-answer mission.
 *
 * The choices are stringified here and nowhere else, so the mission definition
 * has exactly one representation of "3" — the one the answer buttons compare
 * against.
 */
export function countAndAnswerMission(input: CountMissionInput): MissionDefinition {
	if (!Number.isInteger(input.collectCount) || input.collectCount < 1) {
		throw new Error(`collectCount must be a positive integer, got ${input.collectCount}`);
	}
	if (!input.choices.includes(input.targetNumber)) {
		throw new Error(`choices for "${input.id}" must contain the answer ${input.targetNumber}`);
	}
	return {
		id: input.id,
		area: 'counting',
		title: input.title,
		instruction: input.instruction,
		kind: 'count-and-answer',
		collectCount: input.collectCount,
		targetNumber: input.targetNumber,
		choices: input.choices.map(String),
		stars: input.stars ?? 1,
		teaches: input.teaches
	};
}
