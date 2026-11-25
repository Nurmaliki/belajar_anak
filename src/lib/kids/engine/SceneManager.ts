import * as THREE from 'three';

/**
 * Owns the renderer, scene and camera resize policy.
 *
 * The renderer is created defensively: a device without WebGL gets a typed
 * error the loader can show as a friendly message instead of a blank canvas.
 */
export class SceneManager {
	readonly renderer: THREE.WebGLRenderer;
	readonly scene: THREE.Scene;
	private canvas: HTMLCanvasElement;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;

		let renderer: THREE.WebGLRenderer;
		try {
			renderer = new THREE.WebGLRenderer({
				canvas,
				antialias: true,
				alpha: false,
				powerPreference: 'high-performance'
			});
		} catch (err) {
			const detail = err instanceof Error ? err.message : String(err);
			throw new Error(`WebGL tidak tersedia di browser ini. (${detail})`);
		}

		// Adaptive pixel ratio: full DPR on desktop, capped harder on small
		// screens where the fill rate is the thing that costs frames.
		renderer.setPixelRatio(this.targetPixelRatio());
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.12;
		renderer.shadowMap.enabled = this.shadowsAllowed();
		renderer.shadowMap.type = THREE.PCFShadowMap;

		this.renderer = renderer;

		this.scene = new THREE.Scene();
		// A soft sky-blue fog ties the far edge of the island into the sky
		// instead of leaving a hard line where the ground plane stops.
		this.scene.fog = new THREE.Fog(0xcfe9ff, 40, 110);

		this.resize();
	}

	/** Cap the device pixel ratio by screen size, to protect frame rate. */
	private targetPixelRatio(): number {
		if (typeof window === 'undefined') return 1;
		const dpr = window.devicePixelRatio || 1;
		const small = Math.min(window.innerWidth, window.innerHeight) < 700;
		return Math.min(dpr, small ? 1.5 : 2);
	}

	/** Shadows are skipped on very small screens, where they are the most expensive. */
	private shadowsAllowed(): boolean {
		if (typeof window === 'undefined') return false;
		return Math.min(window.innerWidth, window.innerHeight) >= 420;
	}

	resize(): void {
		const width = this.canvas.clientWidth || window.innerWidth;
		const height = this.canvas.clientHeight || window.innerHeight;
		this.renderer.setPixelRatio(this.targetPixelRatio());
		this.renderer.setSize(width, height, false);
	}

	/** Current drawable aspect ratio. */
	get aspect(): number {
		const w = this.canvas.clientWidth || window.innerWidth;
		const h = this.canvas.clientHeight || window.innerHeight;
		return w / Math.max(1, h);
	}

	render(camera: THREE.Camera): void {
		this.renderer.render(this.scene, camera);
	}

	dispose(): void {
		this.renderer.dispose();
		// Release the GL context explicitly: on mobile, leaking contexts across
		// navigations eventually stops new ones from being created.
		this.renderer.forceContextLoss();
		this.scene.clear();
	}
}
