/**
 * structureProtection.test.mjs
 *
 * Project Prompt 24 ("Advanced Railway Routing & Terrain Intelligence") §11
 * test suite — the new player-structure protection
 * (`config/UnbreakableBlockRegistry.js`'s `PROTECTED_STRUCTURE_BLOCK_IDS`,
 * unioned into the same `UNBREAKABLE_BLOCK_ID_SET` every mode's routing
 * already treats as "never plan to break this, reject the route instead").
 * Proves the addon never silently destroys a chest/door/etc. in any of the
 * three modes, and never offers one as bridge material.
 *
 * Run with: node tests/structureProtection.test.mjs
 */

import { createMockDimension, createBuildVector } from "./mockWorld.mjs";
import { createMockPlayer } from "./mockPlayer.mjs";
import { TerrainScanner, TerrainClassification } from "../BP/scripts/terrain/TerrainScanner.js";
import { PathValidator, PathRejectionReason } from "../BP/scripts/terrain/PathValidator.js";
import { InventoryManager } from "../BP/scripts/inventory/InventoryManager.js";
import { BridgeRejectionReason } from "../BP/scripts/terrain/BridgePlan.js";
import { UndergroundRejectionReason } from "../BP/scripts/terrain/UndergroundPlan.js";

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
const CHEST = { typeId: "minecraft:chest" };

// ---------------------------------------------------------------------------
// 1. NORMAL Mode: a chest at the starting rail's own spot is never
//    overwritten — the route is rejected instead, same mechanism already
//    proven for bedrock (Project Prompt 19).
// ---------------------------------------------------------------------------
{
  const dim = createMockDimension({ groundY: 63, overrides: { "0,64,0": CHEST } });
  const result = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 5, dim);
  const validation = pathValidator.validate(result);

  assertEqual(result.positions[0].classification, TerrainClassification.UNSUPPORTED, "NORMAL: chest at the rail's own spot is UNSUPPORTED, not silently buildable");
  assertEqual(result.positions[0].unsupportedReason, "UNBREAKABLE", "NORMAL: reason is the same UNBREAKABLE path a truly indestructible block gets");
  assertTrue(!validation.valid, "NORMAL: the route is rejected");
  assertEqual(validation.reason, PathRejectionReason.UNBREAKABLE_BLOCK, "NORMAL: rejected with UNBREAKABLE_BLOCK, not a generic 'too steep'");
  assertEqual(dim.getBlock({ x: 0, y: 64, z: 0 }).typeId, "minecraft:chest", "NORMAL: the chest itself is untouched — still there, never overwritten");
}

// ---------------------------------------------------------------------------
// 2. UNDERGROUND Mode: a chest inside the planned excavation volume makes
//    the plan infeasible and names the exact block, rather than silently
//    excavating through it.
// ---------------------------------------------------------------------------
{
  // Depth 3 means the ramp descends through y=63,62,61 at increasing
  // distance — placing the chest at the first ramp step's excavation
  // volume (one above the rail spot, which is part of every row's
  // clearance) guarantees it's actually in the plan's own volume.
  const dim = createMockDimension({ groundY: 100, overrides: { "1,99,0": CHEST } });
  const plan = scanner.planUnderground(createBuildVector({ x: 0, y: 100, z: 0 }, "east"), 10, dim, 3);

  assertTrue(!plan.feasible, "UNDERGROUND: a chest in the excavation volume makes the plan infeasible");
  assertEqual(plan.rejectionReason, UndergroundRejectionReason.BLOCKED_BY_UNBREAKABLE, "UNDERGROUND: rejection reason names the protection mechanism");
  assertEqual(plan.blockingBlockId, "minecraft:chest", "UNDERGROUND: the exact blocking block is named, not hidden behind a generic message");
  assertEqual(dim.getBlock({ x: 1, y: 99, z: 0 }).typeId, "minecraft:chest", "UNDERGROUND: the chest is untouched — planning never excavates before validation passes");
}

// ---------------------------------------------------------------------------
// 3. BRIDGE Mode: a chest sitting directly on the deck's own flat starting
//    position (index 0, always flat at the origin elevation — see
//    BridgePlan.js's ELEVATION PROFILE doc) makes the plan infeasible rather
//    than silently burying it under a rail.
// ---------------------------------------------------------------------------
{
  const dim = createMockDimension({ groundY: 50, overrides: { "1,54,0": CHEST } });
  const plan = scanner.planBridge(createBuildVector({ x: 1, y: 54, z: 0 }, "east"), 20, dim, 4);

  assertTrue(!plan.feasible, "BRIDGE: a chest sitting on the deck's own position makes the plan infeasible");
  assertEqual(plan.rejectionReason, BridgeRejectionReason.BLOCKED_BY_UNBREAKABLE, "BRIDGE: rejection reason names the protection mechanism");
  assertEqual(dim.getBlock({ x: 1, y: 54, z: 0 }).typeId, "minecraft:chest", "BRIDGE: the chest is untouched — planning never places material before validation passes");
}

// ---------------------------------------------------------------------------
// 4. Bridge material selection never offers a chest, even if the player is
//    holding one — building a bridge deck out of chests makes no sense, and
//    it's now excluded the same way bedrock/lava already were.
// ---------------------------------------------------------------------------
{
  const inventoryManager = new InventoryManager();
  const player = createMockPlayer({
    id: "structest",
    items: [
      { typeId: "minecraft:chest", amount: 5 },
      { typeId: "minecraft:cobblestone", amount: 20 },
    ],
  });
  const materials = inventoryManager.scanPlaceableMaterials(player);
  const materialIds = materials.map((m) => m.typeId);

  assertTrue(!materialIds.includes("minecraft:chest"), "material scan: a held chest is never offered as bridge material");
  assertTrue(materialIds.includes("minecraft:cobblestone"), "material scan: an ordinary block is still offered normally");
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
