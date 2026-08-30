/**
 * PipelineContext.js
 *
 * PURPOSE
 *   The single mutable object threaded through every stage of a
 *   BuildPipeline run. Each stage reads what earlier stages produced and
 *   writes its own contribution — RailDetectionStage confirms a rail type,
 *   BuildRequestCreationStage attaches a `request`, ValidationStage attaches
 *   a `validationResult`, and so on.
 *
 * RESPONSIBILITIES
 *   - Hold the inputs every build starts with (player, railTypeId).
 *   - Provide named, optional slots for what later stages attach, so the
 *     shape is self-documenting instead of stages inventing ad hoc property
 *     names.
 *   - Hold `lifecycleState` (see ./RequestLifecycleState.js), the one field
 *     BuildPipeline itself writes to rather than an individual stage —
 *     added Project Prompt 9.
 *
 * FUTURE EXTENSIONS
 *   - New stages add a new named, optional field here (e.g. `terrainReport`
 *     for TerrainScanningStage once it's real) — adding an optional field is
 *     additive, never a breaking change for existing stages that don't read it.
 *
 * DEPENDENCIES
 *   - ./RequestLifecycleState.js
 */

import { RequestLifecycleState } from "./RequestLifecycleState.js";

export class PipelineContext {
  /**
   * @param {Object} params
   * @param {import("@minecraft/server").Player} params.player
   * @param {string} params.railTypeId Vanilla item type ID captured at trigger time.
   */
  constructor({ player, railTypeId }) {
    /** @readonly */
    this.player = player;
    /** @readonly */
    this.railTypeId = railTypeId;

    /**
     * Written only by BuildPipeline.run() as the request progresses — see
     * RequestLifecycleState.js for the states and BuildPipeline.js for the
     * exact transition rules. Starts undefined: no request exists yet at
     * the moment a PipelineContext is first constructed (RailDetectionStage
     * hasn't even confirmed the rail type yet).
     * @type {import("./RequestLifecycleState.js").RequestLifecycleState|undefined}
     */
    this.lifecycleState = undefined;

    // --- Populated by later stages (all start undefined) ---
    /** @type {import("../BuildRequest.js").BuildRequest|undefined} Set by BuildRequestCreationStage. */
    this.request = undefined;
    /** @type {import("../validation/ValidationManager.js").ValidationResult|undefined} Set by ValidationStage. */
    this.validationResult = undefined;
    /** @type {import("../../terrain/TerrainScanner.js").TerrainScanResult|undefined} Set by TerrainScanningStage (Project Prompt 7). NORMAL mode only — see `bridgePlan` below for BRIDGE mode's equivalent. */
    this.terrainReport = undefined;
    /** @type {import("../../terrain/PathValidator.js").PathValidationResult|undefined} Set by TerrainScanningStage (Project Prompt 11 — PathValidator is now real). NORMAL mode only. */
    this.pathValidationResult = undefined;
    /** @type {import("../../terrain/BridgePlan.js").BridgePlan|undefined} Set by TerrainScanningStage when `request.buildingMode` is BRIDGE (Project Prompt 16) — `terrainReport`/`pathValidationResult` above are left undefined for a bridge build; nothing downstream should read them expecting NORMAL-mode shape. Re-set to a fresh plan by FinalSafetyCheckStage, mirroring how it replaces `terrainReport` for NORMAL mode. */
    this.bridgePlan = undefined;
    /** @type {import("../../terrain/UndergroundPlan.js").UndergroundPlan|undefined} Set by TerrainScanningStage when `request.buildingMode` is UNDERGROUND (Project Prompt 17) — exact counterpart of `bridgePlan` above, and equally exclusive: exactly one of `terrainReport`/`bridgePlan`/`undergroundPlan` is populated for any given build, decided by the request's mode, which is fixed for the request's whole lifetime. Also re-set to a fresh plan by FinalSafetyCheckStage. */
    this.undergroundPlan = undefined;
    /** @type {import("../../inventory/InventoryManager.js").InventoryReport|undefined} Set by InventoryStage. For BRIDGE mode this is the RAIL item's report; see `bridgeInventoryCheck` below for the bridge material's own report (Project Prompt 16). */
    this.inventoryCheck = undefined;
    /** @type {import("../../inventory/InventoryManager.js").InventoryReport|undefined} Set by InventoryStage, BRIDGE mode only (Project Prompt 16) — the bridge material's own InventoryReport, checked in addition to `inventoryCheck` (rails). Undefined for NORMAL mode. */
    this.bridgeInventoryCheck = undefined;
    /** @type {import("../BuildSession.js").BuildSession|undefined} Set by PlacementStage (Project Prompt 10). */
    this.buildSession = undefined;
    /** @type {import("../../builder/strategies/RailBuildStrategy.js").BuildResult|undefined} Set by PlacementStage (Project Prompt 10). */
    this.placementResult = undefined;
  }
}
