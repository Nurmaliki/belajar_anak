/**
 * Unified input for desktop and touch.
 *
 * Two kinds of signal come out:
 *  - **Continuous**: movement axes and look deltas, polled each frame.
 *  - **Edge**: a jump or an interaction tap, which must fire exactly once.
 *
 * Holding "go up" here means "the player wants to move", never "the key is
 * down": the character controller decides speed, acceleration and facing.
 *
 * Pointer Events are used throughout rather than separate mouse and touch
 * listeners, so a stylus, a trackpad and a finger all take the same path.
 */

export interface MovementAxes {
	/** -1..1, right positive. */
	x: number;
	/** -1..1, forward positive. */
	y: number;
}

export const AXES_IDLE: MovementAxes = { x: 0, y: 0 };

type EdgeAction = 'jump' | 'interact' | 'pause';

export class InputManager {
	private keys = new Set<string>();
	private lookDx = 0;
	private lookDy = 0;
	private pressedHandlers = new Map<EdgeAction, Set<() => void>>();
	private enabled = true;
	/** True while a UI panel owns the pointer, so the canvas ignores drags. */
	private dragging = false;
	private lastPointerX = 0;
	private lastPointerY = 0;
	private activePointerId: number | null = null;
	/** True once the user has interacted; used to start audio legally. */
	private gestureSeen = false;
	private gestureHandlers = new Set<() => void>();

	/** Thumbstick contribution from the on-screen joystick. */
	private touchAxes: MovementAxes = AXES_IDLE;

	private cleanups: (() => void)[] = [];

	constructor(
		private canvas: HTMLElement,
		private target: Window = window
	) {
		this.bindKeyboard();
		this.bindPointer();
	}

	// --- lifecycle --------------------------------------------------------

	private bindKeyboard(): void {
		const onKeyDown = (e: KeyboardEvent) => {
			if (this.isTyping(e.target)) return;
			this.markGesture();
			if (!this.enabled) return;

			switch (e.code) {
				case 'Space':
					e.preventDefault();
					if (!e.repeat) this.fire('jump');
					return;
				case 'KeyE':
					if (!e.repeat) this.fire('interact');
					return;
				case 'Escape':
					if (!e.repeat) this.fire('pause');
					return;
			}
			this.keys.add(e.code);
			// Arrow keys scroll the page otherwise.
			if (e.code.startsWith('Arrow') || e.code === 'Tab') e.preventDefault();
		};

		const onKeyUp = (e: KeyboardEvent) => {
			this.keys.delete(e.code);
		};

		const onBlur = () => {
			// A lost window never delivers keyup, so keys would stick down.
			this.keys.clear();
			this.touchAxes = AXES_IDLE;
		};

		this.send(this.target, 'keydown', onKeyDown);
		this.send(this.target, 'keyup', onKeyUp);
		this.send(this.target, 'blur', onBlur);
	}

	private bindPointer(): void {
		const onDown = (e: PointerEvent) => {
			if (!this.enabled) return;
			this.markGesture();
			this.dragging = true;
			this.activePointerId = e.pointerId;
			this.lastPointerX = e.clientX;
			this.lastPointerY = e.clientY;
			this.canvas.setPointerCapture?.(e.pointerId);
		};

		const onMove = (e: PointerEvent) => {
			if (!this.dragging || e.pointerId !== this.activePointerId) return;
			this.lookDx += e.clientX - this.lastPointerX;
			this.lookDy += e.clientY - this.lastPointerY;
			this.lastPointerX = e.clientX;
			this.lastPointerY = e.clientY;
		};

		const onUp = (e: PointerEvent) => {
			if (e.pointerId !== this.activePointerId) return;
			this.dragging = false;
			this.activePointerId = null;
			this.canvas.releasePointerCapture?.(e.pointerId);
		};

		this.send(this.canvas, 'pointerdown', onDown);
		this.send(this.target, 'pointermove', onMove);
		this.send(this.target, 'pointerup', onUp);
		this.send(this.target, 'pointercancel', onUp);
	}

	private send<K extends keyof WindowEventMap>(
		el: EventTarget,
		type: K,
		fn: (e: WindowEventMap[K]) => void
	): void {
		el.addEventListener(type, fn as EventListener);
		this.cleanups.push(() => el.removeEventListener(type, fn as EventListener));
	}

	dispose(): void {
		for (const c of this.cleanups) c();
		this.cleanups = [];
		this.pressedHandlers.clear();
		this.gestureHandlers.clear();
	}

	// --- gestures ---------------------------------------------------------

	private markGesture(): void {
		if (this.gestureSeen) return;
		this.gestureSeen = true;
		for (const fn of this.gestureHandlers) fn();
	}

	/** Runs once, on the first real user gesture (for starting audio). */
	onFirstGesture(fn: () => void): () => void {
		if (this.gestureSeen) {
			fn();
			return () => {};
		}
		this.gestureHandlers.add(fn);
		return () => this.gestureHandlers.delete(fn);
	}

	// --- continuous -------------------------------------------------------

	setEnabled(enabled: boolean): void {
		this.enabled = enabled;
		if (!enabled) {
			this.keys.clear();
			this.touchAxes = AXES_IDLE;
			this.dragging = false;
		}
	}

	/** Feed the on-screen joystick. Called by the Svelte component. */
	setTouchAxes(axes: MovementAxes): void {
		this.touchAxes = axes;
	}

	/**
	 * Current movement intent, keyboard combined with the thumbstick and
	 * clamped to a unit circle so diagonal movement is not faster.
	 */
	axes(): MovementAxes {
		if (!this.enabled) return AXES_IDLE;
		let x = this.touchAxes.x;
		let y = this.touchAxes.y;
		if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
		if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
		if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
		if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
		const len = Math.hypot(x, y);
		if (len > 1) {
			x /= len;
			y /= len;
		}
		return { x, y };
	}

	/**
	 * Consume accumulated look deltas, in pixels.
	 *
	 * Reading clears them, which is what keeps a fast flick from being applied
	 * again on the next frame.
	 */
	consumeLook(): { dx: number; dy: number } {
		const dx = this.lookDx;
		const dy = this.lookDy;
		this.lookDx = 0;
		this.lookDy = 0;
		return { dx, dy };
	}

	setDragging(dragging: boolean): void {
		if (!dragging) this.dragging = false;
	}

	// --- edge actions -----------------------------------------------------

	on(action: EdgeAction, fn: () => void): () => void {
		let set = this.pressedHandlers.get(action);
		if (!set) {
			set = new Set();
			this.pressedHandlers.set(action, set);
		}
		set.add(fn);
		return () => set?.delete(fn);
	}

	/** Fire an edge action, e.g. from a Svelte button. */
	fire(action: EdgeAction): void {
		const set = this.pressedHandlers.get(action);
		if (!set) return;
		for (const fn of set) fn();
	}

	private isTyping(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		const tag = target.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
	}
}
