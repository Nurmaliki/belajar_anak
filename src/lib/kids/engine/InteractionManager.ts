import * as THREE from 'three';

/**
 * Turns a pointer position into "what did the child aim at".
 *
 * Preschool children do not click precisely. Every pickable object is therefore
 * registered with an invisible, generously-sized hit sphere rather than being
 * raycast against its visible geometry: a 3 cm apple is impossible to hit, a
 * 45 cm invisible sphere around it is easy.
 */

export interface Pickable {
	/** Stable id used by the activity logic. */
	id: string;
	/** The visible object, for animation and highlighting. */
	object: THREE.Object3D;
	/** Radius of the invisible hit target, in world units. */
	hitRadius: number;
}

interface HitTarget {
	id: string;
	object: THREE.Object3D;
	proxy: THREE.Mesh;
}

export class InteractionManager {
	private raycaster = new THREE.Raycaster();
	private targets: HitTarget[] = [];
	private hitGeometry = new THREE.SphereGeometry(1, 8, 6);
	private _ndc = new THREE.Vector2();
	private hoveredId: string | null = null;

	constructor(private camera: THREE.PerspectiveCamera) {}

	/** Replace the pickable set, disposing the old proxies. */
	setPickables(pickables: Pickable[], parent: THREE.Object3D): void {
		this.clear();
		for (const p of pickables) {
			const proxy = new THREE.Mesh(
				this.hitGeometry,
				new THREE.MeshBasicMaterial({ visible: false })
			);
			proxy.position.copy(p.object.position);
			proxy.scale.setScalar(p.hitRadius);
			proxy.userData.pickId = p.id;
			parent.add(proxy);
			this.targets.push({ id: p.id, object: p.object, proxy });
		}
	}

	/** Add one pickable at a time, e.g. as apples are spawned. */
	addPickable(p: Pickable, parent: THREE.Object3D): void {
		const proxy = new THREE.Mesh(this.hitGeometry, new THREE.MeshBasicMaterial({ visible: false }));
		proxy.position.copy(p.object.position);
		proxy.scale.setScalar(p.hitRadius);
		proxy.userData.pickId = p.id;
		parent.add(proxy);
		this.targets.push({ id: p.id, object: p.object, proxy });
	}

	/** Remove a pickable once it has been collected. */
	removePickable(id: string): void {
		const idx = this.targets.findIndex((t) => t.id === id);
		if (idx === -1) return;
		const t = this.targets[idx];
		t.proxy.parent?.remove(t.proxy);
		(t.proxy.material as THREE.Material).dispose();
		this.targets.splice(idx, 1);
	}

	clear(): void {
		for (const t of this.targets) {
			t.proxy.parent?.remove(t.proxy);
			(t.proxy.material as THREE.Material).dispose();
		}
		this.targets = [];
		this.hoveredId = null;
	}

	get pickableIds(): string[] {
		return this.targets.map((t) => t.id);
	}

	/**
	 * Pick at a client-space pointer position.
	 *
	 * @returns the id of the nearest hit, or null.
	 */
	pick(clientX: number, clientY: number, rect: DOMRect): string | null {
		if (this.targets.length === 0) return null;
		this._ndc.set(
			((clientX - rect.left) / rect.width) * 2 - 1,
			-((clientY - rect.top) / rect.height) * 2 + 1
		);
		this.raycaster.setFromCamera(this._ndc, this.camera);
		const meshes = this.targets.map((t) => t.proxy);
		const hits = this.raycaster.intersectObjects(meshes, false);
		if (hits.length === 0) return null;
		return (hits[0].object.userData.pickId as string) ?? null;
	}

	/** Pick with a radius tolerance, for fingers that land slightly off. */
	pickForgiving(clientX: number, clientY: number, rect: DOMRect, tolerancePx = 26): string | null {
		const direct = this.pick(clientX, clientY, rect);
		if (direct) return direct;
		// Sample a small ring around the finger.
		for (const [dx, dy] of RING_OFFSETS) {
			const r = this.pick(clientX + dx * tolerancePx, clientY + dy * tolerancePx, rect);
			if (r) return r;
		}
		return null;
	}

	/** Track the object under the pointer, so it can glow. */
	updateHover(clientX: number, clientY: number, rect: DOMRect): string | null {
		const id = this.pickForgiving(clientX, clientY, rect);
		this.hoveredId = id;
		return id;
	}

	get hovered(): string | null {
		return this.hoveredId;
	}

	dispose(): void {
		this.clear();
		this.hitGeometry.dispose();
	}
}

/** Eight points on a unit circle, sampled around an imprecise touch. */
const RING_OFFSETS = Array.from({ length: 8 }, (_, i) => {
	const a = (i / 8) * Math.PI * 2;
	return [Math.cos(a), Math.sin(a)] as [number, number];
});
