import * as THREE from 'three';

/**
 * Third-person follow camera.
 *
 * Specification from the brief: 55° FOV, ~5 units behind the character, ~3
 * units up, smooth follow, character-centred look-at, no clipping into terrain.
 *
 * The camera is *orbit-around-the-player*, not a chase camera rigidly welded
 * behind the bunny: a child who spins on the spot should not have the world spin
 * with them. Yaw/pitch are owned here, and movement is converted into
 * camera-relative axes by the caller reading `forward` / `right`.
 */

const FOV = 55;
const DISTANCE = 5.2;
const HEIGHT = 3.0;
/** Smallest and largest pitch, in radians. Negative looks down. */
const PITCH_MIN = -0.15;
const PITCH_MAX = 1.15;
/** The camera never sinks below this height above the ground. */
const GROUND_CLEARANCE = 0.9;

export class CameraManager {
	readonly camera: THREE.PerspectiveCamera;
	private yaw = 0;
	private pitch = 0.48;
	private distance = DISTANCE;
	/** The rising, damped follow point that the camera orbits. */
	private focus = new THREE.Vector3();
	private focusInitialized = false;
	private _target = new THREE.Vector3();
	private _desired = new THREE.Vector3();
	private _forward = new THREE.Vector3();
	private _right = new THREE.Vector3();
	/** Optional height sampler so the camera can avoid the ground. */
	private groundAt: (x: number, z: number) => number = () => 0;
	/** Obstacles the camera pulls in front of (trees, walls). */
	private occluders: THREE.Object3D[] = [];
	private raycaster = new THREE.Raycaster();

	constructor(aspect: number) {
		this.camera = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 400);
	}

	setGroundSampler(fn: (x: number, z: number) => number): void {
		this.groundAt = fn;
	}

	/** Trees and buildings that must not sit between the eye and Bubu. */
	setOccluders(objects: THREE.Object3D[]): void {
		this.occluders = objects;
	}

	get yawAngle(): number {
		return this.yaw;
	}

	get pitchAngle(): number {
		return this.pitch;
	}

	/** Rotate by a mouse/touch drag, in radians. */
	rotate(dYaw: number, dPitch: number): void {
		this.yaw -= dYaw;
		this.pitch = THREE.MathUtils.clamp(this.pitch + dPitch, PITCH_MIN, PITCH_MAX);
	}

	setYaw(yaw: number): void {
		this.yaw = yaw;
	}

	/**
	 * Ground-plane forward direction of the view.
	 *
	 * Camera-relative movement is what makes "push up" mean "away from the
	 * camera" regardless of which way the bunny happens to be facing.
	 *
	 * With the eye at `focus + (sin yaw, cos yaw) * distance`, the direction
	 * from the eye to the focus is `(-sin yaw, -cos yaw)`. This must match it
	 * exactly, or forward walks the child straight into the camera.
	 */
	get forward(): THREE.Vector3 {
		this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
		return this._forward;
	}

	/** Ground-plane right direction, perpendicular to `forward`. */
	get right(): THREE.Vector3 {
		this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
		return this._right;
	}

	/** Snap the follow point to the target without easing (on spawn). */
	snapTo(target: THREE.Vector3): void {
		this.focus.copy(target);
		this.focusInitialized = true;
		this.update(0, target, true);
	}

	/**
	 * Follow the player.
	 *
	 * `dt` drives the damping; passing 0 (as `snapTo` does) makes the camera
	 * jump to its ideal pose.
	 */
	update(dt: number, target: THREE.Vector3, immediate = false): void {
		// Follow point: the character's chest, not their feet, so the bunny sits
		// in the lower third of the frame with the world visible ahead.
		this._target.set(target.x, target.y + 0.85, target.z);

		if (!this.focusInitialized || immediate || dt <= 0) {
			this.focus.copy(this._target);
			this.focusInitialized = true;
		} else {
			// Frame-rate independent smoothing. 8 is responsive but still soft.
			const k = 1 - Math.exp(-8 * dt);
			this.focus.lerp(this._target, k);
		}

		// Ideal eye position on the orbit sphere.
		const cosP = Math.cos(this.pitch);
		const sinP = Math.sin(this.pitch);
		const offsetX = Math.sin(this.yaw) * cosP * this.distance;
		const offsetZ = Math.cos(this.yaw) * cosP * this.distance;
		const offsetY = sinP * this.distance + HEIGHT * 0.35;

		let dist = this.distance;

		// Pull in if a solid object is between the focus and the eye.
		if (this.occluders.length > 0) {
			const dir = this._desired
				.set(offsetX, offsetY, offsetZ)
				.normalize();
			this.raycaster.set(this.focus.clone(), dir);
			this.raycaster.far = this.distance + 0.5;
			const hits = this.raycaster.intersectObjects(this.occluders, true);
			if (hits.length > 0) {
				dist = Math.max(1.6, hits[0].distance - 0.35);
			}
		}

		const scale = dist / this.distance;
		this._desired.set(
			this.focus.x + offsetX * scale,
			this.focus.y + offsetY * scale,
			this.focus.z + offsetZ * scale
		);

		// Never sink into the ground: sample the terrain under the eye and lift.
		const ground = this.groundAt(this._desired.x, this._desired.z);
		if (this._desired.y < ground + GROUND_CLEARANCE) {
			this._desired.y = ground + GROUND_CLEARANCE;
		}

		this.camera.position.copy(this._desired);
		this.camera.lookAt(this.focus);
	}

	resize(aspect: number): void {
		this.camera.aspect = aspect;
		this.camera.updateProjectionMatrix();
	}

	dispose(): void {
		// The camera itself holds no GPU resources; nothing to release.
	}
}
