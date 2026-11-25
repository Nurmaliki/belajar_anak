import type { GamePhase } from '../types';

/**
 * Legal phase transitions.
 *
 * Every edge is listed. Anything not here is rejected, which is the whole point:
 * a UI component that flips a boolean of its own is how a game ends up in two
 * states at once, and "MISSION_ACTIVE" while the pause menu thinks it owns the
 * keyboard is exactly that bug.
 */
const ALLOWED: Record<GamePhase, GamePhase[]> = {
	BOOT: ['LOADING', 'GAME_EXIT'],
	LOADING: ['MAIN_MENU', 'GAME_EXIT'],
	MAIN_MENU: ['WORLD_EXPLORATION', 'GAME_EXIT'],
	WORLD_EXPLORATION: ['MISSION_INTRO', 'PAUSED', 'MAIN_MENU', 'GAME_EXIT'],
	MISSION_INTRO: ['MISSION_ACTIVE', 'MISSION_SUCCESS', 'WORLD_EXPLORATION', 'GAME_EXIT'],
	MISSION_ACTIVE: ['MISSION_SUCCESS', 'PAUSED', 'WORLD_EXPLORATION', 'GAME_EXIT'],
	MISSION_SUCCESS: ['WORLD_EXPLORATION', 'MISSION_INTRO', 'GAME_EXIT'],
	PAUSED: ['WORLD_EXPLORATION', 'MISSION_ACTIVE', 'MAIN_MENU', 'GAME_EXIT'],
	GAME_EXIT: []
};

export type PhaseListener = (next: GamePhase, previous: GamePhase) => void;

export class StateManager {
	private phase: GamePhase = 'BOOT';
	private listeners = new Set<PhaseListener>();
	/** The phase to return to when unpausing. */
	private resumePhase: GamePhase = 'WORLD_EXPLORATION';
	/**
	 * When false, illegal transitions are silently ignored instead of throwing.
	 * Production sets this false; tests leave it true so a bad edge is loud.
	 */
	strict: boolean;

	constructor(options: { strict?: boolean } = {}) {
		this.strict = options.strict ?? true;
	}

	get current(): GamePhase {
		return this.phase;
	}

	/** Whether `to` is reachable from the current phase. */
	canTransition(to: GamePhase): boolean {
		return ALLOWED[this.phase].includes(to);
	}

	/**
	 * Move to a new phase.
	 *
	 * Returns whether the transition happened, so callers can avoid playing a
	 * sound or opening a panel for a move that was refused.
	 */
	transition(to: GamePhase): boolean {
		if (to === this.phase) return false;
		if (!this.canTransition(to)) {
			if (this.strict) {
				throw new Error(`Illegal transition ${this.phase} -> ${to}`);
			}
			return false;
		}
		// Entering PAUSED remembers where to go back to.
		if (to === 'PAUSED') this.resumePhase = this.phase;
		const previous = this.phase;
		this.phase = to;
		for (const fn of this.listeners) fn(to, previous);
		return true;
	}

	/**
	 * Leave the pause menu.
	 *
	 * Pausing from WORLD_EXPLORATION or MISSION_ACTIVE both resume to where they
	 * came from; `resumePhase` is what remembers which.
	 */
	unpause(): boolean {
		if (this.phase !== 'PAUSED') return false;
		return this.transition(this.resumePhase);
	}

	/** True while a mission is being played (not merely introduced). */
	get inMission(): boolean {
		return this.phase === 'MISSION_ACTIVE' || this.phase === 'MISSION_INTRO';
	}

	/** True while the player should be able to walk around. */
	get explorable(): boolean {
		return this.phase === 'WORLD_EXPLORATION' || this.phase === 'MISSION_INTRO';
	}

	on(fn: PhaseListener): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}
}

/** Exposed for tests and for documenting the graph. */
export function allowedTransitionsFrom(phase: GamePhase): GamePhase[] {
	return [...ALLOWED[phase]];
}
