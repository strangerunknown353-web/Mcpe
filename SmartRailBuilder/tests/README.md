# Smart Rail Builder — Test Harness

Added Project Prompt 18. No mocked test harness was present in the uploaded
project archive for any prior session (see `docs/ARCHITECTURE.md`'s §33.2/
§34.5 — this gap was flagged repeatedly, never fixed). This directory is a
first pass at fixing that, scoped to what this session actually touched.

## Running

```
node tests/water.test.mjs
```

No dependencies, no build step — plain Node, ESM (`.mjs`).

## What's covered

`mockWorld.mjs` — a synthetic `Dimension.getBlock()` (flat ground plane +
explicit per-position overrides + simulated unloaded/out-of-bounds
positions), since every planning-side module in this addon reads blocks
exclusively through `utils/BlockReader.js`. No `@minecraft/server` import
anywhere in this directory.

`water.test.mjs` — Project Prompt 18's water handling:
- `terrain/WaterDetector.js`'s primitives directly.
- `TerrainScanner.scanPath()`'s shallow-water-safe / water-too-deep / deep
  lake crossing (reusing `GapAnalyzer`'s existing `WATER_CROSSING` gap type)
  classifications, and that lava is unaffected.
- `TerrainScanner.planBridge()` tolerating water at deck/headroom, and piers
  still correctly rising through a water column to real ground.
- `TerrainScanner.planUnderground()`'s corridor water sealing (`sealPositions`),
  and that a liquid floor / lava are still correctly rejected outright.
- `PathValidator`'s new `WATER_CROSSING_UNSAFE` reason and message, for both
  water-detection paths above.
- A short regression block: flat dry terrain, a plain ±1 ascend, existing-rail
  crossing recognition, Bridge's minimum-length rejection, and Underground's
  unbreakable-block rejection — none of this session's changes should have
  touched any of these.

## What's NOT covered (known gap, not solved this session)

The execution strategies (`builder/strategies/*.js`, `builder/TunnelExcavator.js`,
`builder/BridgeSupportBuilder.js`) import `@minecraft/server` directly
(`GameMode`, `BlockPermutation`) and aren't exercised here — testing them the
same way would need a module-resolution shim for that package, which this
session didn't build. Everything in this directory tests planning
(`terrain/*.js`) only. See `docs/TODO.md`.

**In-game verification has not been performed for anything in this session** —
this harness (like every one before it, per `docs/ARCHITECTURE.md`'s own
running theme) approximates the real API surface; it does not replace an
actual play-test.
