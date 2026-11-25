# Architecture — Dunia Pintar 3D

## Principle

The game engine knows nothing about Svelte. Svelte components render pixels and
dispatch intent; the engine owns simulation. The only bridge is a plain
TypeScript class (`GameUI.svelte.ts`) using Svelte 5 runes.

## Layers

```
src/routes/+page.svelte               route shell (the game is the root page)
    └── components/kids/KidsGame.svelte       mounts canvas + HUD
            ├── GameUI.svelte.ts             reactive bridge (runes)
            └── engine/GameEngine.ts         owns Three.js + loop
```

### `src/lib/kids/engine/` — Three.js, no Svelte imports

| File | Responsibility |
| --- | --- |
| `GameEngine.ts` | renderer, loop, resize, dispose, orchestrates the managers |
| `SceneManager.ts` | renderer/scene/camera ownership, graphics preset, WebGL failure |
| `CameraManager.ts` | third-person follow camera, yaw/pitch, collision |
| `LightingManager.ts` | hemisphere + sun + ambient, soft shadows |
| `AssetManager.ts` | load-once GLTF cache; an absent optional model is not re-requested per session |
| `CharacterController.ts` | Bubu movement, jump, facing, procedural animation state |
| `Bubu.ts` | procedural bunny rig (primitives) with named bone groups |
| `Bimo.ts` | procedural squirrel guide rig; same named-group contract as `Bubu.ts` |
| `BimoController.ts` | Bimo's behaviour: watch Bubu, hop on tap, cheer on a win |
| `AccessoryRenderer.ts` | builds one accessory from primitives and parents it to the right rig group; `dispose()` leaves nothing behind |
| `InputManager.ts` | keyboard + pointer, unified axes, edge-triggered actions |
| `InteractionManager.ts` | raycasting, hover/select, hit-testing large targets |
| `WorldManager.ts` | terrain, props, five areas, apple trees, colliders |
| `AudioManager.ts` | bundled MP3 narration (native Indonesian voice) + speechSynthesis fallback + SFX + music; no overlapping narration |

### `src/lib/kids/game/` — rules, no Three.js imports

| File | Responsibility |
| --- | --- |
| `StateManager.ts` | explicit FSM (BOOT…GAME_EXIT), illegal transitions rejected |
| `ProgressTypes.ts` | `ChildProgress` shape + validation/migration |
| `MissionReward.ts` | turns a finished mission into a saved record; stars awarded once per mission id |
| `AreaSummary.ts` | per-area progress for the dashboard, derived from completed missions |

### `src/lib/kids/activities/`
Reusable, content-agnostic activity logic. Each module here is pure: no Three.js,
no DOM, no storage, so it is unit tested directly.

| File | Responsibility |
| --- | --- |
| `counting/CountSession.ts` | collect-then-count rules; an object is counted at most once |
| `counting/countingMission.ts` | builds count-and-answer missions, rejecting unwinnable ones |
| `choices/ChoiceSession.ts` | pick-one-question rules; a wrong answer is never a dead end |
| `choices/choiceMission.ts` | builds letter/syllable/picture/assembly missions + deterministic distractors |
| `syllables/BuildSession.ts` | assemble a word slot by slot; placement is ordered, a wrong pick is not fatal |
| `addition/AdditionSession.ts` | two countable groups; the sum is matched numerically, groups capped at 5 |
| `addition/additionMission.ts` | builds add-groups missions, rejecting ones whose sum is not offered |
| `compare/CompareSession.ts` | more/fewer between two groups; refuses equal groups |
| `compare/compareMission.ts` | builds compare-groups missions with the two groups as buttons |
| `sorting/SortSession.ts` | order three or four groups fewest-first, one slot at a time; refuses equal sizes |
| `sorting/sortMission.ts` | builds sort-groups missions, storing the groups already sorted |
| `subtraction/SubtractionSession.ts` | some objects are taken away; the remainder is matched numerically and must stay positive |
| `subtraction/subtractionMission.ts` | builds subtract-groups missions, rejecting ones whose remainder is not offered |

### `src/lib/kids/data/`
`numbers.ts`, `alphabet.ts`, `syllables.ts`, `animals.ts`, `colors.ts`,
`missions.ts` — all Indonesian learning content.

`accessories.ts` is content too, but it carries a rule: every accessory is
available from the first launch, with no unlock condition. It is kept free of
Three.js so that rule is unit-testable, and `availableAccessories()` takes no
progress argument at all — there is no star count to gate on because there is
no star count to pass in. `engine/AccessoryRenderer.ts` decides *how* to build
each entry; this file only says *what* exists.

### `src/lib/kids/storage/`
`ProgressRepository.ts` — IndexedDB via Dexie, versioned schema, validation and
migration, graceful failure when IndexedDB is unavailable (private mode).

It normalises the record to a plain object before writing. This is not
defensive padding: the caller passes a Svelte 5 `$state` value, which is a Proxy,
and IndexedDB's `structuredClone` throws `DataCloneError` on a Proxy. That bug
silently lost a session's stars until the end-to-end test caught it.

`save()` returns whether the write landed, and the host now *uses* that answer:
a failed write raises a warning banner, because otherwise it looked exactly like
success. `repo.persistent` is the separate, stronger question — "can this device
store anything at all?" — and the banner distinguishes the two.

The wardrobe's outfit is deliberately **not** stored here. It lives in
`localStorage` (`readWearingPreference` in `game/ProgressTypes.ts`): a cosmetic
has no unlock condition and nothing to lose, so it must not vanish because
IndexedDB was refused. `ChildProgress.wearing` remains as a fallback and feeds
the dashboard.

Schema version 2 added `wearing` (the accessory Bubu has on). `migrateProgress`
defaults a version-1 record to `'none'`, and `validateProgress` repairs the
field independently, so a child who played on the older build keeps every star
and simply arrives wearing nothing. An id the catalogue no longer knows is
stored as-is and resolves to "nothing" at render time — storage returns what was
saved; the catalogue decides what exists.

### Who writes progress

The engine never touches storage. It reports through
`onMissionStart` / `onMissionComplete`, and `KidsGame.svelte` applies the result
with the pure `applyMissionResult` / `applyMissionIntroduced` functions and saves
immediately — not only on exit — so closing the tab mid-session keeps the
earned stars.

The wardrobe follows the same split. `Wardrobe.svelte` calls `ui.wear(id)`;
`GameEngine.setWearing` builds the geometry through `AccessoryRenderer` and
narrates; `KidsGame.svelte` owns the saved preference and writes it straight
away. Restoring the outfit at start-up calls the same engine method with
`announce = false`, so the child arriving is not talked at.

## State machine

`StateManager` holds a `GamePhase` and a transition table. Only legal edges are
allowed; an illegal transition throws in development and is ignored in
production. UI components request transitions through `GameEngine`; they never
write the phase directly.

```
BOOT → LOADING → MAIN_MENU → WORLD_EXPLORATION ⇄ MISSION_INTRO
                                     ↓              ↓
                                   PAUSED      MISSION_ACTIVE → MISSION_SUCCESS
                                     ↓              ↓
                              WORLD_EXPLORATION   WORLD_EXPLORATION
GAME_EXIT reachable from any live state.
```

## Performance

- Adaptive pixel ratio (`min(devicePixelRatio, 2)`, 1.5 on small screens).
- Shadows only from one directional light, and only at medium+ graphics.
- No post-processing.
- Per-frame allocations avoided: reused `Vector3`/`Vector2` scratch objects.
- Everything registered for disposal: geometries, materials, textures, listeners,
  the RAF handle, the audio context, the speech utterance.
- Assets loaded once and cached by key.

## Testing seam

The activity logic and the state machine are plain TypeScript, so the interesting
rules are covered by fast unit tests with no DOM. Playwright covers the parts
that only exist in a browser (canvas, WebGL, persistence across reload).
