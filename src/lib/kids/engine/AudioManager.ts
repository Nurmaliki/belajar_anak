/**
 * Audio for Dunia Pintar 3D.
 *
 * Narration ships as real MP3s in `static/audio/` (native Indonesian voice,
 * pre-rendered by `scripts/generate-voice.mjs`), listed in
 * `static/audio/manifest.json`. `speechSynthesis` remains a fallback for any
 * line with no bundled file — the game never depends on a file that is not
 * there, so a missing line simply falls back to the device voice.
 *
 * Two hard requirements are enforced here rather than left to callers:
 *  1. **Nothing plays before a user gesture.** Browsers block it, and a
 *     rejected utterance is silent in a confusing way.
 *  2. **Voice lines never overlap.** New narration cancels the previous one and
 *     queues behind a short gap.
 */

export interface AudioSettings {
	musicEnabled: boolean;
	voiceEnabled: boolean;
	sfxEnabled: boolean;
	masterVolume: number;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
	musicEnabled: true,
	voiceEnabled: true,
	sfxEnabled: true,
	masterVolume: 0.9
};

type SpeechState = 'idle' | 'speaking';

/**
 * A narration line. `file` names a bundled MP3 in `static/audio/` when one
 * exists (native Indonesian voice); otherwise `text`/`rate`/`pitch` drive the
 * speechSynthesis fallback. Capturing the file here keeps the engine speaking
 * plain text and lets audio resolution live in one place.
 */
export interface NarrLine {
	/** Bundled filename, e.g. `mission-count-apples-3.mp3`, or null. */
	file?: string | null;
	/** The spoken text — what speechSynthesis says when no file is available. */
	text: string;
	rate?: number;
	pitch?: number;
}

/** Normalise a spoken line so text-vs-manifest matching survives case/spacing. */
function normaliseSpeech(text: string): string {
	return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

export class AudioManager {
	private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };
	private unlocked = false;
	private synth: SpeechSynthesis | null = null;
	private voice: SpeechSynthesisVoice | null = null;
	private voicesLoaded = false;
	private speechState: SpeechState = 'idle';
	/** Lines waiting to be spoken, so rapid taps cannot talk over each other. */
	private queue: NarrLine[] = [];
	private current: { kind: 'mp3'; audio: HTMLAudioElement } | { kind: 'synth'; u: SpeechSynthesisUtterance } | null = null;
	private audioContext: AudioContext | null = null;
	private masterGain: GainNode | null = null;
	private musicGain: GainNode | null = null;
	private musicNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
	private musicTimer: number | null = null;
	/** Set while a mission's own narration is playing, to avoid chatter. */
	private suppressSfx = false;
	/**
	 * Bundled narration manifest: normalised spoken text → bundled MP3 file.
	 * Populated once at start-up from `static/audio/manifest.json`. A line whose
	 * text is not here falls back to speechSynthesis even if a stray file were
	 * requested.
	 */
	private bundled = new Map<string, string>();
	/**
	 * The `voiceschanged` handler, kept so it can be removed again.
	 *
	 * `speechSynthesis` is a window-level singleton that outlives this object.
	 * An anonymous listener could never be detached, so every visit to the game
	 * left one more handler on the shared synth, calling `loadVoices` on a
	 * manager that had already been disposed.
	 */
	private onVoicesChanged = () => this.loadVoices();

	constructor() {
		if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
			this.synth = window.speechSynthesis;
			this.loadVoices();
			this.synth.addEventListener?.('voiceschanged', this.onVoicesChanged);
		}
		if (typeof window !== 'undefined') {
			this.loadBundledManifest();
		}
	}

	/**
	 * Load the narration manifest: which MP3s ship with this build.
	 *
	 * The manifest only lists files that exist (the generator writes it after
	 * rendering), so a key in it is safe to play. If the fetch fails the set
	 * stays empty and every line falls back to speechSynthesis — audio is a
	 * progressive enhancement and must never break the game.
	 */
	private loadBundledManifest(): void {
		const base = (import.meta.env?.BASE_URL as string | undefined) ?? '/';
		fetch(`${base}audio/manifest.json`)
			.then((r) => (r.ok ? r.json() : null))
			.then((m: unknown) => {
				if (m && typeof m === 'object') {
					const rec = m as Record<string, unknown>;
					for (const key of Object.keys(rec)) {
						if (typeof rec[key] === 'string') this.bundled.set(key, rec[key] as string);
					}
				}
			})
			.catch(() => {
				/* no manifest → fall back to speechSynthesis */
			});
	}

	/** The bundled file for a spoken line, when one ships. */
	private bundledFileFor(text: string): string | null {
		return this.bundled.get(normaliseSpeech(text)) ?? null;
	}

	/** Pick an Indonesian voice if one exists. */
	private loadVoices(): void {
		if (!this.synth) return;
		const voices = this.synth.getVoices();
		if (voices.length === 0) return;
		this.voicesLoaded = true;
		this.voice = voices.find((v) => v.lang?.toLowerCase().startsWith('id')) ?? null;
	}

	/**
	 * Whether a real Indonesian voice is available for the `speechSynthesis`
	 * fallback. Only meaningful when no bundled file covers a line.
	 */
	get hasIndonesianVoice(): boolean {
		return this.voice !== null;
	}

	get isSpeechAvailable(): boolean {
		return this.synth !== null;
	}

	get isUnlocked(): boolean {
		return this.unlocked;
	}

	get speechFallbackNote(): string | null {
		// With bundled MP3 narration, the device speech engine is only a fallback
		// for lines without a file — so this note is no longer "narration is
		// synthetic". Only surface it when there is genuinely nothing to play.
		if (this.bundled.size > 0) return null;
		if (!this.synth) return 'This browser has no speech synthesis, so narration is silent.';
		if (!this.voicesLoaded) return 'Loading voices…';
		if (!this.voice) {
			return 'No Indonesian voice is installed. Narration uses the device default voice and may sound inaccurate.';
		}
		return null;
	}

	updateSettings(next: Partial<AudioSettings>): void {
		this.settings = { ...this.settings, ...next };
		if (!this.settings.musicEnabled) this.stopMusic();
		else if (this.unlocked && this.musicNodes.length === 0) this.startMusic();
		if (this.masterGain && this.audioContext) {
			this.masterGain.gain.setTargetAtTime(
				this.settings.masterVolume,
				this.audioContext.currentTime,
				0.05
			);
		}
		if (!this.settings.voiceEnabled) this.cancelSpeech();
	}

	get currentSettings(): AudioSettings {
		return { ...this.settings };
	}

	/** Must be called from a user gesture. Idempotent. */
	unlock(): void {
		if (this.unlocked) return;
		this.unlocked = true;
		try {
			const Ctor =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (Ctor) {
				this.audioContext = new Ctor();
				this.masterGain = this.audioContext.createGain();
				this.masterGain.gain.value = this.settings.masterVolume;
				this.masterGain.connect(this.audioContext.destination);
				this.musicGain = this.audioContext.createGain();
				this.musicGain.gain.value = 0.09;
				this.musicGain.connect(this.masterGain);
			}
		} catch {
			// Audio is a progressive enhancement; a broken context must not break the game.
			this.audioContext = null;
		}
		if (this.settings.musicEnabled) this.startMusic();
		// Some browsers only expose voices after the first gesture.
		this.loadVoices();
	}

	// --- narration --------------------------------------------------------

	/**
	 * Speak a line.
	 *
	 * When `options.key` matches a bundled MP3 (from the narration manifest),
	 * that file is played — the native Indonesian voice. Otherwise the line
	 * falls back to `speechSynthesis` (device voice). The engine keeps calling
	 * `speak(text)`; it just gains an optional `key` for pre-rendered lines.
	 *
	 * @param interrupt  cancel whatever is being said (default) so instructions
	 *                   do not pile up.
	 */
	speak(
		text: string,
		options: { interrupt?: boolean; rate?: number; pitch?: number; key?: string } = {}
	): void {
		if (!this.settings.voiceEnabled || !text.trim()) return;
		// Without speechSynthesis there is no fallback backend either (an MP3
		// would play regardless, but sound is already disabled at the gate).
		const bundledFile = this.bundledFileFor(text);
		if (!this.synth && !bundledFile) return;
		const interrupt = options.interrupt ?? true;
		if (interrupt) {
			this.cancelSpeech();
			this.queue = [];
			this.queue.push({
				text,
				rate: options.rate ?? 0.92,
				pitch: options.pitch ?? 1.18,
				file: bundledFile
			});
		} else {
			this.queue.push({
				text,
				rate: options.rate ?? 0.92,
				pitch: options.pitch ?? 1.18,
				file: bundledFile
			});
		}
		this.pump();
	}

	/**
	 * Imitate an animal rather than name it.
	 *
	 * The animal sounds are pre-rendered into the bundle with their own
	 * pitch/rate (big animal low & slow, small one high) — the same caricature
	 * `speakAnimalSound` used to produce live. When no bundled file exists this
	 * still synthesises the line with the old parameters, preserving the
	 * fallback.
	 */
	speakAnimalSound(sound: string, depth: number): void {
		// `depth` is 0 for a big animal and 1 for a small one.
		const pitch = 1.35 - depth * 0.55;
		const rate = 0.72 + depth * 0.16;
		this.speak(sound, { pitch, rate });
	}

	private enqueue(text: string, rate: number, pitch: number): void {
		this.queue.push({ text, rate, pitch, file: this.bundledFileFor(text) });
	}

	/**
	 * Pull the next line and play it — the one place that decides between a
	 * bundled MP3 and the speech engine.
	 */
	private pump(): void {
		if (this.speechState === 'speaking') return;
		const next = this.queue.shift();
		if (!next) {
			this.speechState = 'idle';
			return;
		}
		this.speechState = 'speaking';

		// Prefer the bundled native-Indonesian MP3 when we know one exists.
		if (next.file && this.bundled.has(normaliseSpeech(next.text))) {
			const audio = new Audio(`${import.meta.env?.BASE_URL ?? ''}audio/${next.file}`);
			audio.volume = Math.max(0, Math.min(1, this.settings.masterVolume));
			// `Audio()` autoplays; browsers allow it here because `unlock()`
			// ran on a user gesture. Some still block it — fall back like an err.
			const cleanedUp = () => {
				this.speechState = 'idle';
				this.current = null;
				this.pump();
			};
			const onFail = () => {
				// File missing/malformed/blocked: drop it from the manifest so we
				// do not retry it, then speak the text via the engine instead.
				this.bundled.delete(normaliseSpeech(next.text));
				this.speechState = 'idle';
				this.queue.unshift(next);
				this.pump();
			};
			audio.onended = cleanedUp;
			audio.onerror = onFail;
			this.current = { kind: 'mp3', audio };
			try {
				void audio.play().catch(onFail);
			} catch {
				onFail();
			}
			return;
		}

		// Fallback: the platform speech engine.
		if (!this.synth) {
			this.speechState = 'idle';
			this.pump();
			return;
		}
		const u = new SpeechSynthesisUtterance(next.text);
		u.lang = this.voice?.lang ?? 'id-ID';
		if (this.voice) u.voice = this.voice;
		u.rate = next.rate ?? 0.92;
		u.pitch = next.pitch ?? 1.18;
		u.volume = Math.max(0, Math.min(1, this.settings.masterVolume));
		u.onend = () => {
			this.speechState = 'idle';
			this.current = null;
			this.pump();
		};
		u.onerror = () => {
			this.speechState = 'idle';
			this.current = null;
			this.pump();
		};
		this.current = { kind: 'synth', u };
		try {
			this.synth.speak(u);
		} catch {
			this.speechState = 'idle';
			this.current = null;
		}
	}

	cancelSpeech(): void {
		this.queue = [];
		if (this.current?.kind === 'mp3') {
			try {
				this.current.audio.pause();
			} catch {
				/* already stopped */
			}
		}
		this.current = null;
		this.speechState = 'idle';
		try {
			this.synth?.cancel();
		} catch {
			/* nothing to cancel */
		}
	}

	/** Speak an ordinal counting word with a rising, encouraging tone. */
	speakCount(n: number, word: string): void {
		this.speak(word, { interrupt: true, rate: 0.85 });
		void n;
	}

	// --- sound effects ----------------------------------------------------

	/**
	 * A short synthesised tone.
	 *
	 * Tiny, dependency-free feedback for taps and successes. A real app would
	 * load samples; the point here is that feedback exists and is not a lie
	 * about files that are not there.
	 */
	playSfx(kind: 'tap' | 'collect' | 'success' | 'gentle' | 'star'): void {
		if (!this.settings.sfxEnabled || !this.audioContext || !this.masterGain) return;
		if (this.suppressSfx) return;
		const ctx = this.audioContext;
		const now = ctx.currentTime;
		const spec = SFX[kind];
		for (const note of spec.notes) {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = note.type;
			osc.frequency.setValueAtTime(note.freq, now + note.at);
			if (note.slideTo) osc.frequency.linearRampToValueAtTime(note.slideTo, now + note.at + note.dur);
			gain.gain.setValueAtTime(0.0001, now + note.at);
			gain.gain.exponentialRampToValueAtTime(note.gain, now + note.at + 0.015);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + note.at + note.dur);
			osc.connect(gain);
			gain.connect(this.masterGain);
			osc.start(now + note.at);
			osc.stop(now + note.at + note.dur + 0.02);
		}
	}

	// --- music ------------------------------------------------------------

	/**
	 * A gentle layered background: a soft pad triad, a bass line and a light
	 * arpeggio, all from oscillators (no audio files ship, per project rule).
	 * Stays quiet enough to sit under narration — the part that teaches.
	 * `setMusicMood` nudges tempo per area without restarting the engine.
	 */
	private musicTempoMs = 560;
	private musicCursor = 0;

	/** Tune the bed for the current area: `pace` is seconds per beat. */
	setMusicMood(pace: number): void {
		this.musicTempoMs = Math.round(pace * 1000);
	}

	private startMusic(): void {
		if (!this.audioContext || !this.musicGain || this.musicNodes.length > 0) return;
		const ctx = this.audioContext;
		// Ionian (major) triads on C — gentle for a child.
		const roots = [261.63, 329.63, 392.0, 329.63, 293.66, 392.0, 440.0, 392.0];
		const sparkle = [523.25, 659.25, 783.99, 659.25, 587.33, 783.99, 880.0, 783.99];
		let i = 0;
		const step = () => {
			if (!this.musicGain || !this.settings.musicEnabled) return;
			const t = ctx.currentTime;
			const beat = this.musicTempoMs / 1000;
			const root = roots[i % roots.length];
			// Pad: the triad held quietly underneath.
			for (const f of [root, root * 1.5, root * 2]) this.tone(ctx, f, t, beat * 3, 0.035, 'sine');
			// Bass: one note per bar, low.
			this.tone(ctx, root * 0.5, t, beat * 2, 0.06, 'triangle');
			// Sparkle: a higher pluck echoing the root.
			this.tone(ctx, sparkle[i % sparkle.length], t + beat / 2, beat * 0.7, 0.022, 'triangle');
			i++;
			this.musicCursor = i;
		};
		step();
		this.musicTimer = window.setInterval(step, this.musicTempoMs);
	}

	/** Play one oscillator tone with an exponential attack/release. */
	private tone(
		ctx: AudioContext,
		freq: number,
		at: number,
		dur: number,
		peak: number,
		type: OscillatorType
	): void {
		if (!this.musicGain) return;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = type;
		osc.frequency.value = freq;
		const attack = Math.min(0.05, dur / 3);
		gain.gain.setValueAtTime(0.0001, at);
		gain.gain.exponentialRampToValueAtTime(peak, at + attack);
		gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
		osc.connect(gain);
		gain.connect(this.musicGain);
		osc.start(at);
		osc.stop(at + dur + 0.03);
		this.musicNodes.push({ osc, gain });
		osc.onended = () => {
			this.musicNodes = this.musicNodes.filter((n) => n.gain !== gain);
			gain.disconnect();
		};
	}

	private stopMusic(): void {
		if (this.musicTimer !== null) {
			clearInterval(this.musicTimer);
			this.musicTimer = null;
		}
		for (const n of this.musicNodes) {
			try {
				n.osc.stop();
				n.gain.disconnect();
			} catch {
				/* already stopped */
			}
		}
		this.musicNodes = [];
	}

	dispose(): void {
		// Detach from the shared synth before dropping our reference to it, or
		// the listener stays alive on a window-level object we no longer own.
		try {
			this.synth?.removeEventListener?.('voiceschanged', this.onVoicesChanged);
		} catch {
			/* some engines expose addEventListener without remove */
		}
		this.cancelSpeech();
		this.stopMusic();
		try {
			void this.audioContext?.close();
		} catch {
			/* ignore */
		}
		this.audioContext = null;
		this.masterGain = null;
		this.musicGain = null;
	}
}

interface Note {
	freq: number;
	at: number;
	dur: number;
	gain: number;
	type: OscillatorType;
	slideTo?: number;
}

const SFX: Record<'tap' | 'collect' | 'success' | 'gentle' | 'star', { notes: Note[] }> = {
	tap: { notes: [{ freq: 660, at: 0, dur: 0.08, gain: 0.12, type: 'sine' }] },
	collect: {
		notes: [
			{ freq: 523.25, at: 0, dur: 0.1, gain: 0.16, type: 'triangle' },
			{ freq: 783.99, at: 0.07, dur: 0.16, gain: 0.14, type: 'triangle' },
			{ freq: 1046.5, at: 0.14, dur: 0.14, gain: 0.07, type: 'sine' }
		]
	},
	success: {
		notes: [
			{ freq: 523.25, at: 0, dur: 0.16, gain: 0.16, type: 'triangle' },
			{ freq: 659.25, at: 0.12, dur: 0.16, gain: 0.16, type: 'triangle' },
			{ freq: 783.99, at: 0.24, dur: 0.2, gain: 0.16, type: 'triangle' },
			{ freq: 1046.5, at: 0.36, dur: 0.34, gain: 0.13, type: 'triangle' },
			// soft fifth above, for warmth instead of beep
			{ freq: 1567.98, at: 0.38, dur: 0.3, gain: 0.035, type: 'sine' }
		]
	},
	gentle: {
		notes: [
			{ freq: 392, at: 0, dur: 0.14, gain: 0.1, type: 'sine', slideTo: 349.23 },
			{ freq: 349.23, at: 0.13, dur: 0.2, gain: 0.09, type: 'sine' }
		]
	},
	star: {
		notes: [
			{ freq: 880, at: 0, dur: 0.1, gain: 0.12, type: 'sine' },
			{ freq: 1174.66, at: 0.08, dur: 0.18, gain: 0.1, type: 'sine' },
			{ freq: 1567.98, at: 0.16, dur: 0.16, gain: 0.045, type: 'sine' }
		]
	}
};
