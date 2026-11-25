# Dunia Pintar 3D

A 3D educational adventure game for children aged 3–5, in Indonesian.

The child walks around a small island as **Bubu**, a bunny, and visits five
learning areas: counting, letters, reading (syllables), colours & shapes, and
animals. Every mission is playable entirely with one finger, narrated aloud,
and never punished — a wrong answer wobbles and lets the child try again.

Built with **SvelteKit 3 + TypeScript (strict)**, **Three.js** and **Dexie.js**
(IndexedDB).

---

## Quick start

Requirements: **Node.js ≥ 20.19** and npm.

```bash
npm install
npm run dev          # http://localhost:5173/
```

| Route | What it is |
| --- | --- |
| `/` | The game |
| `/parent` | Parent dashboard, behind an arithmetic gate |

## Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm run check        # svelte-check (must be 0 errors / 0 warnings)
npm run test         # vitest unit tests
npm run verify       # check + test + build
```

End-to-end checks run against a live dev server:

```bash
npm run dev -- --port 5175 &
node scripts/kids-smoke.mjs        # or: KIDS_URL=http://host:port node scripts/kids-smoke.mjs
```

`kids-smoke.mjs` drives a real Chromium via Playwright and covers the full
journey: menu → every area → every mission kind → parent dashboard. Headless
Chromium with SwiftShader renders at ~2–3 fps, so movement assertions poll
rather than sample once.

## Deploying

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for Vercel, and for what a target device
must support (WebGL 2, IndexedDB, an Indonesian speech voice).

## Design rules

These are not stylistic preferences; changing them changes whether the game is
suitable for a four-year-old.

- **No punishment.** No lives, no timers, no leaderboards, no losing. A wrong
  answer is retried indefinitely.
- **No locked content.** All five areas are open from the first launch. Content
  is not gated behind progress at this age.
- **Large targets.** Interactive elements are at least 64 CSS px.
- **Minimal text.** Instructions are spoken (Indonesian `speechSynthesis`) and
  shown as one short line.
- **Stars are awarded once per mission**, so replaying cannot inflate a total.
- **Deterministic distractors.** Missions look the same on every visit so the
  child can recognise them.

## Architecture

The Three.js engine is plain TypeScript and knows nothing about Svelte. A single
runes-based bridge (`src/lib/kids/ui/GameUI.svelte.ts`) connects the engine to
the components. See `docs/ARCHITECTURE.md` for the module table.

```
src/lib/kids/engine/      Three.js scene, character, camera, input
src/lib/kids/activities/  activity rules with no DOM and no Three.js
src/lib/kids/data/        educational content (letters, words, numbers, …)
src/lib/kids/game/        FSM and reward transactions
src/lib/kids/storage/     IndexedDB persistence via Dexie
src/lib/components/kids/  Svelte UI
src/routes/               `/` and `/parent`
```

## Assets

**There are no model files in this project.** Bubu is built from Three.js
primitives. `AssetManager` can load a future `Bubu.glb`, but adopting it still
requires an adapter tested against that model's rig and animation clips. The
procedural character must remain the fallback — the app must never depend on a
file that is not there.

**Narration ships as real audio.** Every line the game speaks is pre-rendered
as an MP3 with Microsoft's neural Indonesian voice (`id-ID-GadisNeural`, a
native female speaker — the warm "guru" narrator) into `static/audio/`, listed
in `static/audio/manifest.json`. The audio pipeline is:

- `scripts/narration-corpus.mjs` — derives the list of every spoken line from
  the actual data modules (`missions.ts`, `animals.ts`, …) so it cannot drift
  from content.
- `scripts/generate-voice.mjs` — renders missing MP3s via `edge-tts`
  (no API key; requires Python's `edge-tts` and an internet connection).

At runtime `AudioManager` plays the bundled MP3 for a line and falls back to
`speechSynthesis` when no file ships (offline build, or a line added without
re-running the generator) — a missing file degrades gracefully; it is never a
hard dependency.
