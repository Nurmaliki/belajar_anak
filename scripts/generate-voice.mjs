#!/usr/bin/env node
/**
 * Generate narration audio for Dunia Pintar 3D.
 *
 * Renders every line in the narration corpus with Microsoft's neural
 * Indonesian voice (Gadis — a native female speaker, friendly and warm) via
 * `edge-tts`, writing an MP3 per key into `static/audio/`.
 *
 * Why this design:
 *  - The app ships real audio, so narration sounds native — `speechSynthesis`
 *    remains only a fallback, per AGENTS.md ("never depend on a file that is
 *    not there" — absence simply falls back).
 *  - Files are generated at build time, not runtime, so a child playing uses
 *    0 bytes of network and there is no per-play API cost.
 *  - Idempotent: a baris whose MP3 already exists is skipped, so re-running
 *    never costs anything and never re-renders unchanged lines.
 *
 * Usage:
 *   node scripts/generate-voice.mjs            # render missing lines only
 *   node scripts/generate-voice.mjs --force    # re-render everything
 *
 * Requires `edge-tts` on PATH (pip install edge-tts) and internet access to
 * Microsoft's speech endpoint.
 */

import { execFile } from 'node:child_process';
import { mkdir, readFile, access } from 'node:fs/promises';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { buildCorpus } from './narration-corpus.mjs';

const run = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const AUDIO_DIR = join(ROOT, 'static', 'audio');
const MANIFEST = join(AUDIO_DIR, 'manifest.json');

const VOICE = process.env.NARRATION_VOICE || 'id-ID-GadisNeural';
const FORCE = process.argv.includes('--force');

/** Render one line to MP3 via the edge-tts Python API (not the CLI, whose
 *  argparse misparses negative rates like "-5%" as a flag). Pipes the text
 *  through argv so quotes stay intact.
 */
async function renderLine(entry, dest) {
	const pct = Math.round((entry.rate - 1) * 100);
	const rateArg = (pct >= 0 ? '+' : '') + pct + '%';
	const script = [
		'import asyncio, edge_tts, sys, json',
		'cfg = json.loads(sys.argv[1])',
		"com = edge_tts.Communicate(cfg['text'], voice=cfg['voice'], rate=cfg['rate'], pitch=cfg['pitch'])",
		"asyncio.run(com.save(cfg['dest']))"
	].join(';');
	await run(
		'python3',
		['-c', script, JSON.stringify({ text: entry.text, voice: VOICE, rate: rateArg, pitch: entry.pitch || '+0Hz', dest })],
		{ timeout: 60_000 }
	);
}

/** Crash loudly if a rendered file is empty/zero bytes — a build-time guard. */
async function assertAudio(dest, key) {
	const st = await access(dest).then(
		() => undefined,
		() => 0
	);
	// access() returns nothing on success; we re-stat via readFile size below.
	const buf = await readFile(dest);
	if (buf.length === 0) throw new Error(`generated empty audio for "${key}" (${dest})`);
}

async function main() {
	const srv = await createServer({
		server: { middlewareMode: true },
		appType: 'custom',
		logLevel: 'silent'
	});
	try {
		const corpus = await buildCorpus((id) => srv.ssrLoadModule(id));
		await mkdir(AUDIO_DIR, { recursive: true });

		let generated = 0;
		let skipped = 0;
		const manifest = {};

		for (const entry of corpus) {
			const file = `${entry.key}.mp3`;
			const dest = join(AUDIO_DIR, file);
			// Manifest maps the spoken text (normalised) to the bundled file, so
			// the runtime can find a line by the exact string the engine speaks
			// — no key plumbing through every call site.
			manifest[normalise(entry.text)] = file;

			const exists =
				!FORCE &&
				(await access(dest).then(() => true, () => false));
			if (exists) {
				skipped++;
				continue;
			}

			process.stdout.write(`  ${entry.key} … `);
			try {
				await renderLine(entry, dest);
				await assertAudio(dest, entry.key);
				generated++;
				console.log('ok');
			} catch (err) {
				// Leave no broken file: remove and let the runtime fall back.
				await import('node:fs/promises').then((fs) =>
					fs.rm(dest, { force: true })
				);
				console.log(`FAILED (${err.message?.split('\n')[0] || err}) — fallback will cover`);
			}
		}

		await writeManifest(manifest);
		console.log(`\nDone: ${generated} generated, ${skipped} skipped (${corpus.length} total).`);
		console.log(`Voice: ${VOICE} → ${AUDIO_DIR}`);
	} finally {
		await srv.close();
	}
}

async function writeManifest(manifest) {
	await import('node:fs/promises').then((fs) =>
		fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
	);
}

/** Normalise a spoken line so text-vs-manifest matching survives casing/spacing. */
function normalise(text) {
	return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
