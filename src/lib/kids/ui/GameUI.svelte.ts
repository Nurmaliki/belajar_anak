import type { AreaId, GamePhase, MissionDefinition } from '../types';
import type { GameEngine } from '../engine/GameEngine';

/**
 * The reactive bridge between the engine and Svelte.
 *
 * Using Svelte 5 runes in a `.svelte.ts` module means the engine can push state
 * without importing Svelte: it calls plain methods, and components read the
 * `$state` fields. The engine never sees a component, and a component never
 * mutates engine internals.
 *
 * This mirrors the `GameUI` pattern already proven by the farm application.
 */

export interface MissionPanelView {
	mission: MissionDefinition;
	/** How many objects have been counted so far. */
	collected: number;
	/** How many objects there are in total. */
	total: number;
	/** Whether the answer buttons should be enabled. */
	canAnswer: boolean;
	/** Which choice was last selected, for marking. */
	selected: string | null;
	/** 'correct' | 'wrong' | null, for feedback colouring. */
	feedback: 'correct' | 'wrong' | null;
	/** Which choices were already tried and were wrong. */
	wrongChoices: string[];
	/**
	 * Slots already filled, for `assemble-word` missions.
	 *
	 * Empty for every other kind. The panel renders one slot per entry of
	 * `slots` and fills the first `placed.length`.
	 */
	placed?: string[];
	/** Total slots to fill, for `assemble-word` missions. */
	slots?: string[];
	/** The two groups shown, for `add-groups` missions. */
	addends?: [number, number];
	/** The two groups to compare, for `compare-groups` missions. */
	compare?: { left: number; right: number; mode: 'more' | 'fewer' };
	/** The groups to order, for `sort-groups` missions, fewest first. */
	sort?: number[];
	/** Sizes placed so far, for `sort-groups` missions. */
	sorted?: number[];
	/** The groups to subtract, for `subtract-groups` missions. */
	subtract?: { start: number; removed: number };
	/**
	 * Whether the animal's cry has played, for `pick-by-sound` missions.
	 *
	 * The panel uses this to keep the answer buttons disabled and to show
	 * "listen again" instead: a child who has heard nothing is not being
	 * tested, and a button that scores them would be a trap.
	 */
	soundHeard?: boolean;
	/** The repeating rule, for `continue-pattern` missions, e.g. ['Merah','Kuning']. */
	cycle?: string[];
	/** The items already shown before the gap, for `continue-pattern` missions. */
	shown?: string[];
	/** How many of two tones have played, for `compare-pitch` missions. */
	pitchHeard?: number;
	/** True once both tones played, so the buttons are live. */
	pitchReady?: boolean;
}

export class GameUI {
	phase = $state<GamePhase>('BOOT');
	stars = $state(0);
	areaName = $state<string | null>(null);
	/** The current mission panel, or null when no mission is on screen. */
	mission = $state<MissionPanelView | null>(null);
	/** A transient banner message for the parent-facing bits (errors etc.). */
	notice = $state<{ text: string; tone: 'info' | 'warn' | 'success' } | null>(null);
	/** Whether touch controls should be shown. */
	touchEnabled = $state(false);
	/** True on a tall, narrow screen where the 3D view is cramped. */
	portrait = $state(false);
	/** Set once the child or parent dismisses the rotate hint. */
	rotateHintDismissed = $state(false);
	/** Whether the on-screen sound is on, for the HUD toggle. */
	soundOn = $state(true);
	/** The accessory Bubu is wearing, by catalogue id. */
	wearing = $state<string>('none');
	/** Whether the dressing-up picker is open. */
	wardrobeOpen = $state(false);
	fps = $state(0);
	/** True once the engine has finished initialising. */
	ready = $state(false);
	/** Fatal error text, when WebGL or storage fails. */
	error = $state<string | null>(null);

	private engine: GameEngine | null = null;

	attachEngine(engine: GameEngine): void {
		this.engine = engine;
	}

	// --- engine -> UI -----------------------------------------------------

	setPhase(phase: GamePhase): void {
		this.phase = phase;
	}

	setStars(stars: number): void {
		this.stars = stars;
	}

	/** Mirror what the engine actually put on Bubu. */
	setWearing(accessoryId: string): void {
		this.wearing = accessoryId;
	}

	setArea(name: string | null): void {
		this.areaName = name;
	}

	setMission(view: MissionPanelView | null): void {
		this.mission = view;
	}

	setNotice(text: string, tone: 'info' | 'warn' | 'success' = 'info'): void {
		this.notice = { text, tone };
		// A warning may be the only signal that progress is not being saved. It
		// stays until it is replaced: `setNotice` used to clear every message
		// after 3.2 s, so a child who spent longer than that on the celebration
		// never saw it, and neither did anyone watching.
		if (tone === 'warn') return;
		// `window` is absent during server-side rendering; a transient banner is
		// meaningless there, and calling it would throw in the SSR pass.
		if (typeof window === 'undefined') return;
		window.setTimeout(() => {
			if (this.notice?.text === text) this.notice = null;
		}, 3200);
	}

	setError(text: string): void {
		this.error = text;
	}

	setTouch(enabled: boolean): void {
		this.touchEnabled = enabled;
	}

	setPortrait(isPortrait: boolean): void {
		this.portrait = isPortrait;
	}

	dismissRotateHint(): void {
		this.rotateHintDismissed = true;
	}

	// --- UI -> engine -----------------------------------------------------

	/** Start a mission directly (from the menu, bypassing walking there). */
	startMission(missionId: string): void {
		this.engine?.startMissionById(missionId);
	}

	answer(value: string): void {
		this.engine?.submitAnswer(value);
	}

	replayInstruction(): void {
		// A sound mission's "listen again" must replay the *cry*, not the
		// instruction. Routing it through the engine keeps the decision where
		// the mission is known, rather than making the UI branch on kind.
		this.engine?.replayCry();
	}

	/** Put an accessory on Bubu, or take it off with `'none'`. */
	wear(accessoryId: string): void {
		this.engine?.setWearing(accessoryId);
	}

	toggleWardrobe(open?: boolean): void {
		this.wardrobeOpen = open ?? !this.wardrobeOpen;
	}

	requestJump(): void {
		this.engine?.jump();
	}

	requestInteract(): void {
		this.engine?.interactAtCenter();
	}

	feedJoystick(x: number, y: number): void {
		this.engine?.setJoystick(x, y);
	}

	toggleSound(): void {
		this.soundOn = !this.soundOn;
		this.engine?.setSoundEnabled(this.soundOn);
		// Keep the parent-dashboard preference in step with the HUD button.
		try {
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem('dunia-pintar-sound', this.soundOn ? 'on' : 'off');
			}
		} catch {
			/* storage may be unavailable; the toggle still works for this session */
		}
	}

	pause(): void {
		this.engine?.pause();
	}

	resume(): void {
		this.engine?.resume();
	}

	exitMission(): void {
		this.engine?.abandonMission();
	}

	dispose(): void {
		this.engine = null;
	}
}

export type { AreaId };
