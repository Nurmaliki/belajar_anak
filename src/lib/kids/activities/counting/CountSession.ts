/**
 * The counting activity's rules, with no Three.js and no DOM.
 *
 * This module owns the one rule that must never break: **an object is counted
 * at most once**. Everything visual (which apple pops, which audio plays) reads
 * from `CountSession`, so there is exactly one place where "counted" lives.
 *
 * It is written as a small reducer-style object so a unit test can drive it
 * through a whole session without a renderer.
 */

export type CountStep = 'collecting' | 'answering' | 'answered-correct' | 'answered-wrong';

export interface CountSessionOptions {
	/** How many objects exist in the world. */
	collectCount: number;
	/** How many the child should count to. */
	targetNumber: number;
	/** The number buttons offered, as strings. */
	choices: string[];
}

export interface CountTapResult {
	/** False when the object had already been counted (or is unknown). */
	accepted: boolean;
	/** Count after the tap, i.e. the ordinal of the object just counted. */
	count: number;
	/** True when this tap was the last object. */
	completed: boolean;
}

export interface CountAnswerResult {
	correct: boolean;
	step: CountStep;
}

export class CountSession {
	readonly collectCount: number;
	readonly targetNumber: number;
	readonly choices: string[];
	/** Ids of objects already counted, in the order they were counted. */
	private counted: string[] = [];
	private step: CountStep = 'collecting';
	/** How many wrong answers have been tried, for "coba lagi" wording. */
	private attempts = 0;

	constructor(options: CountSessionOptions) {
		if (options.collectCount < 1) throw new Error('collectCount must be >= 1');
		if (options.choices.length < 2) throw new Error('a choice list needs at least two options');
		this.collectCount = options.collectCount;
		this.targetNumber = options.targetNumber;
		this.choices = [...options.choices];
	}

	get currentStep(): CountStep {
		return this.step;
	}

	/** How many objects have been counted so far. */
	get count(): number {
		return this.counted.length;
	}

	get wrongAttempts(): number {
		return this.attempts;
	}

	/** Objects collected, in the order they were tapped. */
	get collectedIds(): readonly string[] {
		return this.counted;
	}

	/** True once every object has been counted, which unlocks the answer buttons. */
	get allCollected(): boolean {
		return this.counted.length >= this.collectCount;
	}

	/** Whether an object has already been counted. */
	hasCounted(objectId: string): boolean {
		return this.counted.includes(objectId);
	}

	/**
	 * Count an object.
	 *
	 * Returns `accepted: false` for anything already counted, for unknown ids,
	 * and for taps after the question has been answered — so a stray double-tap
	 * can never inflate the count or replay the "Tiga!" clip.
	 */
	tap(objectId: string): CountTapResult {
		if (this.step !== 'collecting' && this.step !== 'answering') {
			return { accepted: false, count: this.count, completed: this.allCollected };
		}
		if (this.hasCounted(objectId)) {
			return { accepted: false, count: this.count, completed: this.allCollected };
		}
		this.counted.push(objectId);
		const completed = this.allCollected;
		if (completed) this.step = 'answering';
		return { accepted: true, count: this.count, completed };
	}

	/** The answer buttons are only meaningful once everything is collected. */
	canAnswer(): boolean {
		return this.step === 'answering';
	}

	/**
	 * Check a chosen number.
	 *
	 * A wrong answer is not a failure: the session moves to `answered-wrong` so
	 * the UI can play a gentle wobble, and the caller returns it to `answering`
	 * with `acknowledgeWrong()` once that beat is over. It never returns the
	 * session to `collecting`, because the apples are already in the basket and
	 * making the child re-collect them would punish a mistake with a chore.
	 */
	answer(choice: string): CountAnswerResult {
		if (this.step !== 'answering') {
			return { correct: false, step: this.step };
		}
		if (choice === String(this.targetNumber)) {
			this.step = 'answered-correct';
			return { correct: true, step: this.step };
		}
		this.attempts += 1;
		this.step = 'answered-wrong';
		return { correct: false, step: this.step };
	}

	/** Reset the wrong-answer latch, used when the UI has finished its wobble. */
	acknowledgeWrong(): void {
		if (this.step === 'answered-wrong') this.step = 'answering';
	}

	/** Fresh session with the same configuration, for "main lagi". */
	restart(): CountSession {
		return new CountSession({
			collectCount: this.collectCount,
			targetNumber: this.targetNumber,
			choices: this.choices
		});
	}
}
