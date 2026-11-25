import * as THREE from 'three';

/**
 * Bubu — a baby bunny built from primitives.
 *
 * There is no `Bubu.glb` in this repository, so this rig *is* the character.
 * It is shaped to read at gameplay distance (camera ~5 m back, 3 m up): an
 * oversized head, a round body, straight-up ears and big eyes. Anatomy is
 * deliberately cartoon, because a true-to-life rabbit at this scale is a
 * smudge.
 *
 * All parts hang off named groups so `CharacterController` can pose them
 * without knowing the geometry, and so a future GLTF model can replace this
 * class behind the same interface.
 */
export interface BubuRig {
	root: THREE.Group;
	/** Whole body, for bob and lean. */
	body: THREE.Group;
	head: THREE.Group;
	leftEar: THREE.Group;
	rightEar: THREE.Group;
	leftArm: THREE.Group;
	rightArm: THREE.Group;
	leftLeg: THREE.Group;
	rightLeg: THREE.Group;
	/** Shadows the bunny on the ground, independent of the shadow map. */
	shadow: THREE.Mesh;
}

/** Bunny palette. Soft, high-value colours that read on green grass. */
const C = {
	fur: 0xfdf6ee,
	furShade: 0xefe2d2,
	innerEar: 0xffb3c7,
	belly: 0xfff9f2,
	eye: 0x2b2230,
	eyeShine: 0xffffff,
	nose: 0xff8fa8,
	cheek: 0xffc2cf,
	foot: 0xf3d8c4
};

/** Height of the standing rig at the top of the head, used by the camera aim. */
export const BUBU_HEIGHT = 1.15;

function mat(hex: number, opts: { roughness?: number; emissive?: number } = {}): THREE.MeshStandardMaterial {
	return new THREE.MeshStandardMaterial({
		color: new THREE.Color().setHex(hex, THREE.SRGBColorSpace),
		roughness: opts.roughness ?? 0.9,
		metalness: 0,
		flatShading: false,
		...(opts.emissive ? { emissive: new THREE.Color().setHex(opts.emissive, THREE.SRGBColorSpace) } : {})
	});
}

export function createBubu(): { rig: BubuRig; dispose: () => void } {
	const disposables: { dispose: () => void }[] = [];
	const track = (g: THREE.BufferGeometry) => disposables.push(g);
	const trackMat = (m: THREE.Material) => disposables.push(m);

	const root = new THREE.Group();
	root.name = 'bubu';

	const body = new THREE.Group();
	root.add(body);

	const fur = mat(C.fur);
	const furShade = mat(C.furShade);
	const bellyMat = mat(C.belly);
	const innerEar = mat(C.innerEar);
	const eyeMat = mat(C.eye, { roughness: 0.35, emissive: 0x1a1420 });
	const shineMat = new THREE.MeshBasicMaterial({ color: C.eyeShine });
	const noseMat = mat(C.nose);
	const cheekMat = mat(C.cheek);
	const footMat = mat(C.foot);
	[fur, furShade, bellyMat, innerEar, eyeMat, shineMat, noseMat, cheekMat, footMat].forEach(trackMat);

	// --- Torso ------------------------------------------------------------
	// An egg, wider at the hips: a sphere scaled in Y reads as a body rather
	// than as a ball with things stuck to it.
	const torsoGeo = new THREE.SphereGeometry(0.34, 24, 18);
	const torso = new THREE.Mesh(torsoGeo, fur);
	torso.position.y = 0.44;
	torso.scale.set(1, 1.08, 0.92);
	torso.castShadow = true;
	body.add(torso);
	track(torsoGeo);

	// Pale belly patch, slightly proud of the torso so it never z-fights.
	const bellyGeo = new THREE.SphereGeometry(0.26, 20, 14);
	const belly = new THREE.Mesh(bellyGeo, bellyMat);
	belly.position.set(0, 0.42, 0.16);
	belly.scale.set(0.86, 1.0, 0.72);
	body.add(belly);
	track(bellyGeo);

	// --- Head -------------------------------------------------------------
	// Bigger than the torso is wide: the single strongest "cute" proportion.
	const head = new THREE.Group();
	head.position.y = 0.86;
	body.add(head);

	const skullGeo = new THREE.SphereGeometry(0.33, 26, 20);
	const skull = new THREE.Mesh(skullGeo, fur);
	skull.scale.set(1, 0.94, 0.96);
	skull.castShadow = true;
	head.add(skull);
	track(skullGeo);

	// Muzzle: a small warm bump carrying the nose.
	const muzzleGeo = new THREE.SphereGeometry(0.15, 18, 14);
	const muzzle = new THREE.Mesh(muzzleGeo, bellyMat);
	muzzle.position.set(0, -0.06, 0.255);
	muzzle.scale.set(1.0, 0.78, 0.72);
	head.add(muzzle);
	track(muzzleGeo);

	const noseGeo = new THREE.SphereGeometry(0.043, 14, 10);
	const nose = new THREE.Mesh(noseGeo, noseMat);
	nose.position.set(0, 0.0, 0.36);
	nose.scale.set(1.25, 0.9, 0.9);
	head.add(nose);
	track(noseGeo);

	// Eyes: large, wide-set, with a highlight. The highlight is what makes
	// them look *alive* rather than painted on.
	const eyeGeo = new THREE.SphereGeometry(0.072, 18, 14);
	const shineGeo = new THREE.SphereGeometry(0.022, 10, 8);
	for (const x of [-0.135, 0.135]) {
		const eye = new THREE.Mesh(eyeGeo, eyeMat);
		eye.position.set(x, 0.055, 0.265);
		eye.scale.set(0.92, 1.08, 0.8);
		head.add(eye);
		const shine = new THREE.Mesh(shineGeo, shineMat);
		shine.position.set(x + 0.022, 0.085, 0.31);
		head.add(shine);
	}
	track(eyeGeo);
	track(shineGeo);

	// Cheeks: two soft pink discs that give the face its friendliness.
	const cheekGeo = new THREE.SphereGeometry(0.06, 14, 10);
	for (const x of [-0.21, 0.21]) {
		const cheek = new THREE.Mesh(cheekGeo, cheekMat);
		cheek.position.set(x, -0.035, 0.215);
		cheek.scale.set(1, 0.7, 0.45);
		head.add(cheek);
	}
	track(cheekGeo);

	// --- Ears -------------------------------------------------------------
	// Pivot groups at the base of each ear, so the controller can flop them.
	const leftEar = makeEar(-1, fur, innerEar, track, trackMat);
	const rightEar = makeEar(1, fur, innerEar, track, trackMat);
	head.add(leftEar);
	head.add(rightEar);

	// --- Arms -------------------------------------------------------------
	const leftArm = makeArm(-1, fur, track, trackMat);
	const rightArm = makeArm(1, fur, track, trackMat);
	body.add(leftArm);
	body.add(rightArm);

	// --- Legs / feet ------------------------------------------------------
	// Short stubby legs with a rounded foot: the hop's contact points.
	const leftLeg = makeLeg(-1, furShade, footMat, track, trackMat);
	const rightLeg = makeLeg(1, furShade, footMat, track, trackMat);
	body.add(leftLeg);
	body.add(rightLeg);

	// --- Tail -------------------------------------------------------------
	const tailGeo = new THREE.SphereGeometry(0.1, 14, 10);
	const tail = new THREE.Mesh(tailGeo, bellyMat);
	tail.position.set(0, 0.34, -0.31);
	body.add(tail);
	track(tailGeo);

	// --- Ground shadow ----------------------------------------------------
	// A soft disc under the bunny, kept even when real shadows are off, so
	// Bubu never floats.
	const shadowGeo = new THREE.CircleGeometry(0.42, 24);
	shadowGeo.rotateX(-Math.PI / 2);
	const shadowMat = new THREE.MeshBasicMaterial({
		color: 0x000000,
		transparent: true,
		opacity: 0.16,
		depthWrite: false
	});
	const shadow = new THREE.Mesh(shadowGeo, shadowMat);
	shadow.position.y = 0.015;
	root.add(shadow);
	track(shadowGeo);
	trackMat(shadowMat);

	return {
		rig: { root, body, head, leftEar, rightEar, leftArm, rightArm, leftLeg, rightLeg, shadow },
		dispose: () => {
			for (const d of disposables) d.dispose();
			root.clear();
		}
	};
}

function makeEar(
	side: 1 | -1,
	fur: THREE.Material,
	inner: THREE.Material,
	track: (g: THREE.BufferGeometry) => void,
	_trackMat: (m: THREE.Material) => void
): THREE.Group {
	const pivot = new THREE.Group();
	// Ears rise from the top of the skull, tilted slightly outwards.
	pivot.position.set(side * 0.13, 0.22, -0.02);
	pivot.rotation.z = side * 0.16;

	// Outer ear: a capsule stretched long and flattened front-to-back.
	const outerGeo = new THREE.CapsuleGeometry(0.085, 0.34, 8, 14);
	const outer = new THREE.Mesh(outerGeo, fur);
	outer.position.y = 0.22;
	outer.scale.set(1, 1, 0.62);
	outer.castShadow = true;
	pivot.add(outer);
	track(outerGeo);

	// Inner ear: inset and pushed forward so it is visible from the front.
	const innerGeo = new THREE.CapsuleGeometry(0.052, 0.3, 8, 12);
	const innerMesh = new THREE.Mesh(innerGeo, inner);
	innerMesh.position.set(0, 0.23, 0.038);
	innerMesh.scale.set(1, 1, 0.35);
	pivot.add(innerMesh);
	track(innerGeo);

	return pivot;
}

function makeArm(
	side: 1 | -1,
	fur: THREE.Material,
	track: (g: THREE.BufferGeometry) => void,
	_trackMat: (m: THREE.Material) => void
): THREE.Group {
	const pivot = new THREE.Group();
	pivot.position.set(side * 0.3, 0.55, 0.02);
	pivot.rotation.z = side * 0.28;

	const armGeo = new THREE.CapsuleGeometry(0.075, 0.2, 8, 12);
	const arm = new THREE.Mesh(armGeo, fur);
	arm.position.y = -0.12;
	arm.scale.set(1, 1, 0.9);
	arm.castShadow = true;
	pivot.add(arm);
	track(armGeo);

	// Paw.
	const pawGeo = new THREE.SphereGeometry(0.078, 14, 10);
	const paw = new THREE.Mesh(pawGeo, fur);
	paw.position.y = -0.235;
	pivot.add(paw);
	track(pawGeo);

	return pivot;
}

function makeLeg(
	side: 1 | -1,
	legMat: THREE.Material,
	footMat: THREE.Material,
	track: (g: THREE.BufferGeometry) => void,
	_trackMat: (m: THREE.Material) => void
): THREE.Group {
	const pivot = new THREE.Group();
	pivot.position.set(side * 0.15, 0.26, 0);

	const legGeo = new THREE.CapsuleGeometry(0.088, 0.1, 8, 12);
	const leg = new THREE.Mesh(legGeo, legMat);
	leg.position.y = -0.08;
	leg.castShadow = true;
	pivot.add(leg);
	track(legGeo);

	// Foot: a flattened sphere reaching forward, which is what a hop lands on.
	const footGeo = new THREE.SphereGeometry(0.105, 16, 12);
	const foot = new THREE.Mesh(footGeo, footMat);
	foot.position.set(0, -0.16, 0.06);
	foot.scale.set(1.0, 0.6, 1.38);
	foot.castShadow = true;
	pivot.add(foot);
	track(footGeo);

	return pivot;
}
