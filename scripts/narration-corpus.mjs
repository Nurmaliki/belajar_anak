#!/usr/bin/env node
/**
 * Narration corpus for Dunia Pintar 3D — generated from the real data modules.
 *
 * Loads `src/lib/kids/data/*.ts` through Vite's SSR module loader (the same
 * resolver the app uses, so extensionless imports resolve exactly as in the
 * build), and collects every string the game speaks. The corpus is the single
 * source of truth for the audio pipeline: a mission whose instruction changes
 * produces a new `key`, which the generator renders; the runtime plays the
 * local file and falls back to speechSynthesis when no file exists.
 *
 * Each entry:
 *   key    — stable id derived from the text (a short slug or explicit id)
 *   text   — what is spoken
 *   rate   — edge-tts speed (+% relative to normal speech)
 *   pitch  — edge-tts pitch shift (Hz), warmer/livelier for the Guru voice
 *   category — where the line comes from (for humans reading the corpus)
 */

/** @typedef {(id: string) => Promise<any>} ModuleLoader */

/**
 * Build the corpus by loading the real data modules.
 * @param {ModuleLoader} loadModule  Vite-compatible loader
 */
export async function buildCorpus(loadModule) {
	const [missions, numbers, areas, animals, accessories, syllables, alphabet] = await Promise.all([
		loadModule('/src/lib/kids/data/missions.ts'),
		loadModule('/src/lib/kids/data/numbers.ts'),
		loadModule('/src/lib/kids/data/areas.ts'),
		loadModule('/src/lib/kids/data/animals.ts'),
		loadModule('/src/lib/kids/data/accessories.ts'),
		loadModule('/src/lib/kids/data/syllables.ts'),
		loadModule('/src/lib/kids/data/alphabet.ts')
	]);

	const entries = [];

	// --- Generic game lines (spoken exactly) -------------------------------
	const generic = [
		['greet-bubu', 'Halo teman-teman! Aku Bubu. Ayo kita bermain!'],
		['greet-bimo', 'Halo! Aku Bimo, tupai penjaga pulau!'],
		['no-accessory', 'Baiklah, tidak pakai aksesori.'],
		['sound-on', 'Suara dinyalakan.'],
		['collect-all-first', 'Ayo kumpulkan semua apel dulu!'],
		['wrong-try-again', 'Belum tepat. Yuk, coba sekali lagi!'],
		['wrong-count-again', 'Belum tepat. Yuk, hitung lagi!'],
		['wrong-left-over', 'Belum tepat. Yuk, hitung apel yang tersisa!'],
		['wrong-fewest', 'Belum tepat. Yuk, cari yang paling sedikit dulu!'],
		['wrong-assemble', 'Belum tepat. Yuk, coba lagi!'],
		['how-many-apples', 'Sekarang, ada berapa apel?'],
		['celebrate', 'Wah, hebat sekali! Kamu berhasil!'],
		['explore', 'Ayo berjalan dan cari tempat belajar!'],
		['leave-area', 'Baiklah, ayo kita lihat tempat lain!']
	];
	for (const [key, text] of generic) {
		entries.push({ key, text, rate: 1.0, pitch: '+8Hz', category: 'generic' });
	}

	// --- Counting words 1..10 (spoken while tapping apples) ----------------
	for (const [i, entry] of numbers.NUMBERS.entries()) {
		entries.push({
			key: `count-${entry.value}`,
			text: numbers.countingWord(entry.value),
			rate: 0.95,
			pitch: '+8Hz',
			category: 'counting'
		});
	}

	// --- Area name + tagline (narrateArea) ----------------------------------
	// Derived from AREA_ORDER rather than typed out, so adding an area cannot
	// silently skip its narration — this list was hand-maintained and would
	// have quietly omitted Pulau Musik.
	const areaOrder = [...areas.AREA_ORDER];
	for (const id of areaOrder) {
		const a = areas.AREAS[id];
		entries.push({
			key: `area-${id}`,
			text: `${a.name}. ${a.tagline}`,
			rate: 1.0,
			pitch: '+8Hz',
			category: 'area'
		});
		// The menu narrates the bare area name when its shortcut is tapped.
		entries.push({
			key: `area-name-${id}`,
			text: a.name,
			rate: 1.0,
			pitch: '+8Hz',
			category: 'area/menu'
		});
	}

	// --- Accessory names "X! Bagus sekali!" ---------------------------------
	for (const acc of accessories.ACCESSORIES) {
		entries.push({
			key: `wear-${acc.id}`,
			text: `${acc.name}! Bagus sekali!`,
			rate: 1.0,
			pitch: '+8Hz',
			category: 'accessory'
		});
	}

	// --- Animal sounds ------------------------------------------------------
	// pitch lower for big animals, higher for small ones — the same caricature
	// the old `speakAnimalSound` did, now baked into the audio file itself.
	/** @type {Record<string, number>} */
	const depthBy = {
		kucing: 0.55, anjing: 0.3, sapi: 0.05, kambing: 0.25,
		ayam: 0.8, bebek: 0.7, gajah: 0.0, singa: 0.1
	};
	for (const an of animals.ANIMALS) {
		const depth = depthBy[an.id] ?? 0.5;
		const pitchHz = Math.round(12 - depth * 22); // 0 → +12Hz, 1 → -10Hz
		entries.push({
			key: `animal-sound-${an.id}`,
			text: an.sound,
			rate: 0.72 + depth * 0.18,
			pitch: `${pitchHz >= 0 ? '+' : ''}${pitchHz}Hz`,
			category: 'animal'
		});
	}

	// --- Letter sounds (Hutan Huruf: the example word is spoken in mission) --
	for (const l of alphabet.LETTERS) {
		entries.push({
			key: `letter-${l.letter.toLowerCase()}`,
			text: l.sound,
			rate: 0.95,
			pitch: '+6Hz',
			category: 'letter'
		});
	}

	// --- Mission instructions (every mission in the catalogue) --------------
	for (const mission of Object.values(missions.MISSIONS)) {
		entries.push({
			key: `mission-${mission.id}`,
			text: mission.instruction,
			rate: 0.98,
			pitch: '+8Hz',
			category: `mission/${mission.area}`
		});
	}

	// --- Word assembly "BA JU, BAJU!" (spoken after the word is built) ------
	for (const w of syllables.SYLLABLE_WORDS) {
		entries.push({
			key: `word-${w.word.toLowerCase()}`,
			text: w.spoken,
			rate: 0.9,
			pitch: '+10Hz',
			category: 'word'
		});
	}

	// --- Syllables spoken one at a time (placed in an assemble-word slot) ---
	// The engine speaks `value` (e.g. "BA", "JU") each time a block lands.
	// Bundle every syllable the activity can offer, so that word is a native
	// female voice rather than the device fallback.
	for (const syl of syllables.SYLLABLES) {
		entries.push({
			key: `syllable-${syl.toLowerCase()}`,
			text: syl,
			rate: 0.9,
			pitch: '+8Hz',
			category: 'syllable'
		});
	}

	// Dedupe by key (data may overlap; keep the first).
	const seen = new Set();
	return entries.filter((e) => (seen.has(e.key) ? false : (seen.add(e.key), true)));
}

// Run standalone as CLI: print the corpus as JSON.
if (process.argv[1] && process.argv[1].endsWith('narration-corpus.mjs')) {
	const { createServer } = await import('vite');
	const srv = await createServer({
		server: { middlewareMode: true },
		appType: 'custom',
		logLevel: 'silent'
	});
	try {
		const corpus = await buildCorpus((id) => srv.ssrLoadModule(id));
		console.log(JSON.stringify(corpus, null, 2));
	} finally {
		await srv.close();
	}
}
