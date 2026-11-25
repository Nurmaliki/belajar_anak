import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { LightingManager } from './LightingManager';
import { CameraManager } from './CameraManager';
import { WorldManager, terrainHeight } from './WorldManager';
import { CharacterController } from './CharacterController';
import { InputManager } from './InputManager';
import { InteractionManager } from './InteractionManager';
import { AudioManager } from './AudioManager';
import { AppleGarden } from './AppleGarden';
import { GameLoop } from './GameLoop';
import { AssetManager } from './AssetManager';
import { StateManager } from '../game/StateManager';
import { CountSession } from '../activities/counting/CountSession';
import { ChoiceSession } from '../activities/choices/ChoiceSession';
import { BuildSession } from '../activities/syllables/BuildSession';
import { AdditionSession } from '../activities/addition/AdditionSession';
import { CompareSession } from '../activities/compare/CompareSession';
import { SortSession } from '../activities/sorting/SortSession';
import { SubtractionSession } from '../activities/subtraction/SubtractionSession';
import { BimoController } from './BimoController';
import { attachAccessory, type AttachedAccessory } from './AccessoryRenderer';
import { resolveWearing } from '../data/accessories';
import { ANIMALS } from '../data/animals';
import { nextMissionForArea, getMission } from '../data/missions';
import { getArea, AREAS } from '../data/areas';
import { countingWord } from '../data/numbers';
import type { GameUI, MissionPanelView } from '../ui/GameUI.svelte';
import type { AreaId, MissionDefinition } from '../types';

/**
 * The engine.
 *
 * Owns Three.js and the loop, and is the only place that decides what a tap
 * means. Svelte components call the public methods here and read `GameUI`.
 * No Svelte import appears in this file — that boundary is what lets the whole
 * simulation be reasoned about without a component tree.
 *
 * The engine does **not** touch storage. It reports what happened through
 * `onMissionStart` / `onMissionComplete` and the host saves it, so the
 * persistence rules stay in one testable place (`MissionReward`).
 */

export interface GameEngineOptions {
	canvas: HTMLCanvasElement;
	ui: GameUI;
	onExit: () => void;
	/** Called when a mission begins, before the child has done anything. */
	onMissionStart?: (mission: MissionDefinition) => void;
	/** Called once a mission is answered correctly. */
	onMissionComplete?: (mission: MissionDefinition) => void;
	/** Mission ids already completed, used to pick what an area offers next. */
	completedMissions?: readonly string[];
}

/** How close Bubu must be to an area stage to enter its mission. */
const AREA_TRIGGER_RADIUS = 3.6;
const LOOK_SENSITIVITY = 0.0042;
/**
 * How big each animal is, 0 = tiny, 1 = huge.
 *
 * Only used to choose a voice pitch when imitating its sound. A cow and a chick
 * should not meow in the same register — that is the one cue a child has to
 * tell them apart by ear.
 */
const ANIMAL_DEPTH: Record<string, number> = {
	kucing: 0.55,
	anjing: 0.3,
	sapi: 0.05,
	kambing: 0.25,
	ayam: 0.8,
	bebek: 0.7,
	gajah: 0.0,
	singa: 0.1
};

export class GameEngine {
	readonly sceneManager: SceneManager;
	readonly ui: GameUI;
	readonly states: StateManager;
	private lighting: LightingManager;
	private camera: CameraManager;
	private world: WorldManager;
	private bubu: CharacterController;
	private input: InputManager;
	private interaction: InteractionManager;
	private audio: AudioManager;
	private garden: AppleGarden;
	private bimo: BimoController;
	/** The accessory currently built and parented to Bubu, or null. */
	private wornAccessory: AttachedAccessory | null = null;
	private wearingId = 'none';
	private loop: GameLoop;
	private assets: AssetManager;
	private canvas: HTMLCanvasElement;
	private onExit: () => void;
	private onMissionStart: (mission: MissionDefinition) => void;
	private onMissionComplete: (mission: MissionDefinition) => void;
	/**
	 * Mission ids already finished, newest last.
	 *
	 * Deliberately mutable: the host updates this the moment a mission is won,
	 * through `markMissionComplete`, or the area rotation would replay the
	 * mission the child just finished until the page is reloaded.
	 */
	private completedMissions: readonly string[];
	/** Current counting session, when a counting mission is active. */
	private session: CountSession | null = null;
	/** Current question session, for letter / syllable / picture missions. */
	private choiceSession: ChoiceSession | null = null;
	/** Current word-assembly session, for `assemble-word` missions. */
	private buildSession: BuildSession | null = null;
	/** Current addition session, for `add-groups` missions. */
	private addSession: AdditionSession | null = null;
	/** Current comparison session, for `compare-groups` missions. */
	private compareSession: CompareSession | null = null;
	private sortSession: SortSession | null = null;
	private subtractSession: SubtractionSession | null = null;
	private activeMission: MissionDefinition | null = null;
	/** Id of the area whose mission was last started, to avoid re-triggering. */
	private lastAreaEntered: AreaId | null = null;
	private wrongChoices: string[] = [];
	private selectedChoice: string | null = null;
	/** Whether the current mission has already paid out its star. */
	private awarded = false;
	private disposed = false;
	private cleanups: (() => void)[] = [];
	/**
	 * Pending timers, so leaving a mission cannot leave one behind.
	 *
	 * Every delayed line in this file — the intro-to-active step, the
	 * "have another go" nudge after a wrong answer, the end-of-celebration
	 * cleanup — used a bare `window.setTimeout`. Nothing cancelled them, so a
	 * child who tapped the home button within a couple of seconds left callbacks
	 * running against a disposed engine. Some were merely wasteful; one
	 * (`endMissionUi`) could tear down a *newly started* mission, leaving the
	 * panel closed with the phase still mid-intro and the game unresponsive.
	 */
	private timers = new Set<number>();
	private clock = 0;
	/** Seconds of play time accumulated, reported to progress on exit. */
	private elapsed = 0;
	private lastGroundArea: AreaId | null = null;
	private dragging = false;
	private dragMoved = false;
	private dragStart = { x: 0, y: 0 };
	/** Where a world-space pointer press began, for the Bimo tap. */
	private worldDownAt: { x: number; y: number } | null = null;

	constructor(options: GameEngineOptions) {
		this.canvas = options.canvas;
		this.ui = options.ui;
		this.onExit = options.onExit;
		this.onMissionStart = options.onMissionStart ?? (() => {});
		this.onMissionComplete = options.onMissionComplete ?? (() => {});
		this.completedMissions = options.completedMissions ?? [];
		this.states = new StateManager({ strict: false });

		this.sceneManager = new SceneManager(options.canvas);
		const scene = this.sceneManager.scene;

		this.lighting = new LightingManager(scene, { shadows: this.sceneManager.renderer.shadowMap.enabled });
		this.world = new WorldManager(scene);
		this.camera = new CameraManager(this.sceneManager.aspect);
		this.camera.setGroundSampler((x, z) => terrainHeight(x, z));
		this.camera.setOccluders(this.world.occluders);

		this.bubu = new CharacterController();
		this.bubu.setColliders(this.world.colliders);
		scene.add(this.bubu.root);
		// Spawn on the plaza, facing the counting stage to the north (-Z).
		this.bubu.teleport(0, 4, 0);

		this.input = new InputManager(options.canvas);
		this.interaction = new InteractionManager(this.camera.camera);
		this.audio = new AudioManager();
		this.assets = new AssetManager();
		this.garden = new AppleGarden({ x: AREAS.counting.position.x, z: AREAS.counting.position.z + 1 }, scene);

		// Bimo stands on the plaza beside the spawn point, facing the plaza so
		// the child sees him as soon as the game opens.
		this.bimo = new BimoController(scene, { position: { x: 3.4, z: 2.2 }, facing: -0.5 });

		this.camera.snapTo(this.bubu.focusPoint);
		this.input.onFirstGesture(() => {
			this.audio.unlock();
			this.audio.speak('Halo teman-teman! Aku Bubu. Ayo kita bermain!');
		});

		this.bindInput();
		this.bindResize();
		this.bindUiFlags();

		this.loop = new GameLoop((dt) => this.update(dt));
		this.ui.attachEngine(this);

		// Enter the world.
		this.states.transition('LOADING');
		this.states.transition('MAIN_MENU');
		this.states.transition('WORLD_EXPLORATION');
		this.ui.setPhase(this.states.current);
		this.states.on((next) => this.ui.setPhase(next));

		this.loop.start();
		this.ui.ready = true;
		// A single, explicitly-named hook for browser tests. It exposes read-only
		// position data and nothing that could corrupt a session.
		(window as unknown as Record<string, unknown>).__duniaEngine = {
			getBubuPositionForTest: () => this.bubu.position.clone(),
			getPhaseForTest: () => this.states.current,
			/** Drive the same handler a canvas tap uses, without pixel-hunting. */
			collectForTest: (id: string) => this.collectObject(id),
			/** Drive the same handler an answer button uses. */
			answerForTest: (value: string) => this.submitAnswer(value),
			startMissionForTest: (id: string) => this.startMissionById(id),
			/** Which mission an area would offer right now. */
			nextMissionForTest: (area: AreaId) => nextMissionForArea(area, this.completedMissions),
			/** Leave the current mission the way the "keluar" button does. */
			abandonMissionForTest: () => this.abandonMission(),
			/**
			 * The notice as rendered right now, with its source.
			 *
			 * Exists because the banner is the only path for a grown-up to learn
			 * that progress is not being saved, and a test that cannot see why it
			 * did not appear is a test that cannot be trusted.
			 */
			noticeForTest: () => this.ui.notice,
			/** Greet Bimo without pixel-hunting for a squirrel. */
			greetBimoForTest: () => this.greetBimo(),
			/** Dress Bubu the way the wardrobe does. */
			setWearingForTest: (id: string) => this.setWearing(id, false),
			debugState: () => ({
				apples: this.garden.activeApples.length,
				pickables: this.interaction.pickableIds,
				sessionCount: this.session?.count ?? null,
				canAnswer:
					this.session?.canAnswer() ??
					this.choiceSession?.canAnswer() ??
					this.buildSession?.canAnswer() ??
					this.addSession?.canAnswer() ??
					this.compareSession?.canAnswer() ??
					this.sortSession?.canAnswer() ??
					this.subtractSession?.canAnswer() ??
					null,
				mission: this.activeMission?.id ?? null,
				missionKind: this.activeMission?.kind ?? null,
				phase: this.states.current,
				bubuState: this.bubu.currentState,
				choiceStep: this.choiceSession?.currentStep ?? null,
				buildStep: this.buildSession?.currentStep ?? null,
				buildPlaced: this.buildSession?.placed.length ?? null,
				addStep: this.addSession?.currentStep ?? null,
				compareStep: this.compareSession?.currentStep ?? null,
				sortStep: this.sortSession?.currentStep ?? null,
				sortPlaced: this.sortSession?.placed.length ?? null,
				subtractStep: this.subtractSession?.currentStep ?? null,
				bimoState: this.bimo.currentState,
				bimoHopping: this.bimo.isHopping,
				bimoYaw: this.bimo.root.rotation.y,
				bimoX: this.bimo.position.x,
				bimoZ: this.bimo.position.z,
				wearing: this.wearingId,
				accessoryMeshes: this.wornAccessory
					? (() => {
							let n = 0;
							this.wornAccessory.group.traverse((o) => {
								if (o instanceof THREE.Mesh) n++;
							});
							return n;
						})()
					: 0
			})
		};
		// Probe for a real model; keep the procedural bunny either way.
		void this.assets.loadBubuModel();
	}

	// --- input wiring -----------------------------------------------------

	private bindInput(): void {
		this.cleanups.push(
			this.input.on('jump', () => this.jump()),
			this.input.on('pause', () => this.togglePause())
		);

		const onDown = (e: PointerEvent) => {
			if (!this.states.explorable && this.states.current !== 'MISSION_ACTIVE') return;
			this.dragging = true;
			this.dragMoved = false;
			this.dragStart = { x: e.clientX, y: e.clientY };
		};
		const onUp = (e: PointerEvent) => {
			if (!this.dragging) return;
			this.dragging = false;
			// A tap (not a drag) is an interaction.
			const moved = Math.hypot(e.clientX - this.dragStart.x, e.clientY - this.dragStart.y);
			if (moved < 12) this.handleTap(e.clientX, e.clientY);
		};
		this.canvas.addEventListener('pointerdown', onDown);
		window.addEventListener('pointerup', onUp);

		/**
		 * Tapping Bimo is handled separately from `handleTap`, which only runs
		 * during a mission. He stands in the world to be greeted while the
		 * child is exploring, so his own listener is attached here rather than
		 * widening the mission tap path.
		 */
		const onDownWorld = (e: PointerEvent) => {
			this.worldDownAt = { x: e.clientX, y: e.clientY };
		};
		const onUpWorld = (e: PointerEvent) => {
			const start = this.worldDownAt;
			this.worldDownAt = null;
			if (!start) return;
			if (Math.hypot(e.clientX - start.x, e.clientY - start.y) >= 12) return;
			this.handleExploreTap(e.clientX, e.clientY);
		};
		this.canvas.addEventListener('pointerdown', onDownWorld);
		window.addEventListener('pointerup', onUpWorld);
		this.cleanups.push(() => {
			this.canvas.removeEventListener('pointerdown', onDown);
			window.removeEventListener('pointerup', onUp);
			this.canvas.removeEventListener('pointerdown', onDownWorld);
			window.removeEventListener('pointerup', onUpWorld);
		});
	}

	private bindResize(): void {
		const onResize = () => {
			this.sceneManager.resize();
			this.camera.resize(this.sceneManager.aspect);
		};
		window.addEventListener('resize', onResize);
		this.cleanups.push(() => window.removeEventListener('resize', onResize));
	}

	private bindUiFlags(): void {
		// Touch controls appear on coarse pointers or narrow screens.
		const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
		const narrow = Math.min(window.innerWidth, window.innerHeight) < 820;
		this.ui.setTouch(coarse || narrow);

		// A tall, narrow viewport squeezes the third-person camera badly, so
		// suggest turning the device. Only a hint: the game stays fully
		// playable, because forcing rotation on iOS is not reliable.
		const applyOrientation = () => {
			const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 820;
			this.ui.setPortrait(portrait);
		};
		applyOrientation();
		window.addEventListener('resize', applyOrientation);
		window.addEventListener('orientationchange', applyOrientation);
		this.cleanups.push(() => {
			window.removeEventListener('resize', applyOrientation);
			window.removeEventListener('orientationchange', applyOrientation);
		});
	}

	/** Tap on the canvas: either pick an apple or just note the tap. */
	private handleTap(clientX: number, clientY: number): void {
		if (this.states.current === 'PAUSED') return;
		if (this.states.current !== 'MISSION_ACTIVE' && this.states.current !== 'MISSION_INTRO') {
			return;
		}
		const rect = this.canvas.getBoundingClientRect();
		const id = this.interaction.pickForgiving(clientX, clientY, rect);
		if (!id) return;
		this.collectObject(id);
	}

	/**
	 * Did the child tap Bimo?
	 *
	 * Checked on screen distance rather than a raycast against his many
	 * primitive meshes: a squirrel built from a dozen spheres has no single
	 * obvious hit box, and a preschooler aims at the character, not at a part.
	 * The forgiving radius is in CSS pixels so it feels the same on any device.
	 */
	private tapHitBimo(clientX: number, clientY: number): boolean {
		const rect = this.canvas.getBoundingClientRect();
		const projected = this.bimo.position.clone();
		projected.y += 0.45; // aim at his middle, not his feet
		projected.project(this.camera.camera);
		if (projected.z > 1) return false; // behind the camera
		const screenX = rect.left + ((projected.x + 1) / 2) * rect.width;
		const screenY = rect.top + ((1 - projected.y) / 2) * rect.height;
		const TAP_RADIUS = 64;
		return Math.hypot(clientX - screenX, clientY - screenY) <= TAP_RADIUS;
	}

	/** Tap on the world while exploring: Bimo notices, everything else does not. */
	private handleExploreTap(clientX: number, clientY: number): void {
		if (this.states.current !== 'WORLD_EXPLORATION') return;
		if (!this.tapHitBimo(clientX, clientY)) return;
		this.greetBimo();
	}

	/** Say hello. Safe to call from the touch "interact" button too. */
	greetBimo(): void {
		// Slow the narration while he hops, so a small child can follow it.
		this.audio.speak('Halo! Aku Bimo, tupai penjaga pulau!', { rate: 0.9 });
		this.bimo.greet();
		this.audio.playSfx('tap');
	}

	// --- dressing up ------------------------------------------------------

	/**
	 * Record that a mission is finished, so the area offers the next one.
	 *
	 * The engine cannot read storage, and `KidsGame` owns the saved record, so
	 * the host calls this after `applyMissionResult` has accepted the star.
	 * Without it the rotation is computed from the list the engine was built
	 * with, and a child who finishes a mission and walks back into the same
	 * area is handed that same mission again.
	 */
	markMissionComplete(missionId: string): void {
		if (this.completedMissions.includes(missionId)) return;
		this.completedMissions = [...this.completedMissions, missionId];
	}

	/** What Bubu is wearing right now, by catalogue id. */
	get wearing(): string {
		return this.wearingId;
	}

	/**
	 * Put an accessory on Bubu, or take it off with `'none'`.
	 *
	 * Every accessory is available at all times — see `data/accessories.ts`.
	 * This method is a wardrobe, not a gate: it never refuses, and an unknown
	 * id simply results in nothing being worn.
	 *
	 * @param announce  speak a short line (true when the child chose it,
	 *                  false when restoring a saved preference at start-up)
	 */
	setWearing(accessoryId: string, announce = true): void {
		this.wearingId = accessoryId;
		this.wornAccessory?.dispose();
		this.wornAccessory = null;

		const accessory = resolveWearing(accessoryId);
		if (accessory) {
			this.wornAccessory = attachAccessory(this.bubu.rig, accessory);
			if (announce) {
				this.audio.playSfx('star');
				this.audio.speak(`${accessory.name}! Bagus sekali!`);
				this.bubu.happy(0.8);
			}
		} else if (announce) {
			this.audio.playSfx('tap');
			this.audio.speak('Baiklah, tidak pakai aksesori.');
		}
		this.ui.setWearing(accessoryId);
	}

	/** Count one object, if the session allows it. */
	private collectObject(id: string): void {
		if (!this.session) return;
		const result = this.session.tap(id);
		if (!result.accepted) {
			// Already counted: a soft blip, no penalty, no double count.
			this.audio.playSfx('gentle');
			return;
		}
		this.garden.pop(id);
		this.interaction.removePickable(id);
		this.bubu.happy(0.7);
		this.audio.playSfx('collect');
		this.audio.speakCount(result.count, countingWord(result.count));
		this.pushMissionView();
		if (result.completed) {
			// Give the last count word room to finish before the question.
			this.audio.speak('Sekarang, ada berapa apel?', { interrupt: false });
		}
	}

	// --- public actions ---------------------------------------------------

	jump(): void {
		if (this.states.current === 'PAUSED') return;
		this.bubu.requestJump();
	}

	/** Touch "interact" button: pick whatever is under the centre of the screen. */
	interactAtCenter(): void {
		const rect = this.canvas.getBoundingClientRect();
		this.handleTap(rect.left + rect.width / 2, rect.top + rect.height / 2);
	}

	setJoystick(x: number, y: number): void {
		this.input.setTouchAxes({ x, y });
	}

	setSoundEnabled(enabled: boolean): void {
		this.audio.updateSettings({ voiceEnabled: enabled, sfxEnabled: enabled, musicEnabled: enabled });
		if (enabled) {
			this.audio.unlock();
			this.audio.speak('Suara dinyalakan.');
		} else {
			this.audio.cancelSpeech();
		}
	}

	pause(): void {
		if (this.states.current === 'PAUSED') return;
		if (this.states.transition('PAUSED')) {
			this.ui.setPhase('PAUSED');
			this.audio.cancelSpeech();
		}
	}

	resume(): void {
		if (this.states.unpause()) {
			this.ui.setPhase(this.states.current);
		}
	}

	private togglePause(): void {
		if (this.states.current === 'PAUSED') this.resume();
		else this.pause();
	}

	// --- missions ---------------------------------------------------------

	/** Start a mission from the menu or a tap, skipping the walk. */
	startMissionById(missionId: string): void {
		const mission = getMission(missionId);
		if (!mission) return;
		// Make sure the phase allows it: from the menu we first enter the world.
		if (this.states.current === 'MAIN_MENU') {
			this.states.transition('WORLD_EXPLORATION');
			this.ui.setPhase(this.states.current);
		}
		// Already mid-mission: leave it cleanly first. Without this the
		// transition to MISSION_INTRO is illegal, the call is silently
		// ignored, and the *previous* mission stays on screen while the
		// caller believes it started a new one.
		//
		// The phase is not a reliable test of this. During the 2.2 s
		// celebration the phase is already WORLD_EXPLORATION while the mission
		// and its session are still live, so a `MISSION_*` check would sail past
		// and overwrite a mission that was still cleaning up.
		if (this.activeMission || this.states.current !== 'WORLD_EXPLORATION') {
			this.endMissionUi();
			if (this.states.current !== 'WORLD_EXPLORATION') {
				this.states.transition('WORLD_EXPLORATION');
				this.ui.setPhase(this.states.current);
			}
		}
		this.beginMission(mission);
	}

	/** Enter a mission triggered by walking onto an area stage. */
	private beginMission(mission: MissionDefinition): void {
		this.activeMission = mission;
		this.wrongChoices = [];
		this.selectedChoice = null;
		// A fresh mission run starts unpaid, however the last one ended.
		this.awarded = false;
		this.states.transition('MISSION_INTRO');
		this.ui.setPhase(this.states.current);

		// Tell the host what is being shown before the child does anything, so
		// "introduced" means introduced, even if they wander off.
		this.onMissionStart(mission);

		const pickables = this.spawnForMission(mission);

		// Walk Bubu up to the garden when the mission starts, so the apples are
		// on screen immediately instead of fifteen metres behind the camera.
		// Ten units back keeps the whole stage — banner, sculpture and apples —
		// inside the frame, instead of planting Bubu against the signpost.
		const area = getArea(mission.area);
		this.bubu.teleport(area.position.x, area.position.z + 10, 0);
		this.camera.setYaw(0);
		this.camera.snapTo(this.bubu.focusPoint);

		this.audio.speak(mission.instruction);
		this.playAnimalSoundAfterwards(mission);
		this.pushMissionView();

		// After the intro line, move to active so the apples are live.
		this.later(() => {
			if (this.disposed) return;
			if (this.states.current === 'MISSION_INTRO') {
				this.states.transition('MISSION_ACTIVE');
				this.ui.setPhase(this.states.current);
			}
		}, 1400);

		void pickables;
	}

	/**
	 * Build the right session for the mission and put its objects in the world.
	 *
	 * Counting missions scatter apples to be counted; every other kind is a
	 * straight question whose answer is a button, so the world stays still and
	 * the child's attention goes to the panel.
	 */
	private spawnForMission(mission: MissionDefinition): string[] {
		this.session = null;
		this.choiceSession = null;
		this.buildSession = null;
		this.addSession = null;
		this.compareSession = null;
		this.sortSession = null;
		this.subtractSession = null;

		if (mission.kind === 'count-and-answer') {
			this.session = new CountSession({
				collectCount: mission.collectCount ?? 3,
				targetNumber: mission.targetNumber ?? 3,
				choices: mission.choices
			});
			const pickables = this.garden.spawn(mission.collectCount ?? 3);
			this.interaction.setPickables(pickables, this.sceneManager.scene);
			return pickables.map((p) => p.id);
		}

		// A question-only mission: no apples, and the buttons are live as soon
		// as the panel appears.
		this.garden.clear();
		this.interaction.clear();

		if (mission.kind === 'add-groups') {
			const [left, right] = mission.addends ?? [1, 1];
			this.addSession = new AdditionSession({ left, right, choices: mission.choices });
			return [];
		}

		if (mission.kind === 'compare-groups') {
			const cmp = mission.compare ?? { left: 2, right: 1, mode: 'more' as const };
			this.compareSession = new CompareSession({
				left: cmp.left,
				right: cmp.right,
				mode: cmp.mode
			});
			return [];
		}

		if (mission.kind === 'subtract-groups') {
			const sub = mission.subtract ?? { start: 4, removed: 1 };
			this.subtractSession = new SubtractionSession({
				start: sub.start,
				removed: sub.removed,
				choices: mission.choices
			});
			return [];
		}

		if (mission.kind === 'sort-groups') {
			this.sortSession = new SortSession({
				answer: mission.sort ?? [1, 2, 3]
			});
			return [];
		}

		if (mission.kind === 'assemble-word') {
			this.buildSession = new BuildSession({
				answer: mission.answerSyllables ?? [mission.choices[0], mission.choices[1]],
				choices: mission.choices
			});
			return [];
		}

		this.choiceSession = new ChoiceSession({
			choices: mission.choices,
			answer: mission.targetAnswer ?? mission.choices[0]
		});
		return [];
	}

	submitAnswer(value: string): void {
		if (this.subtractSession) {
			this.submitSubtractionAnswer(value);
			return;
		}
		if (this.sortSession) {
			this.submitSortAnswer(Number(value));
			return;
		}
		if (this.compareSession) {
			this.submitCompareAnswer(value);
			return;
		}
		if (this.addSession) {
			this.submitAdditionAnswer(value);
			return;
		}
		if (this.buildSession) {
			this.submitBuildAnswer(value);
			return;
		}
		if (this.choiceSession) {
			this.submitChoiceAnswer(value);
			return;
		}
		if (!this.session) return;
		if (!this.session.canAnswer()) {
			// Too early: tell the child what is still missing, gently.
			this.audio.speak('Ayo kumpulkan semua apel dulu!', { interrupt: true });
			return;
		}
		this.selectedChoice = value;
		const result = this.session.answer(value);
		if (!result.correct) {
			this.wrongChoices = [...this.wrongChoices, value];
			this.audio.playSfx('gentle');
			this.audio.speak('Belum tepat. Yuk, coba sekali lagi!', { interrupt: true });
			this.pushMissionView();
			// Let the shake finish, then re-enable the buttons.
			this.later(() => {
				this.session?.acknowledgeWrong();
				this.pushMissionView();
			}, 900);
			return;
		}
		this.rewardSuccess();
	}

	/** Answer a letter / syllable / picture question. */
	private submitChoiceAnswer(value: string): void {
		if (!this.choiceSession) return;
		this.selectedChoice = value;
		const result = this.choiceSession.answer(value);
		if (!result.correct) {
			// A value that was never offered is not the child's mistake: no
			// wobble, no narration, just ignore it.
			if (result.step !== 'answered-wrong') return;
			this.wrongChoices = [...this.choiceSession.wrongChoices];
			this.audio.playSfx('gentle');
			this.audio.speak('Belum tepat. Yuk, coba sekali lagi!', { interrupt: true });
			this.pushMissionView();
			this.later(() => {
				this.choiceSession?.acknowledgeWrong();
				this.pushMissionView();
			}, 900);
			return;
		}
		this.rewardSuccess();
	}

	/** Check the answer to an add-groups mission. */
	private submitAdditionAnswer(value: string): void {
		if (!this.addSession) return;
		this.selectedChoice = value;
		const result = this.addSession.answer(value);

		if (!result.correct) {
			if (this.addSession.currentStep !== 'answered-wrong') return;
			this.wrongChoices = [...this.addSession.wrongChoices];
			this.audio.playSfx('gentle');
			this.audio.speak('Belum tepat. Yuk, hitung lagi!', { interrupt: true });
			this.pushMissionView();
			this.later(() => {
				this.addSession?.acknowledgeWrong();
				this.pushMissionView();
			}, 900);
			return;
		}
		this.rewardSuccess();
	}

	/** Check which group the child tapped in a compare-groups mission. */
	private submitCompareAnswer(value: string): void {
		if (!this.compareSession) return;
		this.selectedChoice = value;
		const result = this.compareSession.answer(value);

		if (!result.correct) {
			if (this.compareSession.currentStep !== 'answered-wrong') return;
			this.wrongChoices = [...this.compareSession.wrongChoices];
			this.audio.playSfx('gentle');
			this.audio.speak('Belum tepat. Yuk, hitung lagi!', { interrupt: true });
			this.pushMissionView();
			this.later(() => {
				this.compareSession?.acknowledgeWrong();
				this.pushMissionView();
			}, 900);
			return;
		}
		this.rewardSuccess();
	}

	/** Check the answer to a subtract-groups mission. */
	private submitSubtractionAnswer(value: string): void {
		if (!this.subtractSession) return;
		this.selectedChoice = value;
		const result = this.subtractSession.answer(value);

		if (!result.correct) {
			if (this.subtractSession.currentStep !== 'answered-wrong') return;
			this.wrongChoices = [...this.subtractSession.wrongChoices];
			this.audio.playSfx('gentle');
			this.audio.speak('Belum tepat. Yuk, hitung apel yang tersisa!', { interrupt: true });
			this.pushMissionView();
			this.later(() => {
				this.subtractSession?.acknowledgeWrong();
				this.pushMissionView();
			}, 900);
			return;
		}
		this.rewardSuccess();
	}

	/** Place the next group in a sort-groups mission, fewest first. */
	private submitSortAnswer(group: number): void {
		if (!this.sortSession) return;
		this.selectedChoice = String(group);
		const result = this.sortSession.place(group);

		if (!result.correct) {
			// A value never offered, or a pick during the wobble: ignore it.
			if (this.sortSession.currentStep !== 'answered-wrong') return;
			this.wrongChoices = this.sortSession.wrongChoices.map(String);
			this.audio.playSfx('gentle');
			this.audio.speak('Belum tepat. Yuk, cari yang paling sedikit dulu!', { interrupt: true });
			this.pushMissionView();
			this.later(() => {
				this.sortSession?.acknowledgeWrong();
				this.pushMissionView();
			}, 900);
			return;
		}

		// A correct group lands in the line and the child keeps going.
		this.audio.playSfx('collect');
		this.bubu.happy(0.5);
		this.pushMissionView();

		if (result.completed) this.rewardSuccess();
	}

	/** Place a syllable into the next slot of an assemble-word mission. */
	private submitBuildAnswer(value: string): void {
		if (!this.buildSession) return;
		this.selectedChoice = value;
		const result = this.buildSession.pick(value);

		if (!result.correct) {
			// A value never offered, or a pick during the wobble: ignore it
			// rather than blaming the child for the program's own slip.
			if (this.buildSession.currentStep !== 'answered-wrong') return;
			this.wrongChoices = [...this.buildSession.wrongChoices];
			this.audio.playSfx('gentle');
			this.audio.speak('Belum tepat. Yuk, coba lagi!', { interrupt: true });
			this.pushMissionView();
			this.later(() => {
				this.buildSession?.acknowledgeWrong();
				this.pushMissionView();
			}, 900);
			return;
		}

		// A correct syllable lands in the slot and the child keeps going.
		this.audio.playSfx('collect');
		this.audio.speak(value, { interrupt: true, rate: 0.85 });
		this.bubu.happy(0.5);
		this.pushMissionView();

		if (result.completed) this.rewardSuccess();
	}

	/** The child got it right: celebrate, award, and report to the host. */
	private rewardSuccess(): void {
		// One award per mission run. The sessions already refuse a second
		// correct answer, but this is the last line: a star must never be
		// awarded twice, whatever else changes.
		if (this.awarded) return;
		const mission = this.activeMission;
		if (!mission) return;
		this.awarded = true;

		this.audio.playSfx('success');
		this.bubu.celebrate(2.4);
		this.bimo.cheer();
		this.states.transition('MISSION_SUCCESS');
		this.ui.setPhase(this.states.current);
		// Record it locally first, so the area this child walks back into
		// offers the *next* mission rather than the one just solved. The host
		// separately persists the star; this list is the engine's own working
		// copy and is refreshed from the host at start-up.
		this.markMissionComplete(mission.id);
		// The host records the star; the HUD mirrors it optimistically.
		this.onMissionComplete(mission);
		this.ui.setStars(this.ui.stars + mission.stars);
		this.later(() => this.audio.playSfx('star'), 500);
		this.audio.speak('Wah, hebat sekali! Kamu berhasil!');
		this.pushMissionView();
		this.states.transition('WORLD_EXPLORATION');
		this.later(() => {
			if (this.disposed) return;
			// The celebration window is 2.2 s long and the phase is already
			// WORLD_EXPLORATION, so anything can start a new mission in the
			// meantime — a menu tap, a test hook, walking into an area. If one
			// did, this timer must not tear it down: it would leave the new
			// mission's panel closed with the phase still mid-intro, and the
			// child holding a game that no longer responds.
			if (this.activeMission?.id !== mission.id) return;
			this.ui.setPhase(this.states.current);
			this.endMissionUi();
		}, 2200);
	}

	replayInstruction(): void {
		if (!this.activeMission) {
			this.audio.speak('Ayo berjalan dan cari tempat belajar!');
			return;
		}
		this.audio.speak(this.activeMission.instruction);
	}

	/** Speak an arbitrary line (used by menus that have not mounted a mission). */
	narrate(text: string): void {
		this.audio.speak(text);
	}

	/**
	 * In Hutan Hewan, actually make the noise.
	 *
	 * The whole point of that area is matching a *sound* to an animal, and until
	 * now the sound only existed as text a pre-reader cannot read. There are no
	 * recorded animal clips in this project, so the onomatopoeia is spoken with
	 * a pitch and pace chosen per animal — big animals low and slow, small ones
	 * high and quick. Queued after the instruction rather than interrupting it.
	 */
	private playAnimalSoundAfterwards(mission: MissionDefinition): void {
		if (mission.area !== 'animals') return;
		const animal = ANIMALS.find((a) => a.name === mission.targetAnswer);
		if (!animal) return;
		const depth = ANIMAL_DEPTH[animal.id] ?? 0.5;
		this.later(() => {
			if (this.disposed) return;
			if (this.activeMission?.id !== mission.id) return;
			this.audio.speakAnimalSound(animal.sound, depth);
		}, 2600);
	}

	/** Announce an area by name and tagline. */
	narrateArea(area: AreaId): void {
		const def = getArea(area);
		this.audio.speak(`${def.name}. ${def.tagline}`);
	}

	/**
	 * Abandon whatever is running and return to a clean exploration state,
	 * used when the child presses the home button and lands on the menu.
	 */
	abandonMissionToMenu(): void {
		if (
			this.session ||
			this.choiceSession ||
			this.buildSession ||
			this.addSession ||
			this.compareSession ||
			this.sortSession ||
			this.subtractSession
		) {
			this.session = null;
			this.choiceSession = null;
			this.buildSession = null;
			this.addSession = null;
			this.compareSession = null;
			this.sortSession = null;
			this.subtractSession = null;
			this.activeMission = null;
			this.wrongChoices = [];
			this.selectedChoice = null;
			this.garden.reset();
			this.interaction.clear();
			this.ui.setMission(null);
			this.lastAreaEntered = null;
		}
		// Put Bubu back at the plaza so re-entering Play is consistent.
		this.bubu.teleport(0, 4, Math.PI);
		this.camera.snapTo(this.bubu.focusPoint);
		if (this.states.current !== 'WORLD_EXPLORATION') {
			this.states.transition('WORLD_EXPLORATION');
			this.ui.setPhase(this.states.current);
		}
	}

	/**
	 * Leave a mission without completing it.
	 *
	 * Deliberately consequence-free: a three-year-old who wanders off has not
	 * "failed" anything.
	 */
	abandonMission(): void {
		if (
			!this.session &&
			!this.choiceSession &&
			!this.buildSession &&
			!this.addSession &&
			!this.compareSession &&
			!this.sortSession &&
			!this.subtractSession
		)
			return;
		if (this.states.current === 'MISSION_SUCCESS') return;
		// Leaving mid-mission is allowed, but the child must not then be stuck
		// standing on a stage that will not offer anything: `endMissionUi`
		// clears the entry latch, so walking off and back on re-offers.
		this.lastAreaEntered = null;
		this.endMissionUi();
		this.audio.speak('Baiklah, ayo kita lihat tempat lain!');
		if (this.states.current !== 'WORLD_EXPLORATION') {
			this.states.transition('WORLD_EXPLORATION');
		}
		this.ui.setPhase(this.states.current);
	}

	private endMissionUi(): void {
		this.session = null;
		this.choiceSession = null;
		this.buildSession = null;
		this.addSession = null;
		this.compareSession = null;
		this.sortSession = null;
		this.subtractSession = null;
		this.activeMission = null;
		this.wrongChoices = [];
		this.selectedChoice = null;
		this.garden.reset();
		this.interaction.clear();
		this.ui.setMission(null);
		// Allow the same area to offer a mission again.
		//
		// This used to be `lastAreaEntered = lastGroundArea`, with a comment
		// claiming it allowed re-entry. It did the opposite: `checkAreaEntry`
		// only fires when the area *changes*, so setting both to the same value
		// meant the first re-entry was silently swallowed. A child who finished a
		// mission was left standing on the stage with no new task and no
		// explanation, and the only way out was to walk away and come back —
		// something a four-year-old has no reason to guess.
		this.lastAreaEntered = null;
	}

	private pushMissionView(): void {
		if (!this.activeMission) {
			this.ui.setMission(null);
			return;
		}
		const mission = this.activeMission;

		if (this.subtractSession) {
			const step = this.subtractSession.currentStep;
			this.ui.setMission({
				mission,
				collected: 0,
				total: 0,
				canAnswer: this.subtractSession.canAnswer(),
				selected: this.selectedChoice,
				feedback: step === 'answered-wrong' ? 'wrong' : step === 'answered-correct' ? 'correct' : null,
				wrongChoices: this.wrongChoices,
				subtract: {
					start: this.subtractSession.start,
					removed: this.subtractSession.removed
				}
			});
			return;
		}

		if (this.sortSession) {
			const step = this.sortSession.currentStep;
			this.ui.setMission({
				mission,
				collected: this.sortSession.placed.length,
				total: this.sortSession.total,
				canAnswer: this.sortSession.canAnswer(),
				selected: this.selectedChoice,
				feedback: step === 'answered-wrong' ? 'wrong' : step === 'complete' ? 'correct' : null,
				wrongChoices: this.wrongChoices,
				sort: [...this.sortSession.answer],
				sorted: [...this.sortSession.placed]
			});
			return;
		}

		if (this.compareSession) {
			const step = this.compareSession.currentStep;
			this.ui.setMission({
				mission,
				collected: 0,
				total: 0,
				canAnswer: this.compareSession.canAnswer(),
				selected: this.selectedChoice,
				feedback:
					step === 'answered-wrong' ? 'wrong' : step === 'answered-correct' ? 'correct' : null,
				wrongChoices: this.wrongChoices,
				compare: {
					left: this.compareSession.left,
					right: this.compareSession.right,
					mode: this.compareSession.mode
				}
			});
			return;
		}

		if (this.addSession) {
			const step = this.addSession.currentStep;
			this.ui.setMission({
				mission,
				collected: 0,
				total: 0,
				canAnswer: this.addSession.canAnswer(),
				selected: this.selectedChoice,
				feedback: step === 'answered-wrong' ? 'wrong' : step === 'answered-correct' ? 'correct' : null,
				wrongChoices: this.wrongChoices,
				addends: [this.addSession.left, this.addSession.right]
			});
			return;
		}

		if (this.buildSession) {
			const step = this.buildSession.currentStep;
			this.ui.setMission({
				mission,
				collected: this.buildSession.placed.length,
				total: this.buildSession.total,
				canAnswer: this.buildSession.canAnswer(),
				selected: this.selectedChoice,
				feedback: step === 'answered-wrong' ? 'wrong' : step === 'complete' ? 'correct' : null,
				wrongChoices: this.wrongChoices,
				placed: [...this.buildSession.placed],
				slots: [...this.buildSession.answer]
			});
			return;
		}

		if (this.choiceSession) {
			const step = this.choiceSession.currentStep;
			this.ui.setMission({
				mission,
				collected: 0,
				total: 0,
				canAnswer: this.choiceSession.canAnswer(),
				selected: this.selectedChoice,
				feedback:
					step === 'answered-correct' ? 'correct' : step === 'answered-wrong' ? 'wrong' : null,
				wrongChoices: this.wrongChoices
			});
			return;
		}

		if (!this.session) {
			this.ui.setMission(null);
			return;
		}

		const view: MissionPanelView = {
			mission,
			collected: this.session.count,
			total: this.session.collectCount,
			canAnswer: this.session.canAnswer(),
			selected: this.selectedChoice,
			feedback:
				this.session.currentStep === 'answered-correct'
					? 'correct'
					: this.session.currentStep === 'answered-wrong'
						? 'wrong'
						: null,
			wrongChoices: this.wrongChoices
		};
		this.ui.setMission(view);
	}

	// --- loop -------------------------------------------------------------

	private update(dt: number): void {
		if (this.disposed) return;
		this.clock += dt;
		this.elapsed += dt;

		const paused = this.states.current === 'PAUSED';
		const canMove =
			!paused &&
			(this.states.current === 'WORLD_EXPLORATION' ||
				this.states.current === 'MISSION_INTRO' ||
				this.states.current === 'MISSION_ACTIVE');

		// Camera look from drag / mouse.
		const look = this.input.consumeLook();
		if (look.dx !== 0 || look.dy !== 0) {
			this.camera.rotate(look.dx * LOOK_SENSITIVITY, -look.dy * LOOK_SENSITIVITY * 0.7);
		}

		const axes = paused ? { x: 0, y: 0 } : this.input.axes();
		const running = Math.hypot(axes.x, axes.y) > 0.92;
		this.bubu.update(
			dt,
			axes,
			{ forward: this.camera.forward, right: this.camera.right },
			running,
			canMove
		);

		this.camera.update(dt, this.bubu.position);
		this.lighting.followSun(this.bubu.position);
		this.world.animate(this.clock);
		this.garden.animate(dt, this.clock);
		this.bimo.update(dt, this.bubu.position);

		if (canMove) this.checkAreaEntry();

		if (this.loop.fps !== this.ui.fps && this.clock % 0.5 < dt) this.ui.fps = this.loop.fps;

		this.sceneManager.render(this.camera.camera);
	}

	/** Enter a mission when Bubu walks onto an area stage. */
	private checkAreaEntry(): void {
		if (
			this.session ||
			this.choiceSession ||
			this.buildSession ||
			this.addSession ||
			this.compareSession ||
			this.sortSession ||
			this.subtractSession
		)
			return; // already in a mission
		const area = this.world.nearestArea(this.bubu.position, AREA_TRIGGER_RADIUS);
		if (area === this.lastGroundArea) return;
		this.lastGroundArea = area;
		if (area) {
			this.ui.setArea(getArea(area).name);
		} else {
			this.ui.setArea(null);
		}
		if (area && area !== this.lastAreaEntered) {
			this.lastAreaEntered = area;
			// Every area now has missions; offer the next unfinished one.
			this.startMissionById(nextMissionForArea(area, this.completedMissions));
		}
	}

	// --- lifecycle --------------------------------------------------------

	/** Seconds played this session, for the parent dashboard. */
	get playSeconds(): number {
		return Math.floor(this.elapsed);
	}

	exitToMenu(): void {
		this.onExit();
	}

	/**
	 * Run something after a delay, and remember it.
	 *
	 * Use this instead of `window.setTimeout` anywhere the callback touches the
	 * engine: `dispose()` clears everything scheduled here, and a disposed
	 * engine never schedules again. The callbacks that used a bare timer were
	 * the only ones that could outlive the object owning them.
	 */
	private later(fn: () => void, ms: number): void {
		if (this.disposed) return;
		const id = window.setTimeout(() => {
			this.timers.delete(id);
			if (this.disposed) return;
			fn();
		}, ms);
		this.timers.add(id);
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.loop.stop();
		// Timers first: a callback that runs between here and the audio teardown
		// would still touch live subsystems, and one that runs afterwards would
		// touch dead ones.
		for (const id of this.timers) clearTimeout(id);
		this.timers.clear();
		for (const c of this.cleanups) c();
		this.cleanups = [];
		this.input.dispose();
		this.interaction.dispose();
		this.audio.dispose();
		this.garden.dispose();
		this.bimo.dispose();
		// Free the accessory before the rig it hangs on, or its geometry leaks
		// into a disposed scene graph.
		this.wornAccessory?.dispose();
		this.wornAccessory = null;
		this.bubu.dispose();
		this.world.dispose();
		this.lighting.dispose();
		this.camera.dispose();
		this.assets.dispose();
		this.sceneManager.dispose();
		void THREE;
	}
}
