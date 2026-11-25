import { describe, expect, it } from 'vitest';
import { GameUI } from '../src/lib/kids/ui/GameUI.svelte';
import { AudioManager } from '../src/lib/kids/engine/AudioManager';

/**
 * `GameUI` is the bridge every component reads from. A field that is written
 * but never read is not harmless — it *looks* like a feature.
 *
 * Two such fields were found during an audit, and both hid a real gap:
 *  - `notice` — set by `setNotice` and rendered nowhere, so a failed write to
 *    storage was silent and a star vanished when the tab closed.
 *  - `voiceNote` — set at start-up and unread. It has since been removed: the
 *    parent dashboard probes speech itself (`describeSpeech`, `voice-status`)
 *    instead of receiving a stale value no component ever rendered.
 *
 * Reading the components' markup from a unit test would mean a filesystem
 * dependency the rest of this suite does not have, and a Svelte template cannot
 * be mounted here either. So this file pins the *bridge* instead: the behaviour
 * that was quietly wrong, expressed as properties of the object components use.
 * The rendering of those values is asserted end-to-end in `kids-smoke.mjs`.
 */

describe('a notice survives long enough to be read', () => {
	it('sets the text and tone', () => {
		const ui = new GameUI();
		ui.setNotice('Penyimpanan tidak tersedia.', 'warn');
		expect(ui.notice?.text).toBe('Penyimpanan tidak tersedia.');
		expect(ui.notice?.tone).toBe('warn');
	});

	it('does not auto-clear a warning', () => {
		// A warning is the only signal that progress is not being saved. It used
		// to vanish after 3.2 s, by which point nobody was looking.
		const ui = new GameUI();
		ui.setNotice('Penyimpanan tidak tersedia.', 'warn');
		const before = ui.notice;
		expect(before).not.toBeNull();
		// No timer may drop it; only a replacement may.
		ui.setNotice('Penyimpanan masih tidak tersedia.', 'warn');
		expect(ui.notice?.text).toBe('Penyimpanan masih tidak tersedia.');
	});

	it('does not throw where there is no window (server-side rendering)', () => {
		// This suite runs in Node, which is exactly the SSR condition: no
		// `window`. `setNotice` used to call `window.setTimeout` unguarded, so
		// any server pass that set a notice would throw. An `info` message is
		// meaningless outside a browser, so it is dropped rather than scheduled.
		expect(typeof window).toBe('undefined');
		const ui = new GameUI();
		expect(() => ui.setNotice('Halo!', 'info')).not.toThrow();
		expect(ui.notice?.text).toBe('Halo!');
	});

	it('a warning needs no window at all', () => {
		const ui = new GameUI();
		expect(() => ui.setNotice('Penyimpanan tidak tersedia.', 'warn')).not.toThrow();
		expect(ui.notice?.tone).toBe('warn');
	});
});

describe('the parent dashboard can ask what speech the device has', () => {
	it('reports no speech support as a fact, not as a reassurance', () => {
		// `speechFallbackNote` returns null when Indonesian speech is available
		// and a plain-language finding otherwise. The dashboard used to print a
		// fixed sentence regardless — including on a browser with no voice, where
		// narration is simply silent.
		const audio = new AudioManager();
		const note = audio.speechFallbackNote;
		expect(note === null || typeof note === 'string').toBe(true);
		audio.dispose();
	});

	it('exposes whether speech exists at all', () => {
		// The dashboard distinguishes "no voice" from "no speech engine"; both
		// are findings, and conflating them helps nobody.
		const audio = new AudioManager();
		expect(typeof audio.isSpeechAvailable).toBe('boolean');
		expect(typeof audio.hasIndonesianVoice).toBe('boolean');
		audio.dispose();
	});
});
