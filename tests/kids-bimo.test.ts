import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BimoController, shortestAngle } from '../src/lib/kids/engine/BimoController';
import { createBimo, BIMO_HEIGHT } from '../src/lib/kids/engine/Bimo';

/**
 * Bimo is the only character with behaviour of his own, and the rules that
 * matter are the ones a child would notice: he turns to look at you, he hops
 * when tapped, he cheers when you win, and he never does anything sad.
 */

function scene() {
	return new THREE.Scene();
}

function bimo() {
	return new BimoController(scene(), { position: { x: 3.4, z: 2.2 }, facing: -0.5 });
}

/** Run frames at 60 fps, with Bubu far away unless told otherwise. */
function run(b: BimoController, seconds: number, lookAt: THREE.Vector3 | null = null) {
	const frames = Math.round(seconds * 60);
	for (let i = 0; i < frames; i++) b.update(1 / 60, lookAt);
}

describe('createBimo — the rig', () => {
	it('builds a named rig so an animator never touches geometry', () => {
		const { rig, dispose } = createBimo();
		for (const part of ['root', 'body', 'head', 'leftEar', 'rightEar', 'tail', 'leftArm', 'rightArm']) {
			expect(rig[part as keyof typeof rig], part).toBeInstanceOf(THREE.Object3D);
		}
		dispose();
	});

	it('is smaller than Bubu, so he reads as a companion', () => {
		expect(BIMO_HEIGHT).toBeLessThan(1.15);
	});

	it('has a tail group that actually holds the plume', () => {
		const { rig, dispose } = createBimo();
		expect(rig.tail.children.length).toBeGreaterThanOrEqual(3);
		dispose();
	});

	it('disposes without throwing', () => {
		const { dispose } = createBimo();
		expect(() => dispose()).not.toThrow();
	});
});

describe('BimoController — he watches Bubu', () => {
	it('turns to face Bubu when she is nearby', () => {
		const b = bimo();
		// Bubu straight along +Z from Bimo: yaw 0 faces her.
		const target = new THREE.Vector3(3.4, 0, 8);
		run(b, 2, target);
		expect(Math.abs(shortestAngle(b.root.rotation.y, 0))).toBeLessThan(0.15);
		b.dispose();
	});

	it('faces along +X when Bubu is to the right', () => {
		const b = bimo();
		const target = new THREE.Vector3(9, 0, 2.2);
		run(b, 2, target);
		// The rig faces +Z, so looking along +X is a yaw of +π/2.
		expect(Math.abs(shortestAngle(b.root.rotation.y, Math.PI / 2))).toBeLessThan(0.15);
		b.dispose();
	});

	it('returns to his resting facing when Bubu wanders far away', () => {
		const b = bimo();
		run(b, 2, new THREE.Vector3(3.4, 0, 8));
		run(b, 3, new THREE.Vector3(200, 0, 200));
		expect(Math.abs(shortestAngle(b.root.rotation.y, -0.5))).toBeLessThan(0.15);
		b.dispose();
	});

	it('does not spin when Bubu stands on top of him', () => {
		const b = bimo();
		const before = b.root.rotation.y;
		run(b, 1, new THREE.Vector3(b.position.x, 0, b.position.z));
		expect(Number.isFinite(b.root.rotation.y)).toBe(true);
		expect(Math.abs(shortestAngle(b.root.rotation.y, before))).toBeLessThan(0.05);
		b.dispose();
	});

	it('turns smoothly rather than snapping in one frame', () => {
		const b = bimo();
		b.update(1 / 60, new THREE.Vector3(9, 0, 2.2));
		const afterOneFrame = Math.abs(shortestAngle(-0.5, b.root.rotation.y));
		// A snap would jump most of the way to π/2 immediately.
		expect(afterOneFrame).toBeLessThan(0.5);
		b.dispose();
	});
});

describe('BimoController — he greets', () => {
	it('hops when tapped and settles back to idle', () => {
		const b = bimo();
		b.greet();
		expect(b.currentState).toBe('hop');
		expect(b.isHopping).toBe(true);
		run(b, 0.25);
		expect(b.isHopping).toBe(true);
		run(b, 1);
		expect(b.currentState).toBe('idle');
		b.dispose();
	});

	it('tapping again restarts the hop rather than stacking', () => {
		const b = bimo();
		b.greet();
		run(b, 0.5);
		b.greet();
		expect(b.currentState).toBe('hop');
		run(b, 1);
		expect(b.currentState).toBe('idle');
		b.dispose();
	});

	it('hops above the ground and comes back down', () => {
		const b = bimo();
		expect(b.hopHeight).toBe(0);
		b.greet();
		run(b, 0.35);
		const midHop = b.hopHeight;
		expect(midHop).toBeGreaterThan(0.1);
		run(b, 1);
		expect(b.hopHeight).toBe(0);
		b.dispose();
	});
});

describe('BimoController — he cheers, never sulks', () => {
	it('cheers when told, then returns to idle', () => {
		const b = bimo();
		b.cheer();
		expect(b.currentState).toBe('cheer');
		run(b, 0.5);
		expect(b.currentState).toBe('cheer');
		run(b, 2);
		expect(b.currentState).toBe('idle');
		b.dispose();
	});

	it('has no sad state at all — only idle, hop and cheer', () => {
		const b = bimo();
		const seen = new Set<string>();
		b.greet();
		for (let i = 0; i < 120; i++) {
			b.update(1 / 60, null);
			seen.add(b.currentState);
		}
		b.cheer();
		for (let i = 0; i < 120; i++) {
			b.update(1 / 60, null);
			seen.add(b.currentState);
		}
		expect([...seen].sort()).toEqual(['cheer', 'hop', 'idle']);
		b.dispose();
	});

	it('idle is stable: he does not wander off his stump', () => {
		const b = bimo();
		const start = b.position.clone();
		run(b, 10);
		expect(b.position.distanceTo(start)).toBeLessThan(0.001);
		b.dispose();
	});
});

describe('shortestAngle', () => {
	it('takes the short way around the circle', () => {
		expect(shortestAngle(0, 0.1)).toBeCloseTo(0.1);
		expect(shortestAngle(0.1, 0)).toBeCloseTo(-0.1);
		// From just under π to just over -π is a small step, not a full turn.
		expect(Math.abs(shortestAngle(3.0, -3.0))).toBeLessThan(0.3);
	});

	it('is bounded by π', () => {
		for (let a = -10; a <= 10; a += 0.37) {
			for (let b = -10; b <= 10; b += 0.53) {
				expect(Math.abs(shortestAngle(a, b))).toBeLessThanOrEqual(Math.PI + 1e-9);
			}
		}
	});
});
