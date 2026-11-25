import * as THREE from 'three';
import { createBubu, type BubuRig } from './Bubu';
import { terrainHeight } from './WorldManager';

/**
 * Drives Bubu.
 *
 * Movement is *camera-relative*: the caller passes intent in view space and the
 * controller turns it into a world direction and a facing angle. Physics is
 * simple on purpose — a bunny hops, it does not ragdoll.
 *
 * The animation is procedural. A `CharacterController` with `AnimationMixer`
 * clips would be preferable with a real `Bubu.glb`; since there is none, the
 * rig's named groups are posed directly. The public surface is the same either
 * way, so swapping in a GLTF model later does not touch the engine.
 */

const WALK_SPEED = 3.4;
const RUN_SPEED = 5.4;
/** Seconds to reach full speed, so movement never snaps on. */
const ACCEL = 9;
const TURN_RATE = 12;
/** Bunny hop: lower and floatier than a person's jump, which suits a rabbit. */
const JUMP_VELOCITY = 6.2;
const GRAVITY = 18;
const PLAYER_RADIUS = 0.38;

export type BubuState = 'idle' | 'walk' | 'run' | 'jump' | 'celebrate' | 'happy';

export class CharacterController {
	readonly rig: BubuRig;
	private disposeRig: () => void;
	private velocity = new THREE.Vector3();
	/** Height above the ground while hopping. */
	private jumpY = 0;
	private vY = 0;
	private grounded = true;
	private walkPhase = 0;
	private facing = 0;
	private state: BubuState = 'idle';
	/** Seconds remaining of a celebrate/happy pose. */
	private celebrateT = 0;
	private colliders: { x: number; z: number; radius: number }[] = [];
	private _moveDir = new THREE.Vector3();

	constructor() {
		const created = createBubu();
		this.rig = created.rig;
		this.disposeRig = created.dispose;
	}

	get root(): THREE.Object3D {
		return this.rig.root;
	}

	get position(): THREE.Vector3 {
		return this.rig.root.position;
	}

	get currentState(): BubuState {
		return this.state;
	}

	setColliders(colliders: { x: number; z: number; radius: number }[]): void {
		this.colliders = colliders;
	}

	/** Place Bubu at a spot on the terrain, facing a heading. */
	teleport(x: number, z: number, facing = 0): void {
		this.rig.root.position.set(x, terrainHeight(x, z), z);
		this.rig.root.rotation.y = facing;
		this.facing = facing;
		this.jumpY = 0;
		this.vY = 0;
		this.grounded = true;
	}

	requestJump(): void {
		if (!this.grounded) return;
		this.vY = JUMP_VELOCITY;
		this.grounded = false;
		this.state = 'jump';
	}

	/** Play the celebration for a moment (mission success). */
	celebrate(seconds = 2.2): void {
		this.celebrateT = seconds;
		this.state = 'celebrate';
	}

	/** A small happy pose, e.g. after collecting an apple. */
	happy(seconds = 0.9): void {
		if (this.celebrateT > 0) return;
		this.celebrateT = seconds;
		this.state = 'happy';
	}

	/**
	 * Advance one frame.
	 *
	 * @param axes  -1..1 intent in *camera* space (y = forward).
	 * @param basis camera forward/right on the ground plane.
	 */
	update(
		dt: number,
		axes: { x: number; y: number },
		basis: { forward: THREE.Vector3; right: THREE.Vector3 },
		running: boolean,
		allowMovement: boolean
	): void {
		const intent = allowMovement ? axes : { x: 0, y: 0 };
		const inputLen = Math.hypot(intent.x, intent.y);

		// Desired world direction from camera basis.
		this._moveDir
			.set(0, 0, 0)
			.addScaledVector(basis.right, intent.x)
			.addScaledVector(basis.forward, intent.y);
		if (this._moveDir.lengthSq() > 0.0001) this._moveDir.normalize();

		const maxSpeed = (running ? RUN_SPEED : WALK_SPEED) * Math.min(1, inputLen);
		const targetVx = this._moveDir.x * maxSpeed;
		const targetVz = this._moveDir.z * maxSpeed;

		// Accelerate/decelerate towards the target velocity.
		const k = 1 - Math.exp(-ACCEL * dt);
		this.velocity.x += (targetVx - this.velocity.x) * k;
		this.velocity.z += (targetVz - this.velocity.z) * k;
		if (Math.abs(this.velocity.x) < 0.01) this.velocity.x = 0;
		if (Math.abs(this.velocity.z) < 0.01) this.velocity.z = 0;

		// Move with swept collision, so a fast run cannot pass through a trunk.
		const stepX = this.velocity.x * dt;
		const stepZ = this.velocity.z * dt;
		const dist = Math.hypot(stepX, stepZ);
		const steps = Math.max(1, Math.ceil(dist / (PLAYER_RADIUS * 0.5)));
		for (let i = 0; i < steps; i++) {
			const nx = this.rig.root.position.x + stepX / steps;
			const nz = this.rig.root.position.z + stepZ / steps;
			const resolved = this.resolve(nx, nz);
			this.rig.root.position.x = resolved.x;
			this.rig.root.position.z = resolved.z;
			if (resolved.blocked) {
				this.velocity.x *= 0.4;
				this.velocity.z *= 0.4;
				break;
			}
		}

		// Jump arc.
		if (!this.grounded) {
			this.vY -= GRAVITY * dt;
			this.jumpY += this.vY * dt;
			if (this.jumpY <= 0) {
				this.jumpY = 0;
				this.vY = 0;
				this.grounded = true;
			}
		}

		const groundY = terrainHeight(this.rig.root.position.x, this.rig.root.position.z);
		this.rig.root.position.y = groundY + this.jumpY;

		// Face the direction of travel.
		const speed = Math.hypot(this.velocity.x, this.velocity.z);
		if (speed > 0.25) {
			const targetFacing = Math.atan2(this.velocity.x, this.velocity.z);
			this.facing = dampAngle(this.facing, targetFacing, TURN_RATE, dt);
			this.rig.root.rotation.y = this.facing;
		}

		this.updateState(speed, running, dt);
		this.animate(dt, speed);
	}

	private updateState(speed: number, running: boolean, dt: number): void {
		if (this.celebrateT > 0) {
			this.celebrateT -= dt;
			if (this.celebrateT <= 0) {
				this.celebrateT = 0;
				this.state = speed > 0.3 ? 'walk' : 'idle';
			}
			return;
		}
		if (!this.grounded) {
			this.state = 'jump';
			return;
		}
		if (speed > 4.2) this.state = 'run';
		else if (speed > 0.3) this.state = 'walk';
		else this.state = 'idle';
	}

	/**
	 * Pose the rig.
	 *
	 * Every branch writes absolute rotations rather than accumulating deltas,
	 * so a state change cannot leave a limb stuck at an angle.
	 */
	private animate(dt: number, speed: number): void {
		const r = this.rig;
		const now = performance.now() / 1000;

		// Idle life: a slow breath and a drifting ear. Without this the bunny
		// looks like a statue the moment the child stops pushing the stick.
		if (this.state === 'idle') {
			const breathe = Math.sin(now * 2.1) * 0.018;
			r.body.scale.set(1 + breathe * 0.5, 1 + breathe, 1 + breathe * 0.5);
			r.body.rotation.x = Math.sin(now * 1.6) * 0.02;
			r.head.rotation.z = Math.sin(now * 1.1) * 0.05;
			r.head.rotation.x = Math.sin(now * 0.9) * 0.03;
			r.leftEar.rotation.z = -0.16 + Math.sin(now * 1.7) * 0.08;
			r.rightEar.rotation.z = 0.16 + Math.sin(now * 1.7 + 0.5) * 0.08;
			r.leftArm.rotation.x = Math.sin(now * 1.6) * 0.05;
			r.rightArm.rotation.x = Math.sin(now * 1.6 + 0.4) * 0.05;
			r.body.position.y = 0;
			return;
		}

		if (this.state === 'walk' || this.state === 'run') {
			// Cadence follows the ground covered, so the feet do not skate.
			const stride = this.state === 'run' ? 1.15 : 0.85;
			this.walkPhase += dt * (speed / stride) * Math.PI;
			const swing = Math.sin(this.walkPhase);
			const amp = this.state === 'run' ? 0.75 : 0.5;

			r.leftLeg.rotation.x = swing * amp;
			r.rightLeg.rotation.x = -swing * amp;
			// Arms counter-swing to the legs.
			r.leftArm.rotation.x = -swing * amp * 0.7;
			r.rightArm.rotation.x = swing * amp * 0.7;

			// Hop bob: two rises per stride, like a running bunny.
			const bob = Math.abs(Math.sin(this.walkPhase)) * (this.state === 'run' ? 0.14 : 0.08);
			r.body.position.y = bob;
			r.body.rotation.x = this.state === 'run' ? 0.14 : 0.05;
			// Ears stream backwards with speed.
			const earBack = this.state === 'run' ? 0.5 : 0.22;
			r.leftEar.rotation.z = -0.16 - Math.sin(this.walkPhase * 2) * 0.12;
			r.leftEar.rotation.x = -earBack + Math.sin(this.walkPhase * 2) * 0.1;
			r.rightEar.rotation.z = 0.16 + Math.sin(this.walkPhase * 2) * 0.12;
			r.rightEar.rotation.x = -earBack + Math.sin(this.walkPhase * 2 + 0.4) * 0.1;
			r.head.rotation.x = -r.body.rotation.x * 0.6;
			r.body.scale.set(1, 1, 1);
			return;
		}

		if (this.state === 'jump') {
			// Tuck on the way up, reach down to land.
			const rise = THREE.MathUtils.clamp(this.vY / JUMP_VELOCITY, -1, 1);
			r.leftLeg.rotation.x = -0.6 + rise * 0.2;
			r.rightLeg.rotation.x = -0.6 + rise * 0.2;
			r.leftArm.rotation.x = -0.9;
			r.rightArm.rotation.x = -0.9;
			r.leftEar.rotation.x = -0.7;
			r.rightEar.rotation.x = -0.7;
			r.body.rotation.x = rise * 0.12;
			r.body.position.y = 0;
			r.body.scale.set(1, 1, 1);
			return;
		}

		if (this.state === 'celebrate') {
			// Arms up, bouncing, ears bouncing — unmistakably "yay".
			const b = Math.abs(Math.sin(now * 9));
			r.body.position.y = b * 0.26;
			r.leftArm.rotation.x = -2.4;
			r.rightArm.rotation.x = -2.4;
			r.leftArm.rotation.z = -0.7;
			r.rightArm.rotation.z = 0.7;
			r.leftEar.rotation.x = Math.sin(now * 9) * 0.35;
			r.rightEar.rotation.x = Math.sin(now * 9 + 0.6) * 0.35;
			r.head.rotation.x = -0.12;
			r.body.rotation.y = Math.sin(now * 4.5) * 0.22;
			r.body.scale.set(1, 1 + b * 0.05, 1);
			return;
		}

		if (this.state === 'happy') {
			const b = Math.sin(now * 7) * 0.5 + 0.5;
			r.body.position.y = b * 0.14;
			r.leftArm.rotation.x = -1.2;
			r.rightArm.rotation.x = -1.2;
			r.leftEar.rotation.x = -0.25 * b;
			r.rightEar.rotation.x = -0.25 * b;
			r.body.rotation.y = 0;
			r.head.rotation.x = 0;
			r.body.scale.set(1, 1, 1);
		}
	}

	/** Push out of circle colliders and the island edge. */
	private resolve(x: number, z: number): { x: number; z: number; blocked: boolean } {
		let px = x;
		let pz = z;
		let blocked = false;
		for (const c of this.colliders) {
			const dx = px - c.x;
			const dz = pz - c.z;
			const minDist = c.radius + PLAYER_RADIUS;
			const dSq = dx * dx + dz * dz;
			if (dSq < minDist * minDist) {
				const d = Math.sqrt(dSq) || 0.0001;
				px = c.x + (dx / d) * minDist;
				pz = c.z + (dz / d) * minDist;
				blocked = true;
			}
		}
		// Island edge: a soft circular clamp.
		const maxR = 32;
		const r = Math.hypot(px, pz);
		if (r > maxR) {
			px = (px / r) * maxR;
			pz = (pz / r) * maxR;
			blocked = true;
		}
		return { x: px, z: pz, blocked };
	}

	/** World-space point the camera should look at (Bubu's chest/head). */
	get focusPoint(): THREE.Vector3 {
		return new THREE.Vector3(
			this.rig.root.position.x,
			this.rig.root.position.y + 0.5,
			this.rig.root.position.z
		);
	}

	dispose(): void {
		this.disposeRig();
	}
}

/** Shortest-path angular damping. */
function dampAngle(current: number, target: number, lambda: number, dt: number): number {
	let delta = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
	if (delta < -Math.PI) delta += Math.PI * 2;
	return current + delta * (1 - Math.exp(-lambda * dt));
}
