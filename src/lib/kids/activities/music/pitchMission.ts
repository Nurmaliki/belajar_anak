import type { MissionDefinition } from '../../types';

export interface PitchMissionInput {
	id: string;
	title: string;
	instruction: string;
	/** Which band the child should pick: 'tinggi' or 'rendah'. */
	answer: 'tinggi' | 'rendah';
	/**
	 * The two notes played, in order, with their frequencies.
	 *
	 * Both are stored rather than one, because the question is a *comparison*:
	 * the panel needs two buttons and the engine needs two tones. A mission
	 * with one tone would be a different (and easier) question.
	 */
	lowFrequency: number;
	highFrequency: number;
	teaches?: MissionDefinition['teaches'];
	stars?: number;
}

/**
 * Builds a "which sound is higher?" mission.
 *
 * The two labels are derived, not passed: a pitch question always offers
 * exactly "Tinggi" and "Rendah", and letting a caller pass its own labels is
 * how a mission ends up asking about a word the child has never heard.
 *
 * Validated at load for the same reason as every other builder — a mission
 * the child cannot answer is a mission they cannot report.
 */
export function pitchMission(input: PitchMissionInput): MissionDefinition {
	if (!(input.highFrequency > input.lowFrequency)) {
		throw new Error(
			`mission "${input.id}" needs a higher pitch above the lower one ` +
				`(${input.highFrequency} is not above ${input.lowFrequency})`
		);
	}
	if (input.answer !== 'tinggi' && input.answer !== 'rendah') {
		throw new Error(`mission "${input.id}" has an unknown pitch answer "${input.answer}"`);
	}
	const answerLabel = input.answer === 'tinggi' ? 'Tinggi' : 'Rendah';
	return {
		id: input.id,
		area: 'music',
		title: input.title,
		instruction: input.instruction,
		kind: 'compare-pitch',
		targetAnswer: answerLabel,
		choices: ['Tinggi', 'Rendah'],
		// No picture: the question is the two tones. Drawing a bird and a bear
		// here would let a child answer by matching animals, which measures
		// nothing about hearing.
		pitches: { low: input.lowFrequency, high: input.highFrequency },
		teaches: input.teaches ?? { music: [answerLabel] },
		stars: input.stars ?? 1
	};
}
