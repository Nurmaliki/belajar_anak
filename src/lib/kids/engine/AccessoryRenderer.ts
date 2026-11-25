import * as THREE from 'three';
import type { Accessory } from '../data/accessories';
import type { BubuRig } from './Bubu';

/**
 * Builds one accessory's geometry and hangs it on the correct part of Bubu's
 * rig.
 *
 * Kept in the engine, not in `data/accessories.ts`, so the catalogue stays
 * importable in a Node test with no Three.js. This file is the only place that
 * knows a hat goes on the head bone and a scarf around the neck.
 *
 * Each call returns a removable group: swapping accessories must leave no
 * geometry behind, so `dispose()` on the group is what the caller uses. All
 * meshes are built from primitives — there are no model files to load, and the
 * project is not allowed to depend on ones that do not exist.
 */

/** Y offset applied to a head accessory, above the skull centre. */
const HEAD_TOP = 0.26;
/** Bubu's neck sits just under the head group. */
const NECK_Y = 0.66;
/** Behind the torso, for wings. */
const BACK_Z = -0.26;

function mat(hex: number, opts: { roughness?: number; emissive?: number } = {}): THREE.MeshStandardMaterial {
	return new THREE.MeshStandardMaterial({
		color: new THREE.Color().setHex(hex, THREE.SRGBColorSpace),
		roughness: opts.roughness ?? 0.85,
		metalness: 0,
		...(opts.emissive ? { emissive: new THREE.Color().setHex(opts.emissive, THREE.SRGBColorSpace) } : {})
	});
}

export interface AttachedAccessory {
	/** Add to the scene graph; parented to the right rig group already. */
	group: THREE.Group;
	/** Remove from the rig and free every geometry and material. */
	dispose: () => void;
}

/**
 * Attach an accessory to a rig.
 *
 * @param rig       Bubu's named groups
 * @param accessory the catalogue entry to build
 * @returns the group to keep for later removal, or null when there is nothing
 *          to wear (a null accessory means "no accessory")
 */
export function attachAccessory(rig: BubuRig, accessory: Accessory | null): AttachedAccessory | null {
	if (!accessory) return null;

	const group = new THREE.Group();
	group.name = `accessory:${accessory.id}`;
	const disposables: (THREE.BufferGeometry | THREE.Material)[] = [];
	const track = <T extends THREE.BufferGeometry | THREE.Material>(x: T): T => {
		disposables.push(x);
		return x;
	};

	switch (accessory.id) {
		case 'topi-merah':
			buildCap(group, accessory, track);
			break;
		case 'mahkota':
			buildCrown(group, accessory, track);
			break;
		case 'topi-pesta':
			buildPartyHat(group, accessory, track);
			break;
		case 'syal-biru':
		case 'syal-hijau':
			buildScarf(group, accessory, track);
			break;
		case 'sayap-peri':
			buildWings(group, accessory, track);
			break;
		default:
			// An unknown catalogue entry renders nothing rather than throwing:
			// a stale saved id must never break the character.
			break;
	}

	// Parent to the bone that moves with it. Ears flop on the head group, so a
	// hat must ride along with it or it will float when she tilts.
	if (accessory.slot === 'head') rig.head.add(group);
	else if (accessory.slot === 'neck') rig.body.add(group);
	else rig.body.add(group);

	return {
		group,
		dispose: () => {
			group.parent?.remove(group);
			for (const d of disposables) d.dispose();
			group.clear();
		}
	};
}

type Track = <T extends THREE.BufferGeometry | THREE.Material>(x: T) => T;

function buildCap(group: THREE.Group, accessory: Accessory, track: Track): void {
	const primary = track(mat(accessory.colors.primary, { roughness: 0.75 }));
	const shade = track(mat(accessory.colors.secondary ?? 0xffffff, { roughness: 0.8 }));

	const domeGeo = track(new THREE.SphereGeometry(0.255, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2));
	const dome = new THREE.Mesh(domeGeo, primary);
	dome.position.set(0, HEAD_TOP - 0.02, -0.01);
	dome.scale.set(1.02, 0.8, 1.02);
	dome.castShadow = true;
	group.add(dome);

	// Brim: a flattened cylinder pushed forward, the part that reads as "cap".
	const brimGeo = track(new THREE.CylinderGeometry(0.29, 0.29, 0.025, 22, 1, false, 0, Math.PI));
	const brim = new THREE.Mesh(brimGeo, primary);
	brim.position.set(0, HEAD_TOP - 0.02, 0.07);
	brim.rotation.x = -0.16;
	brim.castShadow = true;
	group.add(brim);

	// Little button on top.
	const buttonGeo = track(new THREE.SphereGeometry(0.038, 12, 9));
	const button = new THREE.Mesh(buttonGeo, shade);
	button.position.set(0, HEAD_TOP + 0.18, -0.01);
	group.add(button);
}

function buildCrown(group: THREE.Group, accessory: Accessory, track: Track): void {
	const gold = track(mat(accessory.colors.primary, { roughness: 0.35, emissive: 0x3a2a00 }));
	const jewel = track(mat(accessory.colors.secondary ?? 0xff6fae, { roughness: 0.3, emissive: 0x2a0018 }));

	const bandGeo = track(new THREE.CylinderGeometry(0.235, 0.235, 0.075, 20, 1, true));
	const band = new THREE.Mesh(bandGeo, gold);
	band.position.set(0, HEAD_TOP + 0.08, -0.01);
	band.castShadow = true;
	group.add(band);

	// Five points, evenly spaced around the band.
	const pointGeo = track(new THREE.ConeGeometry(0.055, 0.14, 10));
	for (let i = 0; i < 5; i++) {
		const angle = (i / 5) * Math.PI * 2;
		const point = new THREE.Mesh(pointGeo, gold);
		point.position.set(Math.sin(angle) * 0.215, HEAD_TOP + 0.18, Math.cos(angle) * 0.215 - 0.01);
		point.castShadow = true;
		group.add(point);
	}

	const gemGeo = track(new THREE.SphereGeometry(0.032, 12, 9));
	const gem = new THREE.Mesh(gemGeo, jewel);
	gem.position.set(0, HEAD_TOP + 0.09, 0.225);
	group.add(gem);
}

function buildPartyHat(group: THREE.Group, accessory: Accessory, track: Track): void {
	const cone = track(mat(accessory.colors.primary, { roughness: 0.8 }));
	const pom = track(mat(accessory.colors.secondary ?? 0xffffff, { roughness: 0.9 }));

	const coneGeo = track(new THREE.ConeGeometry(0.17, 0.42, 16));
	const hat = new THREE.Mesh(coneGeo, cone);
	hat.position.set(0, HEAD_TOP + 0.19, -0.01);
	hat.rotation.z = 0.08;
	hat.castShadow = true;
	group.add(hat);

	const pomGeo = track(new THREE.SphereGeometry(0.065, 14, 10));
	const ball = new THREE.Mesh(pomGeo, pom);
	ball.position.set(0.016, HEAD_TOP + 0.42, -0.01);
	group.add(ball);
}

function buildScarf(group: THREE.Group, accessory: Accessory, track: Track): void {
	const wool = track(mat(accessory.colors.primary, { roughness: 0.95 }));
	const trim = track(mat(accessory.colors.secondary ?? 0xffffff, { roughness: 0.95 }));

	const ringGeo = track(new THREE.TorusGeometry(0.245, 0.075, 10, 22));
	const ring = new THREE.Mesh(ringGeo, wool);
	ring.position.set(0, NECK_Y + 0.02, 0);
	ring.rotation.x = Math.PI / 2;
	ring.scale.set(1, 1, 0.85);
	ring.castShadow = true;
	group.add(ring);

	// A hanging end, so the scarf reads as cloth and not as a collar.
	const tailGeo = track(new THREE.CapsuleGeometry(0.062, 0.16, 6, 10));
	const tail = new THREE.Mesh(tailGeo, wool);
	tail.position.set(0.16, NECK_Y - 0.13, 0.15);
	tail.rotation.set(0.2, 0, 0.25);
	tail.castShadow = true;
	group.add(tail);

	const fringeGeo = track(new THREE.SphereGeometry(0.07, 12, 9));
	const fringe = new THREE.Mesh(fringeGeo, trim);
	fringe.position.set(0.2, NECK_Y - 0.24, 0.17);
	fringe.scale.set(1, 0.8, 1);
	group.add(fringe);
}

function buildWings(group: THREE.Group, accessory: Accessory, track: Track): void {
	const wingMat = track(mat(accessory.colors.primary, { roughness: 0.5, emissive: 0x22000f }));
	const shineMat = track(mat(accessory.colors.secondary ?? 0xffffff, { roughness: 0.4, emissive: 0x1a1020 }));

	// Two teardrops: a sphere squashed flat and swept back.
	for (const side of [-1, 1] as const) {
		const wingGeo = track(new THREE.SphereGeometry(0.2, 16, 12));
		const wing = new THREE.Mesh(wingGeo, wingMat);
		wing.position.set(side * 0.2, 0.5, BACK_Z - 0.04);
		wing.scale.set(0.78, 1.25, 0.16);
		wing.rotation.set(0.12, side * -0.55, side * 0.28);
		wing.castShadow = true;
		group.add(wing);

		// A smaller highlight near the top, so the wing catches the eye.
		const dotGeo = track(new THREE.SphereGeometry(0.07, 10, 8));
		const dot = new THREE.Mesh(dotGeo, shineMat);
		dot.position.set(side * 0.24, 0.62, BACK_Z - 0.02);
		dot.scale.set(1, 1.2, 0.3);
		group.add(dot);
	}
}
