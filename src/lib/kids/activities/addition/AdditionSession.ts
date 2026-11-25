/**
 * Early addition: two groups of objects, how many altogether?
 *
 * Separate from `ChoiceSession` because a sum is not a label match. The answer
 * is a *quantity*, so it is validated as a number (the child may tap "6" or the
 * button labelled "enam"), and the session tracks which groups were shown so
 * the UI can draw them as countable objects rather than digits alone.
 *
 * Invariants, the same ones every activity in this project holds:
 *  - **A wrong answer is never a dead end.** It latches, the UI wobbles, then
 *    `acknowledgeWrong()` returns to asking. No attempt limit, no timer.
 *  - **A correct answer settles the question**, so a double tap cannot award
 *    two stars.
 *  - **Only offered choices count**; a stray value is refused without being
 *    recorded against the child.
 *  - **The operands must be small.** A preschooler is not served by 7 + 8; the
 *    constructor refuses sums whose parts exceed what can be counted at a
 *    glance, rather than shipping a mission that looks impossible.
 */

export type AdditionStep = 'asking' | 'answered-correct' | 'answered-wrong';

export interface AdditionSessionOptions {
	/** The left group, e.g. 2 apples. */
	left: number;
	/** The right group, e.g. 1 apple. */
	right: number;
	/** The answers offered, as displayed labels. */
	choices: string[];
}

export interface AdditionAnswerResult {
	correct: boolean;
	step: AdditionStep;
}

/** The largest single group a mission may show. */
export const MAX_GROUP = 5;

export class AdditionSession {
	readonly left: number;
	readonly right: number;
	readonly choices: string[];
	/** The sum the child should reach. */
	readonly total: number;
	private step: AdditionStep = 'asking';
	private wrong: string[] = [];

	constructor(options: AdditionSessionOptions) {
		const { left, right, choices } = options;
		for (const [name, value] of [
			['left', left],
			['right', right]
		] as const) {
			if (!Number.isInteger(value) || value < 1 || value > MAX_GROUP) {
				throw new Error(`${name} must be an integer from 1 to ${MAX_GROUP}, got ${value}`);
			}
		}
		if (choices.length < 2) {
			throw new Error('a choice list needs at least two options');
		}
		this.left = left;
		this.right = right;
		this.total = left + right;
		this.choices = [...choices];
		if (this.answerIndex() === -1) {
			throw new Error(`choices must contain the sum ${this.total}`);
		}
	}

	get currentStep(): AdditionStep {
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
	 * Which choice holds the answer.
	 *
	 * Compares by numeric value, not by string identity, so a button labelled
	 * "6" and an answer typed as 6 match — and a malformed choice cannot
	 * silently become the answer via `Number('') === 0`.
	 */
	private answerIndex(): number {
		return this.choices.findIndex((c) => parseChoice(c) === this.total);
	}

	/** The label of the correct choice. */
	get correctChoice(): string {
		return this.choices[this.answerIndex()];
	}

	answer(choice: string): AdditionAnswerResult {
		const value = parseChoice(choice);
		if (value === null || !this.choices.includes(choice)) {
			// Not one of the buttons: not the child's mistake, so not recorded.
			return { correct: false, step: this.step };
		}
		if (this.step !== 'asking') {
			return { correct: false, step: this.step };
		}
		if (value === this.total) {
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

	restart(): AdditionSession {
		return new AdditionSession({ left: this.left, right: this.right, choices: this.choices });
	}
}

/** Parse a button label to a number, or null when it is not a number. */
function parseChoice(choice: string): number | null {
	const trimmed = choice.trim();
	if (trimmed === '') return null;
	const n = Number(trimmed);
	return Number.isFinite(n) ? n : null;
}
