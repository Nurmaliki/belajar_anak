import * as THREE from 'three';
import { createBimo, type BimoRig } from './Bimo';
import { terrainHeight } from './WorldManager';

/**
 * Bimo's behaviour: stand on his stump, watch Bubu, greet, cheer.
 *
 * Deliberately tiny and self-contained. Bimo has no mechanics — he cannot be
 * failed, cannot block the child, and never asks for anything. He is company:
 * something to recognise, tap, and be proud in front of.
 *
 * The rules, all of which are visible to a child:
 *  - **He turns to look at Bubu** as she walks around the plaza. A character
 *    that stares straight ahead reads as scenery; one that tracks her reads as
 *    alive, and it costs one `lookAt` per frame.
 *  - **Tapping him makes him hop and says hello.** Tapping anything should do
 *    *something*, or a child concludes the game is broken.
 *  - **He cheers when Bubu wins**, but never scolds. There is no sad animation
 *    anywhere in this class.
 *
 * Kept out of `GameEngine` so the timing logic is testable without a canvas:
 * the engine owns the clock, this class owns the pose.
 */

/** How long a hop lasts, in seconds. */
const HOP_SECONDS = 0.75;
/** How long the celebrate pose holds. */
const CHEER_SECONDS = 1.6;
/** Beyond this distance Bimo stops tracking Bubu, to avoid snapping. */
const WATCH_RANGE = 18;

export type BimoState = 'idle' | 'hop' | 'cheer';

export interface BimoOptions {
	/** Where Bimo stands. The y comes from the terrain. */
	position: { x: number; z: number };
	/** Which way he faces when not watching anyone, in radians. */
	facing?: number;
}

export class BimoController {
	private readonly rig: BimoRig;
	private readonly disposeRig: () => void;
	private readonly home: THREE.Vector3;
	private readonly baseFacing: number;

	private state: BimoState = 'idle';
	/** Counts down while a pose plays. */
	private timer = 0;
	/** Seconds since the actor was created, drives the idle breathing. */
	private elapsed = 0;
	/** Height of the current hop above the stump. */
	private hopY = 0;
	/** Current yaw of the body, eased towards the target. */
	private yaw = 0;

	constructor(scene: THREE.Scene, options: BimoOptions) {
		const { rig, dispose } = createBimo();
		this.rig = rig;
		this.disposeRig = dispose;
		this.baseFacing = options.facing ?? 0;
		this.yaw = this.baseFacing;
		this.home = new THREE.Vector3(
			options.position.x,
			terrainHeight(options.position.x, options.position.z),
			options.position.z
		);
		rig.root.position.copy(this.home);
		rig.root.rotation.y = this.baseFacing;
		scene.add(rig.root);
	}

	get root(): THREE.Object3D {
		return this.rig.root;
	}

	/** World position, for hit-testing and tests. */
	get position(): THREE.Vector3 {
		return this.rig.root.position;
	}

	get currentState(): BimoState {
		return this.state;
	}

	/** True while a hop is in the air, used by tests and hit tests. */
	get isHopping(): boolean {
		return this.state === 'hop';
	}

	/** Height of the current hop above the stump, in metres. */
	get hopHeight(): number {
		return this.hopY;
	}

	/** The child tapped Bimo: hop and greet. Re-tapping restarts the hop. */
	greet(): void {
		this.state = 'hop';
		this.timer = HOP_SECONDS;
	}

	/** Bubu finished a mission: wave, and bounce once. Never on failure. */
	cheer(): void {
		this.state = 'cheer';
		this.timer = CHEER_SECONDS;
	}

	/**
	 * Advance one frame.
	 *
	 * @param dt        seconds since the last frame, clamped by the caller
	 * @param lookAt    Bubu's position, or null when she is not in the world
	 */
	update(dt: number, lookAt: THREE.Vector3 | null): void {
		this.elapsed += dt;

		// --- state timer -------------------------------------------------
		if (this.timer > 0) {
			this.timer -= dt;
			if (this.timer <= 0) {
				this.timer = 0;
				this.state = 'idle';
			}
		}

		// --- body tracks Bubu --------------------------------------------
		const target = this.desiredYaw(lookAt);
		// Ease, so he turns rather than snapping — a snapped neck reads as a bug.
		const blend = 1 - Math.exp(-6 * dt);
		this.yaw += shortestAngle(this.yaw, target) * blend;
		this.rig.root.rotation.y = this.yaw;

		// --- pose --------------------------------------------------------
		const { body, head, leftArm, rightArm, tail, leftEar, rightEar } = this.rig;

		// Idle breathing: a slow, tiny vertical swell. Kept small on purpose;
		// a big idle motion competes with the mission panel for attention.
		const breathe = Math.sin(this.elapsed * 2.1) * 0.012;

		this.hopY = 0;
		body.rotation.z = 0;
		head.rotation.z = 0;
		head.rotation.x = 0;
		leftArm.rotation.x = 0;
		rightArm.rotation.x = 0;
		tail.rotation.z = Math.sin(this.elapsed * 1.6) * 0.06;
		leftEar.rotation.x = 0;
		rightEar.rotation.x = 0;

		if (this.state === 'hop') {
			// A single arc: sin gives a smooth up-and-down with no bounce.
			const t = 1 - this.timer / HOP_SECONDS;
			this.hopY = Math.sin(t * Math.PI) * 0.3;
			leftArm.rotation.x = -0.9 * Math.sin(t * Math.PI);
			rightArm.rotation.x = -0.9 * Math.sin(t * Math.PI);
			head.rotation.x = -0.15 * Math.sin(t * Math.PI);
		} else if (this.state === 'cheer') {
			// Arms up, bouncing on the toes, ears flicking.
			const t = 1 - this.timer / CHEER_SECONDS;
			const bounce = Math.abs(Math.sin(t * Math.PI * 3)) * 0.14;
			this.hopY = bounce;
			leftArm.rotation.x = -2.2;
			rightArm.rotation.x = -2.2;
			body.rotation.z = Math.sin(t * Math.PI * 6) * 0.08;
			head.rotation.z = Math.sin(t * Math.PI * 6) * 0.1;
			leftEar.rotation.x = Math.sin(t * Math.PI * 5) * 0.2;
			rightEar.rotation.x = Math.sin(t * Math.PI * 5 + 1) * 0.2;
		}

		body.position.y = breathe + this.hopY;
		this.rig.shadow.scale.setScalar(1 - this.hopY * 0.9);
	}

	/**
	 * The yaw Bimo should hold.
	 *
	 * Faces Bubu while she is close, otherwise returns to his resting facing.
	 * Exposed for tests: the interesting part is *when* he turns, not how the
	 * transform is written.
	 */
	desiredYaw(lookAt: THREE.Vector3 | null): number {
		if (!lookAt) return this.baseFacing;
		const dx = lookAt.x - this.home.x;
		const dz = lookAt.z - this.home.z;
		const distance = Math.hypot(dx, dz);
		if (distance > WATCH_RANGE) return this.baseFacing;
		// Too close to have a meaningful direction; keep the current facing
		// rather than dividing by ~zero and spinning.
		if (distance < 0.35) return this.yaw;
		// The rig faces +Z, so the yaw that looks along (dx, dz) is atan2(dx, dz).
		return Math.atan2(dx, dz);
	}

	/** How far away Bubu can be and still be watched. */
	static readonly WATCH_RANGE = WATCH_RANGE;

	dispose(): void {
		this.rig.root.parent?.remove(this.rig.root);
		this.disposeRig();
	}
}

/** The signed shortest rotation from `from` to `to`, in (-π, π]. */
export function shortestAngle(from: number, to: number): number {
	let d = (to - from) % (Math.PI * 2);
	if (d > Math.PI) d -= Math.PI * 2;
	if (d <= -Math.PI) d += Math.PI * 2;
	return d;
}
