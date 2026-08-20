# Wall-E Math Quest

An iOS math game for ages 3-11, built to the *Wall-E Math Quest* PRD (V1 / MVP).
Wall-E searches for Eve behind doors; every door is a math question.

**Stack**: Expo SDK 52 · React Native 0.76 · Expo Router · Reanimated 3 ·
Gesture Handler v2 · expo-av · AsyncStorage · TypeScript (strict).

---

## Quick start

```bash
cd wall-e-math-quest
npm install
npm run ios          # or: npx expo start  then press "i"
```

Portrait-only, iOS-only, no account, no network. Everything is on-device.

### Other commands

| Command | What it does |
|---|---|
| `npm test` | Jest suite (progression, timer, storage, content, queue, distractors) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify:content` | **No install needed.** Re-runs the puzzle pipeline and diffs it against the committed JSON |
| `npm run gen:puzzles` | Regenerates `src/data/puzzles/tier*.json` |
| `npm run gen:sounds` | Regenerates `assets/sounds/*.wav` |
| `npm run gen` | Both generators |

`verify:content` and `gen:*` run on plain Node 22 (type stripping plus
`scripts/node-ts-resolver.mjs`, which teaches Node the `@/` alias) — no
`node_modules` required.

---

## How it fits together

```
src/
  app/            Expo Router screens (index, level-map, round, score, settings)
  components/
    characters/   Sprite + per-character wrappers + SpeechBubble
    puzzles/      DoorSelection, DragAndDrop, PatternCompletion, Corridor
    ui/           Button, Timer, ScoreCounter, StarRating, ProgressBar
  data/
    puzzles/      tier1.json … tier8.json  (480 puzzles, generated)
    characters.ts Roster, reaction lines, wrong-answer weights
    tiers.ts      The 8 tiers and the age -> tier mapping
    puzzleLoader.ts
  hooks/
    useGameState  AsyncStorage-backed GameState provider
    useTimer      60s countdown with pause/resume
    usePuzzleEngine  Round scoring, retries, per-type breakdown
    useSound      Preloads every sound on launch (expo-av)
  utils/
    puzzleGenerator   Procedural templates for tiers 3-8
    distractorEngine  Plausible wrong answers
    progressionEngine Tier unlock rules, star ratings, FIFO history
    puzzleQueue       50/25/25 type mix, no repeats inside a round
    timerMath         Pure countdown maths (kept testable)
    storage           Load/save/repair GameState
  theme/          Colours, spacing, typography, timing constants
scripts/          Build-time generators and the content gate
assets/sounds/    19 synthesised WAV files
```

### Data flow for one round

`level-map` → `round?tierId=N` → 3-2-1 countdown → `usePuzzleEngine` serves
puzzles from `PuzzleQueue` → each puzzle component reports attempts through
`onAttempt` and completion through `onResolved` → the 60s timer expires →
`buildResult()` → `applyRoundResult()` folds it into `GameState` → persisted →
`score` screen with the star rating and any tier unlock.

---

## Content pipeline

480 puzzles, 60 per tier, split 30 door / 15 drag / 15 pattern exactly as the
PRD specifies.

- **Tiers 1-2 are hand-authored** (`scripts/authored-content.mjs`). Ages 3-5
  need developmentally-appropriate prompts, so these lean on countable glyphs
  and single short words rather than sentences.
- **Tiers 3-8 are generated** from topic templates in
  `src/utils/puzzleGenerator.ts`, seeded so regeneration is a no-op diff.
- Both paths run through the same validator (`scripts/puzzle-pipeline.mjs`):
  exactly one correct door, 3-4 doors, contiguous drag positions, unambiguous
  target orders, 1-2 answerable blanks, the answer present in the tray, and no
  repeated question inside a tier.
- `npm run verify:content` re-derives everything and fails if the committed
  JSON has drifted, so hand-editing a puzzle file is caught in CI.

The Jest suite goes one step further and **re-computes the answer from the
prompt text** for every recognisable arithmetic puzzle (~300 of them), which
catches a template that builds its prompt one way and its answer another.

## Sound

All 19 sounds are synthesised from scratch by `scripts/generate-sounds.mjs`
(~1.8 MB of 22 kHz mono WAV). Nothing is sampled and nothing comes from the
film, which satisfies the PRD's "royalty-free or original, no copyrighted
Pixar audio" requirement. Every file is preloaded on launch and held in a ref;
nothing loads during gameplay.

To swap in professionally produced audio, drop replacements with the same
filenames into `assets/sounds/` — no code changes needed.

## Art

Character sprites are the placeholder colour blocks the PRD asks for
(Section 19.8): `src/components/characters/Sprite.tsx` renders a rounded
rectangle with the character's name. It is the **only** component that knows
what a character looks like, so the art pipeline lands by adding a `sprite`
field to `src/data/characters.ts` and one `<Image>` in that file.

No Pixar artwork or audio is included in this repository.

---

## Decisions taken on the PRD's open questions

| # | Question | Decision |
|---|---|---|
| 1 | Build-time or runtime puzzle generation? | **Build-time.** A script emits JSON; the runtime only reads it. Matches the PRD's own recommendation and keeps rounds allocation-free. |
| 2 | Concurrent animation budget? | Designed for iPhone SE (2nd gen) as the floor: at most one door animation plus the parallax corridor (two drifting layers) at a time; the timer bar is a single interpolated value. |
| 3 | Enough character lines? | Shipped exactly the lines in the PRD (2-3 each), with no-immediate-repeat selection. Expanding to 5-8 is a data-only edit in `src/data/characters.ts`. **Left open for Product.** |
| 4 | Haptics? | **Not implemented.** It would need a Settings toggle the PRD does not specify. **Left open for Product/Design.** |
| 5 | Skippable "3-2-1"? | **Not skippable**, per the PRD's recommendation. |

### Judgement calls worth reviewing

- **Retry budget.** Section 5.1 and AC-4 both say "up to 2 retries" (3 attempts);
  Section 15's table says the answer is revealed "after the 2nd wrong answer"
  (2 attempts). Implemented as 2 retries per AC-4, via a single constant —
  `MAX_RETRIES` in `src/hooks/usePuzzleEngine.ts`.
- **Retries on drag and pattern puzzles.** The PRD only describes the retry cap
  for doors. The same cap is applied to the other two types so a stuck player
  is always moved along; wrong placements bounce back exactly as specified, and
  running out of retries reveals the answer.
- **Zero-attempt rounds.** Section 15 says a 0/0 round means "no tier progress
  change", so such a round is recorded in history but does not burn a
  consecutive-pass streak.
- **Starting tier unlocks.** An 11-year-old starts at tier 8 with tiers 1-7
  already unlocked, rather than only tier 8 — replaying easier tiers is
  explicitly allowed, and locking tiers *below* the player would be strange.

---

## Acceptance criteria coverage

| AC | Where it lives | Test |
|---|---|---|
| AC-1 Profile setup | `src/app/index.tsx`, `initialGameState` | `progressionEngine.test.ts`, `storage.test.ts` |
| AC-2 Round timer | `src/utils/timerMath.ts`, `useTimer` | `timer.test.ts` (±100 ms budget) |
| AC-3 Door correct | `DoorSelection.tsx` | manual |
| AC-4 Door wrong + retries | `DoorSelection.tsx`, `usePuzzleEngine` | `characters.test.ts` (weights, no repeats) |
| AC-5 Drag and drop | `DragAndDrop.tsx` | `puzzleContent.test.ts` (unambiguous targets) |
| AC-6 Pattern completion | `PatternCompletion.tsx` | `puzzleContent.test.ts` (answerable blanks) |
| AC-7 Tier unlock | `applyRoundResult` | `progressionEngine.test.ts` |
| AC-8 Persistence | `src/utils/storage.ts` | `storage.test.ts` |
| AC-9 Pause on background | `src/app/round.tsx` | `timer.test.ts` (pause maths) |
| AC-10 Settings reset | `src/app/settings.tsx` | `storage.test.ts` |

## Not in V1

Android, colourblind modes, parental dashboard, cloud sync, multiplayer,
adaptive in-round difficulty, custom avatars, IAP, landscape, cutscenes,
localization — all per the PRD's Section 18.
