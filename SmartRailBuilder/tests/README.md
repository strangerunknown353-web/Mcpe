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

## What's NOT covered (known gaps, not solved this session)

- `ui/BuildMenu.js` and anything using `@minecraft/server-ui`
  (`ActionFormData`/`ModalFormData`/`MessageFormData`) — no mock exists for
  that package yet. Form-building/UI flow is untested by this harness;
  `integration.test.mjs` substitutes a scripted stub for `BuildMenu` instead.
- Real Bedrock semantics this mock doesn't attempt to replicate: actual tick
  pacing (`system.runJob` here drains a generator to completion
  synchronously, not spread across ticks), real block update/neighbor-sensing
  behavior, real `LocationInUnloadedChunkError`/`LocationOutOfWorldBoundariesError`
  timing nuances.

**In-game verification has not been performed for anything in this or any
prior session** — this harness (like every one before it, per
`docs/ARCHITECTURE.md`'s own running theme) approximates the real API
surface; it does not replace an actual play-test.
