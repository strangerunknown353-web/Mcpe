/**
 * directionCoverage.test.mjs
 *
 * Project Prompt 26 ("Final Feature Integration & Advanced Railway
 * Behavior") §3 test suite — "Direction Reliability... Verify all four
 * horizontal directions... Test: Normal, Bridge, Underground."
 *
 * Auditing the existing suites found a real, previously-unnoticed gap:
 * essentially every terrain/bridge/underground test in this project (over
 * 300 assertions, across every prior session) exercises EAST only. NORTH
 * appears exactly once (a single bare permutation lookup); SOUTH and WEST
 * do not appear at all outside `RailPermutationBuilder`'s own straight-rail
 * test. This is exactly the kind of blind spot Project Prompt 26 asks to
 * close before Prompt 27's stabilization pass: a directional asymmetry bug
 * (a sign error specific to one axis, an ascending `rail_direction` value
 * that was only ever guessed — see RailPermutationBuilder.js's own "HIGHEST-
 * RISK ASSUMPTION" doc) could exist in NORTH/SOUTH/WEST and never be caught
 * by a suite that only ever travels EAST.
 *
 * This file re-runs the same already-proven-correct scenarios for all four
 * cardinal directions, computing EXPECTED coordinates from `DirectionUtils`
 * itself rather than hardcoding numbers that could share the same mistake.
 *
 * Run with: node tests/directionCoverage.test.mjs
 */

import { createMockDimension, createBuildVector } from "./mockWorld.mjs";
import { TerrainScanner, TerrainClassification } from "../BP/scripts/terrain/TerrainScanner.js";
import { buildAscendingRailPermutation } from "../BP/scripts/builder/RailPermutationBuilder.js";
import { DirectionUtils, CardinalDirection } from "../BP/scripts/utils/DirectionUtils.js";

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
const ALL_DIRECTIONS = [CardinalDirection.NORTH, CardinalDirection.SOUTH, CardinalDirection.EAST, CardinalDirection.WEST];

/** Expected {x,z} after `distance` steps from `origin`, per DirectionUtils itself. */
function expectedHorizontal(origin, direction, distance) {
  const step = DirectionUtils.toStepVector(direction);
  return { x: origin.x + step.x * distance, z: origin.z + step.z * distance };
}

// ---------------------------------------------------------------------------
// 1. buildAscendingRailPermutation: the "highest-risk unconfirmed
//    assumption" rail_direction mapping, for the 3 directions the existing
//    suite never checked (only NORTH was previously tested).
// ---------------------------------------------------------------------------
{
  const EXPECTED_ASCENDING_RAIL_DIRECTION = {
    [CardinalDirection.EAST]: 2,
    [CardinalDirection.WEST]: 3,
    [CardinalDirection.NORTH]: 4,
    [CardinalDirection.SOUTH]: 5,
  };
  for (const direction of ALL_DIRECTIONS) {
    const permutation = buildAscendingRailPermutation("minecraft:rail", direction);
    assertEqual(
      permutation.states.rail_direction,
      EXPECTED_ASCENDING_RAIL_DIRECTION[direction],
      `ascending rail_direction for ${direction} matches the documented mapping`
    );
  }
}

// ---------------------------------------------------------------------------
// 2. NORMAL Mode: flat terrain scan, all 4 directions. Confirms the scan
//    walks the correct axis for every direction, not just EAST — a
//    NORTH/SOUTH-only bug (or vice versa) would show up as a wrong end
//    coordinate here.
// ---------------------------------------------------------------------------
for (const direction of ALL_DIRECTIONS) {
  const dim = createMockDimension({ groundY: 63 });
  const origin = { x: 0, y: 64, z: 0 };
  const result = scanner.scanPath(createBuildVector(origin, direction), 6, dim);

  assertTrue(result.buildReady, `NORMAL flat terrain (${direction}): buildReady`);
  assertTrue(result.isFlat, `NORMAL flat terrain (${direction}): isFlat`);
  const expectedEnd = expectedHorizontal(origin, direction, 5);
  assertEqual(
    { x: result.positions[5].position.x, z: result.positions[5].position.z },
    expectedEnd,
    `NORMAL flat terrain (${direction}): end position walks the correct axis/sign`
  );
  assertEqual(result.positions[5].position.y, 64, `NORMAL flat terrain (${direction}): elevation unchanged on flat ground`);
}

// ---------------------------------------------------------------------------
// 3. NORMAL Mode: one-block rise, all 4 directions — proves slope
//    resolution (and the ascending permutation direction feeding into it)
//    is correct regardless of which axis the railway travels along.
// ---------------------------------------------------------------------------
for (const direction of ALL_DIRECTIONS) {
  const dim = createMockDimension({ groundY: 63 });
  const origin = { x: 0, y: 64, z: 0 };
  const bumpPosition = expectedHorizontal(origin, direction, 3);
  const dimWithHill = createMockDimension({ groundY: 63, overrides: { [`${bumpPosition.x},64,${bumpPosition.z}`]: { typeId: "minecraft:stone" } } });
  const result = scanner.scanPath(createBuildVector(origin, direction), 5, dimWithHill);

  assertEqual(result.positions[3].classification, TerrainClassification.ASCENDING, `NORMAL one-block rise (${direction}): correctly detected regardless of travel axis`);
  assertTrue(result.buildReady, `NORMAL one-block rise (${direction}): still buildReady`);
}

// ---------------------------------------------------------------------------
// 4. BRIDGE Mode: all 4 directions, same height/length already proven
//    correct for EAST — confirms feasibility and end-position math hold
//    for every direction, and both endpoints still anchor to the ground.
// ---------------------------------------------------------------------------
for (const direction of ALL_DIRECTIONS) {
  const dim = createMockDimension({ groundY: 60 });
  const origin = { x: 0, y: 64, z: 0 };
  const plan = scanner.planBridge(createBuildVector(origin, direction), 9, dim, 3);

  assertTrue(plan.feasible, `BRIDGE (${direction}): plan feasible`);
  assertEqual(plan.deckPositions[0].position.y, 64, `BRIDGE (${direction}): starts flat at the origin elevation`);
  assertEqual(plan.deckPositions[plan.deckPositions.length - 1].position.y, 64, `BRIDGE (${direction}): ends flat back at the origin elevation`);
  const expectedEnd = expectedHorizontal(origin, direction, 8);
  const actualEnd = plan.deckPositions[plan.deckPositions.length - 1].position;
  assertEqual({ x: actualEnd.x, z: actualEnd.z }, expectedEnd, `BRIDGE (${direction}): end position walks the correct axis/sign`);

  const startColumn = plan.supportPositions.filter((p) => p.x === plan.deckPositions[0].position.x && p.z === plan.deckPositions[0].position.z);
  const endColumn = plan.supportPositions.filter((p) => p.x === actualEnd.x && p.z === actualEnd.z);
  assertTrue(startColumn.length > 0, `BRIDGE (${direction}): starting pier anchors to real ground`);
  assertTrue(endColumn.length > 0, `BRIDGE (${direction}): ending pier anchors to real ground`);
}

// ---------------------------------------------------------------------------
// 5. UNDERGROUND Mode: all 4 directions — confirms feasibility, correct end
//    position, and that each ramp step's slopeDirection is the OPPOSITE of
//    travel (per rampSlopeDirection's own documented rule) for every
//    direction, not just the one this project always happened to test.
// ---------------------------------------------------------------------------
for (const direction of ALL_DIRECTIONS) {
  const dim = createMockDimension({ groundY: 100 });
  const origin = { x: 0, y: 70, z: 0 };
  const plan = scanner.planUnderground(createBuildVector(origin, direction), 8, dim, 3);

  assertTrue(plan.feasible, `UNDERGROUND (${direction}): plan feasible`);
  const expectedEnd = expectedHorizontal(origin, direction, 7);
  const actualEnd = plan.railSteps[plan.railSteps.length - 1].position;
  assertEqual({ x: actualEnd.x, z: actualEnd.z }, expectedEnd, `UNDERGROUND (${direction}): end position walks the correct axis/sign`);
  assertEqual(
    plan.railSteps[0].slopeDirection,
    DirectionUtils.opposite(direction),
    `UNDERGROUND (${direction}): ramp slope direction is the opposite of travel, matching the documented rule`
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
