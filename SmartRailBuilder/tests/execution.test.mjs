/**
 * execution.test.mjs
 *
 * Project Prompt 19 ("Smart Terrain Adaptation & Rail Connectivity") test
 * suite — the EXECUTION-side counterpart to tests/water.test.mjs (which only
 * covers planning). Unlocked by the new `node_modules/@minecraft/server`
 * mock (see that package's own header) and tests/mockPlayer.mjs — together
 * these let every class that reads/writes a live Player or places a block
 * run against plain Node for the first time. See tests/README.md.
 *
 * Run with: node tests/execution.test.mjs
 */

import { createMockDimension, createBuildVector, STONE, WATER_SOURCE } from "./mockWorld.mjs";
import { createMockPlayer } from "./mockPlayer.mjs";
import { TerrainScanner, TerrainClassification } from "../BP/scripts/terrain/TerrainScanner.js";
import { StraightRailStrategy } from "../BP/scripts/builder/strategies/StraightRailStrategy.js";
import { BridgeExecutionStrategy } from "../BP/scripts/builder/strategies/BridgeExecutionStrategy.js";
import { UndergroundExecutionStrategy } from "../BP/scripts/builder/strategies/UndergroundExecutionStrategy.js";
import { TunnelExcavator } from "../BP/scripts/builder/TunnelExcavator.js";
import { BridgeSupportBuilder } from "../BP/scripts/builder/BridgeSupportBuilder.js";
import { RailBuilder } from "../BP/scripts/builder/RailBuilder.js";
import { buildStraightRailPermutation, buildAscendingRailPermutation } from "../BP/scripts/builder/RailPermutationBuilder.js";
import { BuildSession } from "../BP/scripts/core/BuildSession.js";
import { CancellationWatcher } from "../BP/scripts/core/CancellationWatcher.js";
import { InventoryManager } from "../BP/scripts/inventory/InventoryManager.js";
import { ResourceValidator } from "../BP/scripts/inventory/ResourceValidator.js";
import { CardinalDirection } from "../BP/scripts/utils/DirectionUtils.js";

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

function fakeBuildRequest({ player, dimension, railTypeId = "minecraft:rail", direction = "east", bridgeMaterialId }) {
  return { player, dimension, railTypeId, buildVector: { direction }, bridgeMaterialId, sessionId: `${player.id}-session` };
}

// ---------------------------------------------------------------------------
// 1. RailPermutationBuilder: starting-rail direction correctness (Section 7)
// ---------------------------------------------------------------------------

for (const [direction, expectedRailDirection] of [
  [CardinalDirection.NORTH, 0],
  [CardinalDirection.SOUTH, 0],
  [CardinalDirection.EAST, 1],
  [CardinalDirection.WEST, 1],
]) {
  const permutation = buildStraightRailPermutation("minecraft:rail", direction);
  assertEqual(permutation.states.rail_direction, expectedRailDirection, `straight rail direction for ${direction}`);
}
{
  // Powered rail types carry rail_data_bit: false — never auto-powered.
  const permutation = buildStraightRailPermutation("minecraft:golden_rail", CardinalDirection.EAST);
  assertEqual(permutation.states, { rail_direction: 1, rail_data_bit: false }, "powered rail carries rail_data_bit: false");
}
{
  const permutation = buildAscendingRailPermutation("minecraft:rail", CardinalDirection.NORTH);
  assertEqual(permutation.states.rail_direction, 4, "ascending rail direction for north");
}

// ---------------------------------------------------------------------------
// 2. StraightRailStrategy: starting rail, ending rail, existing-rail
//    preservation (intersection protection), Survival deduction (Sections
//    4, 5, 7, 8, 10).
// ---------------------------------------------------------------------------

{
  const dim = createMockDimension({
    groundY: 63,
    overrides: { "2,64,0": { typeId: "minecraft:rail" } }, // an existing rail crossing the path
  });
  const scanner = new TerrainScanner();
  const buildVector = createBuildVector({ x: 0, y: 64, z: 0 }, "east");
  const report = scanner.scanPath(buildVector, 5, dim);
  assertTrue(report.buildReady, "existing-rail-crossing path is buildReady");

  const player = createMockPlayer({ id: "p1", gameMode: "Survival", items: [{ typeId: "minecraft:rail", amount: 10 }] });
  const request = fakeBuildRequest({ player, dimension: dim, direction: "east" });
  const session = new BuildSession(request, report.positions.length);

  const inventoryManager = new InventoryManager();
  const strategy = new StraightRailStrategy(scanner, inventoryManager, noopProgressReporter, new TunnelExcavator());

  const generator = strategy.buildPath(session, report.positions);
  let result = generator.next();
  while (!result.done) result = generator.next();
  const buildResult = result.value;

  assertTrue(buildResult.completed, "existing-rail-crossing build completes");
  assertEqual(buildResult.blocksPlaced, 5, "existing-rail-crossing counts the crossed position toward progress");
  assertEqual(inventoryManager.countRailItems(player, "minecraft:rail"), 10 - 4, "existing rail position was NOT deducted from inventory");

  // Starting rail: index 0's actual placed block reflects the travel direction, not disturbed by anything.
  const startBlock = dim.getBlock({ x: 0, y: 64, z: 0 });
  assertEqual(startBlock.permutation.getState("rail_direction"), 1, "starting rail placed with the correct (east/west) direction");

  // Ending rail: last position placed cleanly, correct direction, no obstruction.
  const endBlock = dim.getBlock({ x: 4, y: 64, z: 0 });
  assertEqual(endBlock.typeId, "minecraft:rail", "ending rail placed");
  assertEqual(endBlock.permutation.getState("rail_direction"), 1, "ending rail has the correct direction, not rotated unexpectedly");

  // The existing rail itself must be completely untouched (still exactly what it was).
  const crossedBlock = dim.getBlock({ x: 2, y: 64, z: 0 });
  assertEqual(crossedBlock.typeId, "minecraft:rail", "existing rail crossing survives untouched");
}

{
  // Different rail types crossing: an existing DETECTOR rail must survive a new (plain) rail build too.
  const dim = createMockDimension({ groundY: 63, overrides: { "2,64,0": { typeId: "minecraft:detector_rail" } } });
  const scanner = new TerrainScanner();
  const buildVector = createBuildVector({ x: 0, y: 64, z: 0 }, "east");
  const report = scanner.scanPath(buildVector, 5, dim);
  const player = createMockPlayer({ id: "p1", gameMode: "Creative" });
  const request = fakeBuildRequest({ player, dimension: dim });
  const session = new BuildSession(request, report.positions.length);
  const strategy = new StraightRailStrategy(scanner, new InventoryManager(), noopProgressReporter, new TunnelExcavator());
  const generator = strategy.buildPath(session, report.positions);
  let result = generator.next();
  while (!result.done) result = generator.next();

  assertTrue(result.value.completed, "crossing a different rail type still completes");
  assertEqual(dim.getBlock({ x: 2, y: 64, z: 0 }).typeId, "minecraft:detector_rail", "existing detector rail preserved across a different-type crossing");
}

// ---------------------------------------------------------------------------
// 3. StraightRailStrategy: one-block slopes place the correct sloped
//    permutation (Section 2).
// ---------------------------------------------------------------------------

{
  // Ground steps up by 1 at index 2 (a solid block sitting at rail height forces the ascend fallback).
  const dim = createMockDimension({ groundY: 63, overrides: { "2,64,0": STONE } });
  const scanner = new TerrainScanner();
  const buildVector = createBuildVector({ x: 0, y: 64, z: 0 }, "east");
  const report = scanner.scanPath(buildVector, 5, dim);
  assertEqual(report.positions[2].classification, TerrainClassification.ASCENDING, "slope test: position 2 resolves ASCENDING");

  const player = createMockPlayer({ id: "p1", gameMode: "Creative" });
  const request = fakeBuildRequest({ player, dimension: dim });
  const session = new BuildSession(request, report.positions.length);
  const strategy = new StraightRailStrategy(scanner, new InventoryManager(), noopProgressReporter, new TunnelExcavator());
  const generator = strategy.buildPath(session, report.positions);
  let result = generator.next();
  while (!result.done) result = generator.next();

  assertTrue(result.value.completed, "slope build completes");
  const slopedBlock = dim.getBlock({ x: 2, y: 65, z: 0 });
  assertEqual(slopedBlock.permutation.getState("rail_direction"), 2, "ascending rail block placed with the ascending permutation (east)");
}

// ---------------------------------------------------------------------------
// 4. RailBuilder: drives a strategy's generator via the mocked
//    system.runJob and resolves with the correct BuildResult.
// ---------------------------------------------------------------------------

{
  const dim = createMockDimension({ groundY: 63 });
  const scanner = new TerrainScanner();
  const buildVector = createBuildVector({ x: 0, y: 64, z: 0 }, "east");
  const report = scanner.scanPath(buildVector, 3, dim);
  const player = createMockPlayer({ id: "p1", gameMode: "Creative" });
  const request = fakeBuildRequest({ player, dimension: dim });
  const session = new BuildSession(request, report.positions.length);
  const strategy = new StraightRailStrategy(scanner, new InventoryManager(), noopProgressReporter, new TunnelExcavator());
  const railBuilder = new RailBuilder();

  const result = await railBuilder.run(session, report.positions, strategy);
  assertTrue(result.completed, "RailBuilder.run() resolves a completed BuildResult");
  assertEqual(result.blocksPlaced, 3, "RailBuilder.run() reports the correct blocksPlaced");
}

// ---------------------------------------------------------------------------
// 5. BridgeExecutionStrategy: water-tolerant deck placement (Project Prompt
//    18 regression) and existing-rail preservation on the deck.
// ---------------------------------------------------------------------------

{
  const length = 9;
  const bridgeHeight = 3;
  // Deck elevation at index 3 and 4 is the CREST height (originY + bridgeHeight
  // = 67), not originY itself — see TerrainScanner.planBridge()'s
  // ELEVATION PROFILE doc. Water/existing-rail must sit at the actual deck
  // Y for this index, not the origin's flat starting Y.
  const crestY = 64 + bridgeHeight;
  const overrides = { [`3,${crestY},0`]: WATER_SOURCE, [`4,${crestY},0`]: { typeId: "minecraft:golden_rail" } };
  const dim = createMockDimension({ groundY: 60, overrides });
  const scanner = new TerrainScanner();
  const buildVector = createBuildVector({ x: 0, y: 64, z: 0 }, "east");
  const plan = scanner.planBridge(buildVector, length, dim, bridgeHeight);
  assertTrue(plan.feasible, "bridge-with-water-and-existing-rail plan is feasible");

  const player = createMockPlayer({
    id: "p1",
    gameMode: "Survival",
    items: [
      { typeId: "minecraft:rail", amount: plan.requiredRailCount },
      { typeId: "minecraft:cobblestone", amount: plan.requiredSupportBlockCount },
    ],
  });
  const request = fakeBuildRequest({ player, dimension: dim, bridgeMaterialId: "minecraft:cobblestone" });
  const session = new BuildSession(request, plan.requiredRailCount + plan.requiredSupportBlockCount);
  const strategy = new BridgeExecutionStrategy(new BridgeSupportBuilder(), new InventoryManager(), noopProgressReporter, noopMessageService);

  const railBuilder = new RailBuilder();
  const result = await railBuilder.run(session, plan, strategy);

  assertTrue(result.completed, "bridge build with water deck + existing rail completes");
  const deckAtWater = dim.getBlock({ x: 3, y: crestY, z: 0 });
  assertEqual(deckAtWater.typeId, "minecraft:rail", "bridge deck rail placed directly over what was water");
  const preservedRail = dim.getBlock({ x: 4, y: crestY, z: 0 });
  assertEqual(preservedRail.typeId, "minecraft:golden_rail", "existing golden rail on the bridge deck preserved, not overwritten");
}

// ---------------------------------------------------------------------------
// 6. UndergroundExecutionStrategy: waterproof seal is actually placed
//    (Project Prompt 18 regression, execution level).
// ---------------------------------------------------------------------------

{
  const depth = 3;
  const length = 6;
  const originY = 70;
  const railY = originY - depth;
  const overrides = {
    [`4,${railY},0`]: WATER_SOURCE,
    [`4,${railY},1`]: WATER_SOURCE,
    [`4,${railY},-1`]: WATER_SOURCE,
  };
  const dim = createMockDimension({ groundY: 100, overrides });
  const scanner = new TerrainScanner();
  const buildVector = createBuildVector({ x: 0, y: originY, z: 0 }, "east");
  const plan = scanner.planUnderground(buildVector, length, dim, depth);
  assertTrue(plan.feasible, "underground water-corridor plan is feasible");

  const player = createMockPlayer({ id: "p1", gameMode: "Creative" });
  const request = fakeBuildRequest({ player, dimension: dim });
  const session = new BuildSession(request, plan.requiredRailCount);
  const strategy = new UndergroundExecutionStrategy(new TunnelExcavator(), new InventoryManager(), noopProgressReporter, noopMessageService);

  const railBuilder = new RailBuilder();
  const result = await railBuilder.run(session, plan, strategy);

  assertTrue(result.completed, "underground water-corridor build completes");
  const sealedNeighbor = dim.getBlock({ x: 4, y: railY, z: 1 });
  assertEqual(sealedNeighbor.typeId, "minecraft:stone", "lateral seal block actually placed during execution");
  const railSpot = dim.getBlock({ x: 4, y: railY, z: 0 });
  assertEqual(railSpot.typeId, "minecraft:rail", "rail placed at the formerly-flooded corridor position");
}

// ---------------------------------------------------------------------------
// 7. Resource safety: exact resources, insufficient resources, Creative
//    bypass (Section 10, SURVIVAL test matrix).
// ---------------------------------------------------------------------------

{
  const inventoryManager = new InventoryManager();
  const resourceValidator = new ResourceValidator();

  const exactPlayer = createMockPlayer({ id: "p1", items: [{ typeId: "minecraft:rail", amount: 10 }] });
  const exactReport = inventoryManager.buildReport(exactPlayer, "minecraft:rail", 10);
  assertTrue(resourceValidator.validate(exactReport, "Survival").valid, "exact resources: valid");

  const shortPlayer = createMockPlayer({ id: "p2", items: [{ typeId: "minecraft:rail", amount: 4 }] });
  const shortReport = inventoryManager.buildReport(shortPlayer, "minecraft:rail", 10);
  const shortValidation = resourceValidator.validate(shortReport, "Survival");
  assertEqual(shortValidation.valid, false, "insufficient resources: rejected");
  assertEqual(shortReport.missingQuantity, 6, "insufficient resources: correct missing quantity");

  const creativePlayer = createMockPlayer({ id: "p3", items: [] });
  const creativeReport = inventoryManager.buildReport(creativePlayer, "minecraft:rail", 64);
  assertTrue(resourceValidator.validate(creativeReport, "Creative").valid, "Creative Mode bypasses quantity entirely");
}

{
  // Additional terrain blocks required: a bridge over a deeper gap needs
  // strictly more support material than the same bridge over flat ground —
  // confirming the terrain-driven resource requirement is computed BEFORE
  // construction (planning-time), not discovered mid-build.
  const scanner = new TerrainScanner();
  const flatDim = createMockDimension({ groundY: 60 });
  const flatPlan = scanner.planBridge(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 9, flatDim, 3);

  const deepOverrides = {};
  for (let x = 0; x < 9; x++) deepOverrides[`${x},60,0`] = { typeId: "minecraft:air" };
  const deepDim = createMockDimension({ groundY: 40, overrides: deepOverrides });
  const deepPlan = scanner.planBridge(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 9, deepDim, 3);

  assertTrue(deepPlan.requiredSupportBlockCount > flatPlan.requiredSupportBlockCount, "deeper terrain requires strictly more support material, computed at planning time");
}

// ---------------------------------------------------------------------------
// 8. Multiplayer isolation: CancellationWatcher keeps two players'
//    sessions completely independent (Section 12).
// ---------------------------------------------------------------------------

{
  const watcher = new CancellationWatcher();
  watcher.initialize();

  const player1 = createMockPlayer({ id: "player-1" });
  const player2 = createMockPlayer({ id: "player-2" });
  const session1 = new BuildSession(fakeBuildRequest({ player: player1, dimension: {} }), 10);
  const session2 = new BuildSession(fakeBuildRequest({ player: player2, dimension: {} }), 10);

  watcher.registerSession(player1.id, session1);
  watcher.registerSession(player2.id, session2);

  // player1 leaves — only session1 should be cancelled.
  const { world } = await import("@minecraft/server");
  world.beforeEvents.playerLeave.emit({ player: player1 });

  assertTrue(session1.isCancelled(), "multiplayer isolation: player1's session cancelled on their own playerLeave");
  assertEqual(session1.cancelReason, "playerLeave", "multiplayer isolation: correct cancel reason");
  assertEqual(session2.isCancelled(), false, "multiplayer isolation: player2's session completely unaffected");

  watcher.unregisterSession(player1.id);
  watcher.unregisterSession(player2.id);
}

// ---------------------------------------------------------------------------
// 8b. CancellationWatcher's other 3 events (Project Prompt 27 — closing a
//     real test-coverage gap: only playerLeave had a dedicated test before
//     this session, even though CancellationWatcher.js documents and
//     subscribes to 4 distinct cancellation-relevant events). Each event is
//     exercised in isolation, with multiplayer isolation re-confirmed for
//     every one of them (not just playerLeave) — a second, unrelated
//     player's session must never be cancelled by another player's event.
// ---------------------------------------------------------------------------

{
  // Dimension change (e.g. the player takes a nether portal or an end
  // portal mid-build).
  const watcher = new CancellationWatcher();
  watcher.initialize();

  const player1 = createMockPlayer({ id: "player-1" });
  const player2 = createMockPlayer({ id: "player-2" });
  const session1 = new BuildSession(fakeBuildRequest({ player: player1, dimension: {} }), 10);
  const session2 = new BuildSession(fakeBuildRequest({ player: player2, dimension: {} }), 10);
  watcher.registerSession(player1.id, session1);
  watcher.registerSession(player2.id, session2);

  const { world } = await import("@minecraft/server");
  world.afterEvents.playerDimensionChange.emit({ player: player1 });

  assertTrue(session1.isCancelled(), "dimension change: player1's session cancelled on their own playerDimensionChange");
  assertEqual(session1.cancelReason, "playerDimensionChange", "dimension change: correct cancel reason");
  assertEqual(session2.isCancelled(), false, "dimension change: player2's session completely unaffected");

  watcher.unregisterSession(player1.id);
  watcher.unregisterSession(player2.id);
}

{
  // Player death — CancellationWatcher subscribes to entityDie filtered to
  // minecraft:player and reads event.deadEntity.id (see CancellationWatcher.js).
  const watcher = new CancellationWatcher();
  watcher.initialize();

  const player1 = createMockPlayer({ id: "player-1" });
  const player2 = createMockPlayer({ id: "player-2" });
  const session1 = new BuildSession(fakeBuildRequest({ player: player1, dimension: {} }), 10);
  const session2 = new BuildSession(fakeBuildRequest({ player: player2, dimension: {} }), 10);
  watcher.registerSession(player1.id, session1);
  watcher.registerSession(player2.id, session2);

  const { world } = await import("@minecraft/server");
  world.afterEvents.entityDie.emit({ deadEntity: player1 });

  assertTrue(session1.isCancelled(), "player death: player1's session cancelled on their own entityDie");
  assertEqual(session1.cancelReason, "playerDeath", "player death: correct cancel reason");
  assertEqual(session2.isCancelled(), false, "player death: player2's session completely unaffected");

  watcher.unregisterSession(player1.id);
  watcher.unregisterSession(player2.id);
}

{
  // Game mode change (e.g. an operator switches the player to Spectator
  // mid-build) — the fourth and last of CancellationWatcher's events.
  const watcher = new CancellationWatcher();
  watcher.initialize();

  const player1 = createMockPlayer({ id: "player-1" });
  const player2 = createMockPlayer({ id: "player-2" });
  const session1 = new BuildSession(fakeBuildRequest({ player: player1, dimension: {} }), 10);
  const session2 = new BuildSession(fakeBuildRequest({ player: player2, dimension: {} }), 10);
  watcher.registerSession(player1.id, session1);
  watcher.registerSession(player2.id, session2);

  const { world } = await import("@minecraft/server");
  world.afterEvents.playerGameModeChange.emit({ player: player1 });

  assertTrue(session1.isCancelled(), "game mode change: player1's session cancelled on their own playerGameModeChange");
  assertEqual(session1.cancelReason, "playerGameModeChange", "game mode change: correct cancel reason");
  assertEqual(session2.isCancelled(), false, "game mode change: player2's session completely unaffected");

  watcher.unregisterSession(player1.id);
  watcher.unregisterSession(player2.id);
}

{
  // Orphaned-lock regression: a session unregistered BEFORE its player's
  // cancellation event fires (the normal PlacementStage try/finally order —
  // see PlacementStage.js) must not be touched by a late-arriving event, and
  // must leave no trace in the watcher for a later, unrelated session
  // registered under the same reused player id.
  const watcher = new CancellationWatcher();
  watcher.initialize();

  const player1 = createMockPlayer({ id: "player-1" });
  const firstSession = new BuildSession(fakeBuildRequest({ player: player1, dimension: {} }), 10);
  watcher.registerSession(player1.id, firstSession);
  watcher.unregisterSession(player1.id); // build finished/cancelled/errored — PlacementStage's finally already ran

  const { world } = await import("@minecraft/server");
  world.beforeEvents.playerLeave.emit({ player: player1 });
  assertEqual(firstSession.isCancelled(), false, "orphaned lock: an unregistered session is never cancelled by a late event");

  // A brand-new build for the same player (same id, fresh session) must
  // start completely clean — no stale registration left behind.
  const secondSession = new BuildSession(fakeBuildRequest({ player: player1, dimension: {} }), 10);
  watcher.registerSession(player1.id, secondSession);
  assertEqual(secondSession.isCancelled(), false, "orphaned lock: a new session for the same player id starts uncancelled");
  watcher.unregisterSession(player1.id);
}

{
  // Two independent builds' plans never share state — same scanner
  // instance, two different players/build vectors, no cross-contamination.
  const scanner = new TerrainScanner();
  const dimA = createMockDimension({ groundY: 63, overrides: { "2,64,0": STONE } }); // A hits a rise
  const dimB = createMockDimension({ groundY: 63 }); // B is flat
  const reportA = scanner.scanPath(createBuildVector({ x: 0, y: 64, z: 0 }, "east"), 5, dimA);
  const reportB = scanner.scanPath(createBuildVector({ x: 100, y: 64, z: 100 }, "north"), 5, dimB);

  assertEqual(reportA.positions[2].classification, TerrainClassification.ASCENDING, "player A's plan reflects their own terrain");
  assertTrue(reportB.isFlat, "player B's simultaneous plan is unaffected by player A's terrain");
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
