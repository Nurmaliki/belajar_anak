import type { MissionDefinition } from '../../types';

export interface SoundMissionInput {
	id: string;
	title: string;
	instruction: string;
	/** The animal the child must identify by its cry. */
	answer: string;
	/** The animal labels offered as buttons, including the answer. */
	choices: string[];
	/**
	 * The cry to play, e.g. "Meong".
	 *
	 * Captured here rather than looked up in the panel, for the same reason
	 * `prompt` is explicit data: the panel must not infer content, and the
	 * engine needs the sound *before* the buttons are live.
	 */
	sound: string;
	/** How deep the voice should be, 0 = big animal, 1 = small. */
	depth: number;
	teaches?: MissionDefinition['teaches'];
	stars?: number;
}

/**
 * Builds a "who makes this sound?" mission.
 *
 * Deliberately carries **no prompt picture**: the whole question is the sound.
 * A mission that showed the animal while asking which animal it is would answer
 * itself for any child who can recognise the picture — and a child who cannot
 * hear the device would still "win" without practising anything.
 *
 * Validated at module load for the same reason as every other builder: a
 * mission whose answer is not among its buttons is unwinnable, and a
 * preschooler cannot report that.
 */
export function soundMission(input: SoundMissionInput): MissionDefinition {
	if (input.choices.length < 2) {
		throw new Error(`mission "${input.id}" needs at least two animals to choose from`);
	}
	if (!input.choices.includes(input.answer)) {
		throw new Error(`mission "${input.id}" offers no button for its answer "${input.answer}"`);
	}
	if (new Set(input.choices).size !== input.choices.length) {
		throw new Error(`mission "${input.id}" repeats an animal`);
	}
	if (!input.sound.trim()) {
		throw new Error(`mission "${input.id}" has no sound to play`);
	}
	return {
		id: input.id,
		area: 'animals',
		title: input.title,
		instruction: input.instruction,
		kind: 'pick-by-sound',
		targetAnswer: input.answer,
		choices: [...input.choices],
		// No `prompt`: see the note above. An empty icon with a blank caption
		// is the honest description of a question that is asked by ear.
		teaches: input.teaches ?? { animals: [input.answer] },
		stars: input.stars ?? 1,
		sound: { cry: input.sound, depth: input.depth }
	};
}
