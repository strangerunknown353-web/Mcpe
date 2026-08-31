# Smart Rail Builder — Test Harness

Added Project Prompt 18 (planning-side coverage), substantially extended
Project Prompt 19 (execution-side coverage), and Project Prompt 20 (full
end-to-end pipeline coverage). No mocked test harness was present in the
uploaded project archive for any prior session (see `docs/ARCHITECTURE.md`'s
§33.2/§34.5 — this gap was flagged repeatedly, never fixed) — this directory
is what actually closes it, committed to the repository rather than left in
a session-local temp directory.

## Running

```
node tests/water.test.mjs
node tests/terrain.test.mjs
node tests/execution.test.mjs
node tests/integration.test.mjs
node tests/uiMenu.test.mjs
```

No dependencies, no build step — plain Node (22+), ESM (`.mjs`).

## Test-only mock packages (Project Prompt 19)

`node_modules/@minecraft/server/` at the repository root is a **test-only
mock** of the real package — a `package.json` + `index.js` exporting just
enough of `BlockPermutation`, `GameMode`, `EquipmentSlot`, `system.runJob`,
and `world` (event signals) for this project's own code to run against in
plain Node. It exists so files that import the real `@minecraft/server`
(every execution-side class — strategies, `TunnelExcavator`,
`BridgeSupportBuilder`, `CancellationWatcher`, `InventoryManager`,
`ResourceValidator`) can be imported and exercised directly, the same way
`tests/mockWorld.mjs` already let planning-side code (`terrain/*.js`) run
without a live Minecraft world.

**This is NEVER bundled into the shipped `.mcaddon`** — packaging only zips
`BP/`/`RP/`; `node_modules/` and `tests/` are dev-only tooling, exactly like
`devDependencies` in an ordinary Node project. See that package's own
`index.js` header for exactly what it mocks and what it deliberately doesn't
attempt to replicate.

`tests/mockWorld.mjs` — a synthetic, now **stateful** `Dimension.getBlock()`
(Project Prompt 19: block reads are cached in a `Map` so a `setPermutation()`
mutation is visible on a later read of the same position — required for
testing execution, not just planning) built from a flat ground plane +
explicit per-position overrides + simulated unloaded/out-of-bounds
positions.

`tests/mockPlayer.mjs` (Project Prompt 19) — a minimal in-memory `Player` +
inventory `Container`, matching exactly the surface `InventoryManager.js`/
`HeldItemValidator.js` actually call.

`node_modules/@minecraft/server-ui/` (Project Prompt 21) — a test-only mock
of `ActionFormData`/`ModalFormData`/`MessageFormData`, closing the one gap
this file has listed as unsolved since Project Prompt 18. A test scripts a
response per player with `queueFormResponse(player, response)` before
triggering the code under test; queues are keyed per player object so two
players' scripted flows never cross-contaminate (see `uiMenu.test.mjs`'s own
multiplayer isolation test). `ModalFormData.show()` validates a scripted
slider value against the field's own declared `[min, max]`/`valueStep` —
the same structural guarantee a real physical slider provides — so a test
proving "0 or 21+ is impossible to select" for Bridge Height/Underground
Depth gets the same rejection a real device would produce, not a silent
pass-through. See that package's own `index.js` header for the full
rationale, and its own `NEVER bundled into the shipped .mcaddon` note.

## What's covered

`water.test.mjs` (Project Prompt 18) — water handling, planning-side only:
- `terrain/WaterDetector.js`'s primitives directly.
- `TerrainScanner.scanPath()`'s shallow-water-safe / water-too-deep / deep
  lake crossing (reusing `GapAnalyzer`'s existing `WATER_CROSSING` gap type)
  classifications, and that lava is unaffected.
- `TerrainScanner.planBridge()` tolerating water at deck/headroom, and piers
  still correctly rising through a water column to real ground.
- `TerrainScanner.planUnderground()`'s corridor water sealing (`sealPositions`),
  and that a liquid floor / lava are still correctly rejected outright.
- `PathValidator`'s `WATER_CROSSING_UNSAFE` reason and message.
- A short regression block (flat terrain, ascend, existing-rail crossing,
  Bridge/Underground rejection reasons).

`terrain.test.mjs` (Project Prompt 19) — terrain/rail scenarios, planning-side:
- Flat, one-block hill/depression, a genuine multi-step staircase, a
  tunnelable steep wall vs. a genuinely un-tunnelable bedrock obstruction, a
  ravine (`GapType.AIR`), mixed terrain.
- The two new SMART TERRAIN ANALYSIS checks: an unbreakable block at the
  rail's own spot, and insufficient headroom one block above it — both
  tested at the path's starting position (index 0), the one place their
  effect is unconditionally observable rather than potentially superseded by
  a successful ascend/tunnel fallback (see the staircase tests for that
  machinery actually routing around a single obstruction instead).
- `isExistingRail`, parallel rails (never read), all 4 rail types crossing
  the path, two "generated railways" (consecutive existing rail positions)
  meeting.
- Bridge/Underground transition elevation profiles (start/end at the origin
  elevation, first ramp step, via each mode's own `*Validation` class).

`execution.test.mjs` (Project Prompt 19) — the execution-side counterpart,
unlocked by the new mocks above:
- `RailPermutationBuilder`'s straight/ascending direction values for all 4
  cardinal directions and powered-rail `rail_data_bit`.
- `StraightRailStrategy`: starting-rail and ending-rail direction
  correctness, existing-rail preservation across a crossing (including a
  different rail type), a one-block slope's actual placed permutation,
  Survival deduction skipping an existing-rail position.
- `RailBuilder.run()` actually draining a strategy's generator via the mocked
  `system.runJob` and resolving the correct `BuildResult`.
- `BridgeExecutionStrategy`/`UndergroundExecutionStrategy` execution-level
  regressions for Project Prompt 18: a bridge deck rail genuinely placed over
  what was water, an existing rail preserved on the deck, and an Underground
  waterproof seal block actually written to the world.
- Resource safety: exact resources, insufficient resources (correct missing
  quantity), Creative bypass, and that a deeper/bigger terrain gap produces a
  strictly larger planning-time material requirement.
- Multiplayer isolation: `CancellationWatcher` cancels only the player whose
  `playerLeave` fired, leaving a second player's session completely
  untouched; two simultaneous `scanPath()` calls for two different
  players/build vectors never cross-contaminate.

`integration.test.mjs` (Project Prompt 20) — the full-pipeline counterpart:
builds the exact same dependency graph `main.js`'s `buildDependencyGraph()`
constructs (every real stage, every real validator, the real
`BuildPipeline`), with only `ui/BuildMenu.js` replaced by a scripted stub
(the one class that calls `@minecraft/server-ui`, which has no mock — see
below). Confirms the WIRING itself, not just each piece in isolation:
- A complete NORMAL, BRIDGE, and UNDERGROUND build each run from
  `RailDetectionStage` through `CompletionStage`, with rails actually
  readable in the mock world afterward and the correct Survival inventory
  deduction.
- Four distinct rejection paths (insufficient rails, held item swapped mid-menu,
  an out-of-range bridge height, and — implicitly, via every SUCCESS case
  above — that `FinalSafetyCheckStage` doesn't re-reject a still-valid plan)
  each stop at the CORRECT stage with a `localizationKey`, and confirm
  nothing is built when a build is rejected (Section 10 resource safety).
- Two players building simultaneously (Bridge + Underground, different
  dimensions) through the real pipeline stay completely isolated —
  independent configuration, independent `BuildSession`s, independent
  inventories.

A real bug in the test's OWN first draft was found and fixed by this
process, worth naming since it's exactly the kind of thing a full pipeline
run catches that piecemeal tests can't: the first version asserted on block
coordinates assuming the build origin was the player's own position — it
isn't (`BuildVector`'s ORIGIN RULE places it one block ahead, along whichever
direction `player.getRotation().y` resolves to), so with the mock's default
yaw the assertions were silently checking the wrong coordinates. Fixed by
pinning an explicit yaw and computing the real expected origin from
`DirectionUtils`' own documented bands, rather than adjusting the assertion
to match whatever the code happened to do.

`uiMenu.test.mjs` (Project Prompt 21) — `ui/BuildMenu.js` directly, via the
new `@minecraft/server-ui` mock:
- Mode screen: button order/count matches `BUILD_MODE_ORDER` exactly, a real
  selection maps back to the correct `BuildingMode`, cancellation never
  returns a mode.
- Configuration screen: Bridge Height (1-16) and Underground Depth (1-20)
  are proven physically impossible to set to 0 or 21+ — the mock's slider
  validation rejects it, and `BuildMenu` never lets that escape as a thrown
  error (matching its own "never throw" contract), so it surfaces as a
  cancelled config rather than a usable one. NORMAL mode's config screen
  has exactly one field (Length) — no stray Height/Depth field appears.
  BRIDGE mode's two-field form maps `formValues[0]`/`[1]` back to
  `modeValue`/`length` correctly.
- Material screen: selection maps back to the correct material `typeId`;
  cancellation path reported correctly.
- Summary screen: `selection: 0` (Build) vs `selection: 1` (Cancel button)
  vs the form simply being closed are three distinct, correctly
  distinguished outcomes — the "no accidental construction" contract.
- Multiplayer isolation: two players' scripted mode-screen responses,
  queued and shown concurrently, never cross-contaminate.

## What's NOT covered (known gaps, not solved this session)

- The new `@minecraft/server-ui` mock is shape-only, same spirit as
  `@minecraft/server`'s: no icon rendering, no real screen layout/timing,
  and it cannot confirm the two items already flagged as "needs a live
  client" in `ui/BuildMenu.js`'s own header — whether `.body()` actually
  renders a `{translate, with}` RawMessage with real substituted values
  in-game, and whether `textures/items/<shortName>` resolves for every
  possible bridge material. Both remain visual-confirmation items, not
  fixed by this harness.
- Real Bedrock semantics this mock doesn't attempt to replicate: actual tick
  pacing (`system.runJob` here drains a generator to completion
  synchronously, not spread across ticks), real block update/neighbor-sensing
  behavior, real `LocationInUnloadedChunkError`/`LocationOutOfWorldBoundariesError`
  timing nuances.

**In-game verification has not been performed for anything in this or any
prior session** — this harness (like every one before it, per
`docs/ARCHITECTURE.md`'s own running theme) approximates the real API
surface; it does not replace an actual play-test.
