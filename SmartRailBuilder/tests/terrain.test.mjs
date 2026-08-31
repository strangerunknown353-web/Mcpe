/**
 * terrain.test.mjs
 *
 * Project Prompt 19 ("Smart Terrain Adaptation & Rail Connectivity") test
 * suite — the planning-side terrain/rail/transition scenarios not already
 * covered by tests/water.test.mjs (water-specific) or
 * tests/execution.test.mjs (execution-level). See tests/README.md.
 *
 * Run with: node tests/terrain.test.mjs
 */

import { createMockDimension, createBuildVector, STONE } from "./mockWorld.mjs";
import { TerrainScanner, TerrainClassification } from "../BP/scripts/terrain/TerrainScanner.js";
import { PathValidator, PathRejectionReason } from "../BP/scripts/terrain/PathValidator.js";
import { GapType } from "../BP/scripts/terrain/GapAnalyzer.js";
import { BridgeValidation } from "../BP/scripts/terrain/BridgeValidation.js";
import { UndergroundValidation } from "../BP/scripts/terrain/UndergroundValidation.js";
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
const UNBREAKABLE = { typeId: "minecraft:bedrock" };

// ---------------------------------------------------------------------------
// TERRAIN
// ---------------------------------------------------------------------------

{
  // Completely flat terrain.
  const dim = createMockDimension({ groundY: 63 });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 8, dim);
  assertTrue(result.isFlat, "flat terrain: isFlat true");
  assertTrue(result.buildReady, "flat terrain: buildReady true");
}

{
  // One-block hill (upward slope).
  const dim = createMockDimension({ groundY: 63, overrides: { "3,64,0": STONE } });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 6, dim);
  assertEqual(result.positions[3].classification, TerrainClassification.ASCENDING, "one-block hill: ASCENDING");
  assertTrue(result.buildReady, "one-block hill: still buildReady");
}

{
  // One-block depression (downward slope).
  const dim = createMockDimension({ groundY: 63, overrides: { "3,63,0": { typeId: "minecraft:air" } } });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 6, dim);
  assertEqual(result.positions[3].classification, TerrainClassification.DESCENDING, "one-block depression: DESCENDING");
  assertTrue(result.buildReady, "one-block depression: still buildReady");
}

{
  // Repeated one-block slopes: a genuine 3-step staircase, matching the
  // project's own established "continuous staircase" precedent (§36.2).
  // Each step needs TWO overrides: the block that blocks the flat rail
  // spot at that index (forcing an ascend), AND — for every index after
  // the first — the floor one below that, so the NEXT index's flat check
  // at the new, higher Y finds solid ground rather than a gap (a real
  // staircase's risers are contiguous, not floating steps).
  const dim = createMockDimension({
    groundY: 63,
    overrides: {
      "2,64,0": STONE,
      "3,64,0": STONE,
      "3,65,0": STONE,
      "4,65,0": STONE,
      "4,66,0": STONE,
      // Extend the top of the staircase into a flat plateau so the rest of
      // the scanned path (indices 5-7) has something to stand on too — a
      // real staircase leads somewhere, it doesn't end in a cliff.
      "5,66,0": STONE,
      "6,66,0": STONE,
      "7,66,0": STONE,
    },
  });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 8, dim);
  assertTrue(result.buildReady, "repeated one-block slopes (staircase): buildReady");
  assertEqual(result.positions[2].classification, TerrainClassification.ASCENDING, "staircase step 1");
  assertEqual(result.positions[3].classification, TerrainClassification.ASCENDING, "staircase step 2");
  assertEqual(result.positions[4].classification, TerrainClassification.ASCENDING, "staircase step 3");
  assertEqual(result.positions[4].position.y, 67, "staircase reaches the expected final height (3 consecutive +1 steps)");
}

{
  // Slope followed by flat terrain: ascend once, then the plateau
  // continues flat for the rest of the path (both (2,64,0) and (3,64,0)
  // raised, so index3 onward has solid ground at the new, higher level).
  const dim = createMockDimension({ groundY: 63, overrides: { "2,64,0": STONE, "3,64,0": STONE } });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 6, dim);
  assertEqual(result.positions[1].classification, TerrainClassification.FLAT_SAFE, "flat before the slope");
  assertEqual(result.positions[2].classification, TerrainClassification.ASCENDING, "the slope itself");
  assertEqual(result.positions[3].classification, TerrainClassification.FLAT_SAFE, "flat terrain after the slope, at the new elevation");
  assertEqual(result.positions[3].position.y, 65, "flat-after-slope is at the raised elevation, not back at the original one");
}

{
  // Flat terrain followed by a slope: the mirror case — nothing raised
  // until index4, so the path stays flat right up until the step.
  const dim = createMockDimension({ groundY: 63, overrides: { "4,64,0": STONE } });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 6, dim);
  assertEqual(result.positions[3].classification, TerrainClassification.FLAT_SAFE, "flat terrain right up to the slope");
  assertEqual(result.positions[4].classification, TerrainClassification.ASCENDING, "the slope, immediately after flat terrain");
}

{
  // Depression followed by flat terrain (Project Prompt 24 §3 — the mirror
  // case of "Slope -> Flat" above, using a drop instead of a rise): descend
  // once, then the new, LOWER elevation continues flat, rather than
  // climbing straight back up. Both (2,63,0) and (3,63,0) cleared, so
  // index 3's flat check finds solid ground one level down from the
  // original — the "new floor," not a return to the old one.
  const dim = createMockDimension({ groundY: 63, overrides: { "2,63,0": { typeId: "minecraft:air" }, "3,63,0": { typeId: "minecraft:air" } } });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 4, dim);
  assertEqual(result.positions[1].classification, TerrainClassification.FLAT_SAFE, "flat before the depression");
  assertEqual(result.positions[2].classification, TerrainClassification.DESCENDING, "the depression itself");
  assertEqual(result.positions[3].classification, TerrainClassification.FLAT_SAFE, "flat terrain after the depression, at the new LOWER elevation");
  assertEqual(result.positions[3].position.y, 63, "flat-after-depression is at the lowered elevation, not back at the original one");
}

{
  // Consecutive descending slopes (Project Prompt 24 §3's "multiple
  // slopes" case, descending direction — mirrors the ascending staircase
  // test above): a genuine 3-step descent, then a flat plateau at the
  // bottom, using the same "clear each step's own column, contiguous risers"
  // construction as the ascending version.
  const AIR = { typeId: "minecraft:air" };
  const dim = createMockDimension({
    groundY: 66,
    overrides: {
      "2,66,0": AIR,
      "3,66,0": AIR,
      "3,65,0": AIR,
      "4,66,0": AIR,
      "4,65,0": AIR,
      "4,64,0": AIR,
      "5,66,0": AIR,
      "5,65,0": AIR,
      "5,64,0": AIR,
      "6,66,0": AIR,
      "6,65,0": AIR,
      "6,64,0": AIR,
      "7,66,0": AIR,
      "7,65,0": AIR,
      "7,64,0": AIR,
    },
  });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 67, z: 0 }, "east"), 8, dim);
  assertTrue(result.buildReady, "descending staircase: buildReady");
  assertEqual(result.positions[2].classification, TerrainClassification.DESCENDING, "descending staircase step 1");
  assertEqual(result.positions[3].classification, TerrainClassification.DESCENDING, "descending staircase step 2");
  assertEqual(result.positions[4].classification, TerrainClassification.DESCENDING, "descending staircase step 3");
  assertEqual(result.positions[4].position.y, 64, "descending staircase reaches the expected final depth (3 consecutive -1 steps)");
  assertEqual(result.positions[5].classification, TerrainClassification.FLAT_SAFE, "flat plateau at the bottom of the descending staircase");
}

{
  // Steep hill: a rise of more than 1 block that IS tunnelable (a thin
  // spike/wall) — Normal Mode bores through automatically (Roadmap Phase 12,
  // unchanged), never a sudden vertical jump.
  const overrides = {};
  for (let y = 64; y <= 68; y++) overrides[`3,${y},0`] = STONE; // a 5-tall wall, 1 block thick
  const dim = createMockDimension({ groundY: 63, overrides });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 6, dim);
  assertEqual(result.positions[3].classification, TerrainClassification.TUNNEL, "steep-but-thin hill: bored as a TUNNEL, never a vertical jump");
  assertTrue(result.buildReady, "steep-but-thin hill: still buildReady");
  // Regression (Project Prompt 20 integration review): TunnelPlanner.js is
  // the only OTHER place besides TerrainScanner._scanPosition() that
  // constructs a TerrainPositionFact, and was found to be missing the
  // isExistingRail/isUnderwater fields added in Project Prompts 18/19 —
  // harmless in practice (nothing dereferenced them without a null-check),
  // but an inconsistent shape across the codebase's two fact-producers.
  // Fixed alongside this test.
  assertEqual(result.positions[3].isExistingRail, false, "a TUNNEL fact has isExistingRail explicitly false, not undefined");
  assertEqual(result.positions[3].isUnderwater, false, "a TUNNEL fact has isUnderwater explicitly false, not undefined");
}

{
  // Steep hill that is NOT tunnelable: unbreakable bedrock fills BOTH the
  // rail spot and its headroom at the very first blocked column, so
  // there's no ±1 ascend to try (the ascend candidate is bedrock too) and
  // TunnelDetector's own forward search hits bedrock immediately — Normal
  // Mode must reject cleanly, never attempt an impossible slope or a
  // sudden vertical jump.
  const dim = createMockDimension({ groundY: 63, overrides: { "3,64,0": UNBREAKABLE, "3,65,0": UNBREAKABLE } });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 6, dim);
  assertEqual(result.positions[3].classification, TerrainClassification.UNSUPPORTED, "un-tunnelable steep hill: UNSUPPORTED, not a vertical jump");
  assertEqual(result.positions[3].unsupportedReason, "UNBREAKABLE", "un-tunnelable steep hill: specific reason (bedrock, not tunnel-length)");
  const validation = pathValidator.validate(result);
  assertEqual(validation.valid, false, "un-tunnelable steep hill: Normal Mode rejects rather than building something unsafe");
}

{
  // Ravine: a drop of more than 1 block with open air below (no floor
  // within the search limit) — informational GapAnalysis, still rejected
  // for Normal Mode (Bridge/Underground are the player's manual choice,
  // never auto-selected).
  const dim = createMockDimension({ groundY: 63, unloaded: [] , outOfBounds: []});
  const overrides = {};
  for (let y = 20; y <= 63; y++) overrides[`2,${y},0`] = { typeId: "minecraft:air" }; // deep open ravine, no floor within reach
  const ravineDim = createMockDimension({ groundY: 63, overrides });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 5, ravineDim);
  assertEqual(result.positions[2].classification, TerrainClassification.UNSUPPORTED, "ravine: UNSUPPORTED");
  assertEqual(result.positions[2].gapAnalysis.gapType, GapType.AIR, "ravine with no floor in range: gapType AIR");
  const validation = pathValidator.validate(result);
  assertEqual(validation.valid, false, "ravine: rejected, Normal Mode never auto-switches to Bridge/Underground");
}

{
  // Mixed terrain: flat, then a one-block rise, then a one-block drop, then flat again.
  const dim = createMockDimension({
    groundY: 63,
    overrides: { "2,64,0": STONE, "4,63,0": { typeId: "minecraft:air" } },
  });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 7, dim);
  assertTrue(result.buildReady, "mixed terrain: still buildReady");
  assertEqual(result.positions[2].classification, TerrainClassification.ASCENDING, "mixed terrain: rise recognized");
  assertEqual(result.positions[4].classification, TerrainClassification.DESCENDING, "mixed terrain: drop recognized");
}

// ---------------------------------------------------------------------------
// SMART TERRAIN ANALYSIS (Project Prompt 19 new checks): unbreakable block
// at the rail's own spot, and headroom/clearance.
// ---------------------------------------------------------------------------

{
  // An unbreakable block (bedrock) sitting directly at the STARTING rail's
  // own spot, with otherwise-solid ground beneath, must give a SPECIFIC
  // message, not the generic "too steep" one. Deliberately tested at the
  // very first position (index 0): unlike any later position, index 0
  // never gets an ascend/tunnel fallback attempt (scanPath() only calls
  // _resolveSteppedPosition() for i > 0) — so this is the one case where
  // the specific reason is guaranteed to be the FINAL result rather than
  // possibly superseded by a successful climb around a single obstruction
  // (a real, and arguably smarter, alternative outcome for a later
  // position — see terrain.test.mjs's staircase tests above for that
  // machinery in action). This also directly exercises Section 7's
  // "starting rail" requirement: a bad starting position must be rejected
  // clearly, not silently misreported as generic terrain trouble.
  const dim = createMockDimension({ groundY: 63, overrides: { "0,64,0": UNBREAKABLE } });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 5, dim);
  assertEqual(result.positions[0].classification, TerrainClassification.UNSUPPORTED, "unbreakable at the starting rail spot: UNSUPPORTED");
  assertEqual(result.positions[0].unsupportedReason, "UNBREAKABLE", "unbreakable at the starting rail spot: specific reason");
  const validation = pathValidator.validate(result);
  assertEqual(validation.reason, PathRejectionReason.UNBREAKABLE_BLOCK, "unbreakable at the starting rail spot: UNBREAKABLE_BLOCK rejection");
  assertEqual(validation.localizationKey, LocalizationKeys.PATH_REJECTED_UNBREAKABLE, "unbreakable at the starting rail spot: correct message key");
}

{
  // Low clearance at the STARTING position: solid ground, clear rail spot,
  // but a ceiling exactly 1 block above — a player riding through would
  // clip into it. Tested at index 0 for the same reason as the unbreakable
  // case directly above (no ascend/tunnel fallback to potentially climb
  // past it first).
  const dim = createMockDimension({ groundY: 63, overrides: { "0,65,0": STONE } });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 5, dim);
  assertEqual(result.positions[0].classification, TerrainClassification.UNSUPPORTED, "low clearance at start: UNSUPPORTED");
  assertEqual(result.positions[0].unsupportedReason, "LOW_CLEARANCE", "low clearance at start: specific reason");
  const validation = pathValidator.validate(result);
  assertEqual(validation.reason, PathRejectionReason.LOW_CLEARANCE, "low clearance at start: LOW_CLEARANCE rejection");
  assertEqual(validation.localizationKey, LocalizationKeys.PATH_REJECTED_LOW_CLEARANCE, "low clearance at start: correct message key");
}

{
  // Low clearance with a HAZARD directly above (not unbreakable) — must be
  // classified HAZARD, the most conservative/safe classification, not a
  // generic clearance rejection.
  const dim = createMockDimension({ groundY: 63, overrides: { "2,65,0": { typeId: "minecraft:fire" } } });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 5, dim);
  assertEqual(result.positions[2].classification, TerrainClassification.HAZARD, "hazardous ceiling: classified HAZARD, not generic clearance");
}

{
  // Ordinary open sky above a flat rail must NOT be flagged as low
  // clearance — the new headroom check must never produce a false positive
  // on completely normal terrain (regression against the new Section 1 check).
  const dim = createMockDimension({ groundY: 63 });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 10, dim);
  assertTrue(result.buildReady, "open sky above flat rail: never falsely flagged as low clearance");
}

{
  // isExistingRail is exposed explicitly and accurately.
  const dim = createMockDimension({ groundY: 63, overrides: { "2,64,0": { typeId: "minecraft:activator_rail" } } });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 5, dim);
  assertTrue(result.positions[2].isExistingRail, "isExistingRail true at an existing rail position");
  assertEqual(result.positions[0].isExistingRail, false, "isExistingRail false at an ordinary flat position");
}

// ---------------------------------------------------------------------------
// RAILS: parallel, perpendicular, T-junction, all 4 types.
// ---------------------------------------------------------------------------

{
  // Parallel rail: an existing rail ONE block to the side of the path must
  // never be read at all — the scanner only ever inspects the path's own
  // column, so a parallel railway has zero effect on this build.
  const dim = createMockDimension({ groundY: 63, overrides: { "2,64,1": { typeId: "minecraft:rail" } } });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 5, dim);
  assertTrue(result.isFlat, "parallel rail one block to the side: completely unaffected");
  assertEqual(result.positions[2].isExistingRail, false, "parallel rail: not seen as an existing rail on THIS path");
}

for (const railTypeId of ["minecraft:rail", "minecraft:golden_rail", "minecraft:detector_rail", "minecraft:activator_rail"]) {
  // Perpendicular crossing / T-junction: an existing rail sitting exactly
  // ON the path is recognized and preserved regardless of its own type —
  // this addon never reads or depends on the existing rail's own shape
  // (rail_direction), only that it IS a rail, so a perpendicular crossing
  // and a T-junction are handled identically at the scanning layer (the
  // real difference between them is the pre-existing rail's own shape,
  // which this addon deliberately never disturbs — see RAIL_ITEM_ID_SET's
  // doc for why "leave it exactly as it is" is the safe choice for every
  // crossing geometry).
  const dim = createMockDimension({ groundY: 63, overrides: { "2,64,0": { typeId: railTypeId } } });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 5, dim);
  assertEqual(result.positions[2].classification, TerrainClassification.FLAT_SAFE, `crossing an existing ${railTypeId}: FLAT_SAFE (pass over)`);
  assertTrue(result.positions[2].isExistingRail, `crossing an existing ${railTypeId}: isExistingRail true`);
  assertTrue(result.buildReady, `crossing an existing ${railTypeId}: whole path still buildReady`);
}

{
  // Two generated railways meeting: simulate a second build's rail already
  // sitting at two consecutive positions along this path (as if a first
  // build already ran through here) — the whole path must still be
  // buildReady, preserving both existing positions.
  const dim = createMockDimension({
    groundY: 63,
    overrides: { "2,64,0": { typeId: "minecraft:rail" }, "3,64,0": { typeId: "minecraft:rail" } },
  });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 6, dim);
  assertTrue(result.buildReady, "two generated railways meeting (consecutive existing rails): buildReady");
  assertTrue(result.positions[2].isExistingRail && result.positions[3].isExistingRail, "both existing positions recognized");
}

// ---------------------------------------------------------------------------
// TRANSITIONS: Bridge/Underground start and end cleanly at the origin
// elevation (Sections 7, 8, 9) — verified via each mode's own internal
// consistency check, not a new one.
// ---------------------------------------------------------------------------

{
  const dim = createMockDimension({ groundY: 60 });
  const plan = scanner.planBridge(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 9, dim, 3);
  assertTrue(plan.feasible, "bridge transition: plan feasible");
  assertEqual(plan.deckPositions[0].position.y, 64, "bridge starts flat at the origin elevation");
  assertEqual(plan.deckPositions[plan.deckPositions.length - 1].position.y, 64, "bridge ends flat back at the origin elevation");
  assertEqual(plan.deckPositions[0].slopeDirection, null, "bridge's starting rail is flat, not sloped");
  assertTrue(new BridgeValidation().validate(plan).valid, "bridge transition: passes its own elevation-profile consistency check");

  // Project Prompt 25 §3/§4: direct regression proof that BOTH ends of the
  // bridge actually anchor to real ground, not just at the documented
  // "index 0 and index length-1 are always piers" claim — the deck here
  // (y=64) sits 4 blocks above natural ground (groundY=60), so a genuine
  // support column must exist reaching down toward it at both the starting
  // and ending column, or either end would be a floating bridge instead of
  // a clean transition from/to terrain.
  const startColumn = plan.supportPositions.filter((p) => p.x === plan.deckPositions[0].position.x && p.z === plan.deckPositions[0].position.z);
  const lastDeck = plan.deckPositions[plan.deckPositions.length - 1].position;
  const endColumn = plan.supportPositions.filter((p) => p.x === lastDeck.x && p.z === lastDeck.z);
  assertTrue(startColumn.length > 0, "bridge transition: the starting pier has a real support column reaching toward the ground");
  assertTrue(endColumn.length > 0, "bridge transition: the ending pier has a real support column reaching toward the ground, not a floating landing");
}

{
  const depth = 5;
  const originY = 70;
  const dim = createMockDimension({ groundY: 100 });
  const plan = scanner.planUnderground(createBuildVector({ x: 0, y: originY, z: 0 }, "east"), 8, dim, depth);
  assertTrue(plan.feasible, "underground transition: plan feasible");
  // The ramp's first position sits AT the surface elevation (originY) — it's
  // the position the descent begins FROM, sloped toward index 1, one block
  // lower. No sudden jump: the first physical drop is exactly 1 block, same
  // as every other ramp step. See UndergroundPlan.js's DESCENDING-RAMP
  // ENTRY STRATEGY doc.
  assertEqual(plan.railSteps[0].position.y, originY, "underground's first rail starts exactly at the surface elevation, no sudden jump");
  assertEqual(plan.railSteps[1].position.y, originY - 1, "underground's second position is exactly one block lower, a real ramp");
  assertEqual(plan.railSteps[0].slopeDirection !== null, true, "underground's first rail is sloped (descending), not a vertical shaft");
  assertTrue(new UndergroundValidation().validate(plan).valid, "underground transition: passes its own elevation-profile consistency check");
}

{
  // Project Prompt 25 §9/§11: direct regression proof for the historically
  // reported "tunnel ends in a one-block space the player can't pass
  // through" bug (bugfix pass before Project Prompt 18, ARCHITECTURE.md
  // §46.3) — no existing test asserted on `landingExcavationPositions` by
  // name before this session. With ordinary, breakable terrain past the
  // last requested rail, the terminal landing buffer must actually be
  // populated (a real landing pocket), not silently empty.
  const dim = createMockDimension({ groundY: 100 });
  const plan = scanner.planUnderground(createBuildVector({ x: 0, y: 70, z: 0 }, "east"), 8, dim, 5);
  assertTrue(plan.feasible, "underground exit: plan feasible");
  assertTrue(plan.landingExcavationPositions.length > 0, "underground exit: a real landing buffer is excavated past the last rail, not a flush wall");
  assertEqual(
    plan.landingExcavationPositions.length,
    plan.tunnelHeight,
    "underground exit: the landing buffer clears a full column, matching ordinary tunnel clearance"
  );
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
