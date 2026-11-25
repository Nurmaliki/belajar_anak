# Dunia Pintar 3D — Game Design Document

## 1. Vision

An educational adventure for children aged 3–5, played in Bahasa Indonesia.
Learning must feel like exploring an island, not like sitting an exam. The child
walks around as **Bubu** the baby bunny, meets friendly animals, listens to voice
instructions, touches big colourful things, and is told "hebat!" for trying.

There are no timers, no lives, no failure states and no leaderboards. A wrong
answer gets a gentle nudge, not a penalty.

## 2. Audience

- Age 3–5.
- Many cannot read. **Every instruction is spoken.**
- Motor skills are developing: touch targets are large (≥ 64 CSS px), and
  activities never require dragging to a precise spot or holding two controls.
- Attention spans are short: a mission is a handful of taps, under a minute.

## 3. Art direction

Cute stylised low-poly cartoon. Rounded geometry, flat-shaded, bright but not
saturated to the point of glare.

- Sky: soft blue with a warm horizon band.
- Ground: green grass islands with rounded hills.
- Props: small trees with rounded canopies, flowers, wooden fences.
- Characters: oversized heads, big eyes, soft shapes.

Explicitly avoided: photorealism, darkness, horror, harsh effects, clutter.

## 4. The world

One island, five learning areas. Areas are reached by walking to them.

| # | Area | Indonesian name | Teaches |
| --- | --- | --- | --- |
| 1 | Counting Island | Pulau Berhitung | Numbers 1–10, counting, matching, more/less, early addition |
| 2 | Letter Forest | Hutan Huruf | Letters A, B, I, M; letter↔picture association (shipped) |
| 3 | Reading Town | Kota Membaca | Indonesian syllables, building words, word↔picture |
| 4 | Colour Garden | Kebun Warna | Colours, shapes, sorting |
| 5 | Animal Forest | Hutan Hewan | Animals; hear a spoken sound, pick the animal |

## 5. The character — Bubu

A baby bunny. Friendly, curious, happy, helpful, playful.

Animations: idle (breathing + ear sway), walk, run, jump, celebrate, happy,
interact. In this build every animation is **procedural** (see `Bubu.ts`).
`AssetManager` can load a future `Bubu.glb`, but `CharacterController` does not
adopt it yet: the mixer, clip mapping, scale, orientation and accessory anchors
must be implemented and tested against the actual supplied model. The
procedural rig remains the required fallback.

## 6. Core loop

1. Child picks Play.
2. Bubu spawns on the island.
3. Child walks (joystick / WASD) and looks (drag / mouse) — free exploration.
4. A floating marker above an area can be walked into to start a mission.
5. Narrator speaks the goal.
6. Child taps the objects; each tap is counted aloud.
7. Child picks the answer from big buttons.
8. Correct → celebration animation, a star, spoken praise.
   Wrong → gentle retry, the instruction is repeated.
9. Progress is saved automatically.

## 7. Signature mission — "Kumpulkan tiga apel"

The first fully playable vertical slice (Counting Island, Level 1).

- Bimo the squirrel introduces the task.
- Narrator: *"Halo Bubu! Ayo kumpulkan tiga apel!"*
- Three apples appear in the garden.
- Each apple is tapped; it pops, and the narrator counts *"Satu!"*, *"Dua!"*,
  *"Tiga!"*. **An apple cannot be counted twice.**
- Large number buttons 1–5 appear.
- Choosing 3 → success. Choosing otherwise → *"Yuk, coba sekali lagi!"*.
- One star is awarded and saved.

## 8. Learning content is data

Questions live in `src/lib/kids/data/*.ts` and are consumed by generic activity
modules. UI components never contain question text. Adding a new number mission
means adding a data entry, not editing a component.

## 9. Audio

Bahasa Indonesia throughout. Categories: narrator, character dialogue, learning
pronunciation, animal sounds, UI feedback, music, success effects.

Every narration line ships as a real MP3, pre-rendered from Microsoft's neural
Indonesian voice (`id-ID-GadisNeural` — native female speaker, the warm "guru"
narrator) into `static/audio/`, listed in `static/audio/manifest.json`. The
pipeline is in `scripts/narration-corpus.mjs` (derives every spoken line from
the data modules) and `scripts/generate-voice.mjs` (renders via `edge-tts`,
no API key). `speechSynthesis` remains only the fallback for a line with no
shipped file, so a build never depends on an audio file it does not have.

On browser autoplay rules: nothing plays before the first gesture.

## 10. Rewards

Stars only, earned by completing missions. Never randomised, never purchasable.

**No rewards are locked.** An earlier draft of this section had stars unlock
cosmetics "at thresholds"; that was rejected and is not what is built. Every
accessory in Bubu's wardrobe (hats, scarves, wings) is available from the first
launch. Stars are a *record* of what the child has done, shown beside the
wardrobe — never a key. A three-year-old cannot tell "not earned yet" from "not
good enough", and that screen produces tears, not motivation. See
`src/lib/kids/data/accessories.ts` and `tests/kids-accessories.test.ts`.

## 11. Parent area

Separate route, behind a parent gate. Distinguishes **exposure** (a number was
shown) from **mastery** (the child answered it correctly). No personal data is
collected; progress stays in IndexedDB on the device.
