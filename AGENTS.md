# AGENTS.md

Operating notes for anyone (human or agent) working in this repository.

## What this repository is

**Dunia Pintar 3D** — a 3D educational adventure for children aged 3–5, written
in Indonesian. SvelteKit 3 + TypeScript (strict) + Three.js + Dexie.

| Route | Source |
| --- | --- |
| `/` — the game | `src/lib/kids/**`, `src/lib/components/kids/**`, `src/routes/+page.svelte` |
| `/parent` — dashboard | `src/routes/parent/+page.svelte` |

This project was originally developed inside a farm-game repository and has
since been extracted into a standalone app. **It no longer shares any code with
that project.** Do not reintroduce a cross-repository dependency.

## Hard rules

1. **This game has no punishment mechanics.** No lives, no timers, no
   leaderboards, no losing, no locked areas. A wrong answer must always be
   retryable. A change that adds pressure is a change to the product, and needs
   to be agreed first.
2. **Never delete or rewrite a working module "for tidiness".** If a module
   looks redundant, say so before touching it.
3. **Do not fabricate assets.** There are no `.glb` models or audio files here.
   Bubu is built from Three.js primitives and narration uses
   `speechSynthesis`. If you add a real model, wire it through `AssetManager`
   with the procedural version as the fallback — never make the app depend on a
   file that does not exist.
4. **Do not claim a test passes unless you ran it.** Paste real output.
5. **Ask before destructive operations.**

## Import rules

- The engine (`src/lib/kids/engine/`) must not import Svelte.
- The activity rules (`src/lib/kids/activities/`) must not import Three.js or
  touch the DOM, so they stay unit-testable in Node.
- The engine never touches storage. It reports mission start/complete through
  callbacks; the component applies the pure reward transaction and saves.
- Paths use the `#lib` alias (`#lib/kids/...`, `#lib/components/kids/...`).

## Commands

```bash
npm run dev            # http://localhost:5173/
npm run check          # svelte-check, must be 0 errors / 0 warnings
npm run test           # vitest
npm run build          # production build
npm run verify         # check + test + build
```

End-to-end: start a dev server on port 5175, then `node scripts/kids-smoke.mjs`.
Set `KIDS_URL` to point at a different host.

## Definition of done for a change

- `npm run check` — 0 errors, 0 warnings
- `npm run test` — all green
- `npm run build` — succeeds
- New educational content is validated at build time (a mission whose answer is
  not among its choices must throw when the module loads, not fail in the
  child's hands)
- The report states which files changed and what is still incomplete
