import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CharacterController } from '../src/lib/kids/engine/CharacterController';

/** Basis as the engine supplies it: forward -Z, right +X. */
const BASIS = {
	forward: new THREE.Vector3(0, 0, -1),
	right: new THREE.Vector3(1, 0, 0)
};

function step(c: CharacterController, frames: number, axes: { x: number; y: number }, allow = true) {
	for (let i = 0; i < frames; i++) c.update(1 / 60, axes, BASIS, false, allow);
}

describe('CharacterController movement', () => {
	it('moves forward (-Z) when pushed up', () => {
		const c = new CharacterController();
		c.teleport(0, 4, 0);
		const before = c.position.clone();
		step(c, 60, { x: 0, y: 1 });
		expect(c.position.z).toBeLessThan(before.z - 0.5);
	});

	it('moves right (+X) when pushed right', () => {
		const c = new CharacterController();
		c.teleport(0, 4, 0);
		step(c, 60, { x: 1, y: 0 });
		expect(c.position.x).toBeGreaterThan(0.5);
	});

	it('does not move when movement is disallowed', () => {
		const c = new CharacterController();
		c.teleport(0, 4, 0);
		const before = c.position.clone();
		step(c, 60, { x: 0, y: 1 }, false);
		expect(Math.hypot(c.position.x - before.x, c.position.z - before.z)).toBeLessThan(0.01);
	});

	it('reports a walking state while moving', () => {
		const c = new CharacterController();
		c.teleport(0, 4, 0);
		step(c, 40, { x: 0, y: 1 });
		expect(['walk', 'run']).toContain(c.currentState);
	});

	it('is blocked by a collider placed in its path', () => {
		const c = new CharacterController();
		c.teleport(0, 4, 0);
		// A trunk directly ahead at z = 2.
		c.setColliders([{ x: 0, z: 2, radius: 0.6 }]);
		step(c, 120, { x: 0, y: 1 });
		// It should stop in front of the trunk, not pass through it.
		expect(c.position.z).toBeGreaterThan(2 - 1.2);
	});
});
