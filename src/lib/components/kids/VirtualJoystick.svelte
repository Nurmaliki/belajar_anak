<script lang="ts">
	/**
	 * Virtual joystick for touch.
	 *
	 * Reports a unit-circle direction. Deliberately forgiving: the stick
	 * activates from a press anywhere in its zone, so a child does not have to
	 * find the centre first, and it keeps tracking the original pointer even if
	 * the finger leaves the circle.
	 */
	interface Props {
		size?: number;
		onchange: (x: number, y: number) => void;
		disabled?: boolean;
	}

	let { size = 132, onchange, disabled = false }: Props = $props();

	let base = $state<HTMLDivElement | null>(null);
	let knobX = $state(0);
	let knobY = $state(0);
	let active = $state(false);
	let pointerId: number | null = null;

	const radius = $derived(size / 2 - 18);

	function update(e: PointerEvent) {
		if (!base) return;
		const rect = base.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		let dx = e.clientX - cx;
		let dy = e.clientY - cy;
		const len = Math.hypot(dx, dy);
		const max = radius;
		if (len > max) {
			dx = (dx / len) * max;
			dy = (dy / len) * max;
		}
		knobX = dx;
		knobY = dy;
		// Screen up is negative dy, but movement forward is positive y.
		const nx = dx / max;
		const ny = -dy / max;
		onchange(clamp(nx), clamp(ny));
	}

	function clamp(v: number) {
		return Math.max(-1, Math.min(1, v));
	}

	function onDown(e: PointerEvent) {
		if (disabled) return;
		e.preventDefault();
		active = true;
		pointerId = e.pointerId;
		// `setPointerCapture` throws on a pointer that has already gone away —
		// a real Safari behaviour when a tap is lifted very quickly. Left
		// unguarded, the throw happened *after* `active` and `pointerId` were
		// set but *before* anything could release them, so `onUp` never matched
		// and the child's last direction kept being fed to the character:
		// Bubu walked off on her own and would not stop.
		try {
			base?.setPointerCapture(e.pointerId);
		} catch {
			// Without capture, `onUp` on this element still fires; the window
			// listeners below cover the case where the finger slides away.
		}
		update(e);
	}

	function onMove(e: PointerEvent) {
		if (!active || e.pointerId !== pointerId) return;
		e.preventDefault();
		update(e);
	}

	function onUp(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		release();
	}

	/** Let go, wherever the finger went. Safe to call twice. */
	function release() {
		if (!active && pointerId === null) return;
		active = false;
		pointerId = null;
		knobX = 0;
		knobY = 0;
		onchange(0, 0);
	}

	/** Pausing must stop a finger that is already down. */
	$effect(() => {
		if (disabled) release();
	});

	/**
	 * A finger that leaves the element still has to be noticed.
	 *
	 * Pointer capture normally delivers the release here, but capture can be
	 * refused (see `onDown`) and some mobile browsers drop it when the finger
	 * crosses a fixed overlay. A joystick that never hears the end of a drag is a
	 * character that walks forever, so the release is caught at the window as
	 * well. `release` is idempotent, so hearing it twice is harmless.
	 */
	$effect(() => {
		if (typeof window === 'undefined') return;
		const end = () => release();
		window.addEventListener('pointerup', end);
		window.addEventListener('pointercancel', end);
		return () => {
			window.removeEventListener('pointerup', end);
			window.removeEventListener('pointercancel', end);
		};
	});
</script>

<div
	bind:this={base}
	class="joystick"
	class:active
	class:disabled
	style="width:{size}px;height:{size}px"
	role="group"
	aria-label="Tuas gerak"
	onpointerdown={onDown}
	onpointermove={onMove}
	onpointerup={onUp}
	onpointercancel={onUp}
>
	<div class="ring"></div>
	<div class="knob" style="transform: translate({knobX}px, {knobY}px)"></div>
</div>

<style>
	.joystick {
		position: relative;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.28);
		border: 4px solid rgba(255, 255, 255, 0.5);
		backdrop-filter: blur(4px);
		touch-action: none;
		user-select: none;
		pointer-events: auto;
		transition: background 150ms ease;
	}
	.joystick.active {
		background: rgba(255, 255, 255, 0.4);
	}
	.joystick.disabled {
		opacity: 0.3;
		pointer-events: none;
	}
	.ring {
		position: absolute;
		inset: 14px;
		border-radius: 50%;
		border: 3px dashed rgba(255, 255, 255, 0.55);
	}
	.knob {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 62px;
		height: 62px;
		margin: -31px 0 0 -31px;
		border-radius: 50%;
		background: linear-gradient(180deg, #ffffff, #ffe6c9);
		box-shadow: 0 4px 0 rgba(47, 36, 64, 0.22), 0 6px 14px rgba(47, 36, 64, 0.25);
		transition: transform 60ms linear;
	}
</style>
