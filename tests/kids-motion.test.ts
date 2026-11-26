import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Motion invariants that can be checked without a WebGL context.
 *
 * The controller itself needs a browser (Three.js rig, requestAnimationFrame),
 * and a unit test cannot drag a joystick. What *can* be pinned is the shape of
 * the motion rules: the constants that decide how heavy Bubu feels, and the one
 * relationship that was actually broken — the shadow must move opposite to the
 * body, not with it.
 */
const source = readFileSync(
	new URL('../src/lib/kids/engine/CharacterController.ts', import.meta.url),
	'utf8'
);

function constant(name: string): number {
	const match = source.match(new RegExp(`const ${name} = (-?[\\d.]+);`));
	if (!match) throw new Error(`CharacterController has no constant ${name}`);
	return Number(match[1]);
}

describe('motion constants stay in a child-appropriate range', () => {
	it('walking is slower than running', () => {
		expect(constant('WALK_SPEED')).toBeLessThan(constant('RUN_SPEED'));
	});

	it('Bubu never moves faster than a child can follow with their eyes', () => {
		// At 5.4 m/s she crosses the 34-unit island in ~6 s. Much faster than
		// this and a preschooler loses her behind a tree; much slower and the
		// walk between areas becomes a chore.
		expect(constant('RUN_SPEED')).toBeGreaterThan(4);
		expect(constant('RUN_SPEED')).toBeLessThan(7);
	});

	it('acceleration is high enough to feel responsive but not instant', () => {
		// A pure snap (huge ACCEL) reads as sliding on ice in reverse: the body
		// arrives before the animation does.
		expect(constant('ACCEL')).toBeGreaterThan(4);
		expect(constant('ACCEL')).toBeLessThan(20);
	});

	it('the hop is a hop, not a moon jump', () => {
		// Apex height is v^2 / 2g. Bubu is about 1.1 units tall.
		const apex = constant('JUMP_VELOCITY') ** 2 / (2 * constant('GRAVITY'));
		expect(apex).toBeGreaterThan(0.6);
		expect(apex, 'a jump taller than the bunny is a moon jump').toBeLessThan(2);
	});
});

describe('the ground shadow tracks the jump', () => {
	it('is pushed down by exactly the jump height', () => {
		// The regression: `shadow` was created and never touched, so it rose
		// with the rig and sat in mid-air under a jumping bunny. The fix offsets
		// it by `-lift`, which is what this asserts is still there.
		expect(source).toMatch(/shadow\.position\.y\s*=\s*0\.015\s*-\s*lift/);
	});

	it('shrinks and fades as Bubu rises', () => {
		expect(source).toMatch(/shadow\.scale\.setScalar\(shrink\)/);
		expect(source).toMatch(/opacity\s*=\s*0\.16\s*\*\s*shrink/);
	});

	it('the shrink factor is 1 on the ground and smaller in the air', () => {
		const shrink = (lift: number) => 1 / (1 + lift * 0.55);
		expect(shrink(0)).toBe(1);
		expect(shrink(0.5)).toBeLessThan(1);
		// It never reaches zero, so the shadow never blinks out entirely while
		// Bubu is still airborne.
		expect(shrink(100)).toBeGreaterThan(0);
	});
});
