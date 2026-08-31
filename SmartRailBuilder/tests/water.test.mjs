/**
 * water.test.mjs
 *
 * Project Prompt 18 ("Underwater Railway & Water-Safe Construction") test
 * suite — see mockWorld.mjs's header for why this exists and what it does
 * and doesn't cover (planning-side logic only; execution strategies import
 * `@minecraft/server` directly and aren't exercised here).
 *
 * Run with: node tests/water.test.mjs
 */

import { createMockDimension, createBuildVector, STONE, WATER_SOURCE, WATER_FLOWING, LAVA } from "./mockWorld.mjs";
import { TerrainScanner, TerrainClassification } from "../BP/scripts/terrain/TerrainScanner.js";
import { PathValidator, PathRejectionReason } from "../BP/scripts/terrain/PathValidator.js";
import { PathCategory } from "../BP/scripts/terrain/PathCategory.js";
import { BridgeRejectionReason } from "../BP/scripts/terrain/BridgePlan.js";
import { UndergroundRejectionReason } from "../BP/scripts/terrain/UndergroundPlan.js";
import { UndergroundValidation } from "../BP/scripts/terrain/UndergroundValidation.js";
import { BridgeValidation } from "../BP/scripts/terrain/BridgeValidation.js";
import {
  hasLiquidAbove,
  isSourceBlock,
  perpendicularOffsets,
  findLateralSealPositions,
} from "../BP/scripts/terrain/WaterDetector.js";
import { LocalizationKeys } from "../BP/scripts/localization/LocalizationKeys.js";

let passed = 0;
let failed = 0;
const failures = [];

function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(actual, label) {
  assertEqual(Boolean(actual), true, label);
}

const scanner = new TerrainScanner();
const pathValidator = new PathValidator();

// ---------------------------------------------------------------------------
// 1. WaterDetector unit tests
// ---------------------------------------------------------------------------

{
  const [east, west] = perpendicularOffsets("north");
  assertEqual(east, { x: 1, z: 0 }, "perpendicularOffsets(north) first offset is east");
  assertEqual(west, { x: -1, z: 0 }, "perpendicularOffsets(north) second offset is west");

  const [south2, north2] = perpendicularOffsets("east");
  assertEqual(south2, { x: 0, z: 1 }, "perpendicularOffsets(east) first offset is south");
  assertEqual(north2, { x: 0, z: -1 }, "perpendicularOffsets(east) second offset is north");
}

{
  // hasLiquidAbove: a single water layer at y=10, air at y=11 -> no water above.
  const dim = createMockDimension({ groundY: 5, overrides: { "0,10,0": WATER_SOURCE, "0,11,0": AIRSPEC() } });
  assertEqual(hasLiquidAbove(dim, { x: 0, y: 10, z: 0 }, 1), false, "hasLiquidAbove: single water layer, dry above");
}
{
  // hasLiquidAbove: water stacked two high.
  const dim = createMockDimension({ groundY: 5, overrides: { "0,10,0": WATER_SOURCE, "0,11,0": WATER_SOURCE } });
  assertEqual(hasLiquidAbove(dim, { x: 0, y: 10, z: 0 }, 1), true, "hasLiquidAbove: stacked water detected");
}
{
  // hasLiquidAbove fails safe on an unreadable position.
  const dim = createMockDimension({ groundY: 5, unloaded: ["0,11,0"] });
  assertEqual(hasLiquidAbove(dim, { x: 0, y: 10, z: 0 }, 1), true, "hasLiquidAbove: unreadable position fails safe (true)");
}

assertEqual(isSourceBlock({ isLiquid: true, permutation: { getState: () => 0 } }), true, "isSourceBlock: depth 0 is a source");
assertEqual(isSourceBlock({ isLiquid: true, permutation: { getState: () => 4 } }), false, "isSourceBlock: nonzero depth is flowing");
assertEqual(
  isSourceBlock({
    isLiquid: true,
    permutation: {
      getState: () => {
        throw new Error("state unavailable");
      },
    },
  }),
  true,
  "isSourceBlock: unreadable state defaults to source (informational only)"
);

{
  // findLateralSealPositions: both lateral neighbors are open water -> both sealed.
  const dim = createMockDimension({
    groundY: 5,
    overrides: { "1,10,0": WATER_SOURCE, "-1,10,0": WATER_SOURCE, "0,10,0": WATER_SOURCE },
  });
  const seals = findLateralSealPositions(dim, { x: 0, y: 10, z: 0 }, "north");
  assertEqual(seals.length, 2, "findLateralSealPositions: two open lateral neighbors both need sealing");
}
{
  // One lateral neighbor is already solid ground -> only the other needs sealing.
  const dim = createMockDimension({
    groundY: 15, // both {1,10,0} and {-1,10,0} would be solid by the ground plane...
    overrides: { "0,10,0": WATER_SOURCE, "1,10,0": WATER_SOURCE }, // ...except we carve one back open
  });
  const seals = findLateralSealPositions(dim, { x: 0, y: 10, z: 0 }, "north");
  assertEqual(seals, [{ x: 1, y: 10, z: 0 }], "findLateralSealPositions: already-solid neighbor is left alone");
}

function AIRSPEC() {
  return { typeId: "minecraft:air", isAir: true };
}

// ---------------------------------------------------------------------------
// 2. Normal Mode: shallow water is safely buildable
// ---------------------------------------------------------------------------

{
  // A 5-long flat path, all stone at y=63/64, except a single shallow puddle
  // (one water block, solid ground beneath) at index 2.
  const dim = createMockDimension({ groundY: 63, overrides: { "2,64,0": WATER_SOURCE } });
  const buildVector = createBuildVector({ x: 0, y: 64, z: 0 }, "east");
  const result = scanner.scanPath(buildVector, 5, dim);

  assertTrue(result.buildReady, "shallow water crossing: whole path still buildReady");
  assertEqual(result.underwaterCount, 1, "shallow water crossing: exactly one underwater position counted");
  assertEqual(result.positions[2].classification, TerrainClassification.FLAT_SAFE, "shallow water crossing: position classified FLAT_SAFE");
  assertTrue(result.positions[2].isUnderwater, "shallow water crossing: isUnderwater flag set");
  assertEqual(result.positions[2].waterInfo.isSourceBlock, true, "shallow water crossing: waterInfo reports source block");

  const validation = pathValidator.validate(result);
  assertTrue(validation.valid, "shallow water crossing: PathValidator accepts the whole path");
}

// ---------------------------------------------------------------------------
// 3. Normal Mode: water too deep to safely ride through is rejected, with a
//    specific message pointing to Bridge/Underground.
// ---------------------------------------------------------------------------

{
  const dim = createMockDimension({
    groundY: 63,
    overrides: { "2,64,0": WATER_SOURCE, "2,65,0": WATER_FLOWING },
  });
  const buildVector = createBuildVector({ x: 0, y: 64, z: 0 }, "east");
  const result = scanner.scanPath(buildVector, 5, dim);

  assertEqual(result.positions[2].classification, TerrainClassification.UNSUPPORTED, "deep water at rail level: UNSUPPORTED");
  assertEqual(result.positions[2].unsupportedReason, "WATER_TOO_DEEP", "deep water at rail level: tagged WATER_TOO_DEEP");

  const validation = pathValidator.validate(result);
  assertEqual(validation.valid, false, "deep water at rail level: PathValidator rejects");
  assertEqual(validation.reason, PathRejectionReason.WATER_CROSSING_UNSAFE, "deep water at rail level: WATER_CROSSING_UNSAFE reason");
  assertEqual(
    validation.localizationKey,
    LocalizationKeys.PATH_REJECTED_WATER_CROSSING,
    "deep water at rail level: correct localization key"
  );
}

// ---------------------------------------------------------------------------
// 4. Normal Mode: stepping off a bank into a large/deep body of water (no
//    floor within the drop) is detected via the EXISTING GapAnalyzer
//    WATER_CROSSING machinery, and PathValidator gives the same clear message.
// ---------------------------------------------------------------------------

{
  // Ground drops away entirely at index 2 onward into deep water (12+ blocks,
  // beyond GAP_CONFIG.MAX_DEPTH_SEARCH) with no floor.
  const overrides = {};
  for (let y = 40; y <= 64; y++) {
    overrides[`2,${y},0`] = WATER_SOURCE;
    overrides[`3,${y},0`] = WATER_SOURCE;
  }
  const dim = createMockDimension({ groundY: 63, overrides });
  const buildVector = createBuildVector({ x: 0, y: 64, z: 0 }, "east");
  const result = scanner.scanPath(buildVector, 4, dim);

  const dropFact = result.positions[2];
  assertEqual(dropFact.classification, TerrainClassification.UNSUPPORTED, "deep lake crossing: UNSUPPORTED");
  assertEqual(dropFact.pathCategory, PathCategory.WATER_CROSSING, "deep lake crossing: pathCategory is WaterCrossing (reused GapAnalyzer)");

  const validation = pathValidator.validate(result);
  assertEqual(validation.reason, PathRejectionReason.WATER_CROSSING_UNSAFE, "deep lake crossing: same WATER_CROSSING_UNSAFE reason");
}

// ---------------------------------------------------------------------------
// 5. Lava safety is unaffected by any of the water changes.
// ---------------------------------------------------------------------------

{
  const dim = createMockDimension({ groundY: 63, overrides: { "2,64,0": LAVA } });
  const buildVector = createBuildVector({ x: 0, y: 64, z: 0 }, "east");
  const result = scanner.scanPath(buildVector, 5, dim);
  assertEqual(result.positions[2].classification, TerrainClassification.HAZARD, "lava: still classified HAZARD");
  const validation = pathValidator.validate(result);
  assertEqual(validation.reason, PathRejectionReason.HAZARD, "lava: still rejected as HAZARD, not water logic");
}

// ---------------------------------------------------------------------------
// 6. Bridge Mode: deck/headroom over water no longer rejects; piers still
//    rise correctly through a water column to real ground below.
// ---------------------------------------------------------------------------

{
  // A lake at y=60 (surface) down to y=50 (real lakebed at y=50, i.e. solid
  // ground starts at y=50 and below), origin at y=64 (bridgeHeight 3 -> crest
  // at y=67, well above the lake surface). Pier positions (index 0, length-1,
  // and every 4th) need to search down through the lake to find real ground.
  const length = 9; // >= 2*3+3 = 9, the geometric minimum for height 3.
  const overrides = {};
  for (let x = 0; x < length; x++) {
    for (let y = 51; y <= 60; y++) {
      overrides[`${x},${y},0`] = WATER_SOURCE;
    }
  }
  // Real lakebed at y=50 and below (default ground plane), lake surface at
  // y=60, origin at y=64 is above the water entirely.
  const dim = createMockDimension({ groundY: 50, overrides });
  const buildVector = createBuildVector({ x: 0, y: 64, z: 0 }, "east");
  const plan = scanner.planBridge(buildVector, length, dim, 3);

  assertTrue(plan.feasible, "bridge over water: plan is feasible (no BLOCKED_BY_LIQUID)");
  if (plan.feasible) {
    const consistency = new BridgeValidation().validate(plan);
    assertTrue(consistency.valid, "bridge over water: plan passes its own internal consistency check");
    assertTrue(plan.supportPositions.length > 0, "bridge over water: piers were placed reaching down through the lake");
  }
}

{
  // Same lake, but this time a bridge low enough that its OWN deck sits
  // exactly at the water surface — must still be feasible (Project Prompt 18).
  const length = 9;
  const overrides = {};
  for (let x = 0; x < length; x++) {
    overrides[`${x},64,0`] = WATER_SOURCE; // deck-height water across the whole span
  }
  const dim = createMockDimension({ groundY: 50, overrides });
  const buildVector = createBuildVector({ x: 0, y: 64, z: 0 }, "east");
  const plan = scanner.planBridge(buildVector, length, dim, 3);
  assertTrue(plan.feasible, "bridge with deck-level water across the whole span: still feasible");
  assertEqual(plan.rejectionReason, undefined, "bridge with deck-level water: no rejection reason");
}

// ---------------------------------------------------------------------------
// 7. Underground Mode: corridor water is sealed, not rejected; a liquid
//    FLOOR is still (correctly) rejected outright.
// ---------------------------------------------------------------------------

{
  // depth 5, length 8 (>= depth+1). Flood the corridor at the flat run's
  // very first row (index 5, the first flat position) with water at rail
  // level and headroom level, floor still solid stone (default ground plane
  // is far below railY here since groundY defaults deep below).
  const depth = 5;
  const length = 8;
  const originY = 70;
  const railY = originY - depth; // 65
  const overrides = {
    [`5,${railY},0`]: WATER_SOURCE,
    [`5,${railY + 1},0`]: WATER_SOURCE,
    // The lateral neighbors are part of the SAME water pocket the corridor
    // cuts through (not solid rock) — this is what actually needs sealing.
    // A lateral neighbor that's already solid rock (the default plane
    // everywhere else) needs no seal at all — see the separate
    // findLateralSealPositions unit test above for that case.
    [`5,${railY},1`]: WATER_SOURCE,
    [`5,${railY},-1`]: WATER_SOURCE,
  };
  const dim = createMockDimension({ groundY: 100, overrides }); // solid floor everywhere by default; overrides carve out water/lava
  const buildVector = createBuildVector({ x: 0, y: originY, z: 0 }, "east");
  const plan = scanner.planUnderground(buildVector, length, dim, depth);

  assertTrue(plan.feasible, "underground water corridor: plan is feasible (no BLOCKED_BY_WATER)");
  if (plan.feasible) {
    const consistency = new UndergroundValidation().validate(plan);
    assertTrue(consistency.valid, "underground water corridor: plan passes its own internal consistency check");

    const floodedStep = plan.railSteps[5];
    assertTrue(floodedStep.sealPositions.length > 0, "underground water corridor: flooded row has seal positions");
    // Travel direction "east" -> lateral neighbors are north/south (z ± 1).
    const sealsAtRailLevel = floodedStep.sealPositions.filter((p) => p.y === railY);
    assertEqual(sealsAtRailLevel.length, 2, "underground water corridor: both lateral faces sealed at rail level");
    assertTrue(
      sealsAtRailLevel.every((p) => p.x === 5 && (p.z === 1 || p.z === -1)),
      "underground water corridor: seal positions are the lateral (north/south) neighbors, not along the tunnel"
    );

    assertEqual(plan.terrainSummary.waterRowsSealed, 1, "underground water corridor: exactly one row flagged as sealed");
    assertTrue(plan.totalSealCount > 0, "underground water corridor: totalSealCount is positive");

    // Every other (dry) row must have an empty sealPositions array.
    const dryRowsAllEmpty = plan.railSteps.every((step, i) => i === 5 || step.sealPositions.length === 0);
    assertTrue(dryRowsAllEmpty, "underground water corridor: dry rows have empty sealPositions (no unnecessary work)");
  }
}

{
  // A liquid FLOOR (no solid ground under the rail at all) must still be
  // rejected outright — sealing does not fabricate a floor over open water.
  const depth = 3;
  const length = 6;
  const originY = 70;
  const railY = originY - depth;
  const overrides = { [`4,${railY - 1},0`]: WATER_SOURCE };
  const dim = createMockDimension({ groundY: 100, overrides });
  const buildVector = createBuildVector({ x: 0, y: originY, z: 0 }, "east");
  const plan = scanner.planUnderground(buildVector, length, dim, depth);

  assertEqual(plan.feasible, false, "underground liquid floor: still rejected");
  assertEqual(plan.rejectionReason, UndergroundRejectionReason.BLOCKED_BY_WATER, "underground liquid floor: BLOCKED_BY_WATER reason");
}

{
  // Lava anywhere in the corridor must still abort the whole plan safely —
  // Project Prompt 18 explicitly forbids automatic lava tunnels.
  const depth = 3;
  const length = 6;
  const originY = 70;
  const railY = originY - depth;
  const overrides = { [`4,${railY},0`]: LAVA };
  const dim = createMockDimension({ groundY: 100, overrides });
  const buildVector = createBuildVector({ x: 0, y: originY, z: 0 }, "east");
  const plan = scanner.planUnderground(buildVector, length, dim, depth);

  assertEqual(plan.feasible, false, "underground lava in corridor: still rejected");
  assertEqual(plan.rejectionReason, UndergroundRejectionReason.BLOCKED_BY_LAVA, "underground lava in corridor: BLOCKED_BY_LAVA reason");
}

// ---------------------------------------------------------------------------
// 8. REGRESSION: previously-shipped behavior this session must not disturb.
// ---------------------------------------------------------------------------

{
  // Plain flat, dry terrain: still all FLAT_SAFE, buildReady, zero underwater.
  const dim = createMockDimension({ groundY: 63 });
  const buildVector = createBuildVector({ x: 0, y: 64, z: 0 }, "east");
  const result = scanner.scanPath(buildVector, 5, dim);
  assertTrue(result.buildReady, "regression: flat dry terrain still buildReady");
  assertEqual(result.underwaterCount, 0, "regression: flat dry terrain has zero underwaterCount");
  assertTrue(
    result.positions.every((p) => p.classification === TerrainClassification.FLAT_SAFE),
    "regression: flat dry terrain is all FLAT_SAFE"
  );
}

{
  // A single ±1 ascend still resolves correctly (Roadmap Phase 11), untouched
  // by water logic. A solid block sitting right at rail height (y=64) blocks
  // the flat attempt at index 2, forcing the existing ascend fallback to
  // y=65 (naturally clear, since the default ground plane only fills y<=63).
  const dim = createMockDimension({ groundY: 63, overrides: { "2,64,0": STONE } });
  const buildVector = createBuildVector({ x: 0, y: 64, z: 0 }, "east");
  const result = scanner.scanPath(buildVector, 5, dim);
  assertEqual(result.positions[2].classification, TerrainClassification.ASCENDING, "regression: a genuine +1 rise still resolves ASCENDING");
}

{
  // An existing rail crossing the path is still recognized as already-clear
  // (bugfix pass before Project Prompt 18) and not disturbed by water logic.
  const dim = createMockDimension({ groundY: 63, overrides: { "2,64,0": { typeId: "minecraft:rail" } } });
  const buildVector = createBuildVector({ x: 0, y: 64, z: 0 }, "east");
  const result = scanner.scanPath(buildVector, 5, dim);
  assertEqual(result.positions[2].classification, TerrainClassification.FLAT_SAFE, "regression: existing rail crossing still treated as FLAT_SAFE");
  assertTrue(result.buildReady, "regression: existing rail crossing still buildReady");
}

{
  // Bridge Mode's geometric minimum-length rejection is unaffected by water tolerance.
  const dim = createMockDimension({ groundY: 60 });
  const buildVector = createBuildVector({ x: 0, y: 64, z: 0 }, "east");
  const plan = scanner.planBridge(buildVector, 5, dim, 3); // needs 2*3+3=9, only 5 given
  assertEqual(plan.feasible, false, "regression: bridge length-too-short still rejected");
  assertEqual(plan.rejectionReason, BridgeRejectionReason.LENGTH_TOO_SHORT_FOR_HEIGHT, "regression: correct rejection reason");
}

{
  // Underground Mode's unbreakable-block rejection is unaffected by water tolerance.
  const depth = 3;
  const originY = 70;
  const railY = originY - depth;
  const overrides = { [`4,${railY},0`]: { typeId: "minecraft:bedrock" } };
  const dim = createMockDimension({ groundY: 100, overrides });
  const buildVector = createBuildVector({ x: 0, y: originY, z: 0 }, "east");
  const plan = scanner.planUnderground(buildVector, 6, dim, depth);
  assertEqual(plan.feasible, false, "regression: underground unbreakable block still rejected");
  assertEqual(plan.rejectionReason, UndergroundRejectionReason.BLOCKED_BY_UNBREAKABLE, "regression: correct rejection reason");
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} assertions total).`);
if (failed > 0) {
  console.log("\nFailures:");
  for (const failure of failures) {
    console.log(`  - ${failure}`);
  }
  process.exitCode = 1;
}
