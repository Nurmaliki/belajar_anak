/**
 * Comparing two groups: which has more, or fewer?
 *
 * This is the stepping stone between counting and subtraction. A child who can
 * say "this group has more" already understands that quantity is comparable
 * without knowing the number names — which is why the question is answered by
 * tapping a *group*, not by typing a number.
 *
 * Rules kept here rather than in a component:
 *  - **The two groups must differ.** A "which has more" question with equal
 *    groups is unanswerable, so the constructor refuses it instead of shipping
 *    a question that has no right answer.
 *  - **A wrong answer is never a dead end**: latch, wobble, retry.
 *  - **Only offered group ids count**; a stray value is ignored silently.
 */

export type CompareStep = 'asking' | 'answered-correct' | 'answered-wrong';

/** Which side the child should pick. */
export type CompareMode = 'more' | 'fewer';

export interface CompareSessionOptions {
	/** How many objects the left group holds. */
	left: number;
	/** How many objects the right group holds. */
	right: number;
	/** Whether the child should find the group with more or with fewer. */
	mode: CompareMode;
}

export interface CompareAnswerResult {
	correct: boolean;
	step: CompareStep;
}

/** The group ids the UI offers as buttons. */
export const COMPARE_SIDES = ['left', 'right'] as const;
export type CompareSide = (typeof COMPARE_SIDES)[number];

/** The largest group a comparison may show. */
export const MAX_COMPARE = 6;

export class CompareSession {
	readonly left: number;
	readonly right: number;
	readonly mode: CompareMode;
	private step: CompareStep = 'asking';
	private wrong: string[] = [];

	constructor(options: CompareSessionOptions) {
		const { left, right, mode } = options;
		for (const [name, value] of [
			['left', left],
			['right', right]
		] as const) {
			if (!Number.isInteger(value) || value < 1 || value > MAX_COMPARE) {
				throw new Error(`${name} must be an integer from 1 to ${MAX_COMPARE}, got ${value}`);
			}
		}
		if (left === right) {
			throw new Error('a comparison needs two different quantities');
		}
		this.left = left;
		this.right = right;
		this.mode = mode;
	}

	get currentStep(): CompareStep {
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

	/** Which side the child should tap. */
	get correctChoice(): CompareSide {
		const leftWins = this.mode === 'more' ? this.left > this.right : this.left < this.right;
		return leftWins ? 'left' : 'right';
	}

	answer(side: string): CompareAnswerResult {
		if (!(COMPARE_SIDES as readonly string[]).includes(side)) {
			return { correct: false, step: this.step };
		}
		if (this.step !== 'asking') {
			return { correct: false, step: this.step };
		}
		if (side === this.correctChoice) {
			this.step = 'answered-correct';
			return { correct: true, step: this.step };
		}
		if (!this.wrong.includes(side)) this.wrong.push(side);
		this.step = 'answered-wrong';
		return { correct: false, step: this.step };
	}

	acknowledgeWrong(): void {
		if (this.step === 'answered-wrong') this.step = 'asking';
	}

	restart(): CompareSession {
		return new CompareSession({ left: this.left, right: this.right, mode: this.mode });
	}
}
