import * as THREE from 'three';

/**
 * Bimo — a squirrel guide, built from primitives, just like Bubu.
 *
 * Bimo is the voice the child has always been listening to (`AudioManager`
 * narration) made visible: he stands beside the plaza on a small stump, turns
 * to watch Bubu as she passes, waves when a mission is won, and hops when he
 * is tapped. He is not a quest-giver and has no mechanics — a "character" for a
 * four-year-old is someone to recognise and greet, and adding a second thing
 * to obey would compete with the mission panel.
 *
 * Deliberately smaller than Bubu (~0.85 m against 1.15 m): a companion, not a
 * rival. The silhouette leans on what reads at gameplay distance — a big bushy
 * tail, round ears with tufts, and oversized eyes.
 *
 * All parts hang off named groups so the animator poses them without knowing
 * the geometry, mirroring `BubuRig`.
 */

export interface BimoRig {
	root: THREE.Group;
	/** Whole body, for bob and lean. */
	body: THREE.Group;
	head: THREE.Group;
	leftEar: THREE.Group;
	rightEar: THREE.Group;
	/** The tail curls up behind; the single strongest "squirrel" cue. */
	tail: THREE.Group;
	leftArm: THREE.Group;
	rightArm: THREE.Group;
	/** Shadows him on the ground, independent of the shadow map. */
	shadow: THREE.Mesh;
}

/** Squirrel palette: warm russet that stands out against the grass. */
const C = {
	fur: 0xc9713a,
	furLight: 0xe8a06a,
	belly: 0xffe3c4,
	innerEar: 0xffbe98,
	eye: 0x2b1d14,
	eyeShine: 0xffffff,
	nose: 0x5a3324,
	tuft: 0xa85a2a
};

/** Height of the standing rig, used when placing him on the terrain. */
export const BIMO_HEIGHT = 0.85;

function mat(hex: number, opts: { roughness?: number } = {}): THREE.MeshStandardMaterial {
	return new THREE.MeshStandardMaterial({
		color: new THREE.Color().setHex(hex, THREE.SRGBColorSpace),
		roughness: opts.roughness ?? 0.9,
		metalness: 0
	});
}

export function createBimo(): { rig: BimoRig; dispose: () => void } {
	const disposables: (THREE.BufferGeometry | THREE.Material)[] = [];
	const track = (g: THREE.BufferGeometry) => disposables.push(g);
	const trackMat = (m: THREE.Material) => disposables.push(m);

	const root = new THREE.Group();
	root.name = 'bimo';

	const body = new THREE.Group();
	root.add(body);

	const fur = mat(C.fur);
	const furLight = mat(C.furLight);
	const bellyMat = mat(C.belly);
	const innerEar = mat(C.innerEar);
	const eyeMat = mat(C.eye, { roughness: 0.3 });
	const shineMat = new THREE.MeshBasicMaterial({ color: C.eyeShine });
	const noseMat = mat(C.nose, { roughness: 0.5 });
	const tuftMat = mat(C.tuft);
	[fur, furLight, bellyMat, innerEar, eyeMat, shineMat, noseMat, tuftMat].forEach(trackMat);

	// --- Torso ------------------------------------------------------------
	// Narrower and more upright than Bubu's egg: a squirrel sits up.
	const torsoGeo = new THREE.SphereGeometry(0.24, 22, 16);
	const torso = new THREE.Mesh(torsoGeo, fur);
	torso.position.y = 0.34;
	torso.scale.set(0.94, 1.15, 0.86);
	torso.castShadow = true;
	body.add(torso);
	track(torsoGeo);

	const bellyGeo = new THREE.SphereGeometry(0.18, 18, 12);
	const belly = new THREE.Mesh(bellyGeo, bellyMat);
	belly.position.set(0, 0.32, 0.12);
	belly.scale.set(0.82, 1.05, 0.6);
	body.add(belly);
	track(bellyGeo);

	// --- Head -------------------------------------------------------------
	const head = new THREE.Group();
	head.position.y = 0.66;
	body.add(head);

	const skullGeo = new THREE.SphereGeometry(0.25, 24, 18);
	const skull = new THREE.Mesh(skullGeo, fur);
	skull.scale.set(1, 0.96, 0.98);
	skull.castShadow = true;
	head.add(skull);
	track(skullGeo);

	// Muzzle: paler, slightly forward and low, carrying the nose.
	const muzzleGeo = new THREE.SphereGeometry(0.115, 16, 12);
	const muzzle = new THREE.Mesh(muzzleGeo, bellyMat);
	muzzle.position.set(0, -0.06, 0.19);
	muzzle.scale.set(1, 0.8, 0.8);
	head.add(muzzle);
	track(muzzleGeo);

	const noseGeo = new THREE.SphereGeometry(0.035, 12, 9);
	const nose = new THREE.Mesh(noseGeo, noseMat);
	nose.position.set(0, -0.02, 0.285);
	nose.scale.set(1.3, 0.85, 0.9);
	head.add(nose);
	track(noseGeo);

	// Eyes: large with a highlight, the same trick that makes Bubu look alive.
	const eyeGeo = new THREE.SphereGeometry(0.058, 16, 12);
	const shineGeo = new THREE.SphereGeometry(0.018, 10, 8);
	for (const x of [-0.105, 0.105]) {
		const eye = new THREE.Mesh(eyeGeo, eyeMat);
		eye.position.set(x, 0.045, 0.2);
		eye.scale.set(0.92, 1.06, 0.8);
		head.add(eye);
		const shine = new THREE.Mesh(shineGeo, shineMat);
		shine.position.set(x + 0.018, 0.072, 0.238);
		head.add(shine);
	}
	track(eyeGeo);
	track(shineGeo);

	// --- Ears -------------------------------------------------------------
	// Small pointed ears with a tuft on top — the tuft is the squirrel tell.
	const ears: THREE.Group[] = [];
	for (const side of [-1, 1] as const) {
		const pivot = new THREE.Group();
		pivot.position.set(side * 0.15, 0.17, -0.01);
		pivot.rotation.z = side * 0.28;

		const earGeo = new THREE.ConeGeometry(0.072, 0.16, 12);
		const ear = new THREE.Mesh(earGeo, fur);
		ear.position.y = 0.05;
		ear.castShadow = true;
		pivot.add(ear);
		track(earGeo);

		const innerGeo = new THREE.ConeGeometry(0.042, 0.1, 10);
		const inner = new THREE.Mesh(innerGeo, innerEar);
		inner.position.set(0, 0.045, 0.028);
		pivot.add(inner);
		track(innerGeo);

		const tuftGeo = new THREE.ConeGeometry(0.034, 0.09, 8);
		const tuft = new THREE.Mesh(tuftGeo, tuftMat);
		tuft.position.y = 0.155;
		pivot.add(tuft);
		track(tuftGeo);

		head.add(pivot);
		ears.push(pivot);
	}
	const [leftEar, rightEar] = ears;

	// --- Tail -------------------------------------------------------------
	// A fat curve rising behind the back, built from three tapered segments so
	// it reads as a plume rather than a ball. This is the part a child
	// recognises first.
	const tail = new THREE.Group();
	tail.position.set(0, 0.24, -0.2);
	body.add(tail);

	const segment = (
		radius: number,
		height: number,
		y: number,
		z: number,
		rotX: number,
		material: THREE.Material
	) => {
		const geo = new THREE.SphereGeometry(radius, 16, 12);
		const mesh = new THREE.Mesh(geo, material);
		mesh.position.set(0, y, z);
		mesh.scale.set(1, height, 1);
		mesh.rotation.x = rotX;
		mesh.castShadow = true;
		tail.add(mesh);
		track(geo);
	};
	// Sits low, sweeps out and up, tips slightly forward at the top.
	segment(0.13, 1.25, 0.02, -0.02, 0.35, furLight);
	segment(0.155, 1.2, 0.2, -0.12, 0.15, fur);
	segment(0.125, 1.15, 0.4, -0.05, -0.32, furLight);

	// --- Arms -------------------------------------------------------------
	const arms: THREE.Group[] = [];
	for (const side of [-1, 1] as const) {
		const pivot = new THREE.Group();
		pivot.position.set(side * 0.21, 0.44, 0.02);
		pivot.rotation.z = side * 0.34;

		const armGeo = new THREE.CapsuleGeometry(0.055, 0.13, 8, 10);
		const arm = new THREE.Mesh(armGeo, fur);
		arm.position.y = -0.08;
		arm.castShadow = true;
		pivot.add(arm);
		track(armGeo);

		const pawGeo = new THREE.SphereGeometry(0.058, 12, 9);
		const paw = new THREE.Mesh(pawGeo, furLight);
		paw.position.y = -0.17;
		pivot.add(paw);
		track(pawGeo);

		body.add(pivot);
		arms.push(pivot);
	}
	const [leftArm, rightArm] = arms;

	// --- Feet -------------------------------------------------------------
	// Two small flat ovals, enough to stand on.
	for (const side of [-1, 1] as const) {
		const footGeo = new THREE.SphereGeometry(0.085, 14, 10);
		const foot = new THREE.Mesh(footGeo, furLight);
		foot.position.set(side * 0.11, 0.05, 0.06);
		foot.scale.set(1, 0.55, 1.35);
		foot.castShadow = true;
		body.add(foot);
		track(footGeo);
	}

	// --- Ground shadow ----------------------------------------------------
	const shadowGeo = new THREE.CircleGeometry(0.32, 20);
	shadowGeo.rotateX(-Math.PI / 2);
	const shadowMat = new THREE.MeshBasicMaterial({
		color: 0x000000,
		transparent: true,
		opacity: 0.16,
		depthWrite: false
	});
	const shadow = new THREE.Mesh(shadowGeo, shadowMat);
	shadow.position.y = 0.012;
	root.add(shadow);
	track(shadowGeo);
	trackMat(shadowMat);

	return {
		rig: { root, body, head, leftEar, rightEar, tail, leftArm, rightArm, shadow },
		dispose: () => {
			for (const d of disposables) d.dispose();
			root.clear();
		}
	};
}
