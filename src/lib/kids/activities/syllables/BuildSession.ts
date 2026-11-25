/**
 * The rules for building a word out of its syllables, with no Three.js and no
 * DOM — the reading counterpart of `CountSession`.
 *
 * The child is shown a word's syllables as slots and picks a syllable for each
 * slot in order. This is the step *past* recognising the first syllable: they
 * actually assemble BA + JU into BAJU.
 *
 * Invariants that live here rather than in a component:
 *  - **A wrong pick is never a dead end.** The session latches on
 *    `answered-wrong`, the UI plays a wobble, then `acknowledgeWrong()` returns
 *    it to `building`. Nothing already placed is lost.
 *  - **Placement is ordered.** Only the next empty slot is filled, so the child
 *    cannot assemble the word backwards and the task stays one decision at a
 *    time.
 *  - **Only offered syllables count.** A stray value is refused without being
 *    logged as a wrong attempt.
 */

export type BuildStep = 'building' | 'answered-wrong' | 'complete';

export interface BuildSessionOptions {
	/** The syllables in the order they must be placed, e.g. ["BA", "JU"]. */
	answer: string[];
	/** Every syllable the child can tap, including the correct ones. */
	choices: string[];
}

export interface BuildAnswerResult {
	correct: boolean;
	step: BuildStep;
	/** How many slots are filled after this pick. */
	placed: number;
	/** True when this pick completed the word. */
	completed: boolean;
}

export class BuildSession {
	readonly answer: readonly string[];
	readonly choices: readonly string[];
	private placedSyllables: string[] = [];
	private step: BuildStep = 'building';
	private wrong: string[] = [];

	constructor(options: BuildSessionOptions) {
		if (options.answer.length < 2) {
			throw new Error('a build session needs at least two syllables');
		}
		if (options.choices.length < 2) {
			throw new Error('a choice list needs at least two options');
		}
		for (const syllable of options.answer) {
			if (!options.choices.includes(syllable)) {
				throw new Error(`the syllable "${syllable}" is not among the choices`);
			}
		}
		this.answer = [...options.answer];
		this.choices = [...options.choices];
	}

	get currentStep(): BuildStep {
		return this.step;
	}

	/** Which slots are filled so far. */
	get placed(): readonly string[] {
		return this.placedSyllables;
	}

	get total(): number {
		return this.answer.length;
	}

	get wrongAttempts(): number {
		return this.wrong.length;
	}

	get wrongChoices(): readonly string[] {
		return this.wrong;
	}

	canAnswer(): boolean {
		return this.step === 'building';
	}

	/** The syllable that belongs in the slot the child is on, or null if done. */
	get nextExpected(): string | null {
		if (this.step === 'complete') return null;
		return this.answer[this.placedSyllables.length] ?? null;
	}

	/**
	 * Place a syllable into the next slot.
	 *
	 * A value that was never offered, or a pick made while the wobble is still
	 * playing or after completion, is refused without recording an attempt.
	 */
	pick(syllable: string): BuildAnswerResult {
		const refuse = (): BuildAnswerResult => ({
			correct: false,
			step: this.step,
			placed: this.placedSyllables.length,
			completed: false
		});

		if (!this.choices.includes(syllable)) return refuse();
		if (this.step !== 'building') return refuse();

		if (syllable !== this.nextExpected) {
			if (!this.wrong.includes(syllable)) this.wrong.push(syllable);
			this.step = 'answered-wrong';
			return {
				correct: false,
				step: this.step,
				placed: this.placedSyllables.length,
				completed: false
			};
		}

		this.placedSyllables.push(syllable);
		const completed = this.placedSyllables.length === this.answer.length;
		if (completed) this.step = 'complete';
		return {
			correct: true,
			step: this.step,
			placed: this.placedSyllables.length,
			completed
		};
	}

	/** Clear the wrong latch once the UI has finished its wobble. */
	acknowledgeWrong(): void {
		if (this.step === 'answered-wrong') this.step = 'building';
	}

	/** The word as far as it has been built, e.g. "BA" or "BAJU". */
	get builtWord(): string {
		return this.placedSyllables.join('');
	}

	restart(): BuildSession {
		return new BuildSession({ answer: [...this.answer], choices: [...this.choices] });
	}
}
