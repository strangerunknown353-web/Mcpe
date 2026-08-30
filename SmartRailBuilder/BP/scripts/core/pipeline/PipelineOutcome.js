import { PipelineResultStatus } from "./PipelineResult.js";

/**
 * PipelineOutcome.js
 *
 * PURPOSE
 *   Project Prompt 9 asked for standardized pipeline outcomes — "Build
 *   Accepted, Validation Failed, Inventory Failed, Terrain Failed,
 *   Cancelled, Unexpected Error" — that "future systems must consume."
 *   `PipelineResult.status` (see ./PipelineResult.js) already distinguishes
 *   *processing* states (SUCCESS/CANCELLED/VALIDATION_FAILED/
 *   UNEXPECTED_ERROR/FUTURE_EXPANSION), but doesn't distinguish *which*
 *   kind of validation failure occurred — that information exists only as
 *   `result.stageName`, which every caller would otherwise need to
 *   cross-reference by hand. This module is that cross-reference, done
 *   once, in one place.
 *
 * RESPONSIBILITIES
 *   - Define the closed set of outcome categories.
 *   - Classify any terminal PipelineResult into exactly one of them.
 *
 * WHY THIS IS SEPARATE FROM RequestLifecycleState.js
 *   `RequestLifecycleState` is a live property that changes several times
 *   over one pipeline run (coarse-grained: "what phase is this request in
 *   right now"). `PipelineOutcome` is computed once, only at the end, from
 *   the terminal result (fine-grained: "specifically why did it end here").
 *   A request that ends up FAILED (lifecycle state) could be
 *   VALIDATION_FAILED, TERRAIN_FAILED, or INVENTORY_FAILED (outcome) —
 *   the two concepts answer different questions and neither replaces the
 *   other. See ARCHITECTURE.md §27.2 for the full reasoning.
 *
 * DEPENDENCIES
 *   - ./PipelineResult.js (PipelineResultStatus)
 */

/** @enum {string} */
export const PipelineOutcome = Object.freeze({
  /**
   * status was SUCCESS. Genuinely reachable since Project Prompt 10, when
   * PlacementStage became real (confirmed by test that session) — this
   * comment previously said "not reachable yet" and was stale; corrected
   * during Project Prompt 11's review rather than left to drift further.
   */
  BUILD_ACCEPTED: "BUILD_ACCEPTED",
  /** VALIDATION_FAILED at ValidationStage (player/game mode/item/direction/origin/length/permission). */
  VALIDATION_FAILED: "VALIDATION_FAILED",
  /**
   * VALIDATION_FAILED at TerrainScanningStage or FinalSafetyCheckStage.
   * FinalSafetyCheckStage has been real since Project Prompt 10.
   * TerrainScanningStage's own rejection is real as of Project Prompt 11,
   * now that PathValidator is implemented — previously that path was
   * unreachable because PathValidator was a stub.
   */
  TERRAIN_FAILED: "TERRAIN_FAILED",
  /** VALIDATION_FAILED at InventoryStage — real and reachable as of Project Prompt 8. */
  INVENTORY_FAILED: "INVENTORY_FAILED",
  /**
   * VALIDATION_FAILED at PlacementStage — new Project Prompt 10. A build
   * that started but stopped partway (terrain changed mid-build, ran out
   * of resources, a chunk unloaded, a placement error). Distinct from the
   * other _FAILED categories because, unlike them, some rails were likely
   * already placed and kept, per the finalized interruption policy — this
   * is "stopped," not "rejected outright."
   */
  PLACEMENT_INCOMPLETE: "PLACEMENT_INCOMPLETE",
  /** The player closed the build menu. */
  CANCELLED: "CANCELLED",
  /** An unhandled exception was caught by BuildPipeline. */
  UNEXPECTED_ERROR: "UNEXPECTED_ERROR",
  /**
   * status was FUTURE_EXPANSION — the current, typical result for a fully
   * valid request: every implemented check passed, and the pipeline
   * correctly stopped at a stage whose real logic isn't built yet
   * (currently always PlacementStage, once terrain and inventory both
   * pass). Not one of Project Prompt 9's explicitly-listed outcomes, but a
   * real, common, current result — included here rather than forced into
   * one of the other categories, so nothing this common is misrepresented.
   */
  PENDING_FUTURE_WORK: "PENDING_FUTURE_WORK",
});

/**
 * @param {import("./PipelineResult.js").PipelineResult} result A terminal result from BuildPipeline.run().
 * @returns {PipelineOutcome}
 */
export function classifyOutcome(result) {
  switch (result.status) {
    case PipelineResultStatus.SUCCESS:
      return PipelineOutcome.BUILD_ACCEPTED;
    case PipelineResultStatus.CANCELLED:
      return PipelineOutcome.CANCELLED;
    case PipelineResultStatus.UNEXPECTED_ERROR:
      return PipelineOutcome.UNEXPECTED_ERROR;
    case PipelineResultStatus.FUTURE_EXPANSION:
      return PipelineOutcome.PENDING_FUTURE_WORK;
    case PipelineResultStatus.VALIDATION_FAILED:
      if (result.stageName === "InventoryStage") return PipelineOutcome.INVENTORY_FAILED;
      if (result.stageName === "TerrainScanningStage" || result.stageName === "FinalSafetyCheckStage") {
        return PipelineOutcome.TERRAIN_FAILED;
      }
      if (result.stageName === "PlacementStage") return PipelineOutcome.PLACEMENT_INCOMPLETE;
      return PipelineOutcome.VALIDATION_FAILED;
    default:
      return PipelineOutcome.UNEXPECTED_ERROR;
  }
}
