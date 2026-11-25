/**
 * Early subtraction: a group of objects, some of which go away — how many are
 * left?
 *
 * Modelled on `AdditionSession`, and kept separate from it rather than folded
 * in with a sign flag: the failure modes are different. In addition the child
 * must never double-count a group; in subtraction they must not count the
 * objects that *left*. Two clear rules beat one rule with a conditional.
 *
 * Invariants, the same ones every activity in this project holds:
 *  - **A wrong answer is never a dead end.** Latch, wobble, retry. No limit.
 *  - **A correct answer settles the question**, so a double tap cannot award
 *    two stars.
 *  - **Only offered choices count**; a stray value is refused without being
 *    recorded against the child.
 *  - **The operands must be small and the result positive.** A preschooler is
 *    not served by 9 − 7, and "zero apples left" is a concept for later: a
 *    subtraction that removes everything is refused here.
 */

export type SubtractionStep = 'asking' | 'answered-correct' | 'answered-wrong';

export interface SubtractionSessionOptions {
	/** How many objects are there at the start, e.g. 5 apples. */
	start: number;
	/** How many are taken away, e.g. 2 apples. */
	removed: number;
	/** The answers offered, as displayed labels. */
	choices: string[];
}

export interface SubtractionAnswerResult {
	correct: boolean;
	step: SubtractionStep;
}

/** The largest starting group a mission may show. */
export const MAX_SUBTRACT_START = 6;

export class SubtractionSession {
	readonly start: number;
	readonly removed: number;
	readonly choices: string[];
	/** How many objects are left; the answer the child should reach. */
	readonly remaining: number;
	private step: SubtractionStep = 'asking';
	private wrong: string[] = [];

	constructor(options: SubtractionSessionOptions) {
		const { start, removed, choices } = options;
		if (!Number.isInteger(start) || start < 2 || start > MAX_SUBTRACT_START) {
			throw new Error(`start must be an integer from 2 to ${MAX_SUBTRACT_START}, got ${start}`);
		}
		if (!Number.isInteger(removed) || removed < 1) {
			throw new Error(`removed must be a positive integer, got ${removed}`);
		}
		if (removed >= start) {
			// Taking away everything leaves nothing: that is a lesson about
			// zero, not a subtraction puzzle, and it confuses this age group.
			throw new Error(`removing ${removed} from ${start} leaves nothing to count`);
		}
		if (choices.length < 2) {
			throw new Error('a choice list needs at least two options');
		}
		this.start = start;
		this.removed = removed;
		this.remaining = start - removed;
		this.choices = [...choices];
		if (this.answerIndex() === -1) {
			throw new Error(`choices must contain the remainder ${this.remaining}`);
		}
	}

	get currentStep(): SubtractionStep {
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

	/**
	 * Which choice holds the answer, compared by numeric value so a button
	 * labelled "3" matches however the choices were supplied.
	 */
	private answerIndex(): number {
		return this.choices.findIndex((c) => parseChoice(c) === this.remaining);
	}

	/** The label of the correct choice. */
	get correctChoice(): string {
		return this.choices[this.answerIndex()];
	}

	answer(choice: string): SubtractionAnswerResult {
		const value = parseChoice(choice);
		if (value === null || !this.choices.includes(choice)) {
			return { correct: false, step: this.step };
		}
		if (this.step !== 'asking') {
			return { correct: false, step: this.step };
		}
		if (value === this.remaining) {
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

	restart(): SubtractionSession {
		return new SubtractionSession({
			start: this.start,
			removed: this.removed,
			choices: this.choices
		});
	}
}

/** Parse a button label to a number, or null when it is not a number. */
function parseChoice(choice: string): number | null {
	const trimmed = choice.trim();
	if (trimmed === '') return null;
	const n = Number(trimmed);
	return Number.isFinite(n) ? n : null;
}
