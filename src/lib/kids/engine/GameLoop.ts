/**
 * A frame loop with a clamped delta and an FPS counter.
 *
 * The clamp matters: a backgrounded tab returns a delta of many seconds, and
 * without clamping the character teleports across the island on the first
 * frame after the tab regains focus.
 */
export class GameLoop {
	private rafId = 0;
	private last = 0;
	private running = false;
	private fpsAccum = 0;
	private fpsFrames = 0;
	fps = 0;
	private readonly maxDeltaMs = 80;

	constructor(private readonly callback: (dt: number) => void) {}

	start(): void {
		if (this.running) return;
		this.running = true;
		this.last = performance.now();
		const tick = (now: number) => {
			if (!this.running) return;
			const raw = now - this.last;
			this.last = now;
			const dt = Math.min(Math.max(raw, 0), this.maxDeltaMs) / 1000;

			this.fpsAccum += raw;
			this.fpsFrames++;
			if (this.fpsAccum >= 500) {
				this.fps = Math.round((this.fpsFrames * 1000) / this.fpsAccum);
				this.fpsAccum = 0;
				this.fpsFrames = 0;
			}
			this.callback(dt);
			this.rafId = requestAnimationFrame(tick);
		};
		this.rafId = requestAnimationFrame(tick);
	}

	stop(): void {
		this.running = false;
		cancelAnimationFrame(this.rafId);
	}
}
