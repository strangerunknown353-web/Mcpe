/**
 * buildPlanSafety.test.mjs
 *
 * Project Prompt 22 ("Smart Build Preview, Validation & Safety") test suite.
 * Covers everything new this session that isn't already exercised by
 * `integration.test.mjs`'s full end-to-end runs (which now also incidentally
 * prove BuildPlanStage doesn't break a normal, successful build — see its
 * own Sections 1-3):
 *
 * - `core/BuildPlan.js`: field assembly and the world modification boundary,
 *   for all three modes, including the "don't count the same block twice"
 *   requirement.
 * - `core/ActiveBuildRegistry.js`: claim/release/conflict, in isolation.
 * - `core/pipeline/stages/BuildPlanStage.js`: the immediately-before-
 *   construction revalidation (player/dimension/held item/inventory gone
 *   stale) — tested directly by running the real stages up through
 *   FinalSafetyCheckStage, mutating the mock player, then calling
 *   BuildPlanStage.execute() and inspecting the result.
 * - `core/pipeline/stages/PlacementStage.js`'s new RAIL_CONFLICT rejection —
 *   two overlapping claims, proving `railBuilder.run()` is never called on
 *   a conflict (zero blocks placed).
 * - `config/ValidationErrorCategory.js`'s categorize() mapping.
 * - `core/BuildOrchestrator.js`'s new "STATUS: CANNOT BUILD" chat prefix.
 *
 * Run with: node tests/buildPlanSafety.test.mjs
 */

import { createMockDimension, createBuildVector } from "./mockWorld.mjs";
import { createMockPlayer } from "./mockPlayer.mjs";

import { TerrainScanner } from "../BP/scripts/terrain/TerrainScanner.js";
import { PathValidator } from "../BP/scripts/terrain/PathValidator.js";
import { BridgeValidation } from "../BP/scripts/terrain/BridgeValidation.js";
import { UndergroundValidation } from "../BP/scripts/terrain/UndergroundValidation.js";
import { InventoryManager } from "../BP/scripts/inventory/InventoryManager.js";
import { ResourceValidator } from "../BP/scripts/inventory/ResourceValidator.js";

import { TerrainScanningStage } from "../BP/scripts/core/pipeline/stages/TerrainScanningStage.js";
import { InventoryStage } from "../BP/scripts/core/pipeline/stages/InventoryStage.js";
import { FinalSafetyCheckStage } from "../BP/scripts/core/pipeline/stages/FinalSafetyCheckStage.js";
import { BuildPlanStage } from "../BP/scripts/core/pipeline/stages/BuildPlanStage.js";
import { PlacementStage } from "../BP/scripts/core/pipeline/stages/PlacementStage.js";
import { PipelineResultStatus } from "../BP/scripts/core/pipeline/PipelineResult.js";

import { BuildPlan } from "../BP/scripts/core/BuildPlan.js";
import { ActiveBuildRegistry } from "../BP/scripts/core/ActiveBuildRegistry.js";
import { CancellationWatcher } from "../BP/scripts/core/CancellationWatcher.js";
import { positionKey } from "../BP/scripts/utils/PositionKey.js";
import { categorize, ValidationErrorCategory } from "../BP/scripts/config/ValidationErrorCategory.js";
import { BuildingMode } from "../BP/scripts/config/BuildModes.js";

import { BuildOrchestrator } from "../BP/scripts/core/BuildOrchestrator.js";
import { BuildPipeline } from "../BP/scripts/core/pipeline/BuildPipeline.js";
import { RailDetectionStage } from "../BP/scripts/core/pipeline/stages/RailDetectionStage.js";
import { BuildRequestCreationStage } from "../BP/scripts/core/pipeline/stages/BuildRequestCreationStage.js";
import { ValidationStage } from "../BP/scripts/core/pipeline/stages/ValidationStage.js";
import { ModeAvailabilityStage } from "../BP/scripts/core/pipeline/stages/ModeAvailabilityStage.js";
import { ValidationManager } from "../BP/scripts/core/validation/ValidationManager.js";
import { PlayerValidator } from "../BP/scripts/core/validation/PlayerValidator.js";
import { GameModeValidator } from "../BP/scripts/core/validation/GameModeValidator.js";
import { HeldItemValidator } from "../BP/scripts/core/validation/HeldItemValidator.js";
import { DirectionValidator } from "../BP/scripts/core/validation/DirectionValidator.js";
import { OriginValidator } from "../BP/scripts/core/validation/OriginValidator.js";
import { LengthValidator } from "../BP/scripts/core/validation/LengthValidator.js";
import { ModeConfigValidator } from "../BP/scripts/core/validation/ModeConfigValidator.js";
import { PermissionValidator } from "../BP/scripts/core/validation/PermissionValidator.js";
import { MessageService } from "../BP/scripts/ui/MessageService.js";
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

const noopMessageService = { sendChat() {}, sendActionBar() {} };
const terrainScanner = new TerrainScanner();
const pathValidator = new PathValidator();
const bridgeValidation = new BridgeValidation();
const undergroundValidation = new UndergroundValidation();
const inventoryManager = new InventoryManager();
const resourceValidator = new ResourceValidator();

const terrainScanningStage = new TerrainScanningStage(terrainScanner, pathValidator, noopMessageService, bridgeValidation, undergroundValidation);
const inventoryStage = new InventoryStage(inventoryManager, resourceValidator, noopMessageService);
const finalSafetyCheckStage = new FinalSafetyCheckStage(terrainScanner, noopMessageService);
const buildPlanStage = new BuildPlanStage(inventoryManager, resourceValidator);

/**
 * @param {Object} opts
 * @returns {{context: Object}} A context whose `terrainReport`/`bridgePlan`/
 *   `undergroundPlan` and `inventoryCheck`/`bridgeInventoryCheck` are real,
 *   by running the actual stages — not hand-built fixtures — up through
 *   FinalSafetyCheckStage. BuildPlanStage is deliberately NOT run here, so
 *   each test can mutate player/mock state first, exactly the way async
 *   staleness would happen for real.
 */
function buildContextThroughFinalSafetyCheck({
  player,
  dimension,
  railTypeId = "minecraft:rail",
  direction = "east",
  origin = { x: 1, y: 64, z: 0 },
  requestedLength = 5,
  buildingMode = BuildingMode.NORMAL,
  bridgeHeight = null,
  bridgeMaterialId = null,
  undergroundDepth = null,
}) {
  const request = {
    player,
    dimension,
    railTypeId,
    requestedLength,
    buildingMode,
    bridgeHeight,
    bridgeMaterialId,
    undergroundDepth,
    buildVector: createBuildVector(origin, direction),
  };
  const context = { request };

  terrainScanningStage.execute(context);
  inventoryStage.execute(context);
  finalSafetyCheckStage.execute(context);
  return context;
}

// ---------------------------------------------------------------------------
// 1. BuildPlan.fromContext() — NORMAL: flat terrain, no tunnel, no material.
// ---------------------------------------------------------------------------
{
  const dim = createMockDimension({ groundY: 63 });
  const player = createMockPlayer({ id: "bp1", gameMode: "Survival", heldItemTypeId: "minecraft:rail", items: [{ typeId: "minecraft:rail", amount: 10 }], dimension: dim });
  const context = buildContextThroughFinalSafetyCheck({ player, dimension: dim, requestedLength: 5 });
  const plan = BuildPlan.fromContext(context);

  assertEqual(plan.railPositions.length, 5, "NORMAL BuildPlan: 5 rail positions");
  assertEqual(plan.requiredRailCount, 5, "NORMAL BuildPlan: requiredRailCount matches actual length");
  assertEqual(plan.requiredMaterialId, null, "NORMAL BuildPlan: no material required");
  assertEqual(plan.bridgeHeight, null, "NORMAL BuildPlan: bridgeHeight null");
  assertEqual(plan.undergroundDepth, null, "NORMAL BuildPlan: undergroundDepth null");
  assertEqual(plan.startPosition, { x: 1, y: 64, z: 0 }, "NORMAL BuildPlan: startPosition is the origin");
  assertEqual(plan.endPosition, { x: 5, y: 64, z: 0 }, "NORMAL BuildPlan: endPosition is the last rail position");
  assertEqual(plan.modificationBoundary.size, 5, "NORMAL BuildPlan: boundary has exactly one entry per rail position (flat, no tunnel)");
  assertTrue(plan.containsPosition({ x: 3, y: 64, z: 0 }), "NORMAL BuildPlan: boundary contains a real rail position");
  assertTrue(!plan.containsPosition({ x: 3, y: 65, z: 0 }), "NORMAL BuildPlan: boundary does not contain an unrelated position");
}

// ---------------------------------------------------------------------------
// 2. BuildPlan.fromContext() — BRIDGE: support positions present, required
//    material count matches the plan's own count, no double counting.
// ---------------------------------------------------------------------------
{
  const dim = createMockDimension({ groundY: 60 });
  const player = createMockPlayer({
    id: "bp2",
    gameMode: "Survival",
    heldItemTypeId: "minecraft:rail",
    items: [
      { typeId: "minecraft:rail", amount: 20 },
      { typeId: "minecraft:cobblestone", amount: 40 },
    ],
    dimension: dim,
  });
  const context = buildContextThroughFinalSafetyCheck({
    player,
    dimension: dim,
    origin: { x: 1, y: 64, z: 0 },
    requestedLength: 9,
    buildingMode: BuildingMode.BRIDGE,
    bridgeHeight: 3,
    bridgeMaterialId: "minecraft:cobblestone",
  });
  const plan = BuildPlan.fromContext(context);

  assertEqual(plan.bridgeHeight, 3, "BRIDGE BuildPlan: bridgeHeight carried through");
  assertEqual(plan.bridgeMaterialId, "minecraft:cobblestone", "BRIDGE BuildPlan: bridgeMaterialId carried through");
  assertEqual(plan.requiredMaterialId, "minecraft:cobblestone", "BRIDGE BuildPlan: requiredMaterialId set");
  assertTrue(plan.bridgeSupportPositions.length > 0, "BRIDGE BuildPlan: support positions present (terrain below deck needed fill)");
  assertEqual(
    plan.requiredMaterialCount,
    context.bridgePlan.requiredSupportBlockCount,
    "BRIDGE BuildPlan: requiredMaterialCount matches BridgePlan's own count exactly"
  );
  // No double counting: the boundary's size must equal rail positions plus
  // support positions with NO overlap — BridgePlan.js's own doc guarantees
  // surfacePositions/supportPositions never overlap; this confirms the
  // combined boundary doesn't accidentally collapse anything real away.
  assertEqual(
    plan.modificationBoundary.size,
    plan.railPositions.length + plan.bridgeSupportPositions.length,
    "BRIDGE BuildPlan: boundary size == rails + support positions, no unexpected overlap"
  );
}

// ---------------------------------------------------------------------------
// 3. BuildPlan.fromContext() — UNDERGROUND: tunnel positions present; rail
//    positions ARE also excavation positions (by design), so the boundary
//    correctly deduplicates rather than double-counting them.
// ---------------------------------------------------------------------------
{
  const dim = createMockDimension({ groundY: 100 });
  const player = createMockPlayer({ id: "bp3", gameMode: "Creative", heldItemTypeId: "minecraft:rail", dimension: dim });
  const context = buildContextThroughFinalSafetyCheck({
    player,
    dimension: dim,
    origin: { x: 0, y: 70, z: 0 },
    requestedLength: 8,
    buildingMode: BuildingMode.UNDERGROUND,
    undergroundDepth: 5,
  });
  const plan = BuildPlan.fromContext(context);

  assertEqual(plan.undergroundDepth, 5, "UNDERGROUND BuildPlan: undergroundDepth carried through");
  assertEqual(plan.requiredRailCount, 8, "UNDERGROUND BuildPlan: requiredRailCount == railSteps.length");
  assertTrue(plan.tunnelPositions.length > 0, "UNDERGROUND BuildPlan: tunnel (excavation) positions present");
  const expectedUnique = new Set([...plan.railPositions, ...plan.tunnelPositions].map(positionKey)).size;
  assertEqual(plan.modificationBoundary.size, expectedUnique, "UNDERGROUND BuildPlan: boundary correctly deduplicates rail/excavation overlap");
  assertTrue(plan.modificationBoundary.size < plan.railPositions.length + plan.tunnelPositions.length, "UNDERGROUND BuildPlan: overlap was real and got collapsed, not double-counted");
}

// ---------------------------------------------------------------------------
// 4. ActiveBuildRegistry: claim/conflict/release, in isolation.
// ---------------------------------------------------------------------------
{
  const registry = new ActiveBuildRegistry();
  const keysA = ["1,64,0", "2,64,0", "3,64,0"];
  const keysB = ["3,64,0", "4,64,0"]; // overlaps keysA at "3,64,0"
  const keysC = ["10,64,0", "11,64,0"]; // fully disjoint from keysA

  const claimA = registry.claim("playerA", keysA);
  assertTrue(claimA.claimed, "ActiveBuildRegistry: first claim succeeds");

  const claimB = registry.claim("playerB", keysB);
  assertTrue(!claimB.claimed, "ActiveBuildRegistry: overlapping claim by a different owner fails");
  assertEqual(claimB.conflictingKeys, ["3,64,0"], "ActiveBuildRegistry: reports exactly the conflicting key");

  const claimC = registry.claim("playerC", keysC);
  assertTrue(claimC.claimed, "ActiveBuildRegistry: disjoint claim by a different owner succeeds");

  registry.release("playerA");
  const claimBAfterRelease = registry.claim("playerB", keysB);
  assertTrue(claimBAfterRelease.claimed, "ActiveBuildRegistry: claim succeeds once the conflicting owner releases");
}

// ---------------------------------------------------------------------------
// 5. BuildPlanStage: player disconnected immediately before construction.
// ---------------------------------------------------------------------------
{
  const dim = createMockDimension({ groundY: 63 });
  const player = createMockPlayer({ id: "bp5", gameMode: "Survival", heldItemTypeId: "minecraft:rail", items: [{ typeId: "minecraft:rail", amount: 10 }], dimension: dim });
  const context = buildContextThroughFinalSafetyCheck({ player, dimension: dim, requestedLength: 5 });

  player.isValid = false; // simulate a disconnect right before this stage runs
  const result = buildPlanStage.execute(context);

  assertEqual(result.status, PipelineResultStatus.VALIDATION_FAILED, "BuildPlanStage: disconnected player rejected");
  assertEqual(result.reason, "PLAYER_INVALID", "BuildPlanStage: correct reason");
  assertEqual(context.buildPlan, undefined, "BuildPlanStage: no plan assembled on rejection");
}

// ---------------------------------------------------------------------------
// 6. BuildPlanStage: player changed dimension immediately before construction.
// ---------------------------------------------------------------------------
{
  const dim = createMockDimension({ groundY: 63, id: "minecraft:overworld" });
  const netherDim = createMockDimension({ groundY: 63, id: "minecraft:nether" });
  const player = createMockPlayer({ id: "bp6", gameMode: "Survival", heldItemTypeId: "minecraft:rail", items: [{ typeId: "minecraft:rail", amount: 10 }], dimension: dim });
  const context = buildContextThroughFinalSafetyCheck({ player, dimension: dim, requestedLength: 5 });

  player.setDimension(netherDim);
  const result = buildPlanStage.execute(context);

  assertEqual(result.status, PipelineResultStatus.VALIDATION_FAILED, "BuildPlanStage: dimension change rejected");
  assertEqual(result.reason, "INVALID_DIMENSION", "BuildPlanStage: correct reason");
  assertTrue(Boolean(result.localizationKey), "BuildPlanStage: dimension change carries a localizationKey");
}

// ---------------------------------------------------------------------------
// 7. BuildPlanStage: held item swapped immediately before construction.
// ---------------------------------------------------------------------------
{
  const dim = createMockDimension({ groundY: 63 });
  const player = createMockPlayer({ id: "bp7", gameMode: "Survival", heldItemTypeId: "minecraft:rail", items: [{ typeId: "minecraft:rail", amount: 10 }], dimension: dim });
  const context = buildContextThroughFinalSafetyCheck({ player, dimension: dim, requestedLength: 5 });

  player.setHeldItem("minecraft:golden_rail");
  const result = buildPlanStage.execute(context);

  assertEqual(result.status, PipelineResultStatus.VALIDATION_FAILED, "BuildPlanStage: held item swap rejected");
  assertEqual(result.reason, "ITEM_CHANGED", "BuildPlanStage: correct reason");
}

// ---------------------------------------------------------------------------
// 8. BuildPlanStage: rails removed from inventory immediately before
//    construction (InventoryStage passed earlier; this is what changed
//    since then).
// ---------------------------------------------------------------------------
{
  const dim = createMockDimension({ groundY: 63 });
  const player = createMockPlayer({ id: "bp8", gameMode: "Survival", heldItemTypeId: "minecraft:rail", items: [{ typeId: "minecraft:rail", amount: 10 }], dimension: dim });
  const context = buildContextThroughFinalSafetyCheck({ player, dimension: dim, requestedLength: 5 });

  // Simulate the rails vanishing (traded away, dropped, etc.) between
  // InventoryStage's check and this final one.
  const inventory = player.getComponent("minecraft:inventory");
  for (let slot = 0; slot < inventory.container.size; slot++) {
    inventory.container.setItem(slot);
  }

  const result = buildPlanStage.execute(context);
  assertEqual(result.status, PipelineResultStatus.VALIDATION_FAILED, "BuildPlanStage: inventory gone stale rejected");
  assertEqual(result.reason, "INVENTORY_CHANGED_BEFORE_BUILD", "BuildPlanStage: correct reason");
  assertEqual(result.substitutions, [5, 0], "BuildPlanStage: substitutions are [required, available] — Required: 5, Available: 0");
}

// ---------------------------------------------------------------------------
// 9. BuildPlanStage: success path attaches a correct context.buildPlan.
// ---------------------------------------------------------------------------
{
  const dim = createMockDimension({ groundY: 63 });
  const player = createMockPlayer({ id: "bp9", gameMode: "Survival", heldItemTypeId: "minecraft:rail", items: [{ typeId: "minecraft:rail", amount: 10 }], dimension: dim });
  const context = buildContextThroughFinalSafetyCheck({ player, dimension: dim, requestedLength: 5 });

  const result = buildPlanStage.execute(context);
  assertEqual(result.status, PipelineResultStatus.SUCCESS, "BuildPlanStage: unmodified state succeeds");
  assertTrue(context.buildPlan instanceof BuildPlan, "BuildPlanStage: context.buildPlan is a real BuildPlan");
  assertEqual(context.buildPlan.requiredRailCount, 5, "BuildPlanStage: plan's requiredRailCount is correct");
}

// ---------------------------------------------------------------------------
// 10. PlacementStage: RAIL_CONFLICT — a second player's plan overlaps an
//     already-active build's claimed positions. Zero blocks placed, and
//     railBuilder.run() must never even be called.
//
//     Project Prompt 27 addition: also proves the claim now happens BEFORE
//     the mode-specific "construction started" chat message, not after —
//     see PlacementStage.js's own "BUG FIX (Project Prompt 27)" note. Before
//     that fix, a conflicting player would see "Building N rails..."
//     immediately followed by the RAIL_CONFLICT rejection message, even
//     though no construction had actually started.
// ---------------------------------------------------------------------------
{
  const dim = createMockDimension({ groundY: 63 });
  const registry = new ActiveBuildRegistry();
  const cancellationWatcher = new CancellationWatcher();
  const throwingRailBuilder = {
    run() {
      throw new Error("railBuilder.run() must never be called when a RAIL_CONFLICT is detected");
    },
  };
  const sentMessages = [];
  const trackingMessageService = {
    sendChat(player, key) {
      sentMessages.push(key);
    },
    sendActionBar() {},
  };
  const placementStage = new PlacementStage(throwingRailBuilder, cancellationWatcher, trackingMessageService, {}, registry);

  // Player A's build already holds (1,64,0)-(5,64,0).
  registry.claim("playerA", ["1,64,0", "2,64,0", "3,64,0", "4,64,0", "5,64,0"]);

  const playerB = createMockPlayer({ id: "playerB", gameMode: "Survival", heldItemTypeId: "minecraft:rail", items: [{ typeId: "minecraft:rail", amount: 10 }], dimension: dim });
  const contextB = buildContextThroughFinalSafetyCheck({ player: playerB, dimension: dim, origin: { x: 3, y: 64, z: 0 }, requestedLength: 5 });
  buildPlanStage.execute(contextB); // assembles contextB.buildPlan, overlapping playerA's claim at (3,64,0)-(5,64,0)

  const result = await placementStage.execute(contextB);
  assertEqual(result.status, PipelineResultStatus.VALIDATION_FAILED, "PlacementStage: overlapping build rejected");
  assertEqual(result.reason, "RAIL_CONFLICT", "PlacementStage: correct reason");
  assertEqual(contextB.buildSession, undefined, "PlacementStage: no session created — placement never started");
  assertEqual(dim.getBlock({ x: 4, y: 64, z: 0 }).typeId, "minecraft:air", "PlacementStage: nothing was placed in the conflicting area");
  assertEqual(sentMessages.length, 0, "PlacementStage: no 'construction started' (or any other) message sent when the conflict claim is rejected");

  registry.release("playerA");
}

// ---------------------------------------------------------------------------
// 11. ValidationErrorCategory.categorize() — spot-check the mapping table.
// ---------------------------------------------------------------------------
{
  assertEqual(categorize("LENGTH_OUT_OF_RANGE"), ValidationErrorCategory.INVALID_LENGTH, "categorize: LENGTH_OUT_OF_RANGE -> INVALID_LENGTH");
  assertEqual(categorize("BRIDGEHEIGHT_OUT_OF_RANGE"), ValidationErrorCategory.INVALID_HEIGHT, "categorize: BRIDGEHEIGHT_OUT_OF_RANGE -> INVALID_HEIGHT");
  assertEqual(categorize("UNDERGROUNDDEPTH_OUT_OF_RANGE"), ValidationErrorCategory.INVALID_DEPTH, "categorize: UNDERGROUNDDEPTH_OUT_OF_RANGE -> INVALID_DEPTH");
  assertEqual(categorize("INSUFFICIENT_RAILS"), ValidationErrorCategory.INSUFFICIENT_RAILS, "categorize: INSUFFICIENT_RAILS -> INSUFFICIENT_RAILS");
  assertEqual(categorize("INSUFFICIENT_MATERIAL"), ValidationErrorCategory.INSUFFICIENT_MATERIAL, "categorize: INSUFFICIENT_MATERIAL -> INSUFFICIENT_MATERIAL");
  assertEqual(categorize("BLOCKED_BY_LAVA"), ValidationErrorCategory.UNSAFE_LAVA, "categorize: BLOCKED_BY_LAVA -> UNSAFE_LAVA");
  assertEqual(categorize("BLOCKED_BY_UNBREAKABLE"), ValidationErrorCategory.UNBREAKABLE_BLOCK, "categorize: BLOCKED_BY_UNBREAKABLE -> UNBREAKABLE_BLOCK");
  assertEqual(categorize("UNLOADED_CHUNK"), ValidationErrorCategory.CHUNK_UNAVAILABLE, "categorize: UNLOADED_CHUNK -> CHUNK_UNAVAILABLE");
  assertEqual(categorize("RAIL_CONFLICT"), ValidationErrorCategory.RAIL_CONFLICT, "categorize: RAIL_CONFLICT -> RAIL_CONFLICT");
  assertEqual(categorize("LOW_CLEARANCE"), ValidationErrorCategory.INSUFFICIENT_CLEARANCE, "categorize: LOW_CLEARANCE -> INSUFFICIENT_CLEARANCE");
  assertEqual(categorize("PLAYER_INVALID"), ValidationErrorCategory.INVALID_PLAYER_STATE, "categorize: PLAYER_INVALID -> INVALID_PLAYER_STATE");
  assertEqual(categorize("SOMETHING_NEW_NOBODY_ADDED_YET"), ValidationErrorCategory.UNKNOWN, "categorize: unrecognized reason -> UNKNOWN, never guessed");
}

// ---------------------------------------------------------------------------
// 12. BuildOrchestrator: "STATUS: CANNOT BUILD" is sent before the specific
//     reason for a real, zero-modification rejection — not for a partial
//     PLACEMENT_INCOMPLETE stop.
// ---------------------------------------------------------------------------
{
  // Reuses the pattern established in integration.test.mjs: build the real
  // dependency graph with a scripted BuildMenu stub, then call
  // orchestrator.startBuild() (not pipeline.run() directly) specifically to
  // exercise BuildOrchestrator._reportResult()'s chat-message framing.
  const messageService = new MessageService();
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
    new BuildRequestCreationStage(
      { async promptForMode() { return { cancelled: false, mode: "NORMAL" }; }, async promptForConfiguration() { return { cancelled: false, length: 10 }; }, async promptForSummary() { return { cancelled: false, confirmed: true }; } },
      inventoryManager
    ),
    new ValidationStage(validationManager, messageService),
    new ModeAvailabilityStage(),
    terrainScanningStage,
    inventoryStage,
  ]);
  const orchestrator = new BuildOrchestrator({ pipeline, messageService });

  const dim = createMockDimension({ groundY: 63 });
  const player = createMockPlayer({
    id: "bp12",
    gameMode: "Survival",
    heldItemTypeId: "minecraft:rail",
    items: [{ typeId: "minecraft:rail", amount: 2 }], // not enough for length 10
    location: { x: 0, y: 64, z: 0 },
    rotation: { x: 0, y: 270 },
    dimension: dim,
  });

  await orchestrator.startBuild(player, "minecraft:rail");

  assertTrue(player.sentChatMessages.length >= 2, "BuildOrchestrator: at least 2 chat messages sent (status + reason)");
  assertEqual(player.sentChatMessages[0].translate, LocalizationKeys.STATUS_CANNOT_BUILD, "BuildOrchestrator: first message is the CANNOT BUILD status line");
  assertEqual(player.sentChatMessages[1].translate, LocalizationKeys.INVENTORY_INSUFFICIENT, "BuildOrchestrator: second message is the specific reason");
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
