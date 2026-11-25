import * as THREE from 'three';
import type { Pickable } from '../engine/InteractionManager';
import { terrainHeight } from './WorldManager';

/**
 * The apples for a counting mission.
 *
 * Each apple is a small mesh with a floating bob and a pop animation when
 * collected. Collection is *visual only*: whether an apple may be counted is
 * decided by `CountSession`, never by whether the mesh is still visible. That
 * separation is what makes double-counting impossible even if a tap fires
 * twice in one frame.
 */

export interface Apple {
	id: string;
	group: THREE.Group;
	/** Seconds left of the collection pop; 0 when untouched. */
	popping: number;
	collected: boolean;
	baseY: number;
	phase: number;
}

export class AppleGarden {
	readonly group = new THREE.Group();
	private apples: Apple[] = [];
	private disposables: { dispose: () => void }[] = [];
	private appleGeo: THREE.SphereGeometry;
	private leafGeo: THREE.SphereGeometry;
	private stemGeo: THREE.CylinderGeometry;
	private appleMat: THREE.MeshStandardMaterial;
	private leafMat: THREE.MeshStandardMaterial;
	private stemMat: THREE.MeshStandardMaterial;
	private haloGeo: THREE.RingGeometry;
	private haloMat: THREE.MeshBasicMaterial;

	constructor(
		private center: { x: number; z: number },
		scene: THREE.Scene
	) {
		this.group.name = 'apple-garden';
		scene.add(this.group);

		this.appleGeo = this.track(new THREE.SphereGeometry(0.24, 20, 16));
		this.leafGeo = this.track(new THREE.SphereGeometry(0.09, 10, 8));
		this.stemGeo = this.track(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 6));
		this.appleMat = this.track(
			new THREE.MeshStandardMaterial({
				color: new THREE.Color().setHex(0xe8453c, THREE.SRGBColorSpace),
				roughness: 0.45,
				metalness: 0.05
			})
		);
		this.leafMat = this.track(
			new THREE.MeshStandardMaterial({
				color: new THREE.Color().setHex(0x4caf50, THREE.SRGBColorSpace),
				roughness: 0.8
			})
		);
		this.stemMat = this.track(
			new THREE.MeshStandardMaterial({
				color: new THREE.Color().setHex(0x7a4a2a, THREE.SRGBColorSpace)
			})
		);
		this.haloGeo = this.track(new THREE.RingGeometry(0.42, 0.54, 24));
		this.haloGeo.rotateX(-Math.PI / 2);
		this.haloMat = this.track(
			new THREE.MeshBasicMaterial({
				color: 0xfff2b0,
				transparent: true,
				opacity: 0.55,
				depthWrite: false,
				side: THREE.DoubleSide
			})
		);
	}

	private track<T extends { dispose: () => void }>(r: T): T {
		this.disposables.push(r);
		return r;
	}

	/**
	 * Scatter `count` apples in a friendly arc in front of the stage.
	 *
	 * Returned list is the source of truth for the activity's pickables.
	 */
	spawn(count: number): Pickable[] {
		this.clearApples();
		const pickables: Pickable[] = [];
		for (let i = 0; i < count; i++) {
			// A fan rather than a circle: every apple is visible from the
			// approach direction, so a child never has to hunt for one.
			const t = count === 1 ? 0.5 : i / (count - 1);
			const angle = THREE.MathUtils.lerp(-0.9, 0.9, t);
			const radius = 2.6 + (i % 2) * 0.65;
			const x = this.center.x + Math.sin(angle) * radius;
			const z = this.center.z + Math.cos(angle) * radius;

			const group = new THREE.Group();
			const y = terrainHeight(x, z) + 0.5;
			group.position.set(x, y, z);

			const apple = new THREE.Mesh(this.appleGeo, this.appleMat);
			apple.castShadow = true;
			apple.scale.set(1, 0.94, 1);
			group.add(apple);

			const stem = new THREE.Mesh(this.stemGeo, this.stemMat);
			stem.position.y = 0.26;
			group.add(stem);

			const leaf = new THREE.Mesh(this.leafGeo, this.leafMat);
			leaf.position.set(0.08, 0.28, 0);
			leaf.scale.set(1.3, 0.4, 0.8);
			group.add(leaf);

			// A halo on the ground marks each apple as touchable, which a child
			// reads instantly as "this one is for me".
			const halo = new THREE.Mesh(this.haloGeo, this.haloMat);
			halo.position.y = -y + terrainHeight(x, z) + 0.04;
			group.add(halo);

			this.group.add(group);
			const id = `apple-${i}`;
			this.apples.push({ id, group, popping: 0, collected: false, baseY: y, phase: i * 0.8 });
			pickables.push({ id, object: group, hitRadius: 0.62 });
		}
		return pickables;
	}

	/** Begin the pop for one apple. Idempotent. */
	pop(id: string): void {
		const apple = this.apples.find((a) => a.id === id);
		if (!apple || apple.collected) return;
		apple.collected = true;
		apple.popping = 0.55;
	}

	animate(dt: number, time: number): void {
		for (const a of this.apples) {
			if (a.collected) {
				if (a.popping > 0) {
					a.popping = Math.max(0, a.popping - dt);
					// Pop: rise, swell, fade out.
					const t = 1 - a.popping / 0.55;
					a.group.position.y = a.baseY + t * 0.9;
					const s = 1 + t * 0.6;
					a.group.scale.setScalar(s);
					a.group.rotation.y = t * 6;
					const fade = 1 - t;
					a.group.traverse((o) => {
						if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
							// Shared materials must not be mutated per apple, so fade
							// by visibility rather than opacity.
							o.visible = fade > 0.05;
						}
					});
					if (a.popping === 0) a.group.visible = false;
				}
				continue;
			}
			// Idle bob and spin, so the apples feel alive and touchable.
			a.group.position.y = a.baseY + Math.sin(time * 2 + a.phase) * 0.09;
			a.group.rotation.y = time * 0.6 + a.phase;
		}
	}

	/** Restore every apple (used when a mission restarts). */
	reset(): void {
		for (const a of this.apples) {
			a.collected = false;
			a.popping = 0;
			a.group.visible = true;
			a.group.scale.setScalar(1);
			a.group.position.y = a.baseY;
		}
	}

	/**
	 * Remove every apple from the world.
	 *
	 * Distinct from `reset()`, which makes the apples reappear. A question
	 * mission (letter, syllable, picture) has no apples at all, so leftover
	 * ones from the previous counting mission must be taken away rather than
	 * restored — otherwise the child sees apples that cannot be tapped.
	 */
	clear(): void {
		this.clearApples();
	}

	private clearApples(): void {
		for (const a of this.apples) {
			this.group.remove(a.group);
		}
		this.apples = [];
	}

	get activeApples(): Apple[] {
		return this.apples;
	}

	dispose(): void {
		this.clearApples();
		for (const d of this.disposables) d.dispose();
		this.disposables = [];
		this.group.parent?.remove(this.group);
	}
}
