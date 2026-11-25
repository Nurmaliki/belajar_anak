/**
 * Ordering three or more groups by size, with no Three.js and no DOM.
 *
 * This is the step after comparing two groups: the child no longer just picks
 * the bigger pile, they build the whole sequence from fewest to most. It stays
 * answerable without reading digits because every group is drawn as countable
 * objects and the answer is a *line of groups*, not a number.
 *
 * Rules kept here rather than in a component:
 *  - **The groups must all differ.** Two equal piles make the order ambiguous,
 *    so the constructor refuses them instead of shipping a question with two
 *    right answers.
 *  - **Placement is ordered, one decision at a time.** Only the next slot is
 *    filled, so the child is never asked to hold a whole permutation in their
 *    head. A wrong pick wobbles and is retried; nothing already placed is lost.
 *  - **A wrong pick is never a dead end.** Latch on `answered-wrong`,
 *    `acknowledgeWrong()` returns to `sorting`. No limit, no timer.
 *  - **Only offered groups count.** A stray value (a mis-routed tap, a stale
 *    button) is refused without being recorded against the child.
 */

export type SortStep = 'sorting' | 'answered-wrong' | 'complete';

export interface SortSessionOptions {
	/** The group sizes in the order they must be picked, fewest first. */
	answer: number[];
}

export interface SortAnswerResult {
	correct: boolean;
	step: SortStep;
	/** How many groups are placed after this pick. */
	placed: number;
	/** True when this pick completed the sequence. */
	completed: boolean;
}

/** The fewest groups worth sorting: two is a comparison, not a sort. */
export const MIN_SORT = 3;
/** The most groups a preschooler can hold in mind at once. */
export const MAX_SORT = 4;
/** The largest single group a sort may show, matching `CompareSession`. */
export const MAX_SORT_GROUP = 6;

export class SortSession {
	/** The group sizes, fewest first. */
	readonly answer: readonly number[];
	private placedGroups: number[] = [];
	private step: SortStep = 'sorting';
	private wrong: number[] = [];

	constructor(options: SortSessionOptions) {
		const answer = options.answer;
		if (answer.length < MIN_SORT || answer.length > MAX_SORT) {
			throw new Error(`a sort needs ${MIN_SORT} to ${MAX_SORT} groups, got ${answer.length}`);
		}
		for (const value of answer) {
			if (!Number.isInteger(value) || value < 1 || value > MAX_SORT_GROUP) {
				throw new Error(
					`every group must be an integer from 1 to ${MAX_SORT_GROUP}, got ${value}`
				);
			}
		}
		for (let i = 1; i < answer.length; i++) {
			if (answer[i] <= answer[i - 1]) {
				throw new Error('a sort needs groups of strictly increasing size');
			}
		}
		this.answer = [...answer];
	}

	get currentStep(): SortStep {
		return this.step;
	}

	/** The group sizes placed so far, fewest first. */
	get placed(): readonly number[] {
		return this.placedGroups;
	}

	get total(): number {
		return this.answer.length;
	}

	get wrongAttempts(): number {
		return this.wrong.length;
	}

	get wrongChoices(): readonly number[] {
		return this.wrong;
	}

	canAnswer(): boolean {
		return this.step === 'sorting';
	}

	/** The next group that belongs in the line, or null once complete. */
	get nextExpected(): number | null {
		if (this.step === 'complete') return null;
		return this.answer[this.placedGroups.length] ?? null;
	}

	/**
	 * Place a group at the end of the line.
	 *
	 * A value that was never offered, a pick while the wobble is playing, or a
	 * pick after completion is refused without recording an attempt.
	 */
	place(group: number): SortAnswerResult {
		const refuse = (): SortAnswerResult => ({
			correct: false,
			step: this.step,
			placed: this.placedGroups.length,
			completed: false
		});

		// The button for a group can only be tapped once, so a repeat of an
		// already-placed size is not offered and cannot be the right answer.
		if (!this.offerable().includes(group)) return refuse();
		if (this.step !== 'sorting') return refuse();

		if (group !== this.nextExpected) {
			if (!this.wrong.includes(group)) this.wrong.push(group);
			this.step = 'answered-wrong';
			return {
				correct: false,
				step: this.step,
				placed: this.placedGroups.length,
				completed: false
			};
		}

		this.placedGroups.push(group);
		const completed = this.placedGroups.length === this.answer.length;
		if (completed) this.step = 'complete';
		return {
			correct: true,
			step: this.step,
			placed: this.placedGroups.length,
			completed
		};
	}

	/** Sizes still waiting to be placed. */
	offerable(): readonly number[] {
		return this.answer.filter((g) => !this.placedGroups.includes(g));
	}

	/** Clear the wrong latch once the UI has finished its wobble. */
	acknowledgeWrong(): void {
		if (this.step === 'answered-wrong') this.step = 'sorting';
	}

	restart(): SortSession {
		return new SortSession({ answer: [...this.answer] });
	}
}
