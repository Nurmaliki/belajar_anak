/**
 * Continuing a repeating pattern, with no Three.js and no DOM.
 *
 * The pre-mathematics skill behind this game's "what comes next?" mission is
 * *pattern recognition*: seeing that red, yellow, red, yellow is a rule and not
 * a list. It is deliberately built on colours rather than numbers because a
 * three-year-old can match a colour long before they can name a number, and
 * because Kebun Warna currently offers only "pick one picture", which is a
 * single decision with no sequence in it.
 *
 * Rules kept here rather than in a component:
 *  - **The pattern must actually repeat.** A sequence whose cycle does not fit
 *    would have no single right next item, so the constructor refuses it
 *    instead of shipping a question with two answers.
 *  - **The cycle must be a real cycle.** `[a, b, a, b]` with cycle `[a, b]` is
 *    coherent; `[a, b, a, b]` with cycle `[a, b, a]` is not, and the check is
 *    what stops a mistyped mission from reaching a child.
 *  - **A wrong answer is never a dead end.** Latch, wobble, retry.
 *  - **Only offered labels count**; a stray value is refused without being
 *    recorded against the child.
 */

export type PatternStep = 'asking' | 'answered-correct' | 'answered-wrong';

export interface PatternSessionOptions {
	/**
	 * The full repeating cycle, e.g. `['merah', 'kuning']`.
	 *
	 * The visible sequence shown to the child is this cycle repeated, then cut
	 * short so the last item is missing — that missing item is the answer.
	 */
	cycle: string[];
	/** How many items to show before the gap. Must be ≥ cycle length. */
	visible?: number;
	/** Every label offered as a button, including the answer. */
	choices: string[];
}

export interface PatternAnswerResult {
	correct: boolean;
	step: PatternStep;
}

/** How many items a pattern question shows before the gap. */
export const DEFAULT_VISIBLE = 5;
/** The most items worth drawing: more than this and a preschooler loses count. */
export const MAX_VISIBLE = 7;
/** A cycle of one is not a pattern, it is a repeated item. */
export const MIN_CYCLE = 2;
/** Four is the widest rule a child of this age can hold. */
export const MAX_CYCLE = 3;

export class PatternSession {
	/** The rule, in order. */
	readonly cycle: readonly string[];
	/** What the child sees, in order, with the gap already excluded. */
	readonly shown: readonly string[];
	readonly choices: readonly string[];
	private step: PatternStep = 'asking';
	private wrong: string[] = [];

	constructor(options: PatternSessionOptions) {
		const { cycle, choices } = options;
		if (cycle.length < MIN_CYCLE || cycle.length > MAX_CYCLE) {
			throw new Error(
				`a pattern cycle needs ${MIN_CYCLE} to ${MAX_CYCLE} items, got ${cycle.length}`
			);
		}
		if (new Set(cycle).size !== cycle.length) {
			// A cycle like [red, red, yellow] is really [red, yellow]; allowing it
			// would make the "which item comes next" question ambiguous.
			throw new Error('a pattern cycle may not repeat an item inside one cycle');
		}
		if (choices.length < 2) {
			throw new Error('a pattern question needs at least two answers to choose from');
		}

		const visible = options.visible ?? DEFAULT_VISIBLE;
		if (visible > MAX_VISIBLE) {
			throw new Error(`a pattern may show at most ${MAX_VISIBLE} items, got ${visible}`);
		}

		// The answer is whatever follows the last shown item, so the validity
		// check has to run *after* `visible` is known. Checking against cycle[0]
		// instead would pass missions whose answer is not actually on offer.
		const answer = cycle[visible % cycle.length];
		if (!choices.includes(answer)) {
			throw new Error(`the pattern answer "${answer}" is not among the offered choices`);
		}
		if (new Set(choices).size !== choices.length) {
			throw new Error('a pattern question repeats an answer');
		}

		this.cycle = [...cycle];
		this.choices = [...choices];
		// Show `visible` items, then leave a gap for the one that follows.
		this.shown = Array.from({ length: visible }, (_, i) => cycle[i % cycle.length]);
	}

	/** The item the child should pick next. */
	get correctChoice(): string {
		return this.nextItemOf(this.cycle, this.shown.length);
	}

	private nextItemOf(cycle: readonly string[], index: number): string {
		return cycle[index % cycle.length];
	}

	get currentStep(): PatternStep {
		return this.step;
	}

	get wrongChoices(): readonly string[] {
		return this.wrong;
	}

	get wrongAttempts(): number {
		return this.wrong.length;
	}

	canAnswer(): boolean {
		return this.step === 'asking';
	}

	answer(choice: string): PatternAnswerResult {
		if (!this.choices.includes(choice)) {
			return { correct: false, step: this.step };
		}
		if (this.step !== 'asking') {
			return { correct: false, step: this.step };
		}
		if (choice === this.correctChoice) {
			this.step = 'answered-correct';
			return { correct: true, step: this.step };
		}
		if (!this.wrong.includes(choice)) this.wrong.push(choice);
		this.step = 'answered-wrong';
		return { correct: false, step: this.step };
	}

	acknowledgeWrong(): void {
		if (this.step === 'answered-wrong') this.step = 'asking';
	}

	restart(): PatternSession {
		return new PatternSession({
			cycle: [...this.cycle],
			visible: this.shown.length,
			choices: [...this.choices]
		});
	}
}
