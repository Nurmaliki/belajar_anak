import type { MissionDefinition } from '../../types';
import { MAX_CYCLE, MAX_VISIBLE, MIN_CYCLE } from './PatternSession';

export interface PatternMissionInput {
	id: string;
	title: string;
	instruction: string;
	/** The repeating rule, e.g. `['Merah', 'Kuning']`. */
	cycle: string[];
	/** How many items to show before the gap. Defaults to the session's 5. */
	visible?: number;
	/** Every label offered as a button, including the answer. */
	choices: string[];
	teaches?: MissionDefinition['teaches'];
	stars?: number;
}

/**
 * Builds a "what comes next?" mission from a repeating colour pattern.
 *
 * The answer is computed here and stored in `targetAnswer`, so the panel and
 * the validity test both read one field rather than re-deriving the cycle.
 * Every constraint the session enforces is re-checked at load: a mission whose
 * pattern does not repeat, or whose answer is not on offer, is unwinnable, and
 * a preschooler cannot report that.
 */
export function patternMission(input: PatternMissionInput): MissionDefinition {
	const { cycle, choices } = input;
	if (cycle.length < MIN_CYCLE || cycle.length > MAX_CYCLE) {
		throw new Error(
			`mission "${input.id}" needs a cycle of ${MIN_CYCLE} to ${MAX_CYCLE} items, got ${cycle.length}`
		);
	}
	if (new Set(cycle).size !== cycle.length) {
		throw new Error(`mission "${input.id}" repeats an item inside one cycle`);
	}
	const visible = input.visible ?? 5;
	if (visible > MAX_VISIBLE) {
		throw new Error(`mission "${input.id}" shows more than ${MAX_VISIBLE} items`);
	}
	const answer = cycle[visible % cycle.length];
	if (!choices.includes(answer)) {
		throw new Error(`mission "${input.id}" offers no button for its answer "${answer}"`);
	}
	if (new Set(choices).size !== choices.length) {
		throw new Error(`mission "${input.id}" repeats an answer`);
	}
	return {
		id: input.id,
		area: 'colors',
		title: input.title,
		instruction: input.instruction,
		kind: 'continue-pattern',
		cycle: [...cycle],
		visible,
		targetAnswer: answer,
		choices: [...choices],
		teaches: input.teaches ?? { colors: [...new Set(cycle)] },
		stars: input.stars ?? 1
	};
}
