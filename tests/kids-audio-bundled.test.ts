import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';
import { buildCorpus } from '../scripts/narration-corpus.mjs';

/**
 * The bundled-narration pipeline: `static/audio/manifest.json` maps every line
 * the engine speaks to a pre-rendered native-Indonesian MP3 (Gadis). These
 * tests pin the invariant the runtime depends on:
 *
 *   - the manifest exists and lists every corpus line;
 *   - every file it names actually exists (a missing file means that line
 *     silently falls back to speechSynthesis and the promotion is a lie);
 *   - normalising the speech text (lowercase, collapsed whitespace) is how the
 *     runtime looks a line up — this test asserts the exact strings the engine
 *     calls are findable that way.
 */

	const normalise = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase();

describe('bundled narration', () => {
	let corpus: Array<{ key: string; text: string }>;
	let manifest: Record<string, string>;
	let audioFiles: string[];

	beforeAll(async () => {
		const srv = await createServer({
			server: { middlewareMode: true },
			appType: 'custom',
			logLevel: 'silent'
		});
		try {
			corpus = await buildCorpus((id) => srv.ssrLoadModule(id));
		} finally {
			await srv.close();
		}
		const audioDir = join(process.cwd(), 'static', 'audio');
		const manifestPath = join(audioDir, 'manifest.json');
		manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
		audioFiles = readdirSync(audioDir).filter((f) => f.endsWith('.mp3'));
	});

	it('the manifest exists and covers every distinct spoken line', () => {
		expect(Object.keys(manifest).length).toBeGreaterThan(0);
		// Two corpus lines can normalise to the same text and share one file
		// (e.g. syllable "BE" and letter "B" both read "be") — that is fine: the
		// sound is identical. So we assert distinct texts, not raw corpus size.
		const distinct = new Set(corpus.map((e) => normalise(e.text)));
		expect(Object.keys(manifest).length).toBe(distinct.size);
		for (const n of distinct) {
			expect(manifest[n]).toBeDefined();
		}
	});

	it('every file named in the manifest actually ships', () => {
		for (const file of Object.values(manifest)) {
			expect(audioFiles).toContain(file);
			const full = join(process.cwd(), 'static', 'audio', file);
			const size = readFileSync(full).length;
			expect(size).toBeGreaterThan(0);
		}
	});

	it('the exact strings the engine speaks resolve to bundled audio', () => {
		const spokenByEngine = [
			'Halo teman-teman! Aku Bubu. Ayo kita bermain!',
			'Halo! Aku Bimo, tupai penjaga pulau!',
			'Baiklah, tidak pakai aksesori.',
			'Suara dinyalakan.',
			'Ayo kumpulkan semua apel dulu!',
			'Belum tepat. Yuk, coba sekali lagi!',
			'Belum tepat. Yuk, hitung lagi!',
			'Belum tepat. Yuk, hitung apel yang tersisa!',
			'Belum tepat. Yuk, cari yang paling sedikit dulu!',
			'Belum tepat. Yuk, coba lagi!',
			'Sekarang, ada berapa apel?',
			'Wah, hebat sekali! Kamu berhasil!',
			'Ayo berjalan dan cari tempat belajar!',
			'Baiklah, ayo kita lihat tempat lain!',
			// data-driven lines
			'satu',
			'sepuluh',
			'BA',
			'JU',
			'Topi Merah! Bagus sekali!',
			'Meong'
		];
		for (const t of spokenByEngine) {
			expect(manifest[normalise(t)]).toBeDefined();
		}
	});
});
