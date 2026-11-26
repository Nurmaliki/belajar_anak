# Roadmap — Dunia Pintar 3D

Status legend: ✅ done · 🟡 partial · ⬜ not started

## Phase 1 — Foundation ✅

- ✅ Standalone SvelteKit project (`src/lib/kids/**`, game at `/`).
- ✅ `SceneManager` with WebGL failure handling, adaptive pixel ratio.
- ✅ `LightingManager` (hemisphere + sun, soft shadows).
- ✅ `WorldManager`: island terrain, hills, sky, trees, flowers, fences, path.
- ✅ `CameraManager`: third-person follow, 55° FOV, ~5 units back / 3 up,
  smooth damping, pitch clamp, terrain clearance.
- ✅ Procedural **Bubu** bunny rig with idle/walk/run/jump/celebrate animations.
- ✅ `CharacterController` with camera-relative movement, jump, facing.
- ✅ `InputManager`: WASD/arrows, mouse drag orbit, touch drag, jump.
- ✅ Virtual joystick + jump/interact buttons (touch).
- ✅ Apple trees and pickable apples in the counting area.
- ✅ Speech-synthesis narrator (Indonesian) with single-utterance queue.

## Phase 2 — Core gameplay ✅

- ✅ `InteractionManager` raycasting with large hit targets.
- ✅ Counting activity (collect apples, no double-counting).
- ✅ `MissionManager` + `StateManager` FSM.
- ✅ Star rewards + celebration.
- ✅ HUD: mission title, stars, replay, help, exit.
- ✅ Missions for all six areas, each with a rotation that advances as the
  child completes them — **within** the session, not only after a reload.
  `GameEngine.markMissionComplete` updates the engine's own completed list the
  moment a star is awarded; before that the list was a constructor snapshot, so
  walking back into an area handed the child the mission they had just solved.
- ✅ Animated mission panel transitions: the card rises into place when a
  mission starts (remounted per mission id) and pulses on a correct answer.
  Both are disabled under `prefers-reduced-motion: reduce`.
- ✅ Bimo the squirrel on screen: a procedural rig on a stump beside the
  plaza. He turns to watch Bubu, hops and greets when tapped, and cheers when
  a mission is won. No mechanics, no sad pose — he is company, not a gate.

## Phase 3 — Educational content ✅

- ✅ Alphabet Forest mission: A, B, I, M — letter recognition with an example
  word spoken in the instruction and a picture on screen (A like Ayam). The
  example word is deliberately **not printed** in the prompt: it is the name of
  the task's distractors' neighbour, not the answer, and showing it let a reader
  answer without looking at the letters. Only four letters have authored
  missions; the A–Z dataset exists and supplies the distractors.
- ✅ Reading Town: pick the first syllable to complete a word (BA → BAJU),
  with the rest of the word shown.
- ✅ Word building: assemble a whole word by tapping its syllables in order
  (BA + JU = BAJU), with one slot per syllable.
- ✅ Colour Garden: colour recognition (merah, biru, kuning) with a real
  colour swatch as the prompt.
- ✅ Shape recognition: circle, triangle, square and star, drawn as **real
  geometry** in the mission panel (`clip-path` and `border-radius`), all in one
  flat tone. Emoji were not good enough: 🟦 is a *blue* square and 🔺 is a *red*
  triangle, so the colour argued with the shape being asked about.
- ✅ Animal Forest: hear an animal's sound, then pick the animal. The sound is
  pre-rendered as a bundled MP3 per animal (pitch and pace chosen per animal —
  big animals low and slow, small ones high and quick — baked into the audio
  by the narration pipeline, and `speechSynthesis`-caricature only as a
  fallback for a line without a file).
- ✅ Numbers 1–5 / 1–10 datasets; counting missions at 3, 5 and 10.
- ✅ Early addition: two countable groups (2+1, 3+2), answered by picking the
  total. The sum is validated numerically, and groups are capped at 5 so the
  child can always count at a glance.
- ✅ More/fewer comparison: two tappable groups, answered by pointing at
  objects rather than reading digits. Equal groups are refused at build time.
- ✅ Sorting: order three or four piles from fewest to most, one slot at a
  time. Groups must be distinct and countable at a glance; equal or repeated
  sizes are refused when the module loads.
- ✅ Arithmetic scope is deliberately bounded: sums beyond 5+5 and three-term
  sums are refused by design, not missing content.
- ✅ Early subtraction: a group of apples with some crossed out, answered by
  counting what is left (5 − 2, 4 − 1). Modelled on addition, but the result
  must stay positive — "nothing left" is a lesson about zero, not a puzzle for
  this age, so it is refused when the module loads.

## Phase 4 — Progress ✅

- ✅ `ChildProgress` versioned schema + validation + migration.
- ✅ `ProgressRepository` (Dexie / IndexedDB), reset, graceful no-IndexedDB.
- ✅ Parent dashboard UI (`/parent`) behind an arithmetic parent gate.
- ✅ Missions write through to IndexedDB: completed missions, stars (awarded
  once per mission id), numbers/letters/syllables introduced vs. mastered,
  play duration, and area unlocking.
- ✅ End-to-end test asserts the dashboard actually shows what was earned.
- ✅ Dressing-up box ("Lemari Bubu") — **and the roadmap's "unlock catalogue"
  deliberately not built.** Every accessory (cap, crown, party hat, two
  scarves, fairy wings) is available from the first launch. There is no lock,
  price, star threshold or "coming soon"; the star count is shown as a record
  of what the child has done, never as a key. The original wording was
  rejected for this age group: a three-year-old cannot tell "not earned yet"
  from "not good enough", and that screen produces tears, not motivation.
  `tests/kids-accessories.test.ts` asserts the no-gating rule so it cannot
  quietly reappear. The chosen outfit is saved in `ChildProgress.wearing`
  (schema v2, with a v1 migration that defaults to wearing nothing).
- ✅ Per-area progress breakdown on the dashboard: one row per area with
  missions done out of the rotation, a progress bar, and the stars earned in
  that area. Derived from `completedMissions` rather than stored, so it cannot
  drift away from the star total.

- ✅ Sound recognition: identify an animal by its cry alone (`pick-by-sound`).
  The answer buttons stay locked until the cry has actually played, so a child
  tapping into silence is asked again rather than marked wrong — the panel
  never scores a question that was not asked. No prompt picture is drawn,
  because one would answer the question by sight.
- ✅ Colour patterns: continue a repeating cycle (`continue-pattern`). The
  distractor is drawn from inside the cycle, so the answer cannot be found by
  elimination. This is the pre-mathematics skill the colours area was missing.
- ✅ **Pulau Musik**, the sixth area (`compare-pitch`). Two tones are played,
  low then high, and the child says which was higher. Both are synthesised at
  the frequency the question is about (`AudioManager.playNote`), not spoken:
  a pitch cannot be asked about with a voice. Both tones must play before any
  answer counts, for the same reason a comparison needs two things to compare.
- ✅ `teaches` was empty on the animal, shape and colour missions, so the
  dashboard never showed what those areas taught. Fixed at the source, with a
  test that fails if any mission ever reports teaching nothing.
- ✅ The dashboard now shows **mastery** (mastered / practising / untouched /
  first-try rate) from the per-mission performance record that had been
  collected since schema v3 and never displayed, plus practice suggestions and
  screen-free activity ideas matched to the areas the child has actually played.
  It deliberately does **not** chart progress over time: no per-mission
  timestamps are stored, so such a chart would be invented. The dashboard says
  so rather than leaving a parent to assume the silence is an oversight.


## Phase 5 — Polish 🟡

- ⬜ Supply a licensed `Bubu.glb`, then build and test its `AnimationMixer`
  integration against the model's real scale, orientation, clip names and
  accessory anchors. `AssetManager` can load it, but the engine currently only
  probes for the file and keeps the procedural rig; the fallback is complete.
- ✅ Narration is now bundled real audio: every line the game speaks is
  pre-rendered as an MP3 with Microsoft's neural Indonesian voice
  (`id-ID-GadisNeural`) into `static/audio/`, listed in
  `static/audio/manifest.json`. The pipeline is `scripts/narration-corpus.mjs`
  (derives every spoken line from the data modules, so it cannot drift) and
  `scripts/generate-voice.mjs` (renders via `edge-tts`, no API key). At runtime
  `AudioManager` plays the bundled file and falls back to `speechSynthesis` for
  any line without one. A licensed studio recording could still replace the
  neural voice later by re-running the generator.
- ✅ Playwright end-to-end suite (`scripts/kids-smoke.mjs`).
- ✅ Orientation hint on portrait phones (a dismissible nudge, never a blocker).
- ✅ Vercel deployment notes (`docs/DEPLOY.md`), verified against a production
  build: SSR returns 200 for `/` and `/parent`, 404 for unknown paths, and the
  full Playwright suite passes against `npm run preview`.
- ✅ In-game help text covers every activity, not just apple counting. It was
  stale for two phases, and nothing tested it — a child in the letter forest who
  pressed "?" was told to tap apples.

- ✅ A grown-up is told when progress cannot be saved. `repo.save()` had always
  returned whether the write landed and the answer was thrown away, while
  `GameUI.notice` was set and rendered nowhere — so a full disk or a browser
  refusing IndexedDB looked exactly like success, and the star vanished when the
  tab closed. There is now a quiet banner (never in the child's way, taking no
  taps) that says progress lasts only as long as the page. Warnings do not
  auto-dismiss; the old 3.2 s timer meant a child celebrating for longer than
  that never saw one.

## Audited claims

An audit of this file against the source found four statements that the code
did not support. All four are fixed; they are listed because "we checked" is
worth more than "we wrote it down well":

| Claim | What was actually true |
| --- | --- |
| Shape prompts are the shape, drawn large | The prompt was an emoji *plus the shape's name* — coloured, and the answer printed on screen |
| Animal Forest does sound matching | No sound existed at all; the onomatopoeia was text, unreadable to a pre-reader |
| Letter missions show word + picture | The example word was printed beside the picture, answering a different question than the buttons asked |
| Rotations advance as missions complete | Only across page reloads; the engine snapshotted the list at construction |
| The dashboard tells the parent about speech quality | It printed one fixed sentence, even on a browser with no speech synthesis, where narration is silent |
| A saved star is a saved star | `repo.save`'s result was discarded and `GameUI.notice` was rendered nowhere, so a failed write was indistinguishable from a success |

A second audit found two more, both now fixed:

- **The outfit was stored in the progress database.** In private mode, or with
  IndexedDB refused, the child's hat was gone on the next load — even though
  `localStorage` worked. An outfit has no unlock condition and nothing to lose,
  so it now lives in `localStorage` (`readWearingPreference`), with the progress
  record as a fallback. Verified end-to-end with `indexedDB` deleted.
- **`GameUI.setNotice` called `window` unguarded**, so any server-side pass that
  raised a notice would have thrown. There is now an SSR guard, and a test that
  runs in Node (where `window` genuinely does not exist) pins it.

## Known limitations

- Narration is bundled MP3 (native Indonesian voice) for every line the game
  speaks. Lines added after the last `node scripts/generate-voice.mjs` run, or
  a build without the audio files, fall back to `speechSynthesis`, whose voice
  quality depends on the OS — if no `id-ID` voice exists it may pronounce
  Indonesian imperfectly.
- Bubu is procedural, not a GLB model. `AssetManager` can load one, but
  `GameEngine` does not replace the procedural rig with it yet. A missing
  `/models/Bubu.glb` is remembered in `sessionStorage`, so it is requested once
  per browser session instead of on every page load.
- Colour missions use a CSS swatch for the prompt; there is no 3D colour
  object in the world for them.
- All six areas are open from the start. Locking content behind progress was
  rejected for this age group: a wall in front of a three-year-old produces
  tears, not motivation. `unlockedAreas()` records visits for the dashboard.
- The portrait hint only advises; the game is fully playable in portrait. Forcing
  rotation is not reliable on iOS, so it is never enforced.
- The wardrobe's chosen outfit is remembered in `localStorage`
  (`dunia-pintar-wearing`), not in the progress database. A cosmetic is a
  preference, not a record: it has no unlock condition, so it must not disappear
  because IndexedDB was refused. `ChildProgress.wearing` is kept as a fallback
  and for the dashboard.
- Progress itself still needs IndexedDB. When it is unavailable the game remains
  fully playable, but stars last only as long as the page — and the game now says
  so out loud rather than staying silent about it.
- Accessories are built from Three.js primitives in
  `engine/AccessoryRenderer.ts`, not loaded from model files. They are parented
  to Bubu's named rig groups, so they ride along with her head and body —
  swapping disposes the old geometry rather than leaving it in the scene graph.
- Musical pitch is asked with two synthesised oscillator tones, not recorded
  instruments. They are accurate and always available offline, but they are not
  a piano. Swapping in samples would mean adding audio files, not changing the
  session rules.
- Progress has no timestamps per mission — only `lastPlayedAt` for the whole
  save. The dashboard therefore reports mastery and difficulty but **not** a
  trend over time, and says so on the page. Adding it would need a schema
  version 5 recording `completedAt`, and old saves could not be backfilled.
