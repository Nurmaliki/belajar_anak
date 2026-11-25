import * as THREE from 'three';
import { AREAS, AREA_ORDER } from '../data/areas';
import type { AreaId } from '../types';

/**
 * The island: terrain, sky, dressing and the five area landmarks.
 *
 * Everything is procedural. Terrain is a low-poly grid displaced by smooth
 * sine fields rather than Perlin noise — the hills need to be *gentle and
 * predictable*, and a deterministic height function also means collision and
 * placement agree exactly with the visuals.
 */

/** World radius, beyond which the player is gently held. */
export const ISLAND_RADIUS = 34;

/**
 * Terrain height at a point.
 *
 * Exported so the character controller, the camera and prop placement all use
 * the *same* surface. Three separate height functions is how a character ends
 * up walking through a hill.
 */
export function terrainHeight(x: number, z: number): number {
	const r = Math.hypot(x, z);
	// A gentle bowl: flat in the middle where the areas sit, rising at the rim.
	const rim = Math.max(0, (r - 18) / 16) ** 2 * 3.2;
	// Rolling hills, low frequency.
	const hills =
		Math.sin(x * 0.12) * 0.55 + Math.cos(z * 0.1) * 0.5 + Math.sin((x + z) * 0.07) * 0.35;
	// Flatten near the centre so the play area reads as a clearing.
	const centre = Math.min(1, r / 12);
	return rim + hills * 0.35 * centre;
}

const COLORS = {
	grass: 0x7ecb5a,
	grassLight: 0x93db6d,
	grassDark: 0x5fae42,
	trunk: 0x8b5a35,
	leafA: 0x5fbf5a,
	leafB: 0x7fd46e,
	leafC: 0x4fa84e,
	stone: 0xb8c2c9,
	fence: 0xb98a5a,
	fenceDark: 0x9a6f45,
	apple: 0xe8453c,
	appleLeaf: 0x4caf50,
	path: 0xe7d6a8
};

interface Prop {
	group: THREE.Group;
	collider?: { x: number; z: number; radius: number };
}

export interface AreaLandmark {
	area: AreaId;
	group: THREE.Group;
	/** World position of the landmark, for proximity checks. */
	position: THREE.Vector3;
	/** The banner mesh, animated for attention. */
	banner: THREE.Mesh;
}

export class WorldManager {
	readonly group = new THREE.Group();
	/** Circle colliders the character cannot walk through. */
	readonly colliders: { x: number; z: number; radius: number }[] = [];
	/** Solid meshes the camera must not clip through. */
	readonly occluders: THREE.Object3D[] = [];
	readonly landmarks = new Map<AreaId, AreaLandmark>();
	private disposables: { dispose: () => void }[] = [];
	/** Animated floating letters above the alphabet forest. */
	private floaters: { mesh: THREE.Mesh; baseY: number; phase: number }[] = [];
	/** Decorative clouds drifting slowly across the sky. */
	private clouds: { group: THREE.Group; baseX: number; baseZ: number; speed: number; phase: number }[] = [];

	constructor(scene: THREE.Scene) {
		this.group.name = 'island';
		scene.add(this.group);

		this.buildSky();
		this.buildClouds();
		this.buildTerrain();
		this.buildPath();
		this.buildTrees();
		this.buildFlowersAndRocks();
		this.buildLandmarks();
		this.buildBoundsFence();
	}

	private track<T extends { dispose: () => void }>(resource: T): T {
		this.disposables.push(resource);
		return resource;
	}

	private mat(hex: number, opts: { flat?: boolean; roughness?: number } = {}): THREE.MeshStandardMaterial {
		return this.track(
			new THREE.MeshStandardMaterial({
				color: new THREE.Color().setHex(hex, THREE.SRGBColorSpace),
				roughness: opts.roughness ?? 0.92,
				metalness: 0,
				flatShading: opts.flat ?? true
			})
		);
	}

	// --- sky --------------------------------------------------------------

	private buildSky(): void {
		// A large inverted sphere with a vertical gradient. Cheaper and calmer
		// than a physical sky, and it never shows a seam.
		const geo = this.track(new THREE.SphereGeometry(240, 32, 16));
		const mat = this.track(
			new THREE.ShaderMaterial({
				side: THREE.BackSide,
				depthWrite: false,
				uniforms: {
					top: { value: new THREE.Color(0x5fb4ff) },
					bottom: { value: new THREE.Color(0xd8efff) }
				},
				vertexShader: `
					varying float vH;
					void main() {
						vec4 world = modelMatrix * vec4(position, 1.0);
						vH = normalize(world.xyz).y;
						gl_Position = projectionMatrix * viewMatrix * world;
					}
				`,
				fragmentShader: `
					uniform vec3 top;
					uniform vec3 bottom;
					varying float vH;
					void main() {
						float t = clamp(vH * 1.6 + 0.25, 0.0, 1.0);
						gl_FragColor = vec4(mix(bottom, top, t), 1.0);
					}
				`
			})
		);
		const sky = new THREE.Mesh(geo, mat);
		sky.frustumCulled = false;
		this.group.add(sky);

		// Sun disc, purely decorative.
		const sunGeo = this.track(new THREE.SphereGeometry(6, 16, 12));
		const sunMat = this.track(new THREE.MeshBasicMaterial({ color: 0xfff7d6 }));
		const sun = new THREE.Mesh(sunGeo, sunMat);
		sun.position.set(70, 90, -60);
		this.group.add(sun);
	}

	// --- clouds ------------------------------------------------------------

	/**
	 * A handful of soft clouds drifting on a slow circular path. Each is a
	 * cluster of white spheres — no textures, no per-frame geometry work, and
	 * they never cast shadows (a moving shadow over the play area reads as a
	 * glitch, not weather).
	 */
	private buildClouds(): void {
		const cloudMat = this.track(
			new THREE.MeshStandardMaterial({
				color: 0xffffff,
				roughness: 1,
				metalness: 0,
				flatShading: false,
				transparent: true,
				opacity: 0.9
			})
		);
		// Each cloud: one wide lobe plus two smaller ones for a puffy silhouette.
		const lobeGeos = [
			this.track(new THREE.SphereGeometry(3.2, 14, 10)),
			this.track(new THREE.SphereGeometry(2.2, 12, 8)),
			this.track(new THREE.SphereGeometry(1.6, 12, 8))
		];
		const seedBase = 7;
		for (let c = 0; c < 6; c++) {
			const group = new THREE.Group();
			group.name = `cloud-${c}`;
			const lobe = (geo: THREE.SphereGeometry, dx: number, dy: number, dz: number, s: number) => {
				const m = new THREE.Mesh(geo, cloudMat);
				m.position.set(dx, dy, dz);
				m.scale.set(s, s * 0.8, s);
				group.add(m);
			};
			lobe(lobeGeos[0], 0, 0, 0, 1);
			lobe(lobeGeos[1], 2.4, 0.5, 0.4, 1);
			lobe(lobeGeos[2], -2.2, 0.3, -0.3, 1);
			const angle = (c / 6) * Math.PI * 2 + seedBase;
			const radius = 55 + (c % 3) * 12;
			group.position.set(Math.cos(angle) * radius, 34 + (c % 2) * 8, Math.sin(angle) * radius);
			group.scale.setScalar(1 + (c % 3) * 0.25);
			this.group.add(group);
			this.clouds.push({ group, baseX: group.position.x, baseZ: group.position.z, speed: 0.008 + (c % 3) * 0.004, phase: angle });
		}
	}

	// --- terrain ----------------------------------------------------------

	private buildTerrain(): void {
		const size = 120;
		const segs = 96;
		const geo = this.track(new THREE.PlaneGeometry(size, size, segs, segs));
		geo.rotateX(-Math.PI / 2);

		const pos = geo.attributes.position as THREE.BufferAttribute;
		const colors: number[] = [];
		const cGrass = new THREE.Color().setHex(COLORS.grass, THREE.SRGBColorSpace);
		const cLight = new THREE.Color().setHex(COLORS.grassLight, THREE.SRGBColorSpace);
		const cDark = new THREE.Color().setHex(COLORS.grassDark, THREE.SRGBColorSpace);

		for (let i = 0; i < pos.count; i++) {
			const x = pos.getX(i);
			const z = pos.getZ(i);
			pos.setY(i, terrainHeight(x, z));

			// Vertex colour mottling, so a flat-shaded plane does not read as
			// one solid slab of green.
			const n = Math.sin(x * 0.7) * Math.cos(z * 0.6) * 0.5 + 0.5;
			const c = cGrass.clone().lerp(n > 0.5 ? cLight : cDark, Math.abs(n - 0.5) * 0.55);
			colors.push(c.r, c.g, c.b);
		}
		geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
		geo.computeVertexNormals();

		const mat = this.mat(0xffffff);
		mat.vertexColors = true;
		mat.flatShading = true;

		const terrain = new THREE.Mesh(geo, mat);
		terrain.receiveShadow = true;
		terrain.name = 'terrain';
		this.group.add(terrain);
	}

	/** A sandy path linking the spawn point to each area. */
	private buildPath(): void {
		const mat = this.mat(COLORS.path, { flat: false, roughness: 0.95 });
		const points: THREE.Vector3[] = [new THREE.Vector3(0, 0, 4)];
		for (const id of AREA_ORDER) {
			const a = AREAS[id];
			points.push(new THREE.Vector3(a.position.x, 0, a.position.z));
		}
		for (const p of points.slice(1)) {
			const from = new THREE.Vector3(0, 0, 4);
			const dist = from.distanceTo(p);
			const steps = Math.ceil(dist / 1.4);
			for (let i = 0; i < steps; i++) {
				const t = i / Math.max(1, steps - 1);
				const x = THREE.MathUtils.lerp(from.x, p.x, t);
				const z = THREE.MathUtils.lerp(from.z, p.z, t);
				const geo = this.track(new THREE.CircleGeometry(0.62, 10));
				geo.rotateX(-Math.PI / 2);
				const blob = new THREE.Mesh(geo, mat);
				blob.position.set(x + Math.sin(i * 2.1) * 0.16, terrainHeight(x, z) + 0.03, z);
				blob.scale.set(1, 1, 0.8);
				blob.receiveShadow = true;
				this.group.add(blob);
			}
		}
	}

	// --- trees ------------------------------------------------------------

	private buildTrees(): void {
		// A deterministic scatter: a seeded LCG, so the island looks the same
		// on every visit (and tests could reproduce it).
		let seed = 1337;
		const rand = () => {
			seed = (seed * 1664525 + 1013904223) % 4294967296;
			return seed / 4294967296;
		};

		const trunkMat = this.mat(COLORS.trunk);
		const leafMats = [this.mat(COLORS.leafA), this.mat(COLORS.leafB), this.mat(COLORS.leafC)];

		let placed = 0;
		let guard = 0;
		while (placed < 46 && guard < 800) {
			guard++;
			const angle = rand() * Math.PI * 2;
			const radius = 9 + rand() * 24;
			const x = Math.cos(angle) * radius;
			const z = Math.sin(angle) * radius;

			if (this.tooCloseToArea(x, z, 4.2)) continue;
			if (Math.hypot(x, z - 4) < 6) continue; // keep the spawn clear

			const scale = 0.8 + rand() * 0.6;
			const prop = this.makeTree(trunkMat, leafMats[Math.floor(rand() * leafMats.length)], scale);
			prop.group.position.set(x, terrainHeight(x, z), z);
			prop.group.rotation.y = rand() * Math.PI * 2;
			this.group.add(prop.group);
			this.occluders.push(prop.group);
			// The collider must carry the tree's real world position. Leaving it
			// at the placeholder origin piled every trunk into one wall at the
			// spawn point and Bubu could not take a step.
			if (prop.collider) this.colliders.push({ ...prop.collider, x, z });
			placed++;
		}
	}

	private makeTree(trunkMat: THREE.Material, leafMat: THREE.Material, scale: number): Prop {
		const group = new THREE.Group();
		const trunkGeo = this.track(new THREE.CylinderGeometry(0.16, 0.24, 1.5, 7));
		const trunk = new THREE.Mesh(trunkGeo, trunkMat);
		trunk.position.y = 0.75;
		trunk.castShadow = true;
		group.add(trunk);

		// Two or three overlapping blobs make a rounded canopy that reads as
		// "tree" from any angle, without a texture.
		const blobGeo = this.track(new THREE.IcosahedronGeometry(0.95, 1));
		for (let i = 0; i < 3; i++) {
			const blob = new THREE.Mesh(blobGeo, leafMat);
			const a = (i / 3) * Math.PI * 2;
			blob.position.set(Math.cos(a) * 0.42, 1.75 + (i === 0 ? 0.3 : 0), Math.sin(a) * 0.42);
			blob.scale.setScalar(0.8 + (i === 0 ? 0.25 : 0));
			blob.castShadow = true;
			group.add(blob);
		}

		group.scale.setScalar(scale);
		// Only the radius is intrinsic to the tree; the caller supplies the
		// position, because a placeholder (0,0) here once became a real wall.
		return {
			group,
			collider: { x: 0, z: 0, radius: 0.45 * scale }
		};
	}

	private tooCloseToArea(x: number, z: number, pad: number): boolean {
		for (const id of AREA_ORDER) {
			const a = AREAS[id];
			if (Math.hypot(x - a.position.x, z - a.position.z) < pad + 3) return true;
		}
		return false;
	}

	// --- flowers & rocks --------------------------------------------------

	private buildFlowersAndRocks(): void {
		let seed = 99;
		const rand = () => {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			return seed / 2147483648;
		};

		const petalColors = [0xff7fa8, 0xffd93d, 0xffffff, 0xb07cff, 0xff9f43];
		const stemMat = this.mat(0x4c9a3f);
		const stemGeo = this.track(new THREE.CylinderGeometry(0.02, 0.025, 0.3, 5));
		const petalGeo = this.track(new THREE.SphereGeometry(0.075, 8, 6));
		const heartGeo = this.track(new THREE.SphereGeometry(0.05, 8, 6));
		const heartMat = this.mat(0xffd93d);
		const petalMats = petalColors.map((c) => this.mat(c, { flat: false }));

		// Instanced per colour: 5 draw calls for ~200 flowers rather than 1200.
		const counts = petalColors.map(() => 0);
		const total = 200;
		const placements: { x: number; y: number; z: number; color: number; rot: number }[] = [];
		for (let i = 0; i < total; i++) {
			const angle = rand() * Math.PI * 2;
			const radius = 4 + rand() * 27;
			const x = Math.cos(angle) * radius;
			const z = Math.sin(angle) * radius;
			const colorIdx = Math.floor(rand() * petalColors.length);
			counts[colorIdx]++;
			placements.push({ x, y: terrainHeight(x, z), z, color: colorIdx, rot: rand() * Math.PI });
		}

		const dummy = new THREE.Object3D();
		for (let c = 0; c < petalColors.length; c++) {
			const inst = new THREE.InstancedMesh(petalGeo, petalMats[c], Math.max(1, counts[c]));
			inst.castShadow = false;
			let k = 0;
			for (const p of placements) {
				if (p.color !== c) continue;
				dummy.position.set(p.x, p.y + 0.32, p.z);
				dummy.rotation.set(0, p.rot, 0);
				dummy.scale.setScalar(1);
				dummy.updateMatrix();
				inst.setMatrixAt(k++, dummy.matrix);
			}
			inst.count = k;
			inst.instanceMatrix.needsUpdate = true;
			this.group.add(inst);
			this.disposables.push(inst);
		}

		// Stems: one instanced mesh for all of them.
		const stems = new THREE.InstancedMesh(stemGeo, stemMat, placements.length);
		placements.forEach((p, i) => {
			dummy.position.set(p.x, p.y + 0.15, p.z);
			dummy.rotation.set(0, 0, 0);
			dummy.scale.setScalar(1);
			dummy.updateMatrix();
			stems.setMatrixAt(i, dummy.matrix);
		});
		stems.instanceMatrix.needsUpdate = true;
		this.group.add(stems);
		this.disposables.push(stems);

		// Yellow flower hearts.
		const hearts = new THREE.InstancedMesh(heartGeo, heartMat, placements.length);
		placements.forEach((p, i) => {
			dummy.position.set(p.x, p.y + 0.35, p.z);
			dummy.rotation.set(0, 0, 0);
			dummy.scale.setScalar(1);
			dummy.updateMatrix();
			hearts.setMatrixAt(i, dummy.matrix);
		});
		hearts.instanceMatrix.needsUpdate = true;
		this.group.add(hearts);
		this.disposables.push(hearts);

		// A few rounded rocks.
		const rockGeo = this.track(new THREE.DodecahedronGeometry(0.55, 0));
		const rockMat = this.mat(COLORS.stone);
		for (let i = 0; i < 12; i++) {
			const angle = rand() * Math.PI * 2;
			const radius = 12 + rand() * 18;
			const x = Math.cos(angle) * radius;
			const z = Math.sin(angle) * radius;
			if (this.tooCloseToArea(x, z, 3)) continue;
			const rock = new THREE.Mesh(rockGeo, rockMat);
			rock.position.set(x, terrainHeight(x, z) + 0.18, z);
			rock.scale.set(1 + rand() * 0.6, 0.7 + rand() * 0.4, 1 + rand() * 0.6);
			rock.rotation.set(rand(), rand() * Math.PI, rand());
			rock.castShadow = true;
			rock.receiveShadow = true;
			this.group.add(rock);
			this.colliders.push({ x, z, radius: 0.6 });
		}
	}

	// --- landmarks --------------------------------------------------------

	private buildLandmarks(): void {
		for (const id of AREA_ORDER) {
			const def = AREAS[id];
			const group = new THREE.Group();
			const y = terrainHeight(def.position.x, def.position.z);
			group.position.set(def.position.x, y, def.position.z);

			// A round stage, so each area reads as a distinct place.
			const stageGeo = this.track(new THREE.CylinderGeometry(3.0, 3.2, 0.3, 24));
			const stageMat = this.mat(id === 'counting' ? 0xd8a05a : 0xcbb89a, { flat: false });
			const stage = new THREE.Mesh(stageGeo, stageMat);
			stage.position.y = 0.15;
			stage.receiveShadow = true;
			group.add(stage);

			// Two posts and a banner in the area's colour.
			const postGeo = this.track(new THREE.CylinderGeometry(0.09, 0.11, 2.6, 7));
			const postMat = this.mat(COLORS.fenceDark);
			for (const x of [-1.5, 1.5]) {
				const post = new THREE.Mesh(postGeo, postMat);
				post.position.set(x, 1.3, 0);
				post.castShadow = true;
				group.add(post);
			}

			const bannerGeo = this.track(new THREE.BoxGeometry(3.1, 0.9, 0.08));
			const bannerMat = this.mat(def.color, { flat: false });
			const banner = new THREE.Mesh(bannerGeo, bannerMat);
			banner.position.set(0, 2.35, 0);
			banner.castShadow = true;
			group.add(banner);

			// Each area also gets a themed sculpture, so the five places look
			// like five places rather than five identical signposts.
			group.add(this.makeAreaSculpture(id));

			this.group.add(group);
			// The stage is walkable; the posts are not.
			this.colliders.push({ x: def.position.x - 1.5, z: def.position.z, radius: 0.2 });
			this.colliders.push({ x: def.position.x + 1.5, z: def.position.z, radius: 0.2 });

			this.landmarks.set(id, {
				area: id,
				group,
				position: new THREE.Vector3(def.position.x, y, def.position.z),
				banner
			});
		}
	}

	private makeAreaSculpture(id: AreaId): THREE.Object3D {
		const g = new THREE.Group();
		g.position.set(0, 1.2, -1.6);

		if (id === 'counting') {
			// A giant apple on a plinth.
			const appleGeo = this.track(new THREE.SphereGeometry(0.8, 20, 16));
			const apple = new THREE.Mesh(appleGeo, this.mat(COLORS.apple, { flat: false }));
			apple.scale.set(1, 0.92, 1);
			apple.castShadow = true;
			g.add(apple);
			const stemGeo = this.track(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6));
			const stem = new THREE.Mesh(stemGeo, this.mat(COLORS.trunk));
			stem.position.y = 0.85;
			g.add(stem);
			const leafGeo = this.track(new THREE.SphereGeometry(0.2, 10, 8));
			const leaf = new THREE.Mesh(leafGeo, this.mat(COLORS.appleLeaf));
			leaf.position.set(0.18, 0.92, 0);
			leaf.scale.set(1, 0.4, 0.6);
			g.add(leaf);
		} else if (id === 'alphabet') {
			// Floating letters that bob above the stage.
			const letters = ['A', 'B', 'C'];
			const mat = this.mat(AREAS.alphabet.color, { flat: false });
			letters.forEach((letter, i) => {
				const geo = this.track(new THREE.BoxGeometry(0.5, 0.7, 0.12));
				const mesh = new THREE.Mesh(geo, mat);
				mesh.position.set((i - 1) * 0.9, i * 0.35, i * 0.2);
				mesh.castShadow = true;
				g.add(mesh);
				this.floaters.push({ mesh, baseY: mesh.position.y, phase: i * 1.3 });
			});
		} else if (id === 'reading') {
			// An open book.
			const coverMat = this.mat(0xb98cff, { flat: false });
			for (const side of [-1, 1]) {
				const pageGeo = this.track(new THREE.BoxGeometry(0.85, 0.06, 1.0));
				const page = new THREE.Mesh(pageGeo, coverMat);
				page.position.set(side * 0.44, 0, 0);
				page.rotation.z = side * 0.14;
				page.castShadow = true;
				g.add(page);
			}
		} else if (id === 'colors') {
			// A stack of coloured blocks.
			const palette = [0xe8453c, 0xf7c948, 0x3d8bff, 0x47b85c];
			palette.forEach((hex, i) => {
				const geo = this.track(new THREE.BoxGeometry(0.6, 0.6, 0.6));
				const block = new THREE.Mesh(geo, this.mat(hex, { flat: false }));
				block.position.set((i % 2) * 0.5 - 0.25, i * 0.32, 0);
				block.castShadow = true;
				g.add(block);
			});
		} else {
			// Animal forest: a big friendly elephant silhouette in blocks.
			const bodyMat = this.mat(0x4ed18a, { flat: false });
			const bodyGeo = this.track(new THREE.SphereGeometry(0.75, 18, 14));
			const body = new THREE.Mesh(bodyGeo, bodyMat);
			body.scale.set(1.2, 0.95, 0.9);
			body.castShadow = true;
			g.add(body);
			const earGeo = this.track(new THREE.SphereGeometry(0.42, 14, 10));
			for (const side of [-1, 1]) {
				const ear = new THREE.Mesh(earGeo, bodyMat);
				ear.position.set(side * 0.72, 0.12, 0.1);
				ear.scale.set(0.35, 1, 0.9);
				ear.castShadow = true;
				g.add(ear);
			}
		}
		return g;
	}

	/** A low fence around the lip of the island, so nobody walks off the map. */
	private buildBoundsFence(): void {
		const postGeo = this.track(new THREE.BoxGeometry(0.16, 0.9, 0.16));
		const postMat = this.mat(COLORS.fence);
		const railGeo = this.track(new THREE.BoxGeometry(1.0, 0.1, 0.08));
		const railMat = this.mat(COLORS.fenceDark);

		const segments = 64;
		const radius = ISLAND_RADIUS - 1;
		for (let i = 0; i < segments; i++) {
			const a = (i / segments) * Math.PI * 2;
			const x = Math.cos(a) * radius;
			const z = Math.sin(a) * radius;
			const y = terrainHeight(x, z);
			const post = new THREE.Mesh(postGeo, postMat);
			post.position.set(x, y + 0.45, z);
			post.rotation.y = -a;
			post.castShadow = true;
			this.group.add(post);

			if (i % 2 === 0) {
				const a2 = ((i + 2) / segments) * Math.PI * 2;
				const x2 = Math.cos(a2) * radius;
				const z2 = Math.sin(a2) * radius;
				const rail = new THREE.Mesh(railGeo, railMat);
				rail.position.set((x + x2) / 2, (y + terrainHeight(x2, z2)) / 2 + 0.55, (z + z2) / 2);
				rail.rotation.y = -a + Math.PI / 2;
				rail.scale.x = 1.6;
				this.group.add(rail);
			}
		}
	}

	// --- per-frame --------------------------------------------------------

	animate(time: number): void {
		for (const f of this.floaters) {
			f.mesh.position.y = f.baseY + Math.sin(time * 1.4 + f.phase) * 0.18;
			f.mesh.rotation.y = Math.sin(time * 0.7 + f.phase) * 0.3;
		}
		// Clouds drift on a very slow circular path around the island.
		for (const c of this.clouds) {
			const a = c.phase + time * c.speed;
			c.group.position.x = Math.cos(a) * 55;
			c.group.position.z = Math.sin(a) * 55;
		}
	}

	/** Nearest area landmark within `radius`, or null. */
	nearestArea(position: THREE.Vector3, radius = 4): AreaId | null {
		let best: AreaId | null = null;
		let bestDist = radius;
		for (const [id, lm] of this.landmarks) {
			const d = Math.hypot(position.x - lm.position.x, position.z - lm.position.z);
			if (d < bestDist) {
				bestDist = d;
				best = id;
			}
		}
		return best;
	}

	dispose(): void {
		for (const d of this.disposables) d.dispose();
		this.disposables = [];
		this.group.clear();
		this.colliders.length = 0;
		this.occluders.length = 0;
		this.landmarks.clear();
		this.floaters = [];
	}
}
