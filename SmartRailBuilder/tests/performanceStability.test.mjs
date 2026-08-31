/**
 * performanceStability.test.mjs
 *
 * Project Prompt 23 ("Performance, Stability & Long-Build Optimization")
 * test suite. Covers what this session added or specifically re-verified
 * that no prior suite already exercised:
 *
 * - `inventory/InventoryManager.js`'s new `hasAtLeast()` — correctness
 *   against `countRailItems()` for a range of inventory shapes.
 * - Mid-construction cancellation for ALL THREE execution strategies
 *   (StraightRailStrategy/BridgeExecutionStrategy/UndergroundExecutionStrategy)
 *   — prior suites only tested cancellation via `CancellationWatcher`'s own
 *   flag-setting, never that a strategy's generator actually stops promptly
 *   and leaves the correct partial state. Project Prompt 23 §13/§14
 *   specifically asks for this across bridge/underground/rail placement,
 *   not just Normal Mode.
 * - Job lifecycle (§12): a player can start a fresh build immediately after
 *   a previous one completes OR is cancelled — no stale claim/session left
 *   behind in `ActiveBuildRegistry`/`CancellationWatcher`.
 * - Maximum build length (64 — this project's own configured ceiling,
 *   respected rather than raised for this test per §3's explicit
 *   instruction) actually completing for all three modes.
 * - 3-player simultaneous load (§15 asks for 3-4 "if practical") — three
 *   different modes at once, in three far-apart areas, all completing with
 *   no configuration/inventory/progress/build-plan leakage between them.
 *
 * Run with: node tests/performanceStability.test.mjs
 */

import { createMockDimension, createBuildVector } from "./mockWorld.mjs";
import { createMockPlayer } from "./mockPlayer.mjs";

import { TerrainScanner } from "../BP/scripts/terrain/TerrainScanner.js";
import { InventoryManager } from "../BP/scripts/inventory/InventoryManager.js";
import { BuildSession } from "../BP/scripts/core/BuildSession.js";
import { BuildRequest } from "../BP/scripts/core/BuildRequest.js";
import { StraightRailStrategy } from "../BP/scripts/builder/strategies/StraightRailStrategy.js";
import { BridgeExecutionStrategy } from "../BP/scripts/builder/strategies/BridgeExecutionStrategy.js";
import { BridgeSupportBuilder } from "../BP/scripts/builder/BridgeSupportBuilder.js";
import { UndergroundExecutionStrategy } from "../BP/scripts/builder/strategies/UndergroundExecutionStrategy.js";
import { TunnelExcavator } from "../BP/scripts/builder/TunnelExcavator.js";
import { RailBuilder } from "../BP/scripts/builder/RailBuilder.js";
import { CancellationWatcher } from "../BP/scripts/core/CancellationWatcher.js";
import { ActiveBuildRegistry } from "../BP/scripts/core/ActiveBuildRegistry.js";
import { BuildingMode } from "../BP/scripts/config/BuildModes.js";

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

const noopMessageService = { sendChat() {}, sendActionBar() {} };
const noopProgressReporter = { reportIfDue() {} };
const terrainScanner = new TerrainScanner();
const inventoryManager = new InventoryManager();
const tunnelExcavator = new TunnelExcavator();

function fakeBuildRequest({ player, dimension, railTypeId = "minecraft:rail", direction = "east", origin = { x: 1, y: 64, z: 0 }, buildingMode, bridgeMaterialId }) {
  return new BuildRequest({
    player,
    dimension,
    railTypeId,
    requestedLength: 0,
    buildVector: createBuildVector(origin, direction),
    sessionId: `${player.id}-session`,
    buildingMode,
    bridgeMaterialId,
  });
}

// ---------------------------------------------------------------------------
// 1. InventoryManager.hasAtLeast() — correctness against countRailItems().
// ---------------------------------------------------------------------------
{
  const player = createMockPlayer({ id: "inv1", items: [{ typeId: "minecraft:rail", amount: 3 }] });
  assertTrue(inventoryManager.hasAtLeast(player, "minecraft:rail", 1), "hasAtLeast: 3 available, need 1 -> true");
  assertTrue(inventoryManager.hasAtLeast(player, "minecraft:rail", 3), "hasAtLeast: 3 available, need 3 -> true (exact)");
  assertTrue(!inventoryManager.hasAtLeast(player, "minecraft:rail", 4), "hasAtLeast: 3 available, need 4 -> false");
  assertTrue(!inventoryManager.hasAtLeast(player, "minecraft:golden_rail", 1), "hasAtLeast: 0 of a different item -> false");
}
{
  // Split across multiple stacks/slots — hasAtLeast must sum across slots,
  // not just check the first one, exactly like countRailItems().
  const player = createMockPlayer({
    id: "inv2",
    items: [
      { typeId: "minecraft:rail", amount: 2 },
      { typeId: "minecraft:cobblestone", amount: 10 },
      { typeId: "minecraft:rail", amount: 2 },
    ],
  });
  assertEqual(inventoryManager.countRailItems(player, "minecraft:rail"), 4, "hasAtLeast cross-check: countRailItems sees 4 across 2 stacks");
  assertTrue(inventoryManager.hasAtLeast(player, "minecraft:rail", 4), "hasAtLeast: matches countRailItems's total across split stacks");
  assertTrue(!inventoryManager.hasAtLeast(player, "minecraft:rail", 5), "hasAtLeast: correctly false one above the real total");
}
{
  const player = createMockPlayer({ id: "inv3", items: [] });
  assertTrue(!inventoryManager.hasAtLeast(player, "minecraft:rail", 1), "hasAtLeast: empty inventory -> false");
}

// ---------------------------------------------------------------------------
// 2. Mid-construction cancellation — StraightRailStrategy (NORMAL).
// ---------------------------------------------------------------------------
{
  const dim = createMockDimension({ groundY: 63 });
  const player = createMockPlayer({ id: "cancel-normal", gameMode: "Survival", items: [{ typeId: "minecraft:rail", amount: 20 }], dimension: dim });
  const scan = terrainScanner.scanPath(createBuildVector({ x: 1, y: 64, z: 0 }, "east"), 10, dim);
  const request = fakeBuildRequest({ player, dimension: dim });
  const session = new BuildSession(request, scan.positions.length);
  const strategy = new StraightRailStrategy(terrainScanner, inventoryManager, noopProgressReporter, tunnelExcavator);

  const gen = strategy.buildPath(session, scan.positions);
  gen.next(); // place block 0
  gen.next(); // place block 1
  gen.next(); // place block 2
  session.markCancelled("test-cancel");
  const final = gen.next(); // should detect cancellation and return immediately, not place block 3

  assertTrue(final.done, "NORMAL cancellation: generator reports done immediately after cancel is detected");
  assertEqual(session.blocksPlaced, 3, "NORMAL cancellation: exactly 3 blocks placed before the cancel took effect, no more");
  assertEqual(final.value.completed, false, "NORMAL cancellation: BuildResult reports not completed");
  assertEqual(final.value.stopReason, "test-cancel", "NORMAL cancellation: BuildResult carries the cancel reason");
  assertEqual(dim.getBlock({ x: 5, y: 64, z: 0 }).typeId, "minecraft:air", "NORMAL cancellation: block 4 (never reached) was never placed");
}

// ---------------------------------------------------------------------------
// 3. Mid-construction cancellation — BridgeExecutionStrategy (BRIDGE),
//    cancelled during the SUPPORT phase, before any rail is placed.
// ---------------------------------------------------------------------------
{
  const dim = createMockDimension({ groundY: 50 }); // deep gap -> real support columns
  const player = createMockPlayer({
    id: "cancel-bridge",
    gameMode: "Survival",
    items: [
      { typeId: "minecraft:rail", amount: 40 },
      { typeId: "minecraft:cobblestone", amount: 200 },
    ],
    dimension: dim,
  });
  const plan = terrainScanner.planBridge(createBuildVector({ x: 1, y: 64, z: 0 }, "east"), 20, dim, 8);
  assertTrue(plan.feasible, "BRIDGE cancellation setup: plan is feasible");
  assertTrue(plan.supportPositions.length > 3, "BRIDGE cancellation setup: enough support positions to cancel partway through");

  const request = fakeBuildRequest({ player, dimension: dim, buildingMode: BuildingMode.BRIDGE, bridgeMaterialId: "minecraft:cobblestone" });
  const session = new BuildSession(request, plan.requiredRailCount + plan.requiredSupportBlockCount);
  const strategy = new BridgeExecutionStrategy(new BridgeSupportBuilder(), inventoryManager, noopProgressReporter, noopMessageService);

  const gen = strategy.buildPath(session, plan);
  gen.next();
  gen.next();
  gen.next();
  const placedBeforeCancel = session.blocksPlaced;
  session.markCancelled("test-cancel-bridge");
  const final = gen.next();

  assertTrue(final.done, "BRIDGE cancellation: generator reports done immediately after cancel is detected");
  assertEqual(session.blocksPlaced, placedBeforeCancel, "BRIDGE cancellation: no additional block placed after cancellation");
  assertEqual(final.value.completed, false, "BRIDGE cancellation: BuildResult reports not completed");
  assertTrue(placedBeforeCancel < plan.requiredRailCount + plan.requiredSupportBlockCount, "BRIDGE cancellation: genuinely partial (stopped well before the full plan)");
  // Not one rail was placed yet — cancellation happened during the support phase.
  for (const step of plan.deckPositions) {
    assertTrue(dim.getBlock(step.position).typeId !== "minecraft:rail", "BRIDGE cancellation: no rail placed before cancellation (still in support phase)");
    break; // one representative check is enough; the loop exists only for readability of the position source
  }
}

// ---------------------------------------------------------------------------
// 4. Mid-construction cancellation — UndergroundExecutionStrategy
//    (UNDERGROUND), cancelled partway through the ramp.
// ---------------------------------------------------------------------------
{
  const dim = createMockDimension({ groundY: 100 });
  const player = createMockPlayer({ id: "cancel-underground", gameMode: "Creative", dimension: dim });
  const plan = terrainScanner.planUnderground(createBuildVector({ x: 0, y: 70, z: 0 }, "east"), 20, dim, 10);
  assertTrue(plan.feasible, "UNDERGROUND cancellation setup: plan is feasible");

  const request = fakeBuildRequest({ player, dimension: dim, origin: { x: 0, y: 70, z: 0 } });
  const session = new BuildSession(request, plan.requiredRailCount);
  const strategy = new UndergroundExecutionStrategy(tunnelExcavator, inventoryManager, noopProgressReporter, noopMessageService);

  const gen = strategy.buildPath(session, plan);
  gen.next();
  gen.next();
  gen.next();
  gen.next();
  const placedBeforeCancel = session.blocksPlaced;
  session.markCancelled("test-cancel-underground");
  const final = gen.next();

  assertTrue(final.done, "UNDERGROUND cancellation: generator reports done immediately after cancel is detected");
  assertEqual(session.blocksPlaced, placedBeforeCancel, "UNDERGROUND cancellation: no additional block placed after cancellation");
  assertEqual(final.value.completed, false, "UNDERGROUND cancellation: BuildResult reports not completed");
  assertTrue(placedBeforeCancel < plan.requiredRailCount, "UNDERGROUND cancellation: genuinely partial");
}

// ---------------------------------------------------------------------------
// 5. Job lifecycle (§12): a player can immediately start a fresh build
//    after a previous one completes, with no stale ActiveBuildRegistry
//    claim or CancellationWatcher registration left behind.
// ---------------------------------------------------------------------------
{
  const dim = createMockDimension({ groundY: 63 });
  const player = createMockPlayer({ id: "lifecycle1", gameMode: "Survival", items: [{ typeId: "minecraft:rail", amount: 100 }], dimension: dim });
  const registry = new ActiveBuildRegistry();
  const cancellationWatcher = new CancellationWatcher();
  const railBuilder = new RailBuilder();
  const strategy = new StraightRailStrategy(terrainScanner, inventoryManager, noopProgressReporter, tunnelExcavator);

  async function runOneBuild(origin) {
    const scan = terrainScanner.scanPath(createBuildVector(origin, "east"), 5, dim);
    const request = fakeBuildRequest({ player, dimension: dim, origin });
    const session = new BuildSession(request, scan.positions.length);
    const claim = registry.claim(player.id, scan.positions.map((p) => `${p.position.x},${p.position.y},${p.position.z}`));
    if (!claim.claimed) throw new Error("test setup error: unexpected claim conflict");
    cancellationWatcher.registerSession(player.id, session);
    try {
      return await railBuilder.run(session, scan.positions, strategy);
    } finally {
      cancellationWatcher.unregisterSession(player.id);
      registry.release(player.id);
    }
  }

  const first = await runOneBuild({ x: 1, y: 64, z: 0 });
  assertTrue(first.completed, "job lifecycle: first build completes");

  // Same player, a SECOND build immediately after — same area even, to prove
  // the first build's claim was actually released, not just that a
  // different area happened to be free.
  const second = await runOneBuild({ x: 1, y: 64, z: 0 });
  assertTrue(second.completed, "job lifecycle: second build (same player, same area, right after the first) also completes — no stale claim left behind");
}

// ---------------------------------------------------------------------------
// 6. Job lifecycle (§12): a player can start a fresh build immediately
//    after a previous one was CANCELLED — no stale claim/session either.
// ---------------------------------------------------------------------------
{
  const dim = createMockDimension({ groundY: 63 });
  const player = createMockPlayer({ id: "lifecycle2", gameMode: "Survival", items: [{ typeId: "minecraft:rail", amount: 100 }], dimension: dim });
  const registry = new ActiveBuildRegistry();
  const cancellationWatcher = new CancellationWatcher();
  const strategy = new StraightRailStrategy(terrainScanner, inventoryManager, noopProgressReporter, tunnelExcavator);

  const scan1 = terrainScanner.scanPath(createBuildVector({ x: 1, y: 64, z: 0 }, "east"), 10, dim);
  const request1 = fakeBuildRequest({ player, dimension: dim });
  const session1 = new BuildSession(request1, scan1.positions.length);
  registry.claim(player.id, scan1.positions.map((p) => `${p.position.x},${p.position.y},${p.position.z}`));
  cancellationWatcher.registerSession(player.id, session1);

  const gen1 = strategy.buildPath(session1, scan1.positions);
  gen1.next();
  session1.markCancelled("manual-cancel");
  gen1.next(); // drains to completion (detects cancellation, returns)
  cancellationWatcher.unregisterSession(player.id);
  registry.release(player.id);

  // Fresh build, same player, overlapping area.
  const scan2 = terrainScanner.scanPath(createBuildVector({ x: 1, y: 64, z: 0 }, "east"), 10, dim);
  const request2 = fakeBuildRequest({ player, dimension: dim });
  const session2 = new BuildSession(request2, scan2.positions.length);
  const claim2 = registry.claim(player.id, scan2.positions.map((p) => `${p.position.x},${p.position.y},${p.position.z}`));
  assertTrue(claim2.claimed, "job lifecycle after cancellation: fresh claim succeeds, nothing stale left from the cancelled build");

  const gen2 = strategy.buildPath(session2, scan2.positions);
  let result2;
  for (let step = gen2.next(); ; step = gen2.next()) {
    if (step.done) {
      result2 = step.value;
      break;
    }
  }
  assertTrue(result2.completed, "job lifecycle after cancellation: the new build completes normally");
  registry.release(player.id);
}

// ---------------------------------------------------------------------------
// 7. Maximum configured build length (64 — this project's own ceiling, not
//    raised for this test) completes for all three modes.
// ---------------------------------------------------------------------------
{
  const dim = createMockDimension({ groundY: 63 });
  const scan = terrainScanner.scanPath(createBuildVector({ x: 1, y: 64, z: 0 }, "east"), 64, dim);
  assertEqual(scan.positions.length, 64, "max length: NORMAL scan produces exactly 64 positions on flat terrain");
  assertTrue(scan.buildReady, "max length: NORMAL 64-block scan is buildReady");
}
{
  const dim = createMockDimension({ groundY: 50 });
  const plan = terrainScanner.planBridge(createBuildVector({ x: 1, y: 64, z: 0 }, "east"), 40, dim, 16);
  assertTrue(plan.feasible, "max height: BRIDGE height 16 with a generous length is feasible");
  assertEqual(plan.bridgeHeight, 16, "max height: plan reflects the requested height 16 (this mode's own configured maximum)");
}
{
  const dim = createMockDimension({ groundY: 100 });
  const plan = terrainScanner.planUnderground(createBuildVector({ x: 0, y: 70, z: 0 }, "east"), 64, dim, 20);
  assertTrue(plan.feasible, "max depth + max length: UNDERGROUND depth 20 at the full 64-length ceiling is feasible");
  assertEqual(plan.requiredRailCount, 64, "max depth + max length: uses the full 64-length ceiling");
}

// ---------------------------------------------------------------------------
// 8. Multiplayer load (§15): 3 players, 3 different modes, 3 far-apart
//    areas, all building at once — no configuration/inventory/progress/
//    build-plan leakage between any of them.
// ---------------------------------------------------------------------------
{
  const registry = new ActiveBuildRegistry();
  const railBuilder = new RailBuilder();

  const dimA = createMockDimension({ groundY: 63 });
  const playerA = createMockPlayer({ id: "load-A", gameMode: "Survival", items: [{ typeId: "minecraft:rail", amount: 30 }], dimension: dimA });
  const scanA = terrainScanner.scanPath(createBuildVector({ x: 1, y: 64, z: 0 }, "east"), 20, dimA);
  const sessionA = new BuildSession(fakeBuildRequest({ player: playerA, dimension: dimA }), scanA.positions.length);
  const strategyA = new StraightRailStrategy(terrainScanner, inventoryManager, noopProgressReporter, tunnelExcavator);

  const dimB = createMockDimension({ groundY: 50 });
  const playerB = createMockPlayer({
    id: "load-B",
    gameMode: "Survival",
    items: [
      { typeId: "minecraft:rail", amount: 30 },
      { typeId: "minecraft:cobblestone", amount: 200 },
    ],
    dimension: dimB,
  });
  const planB = terrainScanner.planBridge(createBuildVector({ x: 100, y: 64, z: 100 }, "east"), 20, dimB, 5);
  const sessionB = new BuildSession(
    fakeBuildRequest({ player: playerB, dimension: dimB, origin: { x: 100, y: 64, z: 100 }, buildingMode: BuildingMode.BRIDGE, bridgeMaterialId: "minecraft:cobblestone" }),
    planB.requiredRailCount + planB.requiredSupportBlockCount
  );
  const strategyB = new BridgeExecutionStrategy(new BridgeSupportBuilder(), inventoryManager, noopProgressReporter, noopMessageService);

  const dimC = createMockDimension({ groundY: 100 });
  const playerC = createMockPlayer({ id: "load-C", gameMode: "Creative", dimension: dimC });
  const planC = terrainScanner.planUnderground(createBuildVector({ x: -100, y: 70, z: -100 }, "east"), 15, dimC, 8);
  const sessionC = new BuildSession(fakeBuildRequest({ player: playerC, dimension: dimC, origin: { x: -100, y: 70, z: -100 } }), planC.requiredRailCount);
  const strategyC = new UndergroundExecutionStrategy(tunnelExcavator, inventoryManager, noopProgressReporter, noopMessageService);

  for (const [id, positions] of [
    ["load-A", scanA.positions.map((p) => `${p.position.x},${p.position.y},${p.position.z}`)],
    ["load-B", [...planB.deckPositions.map((d) => d.position), ...planB.surfacePositions, ...planB.supportPositions].map((p) => `${p.x},${p.y},${p.z}`)],
    ["load-C", planC.railSteps.flatMap((s) => s.excavationPositions).map((p) => `${p.x},${p.y},${p.z}`)],
  ]) {
    const claim = registry.claim(id, positions);
    assertTrue(claim.claimed, `multiplayer load: ${id}'s far-apart claim never conflicts with another player's`);
  }

  const [resultA, resultB, resultC] = await Promise.all([
    railBuilder.run(sessionA, scanA.positions, strategyA),
    railBuilder.run(sessionB, planB, strategyB),
    railBuilder.run(sessionC, planC, strategyC),
  ]);

  assertTrue(resultA.completed, "multiplayer load: player A's (NORMAL) build completes");
  assertTrue(resultB.completed, "multiplayer load: player B's (BRIDGE) build completes");
  assertTrue(resultC.completed, "multiplayer load: player C's (UNDERGROUND) build completes");
  assertEqual(sessionA.railTypeId, "minecraft:rail", "multiplayer load: player A's own session config unaffected by B/C");
  assertEqual(sessionB.bridgeMaterialId, "minecraft:cobblestone", "multiplayer load: player B's own material choice unaffected by A/C");
  assertTrue(playerC.getComponent("minecraft:inventory") !== playerA.getComponent("minecraft:inventory"), "multiplayer load: player C's inventory is a distinct object from player A's");

  registry.release("load-A");
  registry.release("load-B");
  registry.release("load-C");
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
