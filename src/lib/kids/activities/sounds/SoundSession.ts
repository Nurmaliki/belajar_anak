/**
 * Recognising an animal from its sound, with no Three.js and no DOM.
 *
 * This is a genuinely different skill from `ChoiceSession`'s picture match,
 * which is why it is a separate session rather than a flag on the old one:
 *
 *  - **The question is audio.** A picture match asks "which of these is a
 *    kucing?" and shows the answer among its distractors. A sound match asks
 *    "who says meong?" and shows *nothing* — the child has to recall the
 *    animal before they can look. That is a harder, later step, and it fails
 *    in a way a picture match cannot: with the sound unheard there is no
 *    question at all.
 *
 *  - **A silent device is not a wrong answer.** Browsers block audio until a
 *    gesture, and some browsers have no speech at all. The session therefore
 *    exposes `soundWasHeard`, and refuses to score a pick made before the
 *    sound has played. A child tapping in silence is not being tested, they
 *    are being asked to guess — so the panel must re-offer the sound rather
 *    than record a mistake.
 *
 *  - **The 'repeat' button is part of the activity**, not a convenience. A
 *    pre-reader will want to hear the sound several times; each replay is
 *    free and unlimited, which is the same no-punishment rule every other
 *    activity holds.
 *
 * Invariants, unchanged from the rest of the project:
 *  - A wrong answer latches, wobbles, then returns to asking. Never a dead end.
 *  - A correct answer settles the question, so a double tap cannot double-award.
 *  - Only offered choices count; a stray value is refused without being
 *    recorded against the child.
 */

export type SoundStep = 'listening' | 'answered-correct' | 'answered-wrong';

export interface SoundSessionOptions {
	/** The animal the child must identify, by the label shown on the button. */
	answer: string;
	/** Every animal label offered, including the answer. */
	choices: string[];
}

export interface SoundAnswerResult {
	correct: boolean;
	step: SoundStep;
	/**
	 * True when the pick was refused outright rather than scored.
	 *
	 * A refusal happens when the child taps before the sound has been heard, or
	 * when the value was never one of the buttons. Neither is the child's
	 * mistake, so neither is recorded as a wrong attempt — the UI uses this to
	 * replay the sound instead of showing the "try again" wobble.
	 */
	refused: boolean;
}

export class SoundSession {
	/** The animal the child must pick. Named `correctChoice` to match
	 *  `CompareSession`, and because a bare `answer` collided with the method
	 *  of the same name that scores a pick. */
	readonly correctChoice: string;
	readonly choices: readonly string[];
	private step: SoundStep = 'listening';
	private heard = false;
	private wrong: string[] = [];

	constructor(options: SoundSessionOptions) {
		if (options.choices.length < 2) {
			throw new Error('a sound question needs at least two animals to choose from');
		}
		if (!options.choices.includes(options.answer)) {
			throw new Error(`the answer "${options.answer}" is not among the offered animals`);
		}
		if (new Set(options.choices).size !== options.choices.length) {
			throw new Error('a sound question repeats an animal');
		}
		this.correctChoice = options.answer;
		this.choices = [...options.choices];
	}

	get currentStep(): SoundStep {
		return this.step;
	}

	/** Whether the animal's sound has been played at least once. */
	get soundWasHeard(): boolean {
		return this.heard;
	}

	get wrongChoices(): readonly string[] {
		return this.wrong;
	}

	get wrongAttempts(): number {
		return this.wrong.length;
	}

	/** Whether the buttons should be live. */
	canAnswer(): boolean {
		return this.step !== 'answered-correct';
	}

	/**
	 * Record that the sound actually played.
	 *
	 * Called by the engine once the narration for the animal's cry has
	 * finished (or been handed to the speech engine). Until this is called the
	 * buttons refuse, because the child has not been asked anything yet.
	 */
	markSoundHeard(): void {
		this.heard = true;
	}

	answer(choice: string): SoundAnswerResult {
		// Not one of the buttons: never the child's mistake.
		if (!this.choices.includes(choice)) {
			return { correct: false, step: this.step, refused: true };
		}
		// Already settled: a second tap must not award twice.
		if (this.step === 'answered-correct') {
			return { correct: false, step: this.step, refused: true };
		}
		// Tapped before the sound played: there was no question to answer.
		// Refuse rather than score — the panel replays the sound instead.
		if (!this.heard) {
			return { correct: false, step: this.step, refused: true };
		}
		if (this.step === 'answered-wrong') {
			return { correct: false, step: this.step, refused: true };
		}

		if (choice === this.correctChoice) {
			this.step = 'answered-correct';
			return { correct: true, step: this.step, refused: false };
		}
		if (!this.wrong.includes(choice)) this.wrong.push(choice);
		this.step = 'answered-wrong';
		return { correct: false, step: this.step, refused: false };
	}

	/** Clear the wrong latch once the UI has finished its wobble. */
	acknowledgeWrong(): void {
		if (this.step === 'answered-wrong') this.step = 'listening';
	}

	restart(): SoundSession {
		const next = new SoundSession({ answer: this.correctChoice, choices: [...this.choices] });
		// A restart is a replay, so the sound is heard again immediately.
		next.markSoundHeard();
		return next;
	}
}
