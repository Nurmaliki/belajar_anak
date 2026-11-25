import * as THREE from 'three';

/**
 * Load-once asset cache with an explicit fallback contract.
 *
 * The repository ships **no** `.glb` models, so `loadBubuModel` resolves to
 * `null` and the caller keeps the procedural bunny. That is the honest
 * behaviour: the app is not allowed to depend on a file that does not exist.
 * If a `Bubu.glb` is supplied later, this loader returns it. Adopting its scene,
 * clips and attachment points is deliberately left to `CharacterController`,
 * where it can be tested against the actual asset instead of guessed here.
 */

export interface LoadedModel {
	scene: THREE.Group;
	animations: THREE.AnimationClip[];
}

export class AssetManager {
	// Loaded on first use, not at import time: this repository ships no `.glb`
	// models, so paying for GLTFLoader on every startup would be pure cost.
	private gltf: import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader | null = null;
	private models = new Map<string, LoadedModel | null>();
	private textures = new Map<string, THREE.Texture | null>();

	/**
	 * Set once a model URL is known to be absent *in this deployment*.
	 *
	 * Without this, every load of the game asks for `/models/Bubu.glb`, gets a
	 * 404, and repeats on the next load — a permanent 404 in every server log
	 * and browser console for a file that was never shipped. One request per
	 * browser session is enough to learn the answer.
	 */
	private static readonly MISSING_KEY = 'dunia-pintar:missing-model:';

	/** Whether an earlier visit already proved this URL is not deployed. */
	private static isKnownMissing(url: string): boolean {
		try {
			return globalThis.sessionStorage?.getItem(AssetManager.MISSING_KEY + url) === '1';
		} catch {
			// Private mode or no storage: fall back to asking again.
			return false;
		}
	}

	private static rememberMissing(url: string): void {
		try {
			globalThis.sessionStorage?.setItem(AssetManager.MISSING_KEY + url, '1');
		} catch {
			/* storage unavailable; the in-memory cache still prevents repeats */
		}
	}

	/**
	 * Try to load a GLTF model.
	 *
	 * Never throws: a missing or corrupt model resolves to `null` so the caller
	 * can fall back to procedural geometry. A URL already known to be missing
	 * is not requested a second time — see `MISSING_KEY`.
	 */
	async loadModel(url: string): Promise<LoadedModel | null> {
		if (this.models.has(url)) return this.models.get(url) ?? null;
		if (AssetManager.isKnownMissing(url)) {
			this.models.set(url, null);
			return null;
		}
		try {
			this.gltf ??= new (await import('three/examples/jsm/loaders/GLTFLoader.js')).GLTFLoader();
			const gltf = await this.gltf.loadAsync(url);
			const model: LoadedModel = { scene: gltf.scene, animations: gltf.animations };
			this.models.set(url, model);
			return model;
		} catch {
			// Missing asset is an expected state, not an error worth surfacing.
			// A 404 is remembered; a parse error is not, so a corrupt file gets
			// re-fetched after it is replaced rather than being blacklisted.
			if (await AssetManager.isAbsent(url)) AssetManager.rememberMissing(url);
			this.models.set(url, null);
			return null;
		}
	}

	/**
	 * Was the failure "there is no such file" rather than "the file is bad"?
	 *
	 * A `HEAD` request is cheap and answered from cache, and it distinguishes
	 * the two cases without guessing from an error message.
	 */
	private static async isAbsent(url: string): Promise<boolean> {
		try {
			const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
			return res.status === 404 || res.status === 410;
		} catch {
			return false;
		}
	}

	/**
	 * The character model, if one has been provided.
	 *
	 * Returns `null` in this repository — see the class comment.
	 */
	async loadBubuModel(): Promise<LoadedModel | null> {
		return this.loadModel('/models/Bubu.glb');
	}

	/** Load a texture with the same never-throw contract. */
	async loadTexture(url: string): Promise<THREE.Texture | null> {
		if (this.textures.has(url)) return this.textures.get(url) ?? null;
		try {
			const tex = await new THREE.TextureLoader().loadAsync(url);
			tex.colorSpace = THREE.SRGBColorSpace;
			tex.wrapS = THREE.RepeatWrapping;
			tex.wrapT = THREE.RepeatWrapping;
			this.textures.set(url, tex);
			return tex;
		} catch {
			this.textures.set(url, null);
			return null;
		}
	}

	dispose(): void {
		for (const model of this.models.values()) {
			model?.scene.traverse((o) => {
				if (o instanceof THREE.Mesh) {
					o.geometry?.dispose();
					const mat = o.material;
					if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
					else mat?.dispose();
				}
			});
		}
		for (const tex of this.textures.values()) tex?.dispose();
		this.models.clear();
		this.textures.clear();
	}
}
