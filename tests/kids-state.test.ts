import { describe, expect, it } from 'vitest';
import { StateManager, allowedTransitionsFrom } from '../src/lib/kids/game/StateManager';
import type { GamePhase } from '../src/lib/kids/types';

/** Advance a fresh manager along a legal path. */
function at(...path: GamePhase[]): StateManager {
	const sm = new StateManager({ strict: true });
	for (const p of path) sm.transition(p);
	return sm;
}

describe('StateManager', () => {
	it('starts in BOOT', () => {
		expect(new StateManager().current).toBe('BOOT');
	});

	it('walks the boot path to the world', () => {
		const sm = at('LOADING', 'MAIN_MENU', 'WORLD_EXPLORATION');
		expect(sm.current).toBe('WORLD_EXPLORATION');
	});

	it('rejects an illegal transition in strict mode', () => {
		const sm = new StateManager({ strict: true });
		expect(() => sm.transition('MISSION_ACTIVE')).toThrow(/Illegal transition/);
	});

	it('ignores an illegal transition in non-strict mode', () => {
		const sm = new StateManager({ strict: false });
		expect(sm.transition('MISSION_ACTIVE')).toBe(false);
		expect(sm.current).toBe('BOOT');
	});

	it('treats a self-transition as a no-op', () => {
		const sm = at('LOADING', 'MAIN_MENU');
		expect(sm.transition('MAIN_MENU')).toBe(false);
		expect(sm.current).toBe('MAIN_MENU');
	});

	it('runs the full counting mission path', () => {
		const sm = at('LOADING', 'MAIN_MENU', 'WORLD_EXPLORATION');
		expect(sm.transition('MISSION_INTRO')).toBe(true);
		expect(sm.transition('MISSION_ACTIVE')).toBe(true);
		expect(sm.transition('MISSION_SUCCESS')).toBe(true);
		expect(sm.transition('WORLD_EXPLORATION')).toBe(true);
	});

	it('can abandon a mission intro back to exploration', () => {
		const sm = at('LOADING', 'MAIN_MENU', 'WORLD_EXPLORATION', 'MISSION_INTRO');
		expect(sm.transition('WORLD_EXPLORATION')).toBe(true);
	});

	it('lets a mission be won straight from the intro', () => {
		// A question mission's answer buttons are on screen and live from the
		// moment the panel appears, which is during MISSION_INTRO. A child who
		// taps correctly before the 1.4 s intro timer elapses was transitioning
		// MISSION_INTRO -> MISSION_SUCCESS, an edge missing from the table. In
		// production (`strict: false`) it was refused silently: the star was
		// still awarded, but the phase never became MISSION_SUCCESS, so the
		// guard that protects the celebration window never engaged.
		const sm = at('LOADING', 'MAIN_MENU', 'WORLD_EXPLORATION', 'MISSION_INTRO');
		expect(sm.transition('MISSION_SUCCESS')).toBe(true);
		expect(sm.current).toBe('MISSION_SUCCESS');
		expect(sm.transition('WORLD_EXPLORATION')).toBe(true);
	});

	it('remembers where pause came from (exploration)', () => {
		const sm = at('LOADING', 'MAIN_MENU', 'WORLD_EXPLORATION');
		sm.transition('PAUSED');
		expect(sm.unpause()).toBe(true);
		expect(sm.current).toBe('WORLD_EXPLORATION');
	});

	it('remembers where pause came from (mission)', () => {
		const sm = at('LOADING', 'MAIN_MENU', 'WORLD_EXPLORATION', 'MISSION_INTRO', 'MISSION_ACTIVE');
		sm.transition('PAUSED');
		expect(sm.unpause()).toBe(true);
		expect(sm.current).toBe('MISSION_ACTIVE');
	});

	it('refuses to pause from the main menu', () => {
		const sm = at('LOADING', 'MAIN_MENU');
		expect(sm.canTransition('PAUSED')).toBe(false);
		expect(() => sm.transition('PAUSED')).toThrow(/Illegal transition/);
		expect(sm.current).toBe('MAIN_MENU');
	});

	it('makes GAME_EXIT terminal', () => {
		const nonStrict = new StateManager({ strict: false });
		nonStrict.transition('LOADING');
		nonStrict.transition('GAME_EXIT');
		expect(nonStrict.current).toBe('GAME_EXIT');
		expect(allowedTransitionsFrom('GAME_EXIT')).toEqual([]);
		expect(nonStrict.transition('MAIN_MENU')).toBe(false);
		expect(nonStrict.current).toBe('GAME_EXIT');
	});

	it('notifies listeners with previous and next', () => {
		const sm = new StateManager({ strict: false });
		const seen: [GamePhase, GamePhase][] = [];
		sm.on((next, prev) => seen.push([prev, next]));
		sm.transition('LOADING');
		expect(seen).toEqual([['BOOT', 'LOADING']]);
	});

	it('stops notifying after unsubscribe', () => {
		const sm = new StateManager({ strict: false });
		let calls = 0;
		const off = sm.on(() => calls++);
		sm.transition('LOADING');
		off();
		sm.transition('MAIN_MENU');
		expect(calls).toBe(1);
	});

	it('reports explorable and in-mission correctly', () => {
		const sm = at('LOADING', 'MAIN_MENU', 'WORLD_EXPLORATION');
		expect(sm.explorable).toBe(true);
		expect(sm.inMission).toBe(false);
		sm.transition('MISSION_INTRO');
		expect(sm.explorable).toBe(true);
		expect(sm.inMission).toBe(true);
		sm.transition('MISSION_ACTIVE');
		expect(sm.explorable).toBe(false);
		expect(sm.inMission).toBe(true);
	});

	it('unpause is a no-op when not paused', () => {
		const sm = at('LOADING', 'MAIN_MENU', 'WORLD_EXPLORATION');
		expect(sm.unpause()).toBe(false);
	});
});
