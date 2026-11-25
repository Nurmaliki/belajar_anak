/**
 * The rules for a single "pick one of these" question, with no Three.js and no
 * DOM — used by the letter, syllable and picture missions, just as
 * `CountSession` is used by the counting mission.
 *
 * The invariants that must never break, and therefore live here rather than in
 * a component:
 *  - **A wrong answer is never a dead end.** The session latches on
 *    `answered-wrong` so the UI can play a wobble, then returns to `asking`.
 *    Nothing is lost, no attempt limit, no timer.
 *  - **A correct answer settles the question.** Once `answered-correct`,
 *    further answers are refused, so a double tap cannot award two stars.
 *  - **Only offered choices count.** A stray value (a mis-routed tap, a stale
 *    button) is refused without being logged as a wrong attempt, because
 *    blaming the child for the program's mistake is exactly wrong here.
 */

export type ChoiceStep = 'asking' | 'answered-correct' | 'answered-wrong';

export interface ChoiceSessionOptions {
	/** The options offered as big buttons. */
	choices: string[];
	/** The one correct option. Must be one of `choices`. */
	answer: string;
}

export interface ChoiceAnswerResult {
	correct: boolean;
	step: ChoiceStep;
}

export class ChoiceSession {
	readonly choices: string[];
	readonly correctChoice: string;
	private step: ChoiceStep = 'asking';
	private wrong: string[] = [];

	constructor(options: ChoiceSessionOptions) {
		if (options.choices.length < 2) {
			throw new Error('a choice list needs at least two options');
		}
		if (!options.choices.includes(options.answer)) {
			throw new Error(`the answer "${options.answer}" is not among the choices`);
		}
		this.choices = [...options.choices];
		this.correctChoice = options.answer;
	}

	get currentStep(): ChoiceStep {
		return this.step;
	}

	/** Whether the buttons should respond right now. */
	canAnswer(): boolean {
		return this.step === 'asking';
	}

	get wrongAttempts(): number {
		return this.wrong.length;
	}

	/** Choices already tried and found wrong, for dimming them. */
	get wrongChoices(): readonly string[] {
		return this.wrong;
	}

	/**
	 * Check a chosen option.
	 *
	 * @returns whether it was correct and the step the session moved to. A
	 * value that was never offered returns `{ correct: false }` while leaving
	 * the session in `asking`, deliberately without recording an attempt.
	 */
	answer(choice: string): ChoiceAnswerResult {
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

	/** Clear the wrong-answer latch once the UI has finished its wobble. */
	acknowledgeWrong(): void {
		if (this.step === 'answered-wrong') this.step = 'asking';
	}

	/** A fresh session with the same question, for "main lagi". */
	restart(): ChoiceSession {
		return new ChoiceSession({ choices: this.choices, answer: this.correctChoice });
	}
}
