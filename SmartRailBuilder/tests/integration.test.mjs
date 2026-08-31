/**
 * integration.test.mjs
 *
 * Project Prompt 20 ("Full Integration, Stability & Real-World Test Build").
 *
 * Everything before this file tested individual classes (terrain planning,
 * one execution strategy, one validator) in isolation. This file builds the
 * SAME dependency graph `main.js`'s `buildDependencyGraph()` constructs —
 * every real stage, every real validator, the real `BuildPipeline` — and
 * runs it end to end, exactly like a real player interaction would, with
 * only `ui/BuildMenu.js` replaced by a scripted stub (it's the one class
 * that calls `@minecraft/server-ui`, which has no mock yet — see
 * tests/README.md).
 *
 * This is the first test in the project to prove the WIRING itself is
 * correct — that RailDetectionStage really does hand off to
 * BuildRequestCreationStage, which really does hand off to ValidationStage's
 * real validator list, through TerrainScanningStage, InventoryStage,
 * FinalSafetyCheckStage, PlacementStage, and CompletionStage — not just that
 * each stage is correct on its own.
 *
 * Run with: node tests/integration.test.mjs
 */

import { createMockDimension, createBuildVector } from "./mockWorld.mjs";
import { createMockPlayer } from "./mockPlayer.mjs";

import { TerrainScanner } from "../BP/scripts/terrain/TerrainScanner.js";
import { PathValidator } from "../BP/scripts/terrain/PathValidator.js";
import { BridgeValidation } from "../BP/scripts/terrain/BridgeValidation.js";
import { UndergroundValidation } from "../BP/scripts/terrain/UndergroundValidation.js";
import { InventoryManager } from "../BP/scripts/inventory/InventoryManager.js";
import { ResourceValidator } from "../BP/scripts/inventory/ResourceValidator.js";
import { MessageService } from "../BP/scripts/ui/MessageService.js";
import { ProgressReporter } from "../BP/scripts/ui/ProgressReporter.js";
import { CancellationWatcher } from "../BP/scripts/core/CancellationWatcher.js";
import { TunnelExcavator } from "../BP/scripts/builder/TunnelExcavator.js";
import { StraightRailStrategy } from "../BP/scripts/builder/strategies/StraightRailStrategy.js";
import { BridgeExecutionStrategy } from "../BP/scripts/builder/strategies/BridgeExecutionStrategy.js";
import { BridgeSupportBuilder } from "../BP/scripts/builder/BridgeSupportBuilder.js";
import { UndergroundExecutionStrategy } from "../BP/scripts/builder/strategies/UndergroundExecutionStrategy.js";
import { RailBuilder } from "../BP/scripts/builder/RailBuilder.js";
import { BuildingMode } from "../BP/scripts/config/BuildModes.js";

import { ValidationManager } from "../BP/scripts/core/validation/ValidationManager.js";
import { PlayerValidator } from "../BP/scripts/core/validation/PlayerValidator.js";
import { GameModeValidator } from "../BP/scripts/core/validation/GameModeValidator.js";
import { HeldItemValidator } from "../BP/scripts/core/validation/HeldItemValidator.js";
import { DirectionValidator } from "../BP/scripts/core/validation/DirectionValidator.js";
import { OriginValidator } from "../BP/scripts/core/validation/OriginValidator.js";
import { LengthValidator } from "../BP/scripts/core/validation/LengthValidator.js";
import { ModeConfigValidator } from "../BP/scripts/core/validation/ModeConfigValidator.js";
import { PermissionValidator } from "../BP/scripts/core/validation/PermissionValidator.js";

import { BuildPipeline } from "../BP/scripts/core/pipeline/BuildPipeline.js";
import { RailDetectionStage } from "../BP/scripts/core/pipeline/stages/RailDetectionStage.js";
import { BuildRequestCreationStage } from "../BP/scripts/core/pipeline/stages/BuildRequestCreationStage.js";
import { ValidationStage } from "../BP/scripts/core/pipeline/stages/ValidationStage.js";
import { ModeAvailabilityStage } from "../BP/scripts/core/pipeline/stages/ModeAvailabilityStage.js";
import { TerrainScanningStage } from "../BP/scripts/core/pipeline/stages/TerrainScanningStage.js";
import { InventoryStage } from "../BP/scripts/core/pipeline/stages/InventoryStage.js";
import { FinalSafetyCheckStage } from "../BP/scripts/core/pipeline/stages/FinalSafetyCheckStage.js";
import { PlacementStage } from "../BP/scripts/core/pipeline/stages/PlacementStage.js";
import { CompletionStage } from "../BP/scripts/core/pipeline/stages/CompletionStage.js";
import { PipelineContext } from "../BP/scripts/core/pipeline/PipelineContext.js";
import { PipelineResultStatus } from "../BP/scripts/core/pipeline/PipelineResult.js";
import { BuildOrchestrator } from "../BP/scripts/core/BuildOrchestrator.js";
import { classifyOutcome, PipelineOutcome } from "../BP/scripts/core/pipeline/PipelineOutcome.js";

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

/**
 * Builds the exact same object graph as main.js's buildDependencyGraph() —
 * copied deliberately rather than importing main.js itself, since main.js
 * subscribes a real `world.beforeEvents.playerInteractWithBlock` listener at
 * module-load time as a side effect, which this test has no reason to do.
 * `buildMenu` is the one substitution: a scripted stub standing in for the
 * real `ui/BuildMenu.js`, which calls `@minecraft/server-ui` (no mock exists
 * for that package yet — see tests/README.md).
 */
function buildRealDependencyGraph(buildMenu) {
  const terrainScanner = new TerrainScanner();
  const pathValidator = new PathValidator();
  const inventoryManager = new InventoryManager();
  const resourceValidator = new ResourceValidator();
  const messageService = new MessageService();
  const progressReporter = new ProgressReporter(messageService);
  const cancellationWatcher = new CancellationWatcher();

  const tunnelExcavator = new TunnelExcavator();
  const straightRailStrategy = new StraightRailStrategy(terrainScanner, inventoryManager, progressReporter, tunnelExcavator);
  const bridgeExecutionStrategy = new BridgeExecutionStrategy(new BridgeSupportBuilder(), inventoryManager, progressReporter, messageService);
  const undergroundExecutionStrategy = new UndergroundExecutionStrategy(tunnelExcavator, inventoryManager, progressReporter, messageService);
  const strategiesByMode = Object.freeze({
    [BuildingMode.NORMAL]: straightRailStrategy,
    [BuildingMode.BRIDGE]: bridgeExecutionStrategy,
    [BuildingMode.UNDERGROUND]: undergroundExecutionStrategy,
  });
  const railBuilder = new RailBuilder();
  const bridgeValidation = new BridgeValidation();
  const undergroundValidation = new UndergroundValidation();

  const validationManager = new ValidationManager([
    new PlayerValidator(),
    new GameModeValidator(),
    new HeldItemValidator(),
    new DirectionValidator(),
    new OriginValidator(),
    new LengthValidator(),
    new ModeConfigValidator(),
    new PermissionValidator(),
  ]);

  const pipeline = new BuildPipeline([
    new RailDetectionStage(),
    new BuildRequestCreationStage(buildMenu, inventoryManager),
    new ValidationStage(validationManager, messageService),
    new ModeAvailabilityStage(),
    new TerrainScanningStage(terrainScanner, pathValidator, messageService, bridgeValidation, undergroundValidation),
    new InventoryStage(inventoryManager, resourceValidator, messageService),
    new FinalSafetyCheckStage(terrainScanner, messageService),
    new PlacementStage(railBuilder, cancellationWatcher, messageService, strategiesByMode),
    new CompletionStage(messageService),
  ]);

  const orchestrator = new BuildOrchestrator({ pipeline, messageService });
  return { orchestrator, pipeline, cancellationWatcher, inventoryManager };
}

function stubBuildMenu({ mode = "NORMAL", modeValue, length = 5, materialId, confirmed = true }) {
  return {
    async promptForMode() {
      return { cancelled: false, mode };
    },
    async promptForBridgeMaterial(player, materials) {
      return { cancelled: false, materialId: materialId ?? materials[0]?.typeId };
    },
    async promptForConfiguration() {
      return { cancelled: false, modeValue, length };
    },
    async promptForSummary() {
      return { cancelled: false, confirmed };
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Full pipeline, NORMAL Mode: RailDetectionStage all the way through
//    CompletionStage, with a real mutable world.
// ---------------------------------------------------------------------------

{
  const dim = createMockDimension({ groundY: 63 });
  const player = createMockPlayer({
    id: "p1",
    gameMode: "Survival",
    heldItemTypeId: "minecraft:rail",
    items: [{ typeId: "minecraft:rail", amount: 10 }],
    location: { x: 0, y: 64, z: 0 },
    // Yaw 270 -> EAST (see utils/DirectionUtils.js's snapYawToCardinal bands)
    // — pinned explicitly so this test's own coordinate assertions below are
    // deterministic, rather than relying on the mock's default yaw 0 (SOUTH).
    rotation: { x: 0, y: 270 },
    dimension: dim,
  });

  const { pipeline } = buildRealDependencyGraph(stubBuildMenu({ mode: "NORMAL", length: 5 }));
  const context = new PipelineContext({ player, railTypeId: "minecraft:rail" });

  // BuildOrchestrator.startBuild() is the exact entry point main.js's event
  // listener calls — but it constructs its own PipelineContext internally,
  // so this test calls the pipeline directly for result inspection while
  // still exercising the identical stage list and wiring.
  const result = await pipeline.run(context);

  assertEqual(result.status, PipelineResultStatus.SUCCESS, "full NORMAL pipeline: SUCCESS end to end");
  assertEqual(classifyOutcome(result), PipelineOutcome.BUILD_ACCEPTED, "full NORMAL pipeline: BUILD_ACCEPTED outcome");
  assertEqual(context.buildSession.blocksPlaced, 5, "full NORMAL pipeline: correct number of blocks placed");
  // BuildVector.fromPlayer's origin rule: exactly one block ahead of the
  // player's own position along their facing direction (never the player's
  // own block) — EAST from (0,64,0) puts the origin at (1,64,0), ending at
  // (5,64,0) for a 5-long build. See core/BuildVector.js's ORIGIN RULE.
  assertTrue(dim.getBlock({ x: 1, y: 64, z: 0 }).typeId === "minecraft:rail", "full NORMAL pipeline: starting rail actually in the world");
  assertTrue(dim.getBlock({ x: 5, y: 64, z: 0 }).typeId === "minecraft:rail", "full NORMAL pipeline: ending rail actually in the world");
  const report = new InventoryManager().buildReport(player, "minecraft:rail", 0);
  assertEqual(report.totalAvailable, 5, "full NORMAL pipeline: exactly 5 rails deducted from Survival inventory (10 - 5)");
}

// ---------------------------------------------------------------------------
// 2. Full pipeline, BRIDGE Mode: menu -> material screen -> validation ->
//    planning -> inventory -> placement -> completion.
// ---------------------------------------------------------------------------

{
  const dim = createMockDimension({ groundY: 60 });
  const player = createMockPlayer({
    id: "p2",
    gameMode: "Survival",
    heldItemTypeId: "minecraft:rail",
    items: [
      { typeId: "minecraft:rail", amount: 20 },
      { typeId: "minecraft:cobblestone", amount: 20 },
    ],
    location: { x: 0, y: 64, z: 0 },
    dimension: dim,
  });

  const { pipeline } = buildRealDependencyGraph(
    stubBuildMenu({ mode: "BRIDGE", modeValue: 3, length: 9, materialId: "minecraft:cobblestone" })
  );
  const context = new PipelineContext({ player, railTypeId: "minecraft:rail" });
  const result = await pipeline.run(context);

  assertEqual(result.status, PipelineResultStatus.SUCCESS, "full BRIDGE pipeline: SUCCESS end to end");
  assertEqual(context.request.bridgeHeight, 3, "full BRIDGE pipeline: bridgeHeight carried through the whole request");
  assertEqual(context.request.bridgeMaterialId, "minecraft:cobblestone", "full BRIDGE pipeline: chosen material carried through");
  assertTrue(context.buildSession.blocksPlaced > 0, "full BRIDGE pipeline: blocks actually placed");
}

// ---------------------------------------------------------------------------
// 3. Full pipeline, UNDERGROUND Mode.
// ---------------------------------------------------------------------------

{
  const dim = createMockDimension({ groundY: 100 });
  const player = createMockPlayer({
    id: "p3",
    gameMode: "Creative",
    heldItemTypeId: "minecraft:rail",
    location: { x: 0, y: 70, z: 0 },
    dimension: dim,
  });

  const { pipeline } = buildRealDependencyGraph(stubBuildMenu({ mode: "UNDERGROUND", modeValue: 5, length: 8 }));
  const context = new PipelineContext({ player, railTypeId: "minecraft:rail" });
  const result = await pipeline.run(context);

  assertEqual(result.status, PipelineResultStatus.SUCCESS, "full UNDERGROUND pipeline: SUCCESS end to end (Creative)");
  assertEqual(context.request.undergroundDepth, 5, "full UNDERGROUND pipeline: undergroundDepth carried through");
  assertEqual(context.buildSession.blocksPlaced, 8, "full UNDERGROUND pipeline: all 8 rails placed");
}

// ---------------------------------------------------------------------------
// 4. Rejection paths still stop the pipeline at the RIGHT stage, with a
//    localizationKey, and never reach PlacementStage.
// ---------------------------------------------------------------------------

{
  // Insufficient rails: should stop at InventoryStage, never place anything.
  const dim = createMockDimension({ groundY: 63 });
  const player = createMockPlayer({
    id: "p4",
    gameMode: "Survival",
    heldItemTypeId: "minecraft:rail",
    items: [{ typeId: "minecraft:rail", amount: 2 }],
    location: { x: 0, y: 64, z: 0 },
    rotation: { x: 0, y: 270 }, // EAST — see the full-NORMAL-pipeline test above for why this is pinned
    dimension: dim,
  });
  const { pipeline } = buildRealDependencyGraph(stubBuildMenu({ mode: "NORMAL", length: 10 }));
  const context = new PipelineContext({ player, railTypeId: "minecraft:rail" });
  const result = await pipeline.run(context);

  assertEqual(result.status, PipelineResultStatus.VALIDATION_FAILED, "insufficient rails: rejected");
  assertEqual(result.stageName, "InventoryStage", "insufficient rails: rejected at the correct stage");
  assertTrue(Boolean(result.localizationKey), "insufficient rails: carries a localizationKey");
  assertEqual(context.buildSession, undefined, "insufficient rails: PlacementStage never ran, no session created");
  assertEqual(dim.getBlock({ x: 1, y: 64, z: 0 }).typeId, "minecraft:air", "insufficient rails: build nothing (Section 10 resource safety)");
}

{
  // Held item changed between menu and validation: HeldItemValidator should
  // catch it inside ValidationStage.
  const dim = createMockDimension({ groundY: 63 });
  const player = createMockPlayer({
    id: "p5",
    gameMode: "Creative",
    heldItemTypeId: "minecraft:golden_rail", // holding a DIFFERENT rail than requested
    location: { x: 0, y: 64, z: 0 },
    dimension: dim,
  });
  const { pipeline } = buildRealDependencyGraph(stubBuildMenu({ mode: "NORMAL", length: 5 }));
  const context = new PipelineContext({ player, railTypeId: "minecraft:rail" });
  const result = await pipeline.run(context);

  assertEqual(result.status, PipelineResultStatus.VALIDATION_FAILED, "held item changed: rejected");
  assertEqual(result.stageName, "ValidationStage", "held item changed: rejected at ValidationStage");
}

{
  // Invalid bridge height (out of BuildMenu's own bounds, simulating a
  // tampered/buggy client value) must be caught by ModeConfigValidator.
  const dim = createMockDimension({ groundY: 60 });
  const player = createMockPlayer({
    id: "p6",
    gameMode: "Creative",
    heldItemTypeId: "minecraft:rail",
    // A placeable material must be present so BuildRequestCreationStage's
    // OWN "no materials at all" check (a different, earlier rejection —
    // NO_BRIDGE_MATERIALS at BuildRequestCreationStage) doesn't fire first
    // and mask the ModeConfigValidator rejection this test actually targets.
    items: [{ typeId: "minecraft:cobblestone", amount: 20 }],
    location: { x: 0, y: 64, z: 0 },
    dimension: dim,
  });
  const { pipeline } = buildRealDependencyGraph(
    stubBuildMenu({ mode: "BRIDGE", modeValue: 99, length: 9, materialId: "minecraft:cobblestone" })
  );
  const context = new PipelineContext({ player, railTypeId: "minecraft:rail" });
  const result = await pipeline.run(context);

  assertEqual(result.status, PipelineResultStatus.VALIDATION_FAILED, "invalid bridge height: rejected");
  assertEqual(result.stageName, "ValidationStage", "invalid bridge height: rejected at ValidationStage (ModeConfigValidator)");
}

// ---------------------------------------------------------------------------
// 5. Multiplayer isolation through the FULL pipeline: two players, two
//    simultaneous builds, sharing nothing.
// ---------------------------------------------------------------------------

{
  const dimA = createMockDimension({ groundY: 63 });
  // groundY must be high enough that solid ground exists immediately below
  // EVERY ramp step down from the surface (player B starts at y=70, depth
  // 10 means the ramp needs solid floor continuously from y=69 down to
  // y=60) — 60 left most of that ramp floating over open air. See the
  // Underground tests in tests/terrain.test.mjs for the same requirement.
  const dimB = createMockDimension({ groundY: 100 });
  const playerA = createMockPlayer({
    id: "playerA",
    gameMode: "Survival",
    heldItemTypeId: "minecraft:rail",
    // 33 support/surface blocks are needed for a height-8, length-19 bridge
    // over this terrain (confirmed by this same test's own plan-derived
    // Content Log line before this fix) — 50 leaves comfortable headroom.
    items: [{ typeId: "minecraft:rail", amount: 20 }, { typeId: "minecraft:cobblestone", amount: 50 }],
    location: { x: 0, y: 64, z: 0 },
    dimension: dimA,
  });
  const playerB = createMockPlayer({
    id: "playerB",
    gameMode: "Survival",
    heldItemTypeId: "minecraft:rail",
    items: [{ typeId: "minecraft:rail", amount: 20 }],
    location: { x: 100, y: 70, z: 100 },
    dimension: dimB,
  });

  const graphA = buildRealDependencyGraph(stubBuildMenu({ mode: "BRIDGE", modeValue: 8, length: 19, materialId: "minecraft:cobblestone" }));
  const graphB = buildRealDependencyGraph(stubBuildMenu({ mode: "UNDERGROUND", modeValue: 10, length: 15 }));

  const contextA = new PipelineContext({ player: playerA, railTypeId: "minecraft:rail" });
  const contextB = new PipelineContext({ player: playerB, railTypeId: "minecraft:rail" });

  const [resultA, resultB] = await Promise.all([
    graphA.pipeline.run(contextA),
    graphB.pipeline.run(contextB),
  ]);

  assertEqual(resultA.status, PipelineResultStatus.SUCCESS, "multiplayer: player A's Bridge build succeeds");
  assertEqual(resultB.status, PipelineResultStatus.SUCCESS, "multiplayer: player B's Underground build succeeds");
  assertEqual(contextA.request.buildingMode, "BRIDGE", "multiplayer: player A's mode unaffected by player B");
  assertEqual(contextB.request.buildingMode, "UNDERGROUND", "multiplayer: player B's mode unaffected by player A");
  assertEqual(contextA.request.bridgeHeight, 8, "multiplayer: player A's config isolated");
  assertEqual(contextB.request.undergroundDepth, 10, "multiplayer: player B's config isolated");
  assertTrue(contextA.buildSession !== contextB.buildSession, "multiplayer: completely separate BuildSession objects");
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
