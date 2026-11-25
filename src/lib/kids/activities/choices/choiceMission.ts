import type { AreaId, MissionDefinition, MissionKind } from '../../types';

export interface ChoiceMissionInput {
	id: string;
	area: AreaId;
	title: string;
	instruction: string;
	kind: Exclude<MissionKind, 'count-and-answer'>;
	/** The correct choice, as the exact string that appears in `choices`. */
	answer: string;
	choices: string[];
	teaches?: MissionDefinition['teaches'];
	/** What the question panel shows above the buttons. */
	prompt?: MissionDefinition['prompt'];
	stars?: number;
}

/**
 * Builds a "pick the right one" mission.
 *
 * The check that the answer is actually on offer happens here rather than at
 * play time: a mission whose correct answer is not among its buttons is
 * unwinnable, and a child cannot report that bug — they just get stuck.
 */
export function choiceMission(input: ChoiceMissionInput): MissionDefinition {
	if (input.choices.length < 2) {
		throw new Error(`mission "${input.id}" needs at least two choices`);
	}
	if (!input.choices.includes(input.answer)) {
		throw new Error(`mission "${input.id}" offers no button for its answer "${input.answer}"`);
	}
	const seen = new Set<string>();
	for (const c of input.choices) {
		if (seen.has(c)) throw new Error(`mission "${input.id}" repeats the choice "${c}"`);
		seen.add(c);
	}
	return {
		id: input.id,
		area: input.area,
		title: input.title,
		instruction: input.instruction,
		kind: input.kind,
		targetAnswer: input.answer,
		choices: [...input.choices],
		teaches: input.teaches,
		prompt: input.prompt,
		stars: input.stars ?? 1
	};
}

/**
 * Pick `count` distractors from `pool`, excluding `answer`.
 *
 * Deterministic rather than random: the same mission should look the same on
 * every visit, so a child can recognise it. The stride is coprime with the
 * candidate count where possible, so a short pool still yields every candidate
 * instead of looping over a subset and coming up short.
 */
export function distractors(pool: string[], answer: string, count: number, seed = 0): string[] {
	const candidates = pool.filter((c) => c !== answer);
	if (candidates.length === 0) return [];
	const out: string[] = [];
	const n = candidates.length;
	// Step through every candidate before repeating: a stride of 1 guarantees
	// the whole pool is available when `count` is large.
	let idx = ((seed % n) + n) % n;
	for (let k = 0; k < n && out.length < count; k++) {
		out.push(candidates[idx % n]);
		idx++;
	}
	return out;
}

export interface AssembleWordMissionInput {
	id: string;
	area: AreaId;
	title: string;
	instruction: string;
	/** The syllables in the order the child must place them. */
	answerSyllables: string[];
	/** Every syllable offered, including the correct ones. */
	choices: string[];
	teaches?: MissionDefinition['teaches'];
	prompt?: MissionDefinition['prompt'];
	stars?: number;
}

/**
 * Builds a "assemble the word" mission.
 *
 * Validated here for the same reason as `choiceMission`: a mission whose
 * syllables cannot be placed is unwinnable, and the child cannot report that.
 */
export function assembleWordMission(input: AssembleWordMissionInput): MissionDefinition {
	if (input.answerSyllables.length < 2) {
		throw new Error(`mission "${input.id}" needs at least two syllables to assemble`);
	}
	for (const syllable of input.answerSyllables) {
		if (!input.choices.includes(syllable)) {
			throw new Error(`mission "${input.id}" offers no button for the syllable "${syllable}"`);
		}
	}
	return {
		id: input.id,
		area: input.area,
		title: input.title,
		instruction: input.instruction,
		kind: 'assemble-word',
		answerSyllables: [...input.answerSyllables],
		choices: [...input.choices],
		teaches: input.teaches,
		prompt: input.prompt,
		stars: input.stars ?? 1
	};
}
