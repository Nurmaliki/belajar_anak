import * as THREE from 'three';

/**
 * Daylight for a cheerful preschool world.
 *
 * One directional sun (the only shadow caster), a hemisphere light for the sky
 * bounce that keeps shadows blue rather than black, and a low ambient floor so
 * nothing reads as a featureless silhouette. No point lights: each one costs a
 * shader permutation and a shadow map the game does not need.
 */
export class LightingManager {
	readonly group = new THREE.Group();
	readonly sun: THREE.DirectionalLight;
	private shadowSize = 2048;

	constructor(scene: THREE.Scene, options: { shadows: boolean } = { shadows: true }) {
		// Sky blue from above, warm grass bounce from below.
		const hemi = new THREE.HemisphereLight(0xcfe9ff, 0x8fd06a, 1.55);
		hemi.position.set(0, 30, 0);
		this.group.add(hemi);

		const sun = new THREE.DirectionalLight(0xfff4dc, 2.1);
		sun.position.set(14, 22, 10);
		sun.castShadow = options.shadows;
		if (options.shadows) {
			sun.shadow.mapSize.set(this.shadowSize, this.shadowSize);
			const cam = sun.shadow.camera;
			// A tight ortho box around the play area keeps shadow texels dense.
			cam.left = -24;
			cam.right = 24;
			cam.top = 24;
			cam.bottom = -24;
			cam.near = 1;
			cam.far = 70;
			sun.shadow.bias = -0.0006;
			// A little normal bias avoids the acne on flat-shaded low-poly
			// surfaces without detaching contact shadows.
			sun.shadow.normalBias = 0.02;
		}
		this.sun = sun;
		this.group.add(sun);
		this.group.add(sun.target);

		const ambient = new THREE.AmbientLight(0xffffff, 0.35);
		this.group.add(ambient);

		scene.add(this.group);
	}

	/** Keep the sun's shadow frustum centred on the player so it never misses. */
	followSun(target: THREE.Vector3): void {
		this.sun.target.position.set(target.x, 0, target.z);
		this.sun.position.set(target.x + 14, 22, target.z + 10);
		this.sun.target.updateMatrixWorld();
	}

	dispose(): void {
		this.sun.shadow.map?.dispose();
		this.sun.dispose();
		this.group.clear();
	}
}
