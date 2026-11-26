/**
 * "Which sound is higher?" — a listening question, with no Three.js and no DOM.
 *
 * The musical counterpart of `SoundSession`, and it inherits that session's
 * hardest rule: **a question that has not been heard has not been asked.**
 *
 * Two extra rules are specific to pitch:
 *
 *  - **Both sounds must be played, in order.** A child cannot compare one thing
 *    to nothing. The session tracks *how many* of the two sounds have played
 *    and refuses every answer until both have, rather than the single boolean
 *    `SoundSession` needs (that question plays one sound).
 *
 *  - **The two pitches must differ.** "Which is higher" with two equal notes
 *    has no right answer, so the constructor refuses it instead of shipping an
 *    unanswerable question — the same guard `CompareSession` uses for equal
 *    piles, and for the same reason.
 */

export type PitchStep = 'listening' | 'answered-correct' | 'answered-wrong';

export interface PitchSessionOptions {
	/** Which band the child should end up choosing. */
	answer: 'tinggi' | 'rendah';
	/** The two labels offered, in panel order. */
	choices: string[];
}

export interface PitchAnswerResult {
	correct: boolean;
	step: PitchStep;
	/**
	 * True when the pick was refused rather than scored — tapped before both
	 * sounds played, after success, or a value that is not a button. None of
	 * these is the child's mistake, so none is recorded.
	 */
	refused: boolean;
}

/** How many sounds a pitch question plays before it can be answered. */
export const PITCH_SOUNDS_REQUIRED = 2;

export class PitchSession {
	readonly correctChoice: 'tinggi' | 'rendah';
	readonly choices: readonly string[];
	private step: PitchStep = 'listening';
	private heardCount = 0;
	private wrong: string[] = [];

	constructor(options: PitchSessionOptions) {
		if (!['tinggi', 'rendah'].includes(options.answer)) {
			throw new Error(`unknown pitch answer "${options.answer}"`);
		}
		if (options.choices.length !== 2) {
			throw new Error('a pitch question offers exactly two sounds');
		}
		if (new Set(options.choices).size !== options.choices.length) {
			throw new Error('a pitch question repeats a sound');
		}
		// Both bands must be on offer: asking "which is higher?" with two
		// identical buttons is unanswerable.
		const normalised = options.choices.map((c) => c.toLowerCase());
		if (!normalised.includes('tinggi') || !normalised.includes('rendah')) {
			throw new Error('a pitch question must offer both a high and a low sound');
		}
		this.correctChoice = options.answer;
		this.choices = [...options.choices];
	}

	get currentStep(): PitchStep {
		return this.step;
	}

	/** How many of the two sounds have played. */
	get soundsHeard(): number {
		return this.heardCount;
	}

	/** Whether both sounds have played, i.e. whether the question has been asked. */
	get fullyHeard(): boolean {
		return this.heardCount >= PITCH_SOUNDS_REQUIRED;
	}

	get wrongChoices(): readonly string[] {
		return this.wrong;
	}

	get wrongAttempts(): number {
		return this.wrong.length;
	}

	canAnswer(): boolean {
		return this.step !== 'answered-correct';
	}

	/**
	 * Record that one sound played.
	 *
	 * Called once per sound by the engine, not once per question: it is what
	 * lets the panel unlock exactly when the comparison is complete.
	 */
	markSoundHeard(): void {
		if (this.heardCount < PITCH_SOUNDS_REQUIRED) this.heardCount++;
	}

	/** Restart the count, for a "listen again" that replays both sounds. */
	resetHeard(): void {
		this.heardCount = 0;
	}

	answer(choice: string): PitchAnswerResult {
		const normalised = this.choices.find((c) => c.toLowerCase() === choice.toLowerCase());
		if (!normalised) {
			return { correct: false, step: this.step, refused: true };
		}
		if (this.step === 'answered-correct') {
			return { correct: false, step: this.step, refused: true };
		}
		if (!this.fullyHeard) {
			return { correct: false, step: this.step, refused: true };
		}
		if (this.step === 'answered-wrong') {
			return { correct: false, step: this.step, refused: true };
		}

		if (normalised.toLowerCase() === this.correctChoice.toLowerCase()) {
			this.step = 'answered-correct';
			return { correct: true, step: this.step, refused: false };
		}
		if (!this.wrong.includes(normalised)) this.wrong.push(normalised);
		this.step = 'answered-wrong';
		return { correct: false, step: this.step, refused: false };
	}

	acknowledgeWrong(): void {
		if (this.step === 'answered-wrong') this.step = 'listening';
	}

	restart(): PitchSession {
		const next = new PitchSession({ answer: this.correctChoice, choices: [...this.choices] });
		next.markSoundHeard();
		next.markSoundHeard();
		return next;
	}
}
