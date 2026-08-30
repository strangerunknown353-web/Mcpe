/**
 * RequestLifecycleState.js
 *
 * PURPOSE
 *   A coarse-grained "where is this request right now" state, updated
 *   several times over the course of one BuildPipeline.run() call — unlike
 *   PipelineResult (see ./PipelineResult.js), which is a one-shot value
 *   describing how a single stage or the whole run ended. Project Prompt 9
 *   asked for "every request has a lifecycle"; this is that lifecycle.
 *
 * RESPONSIBILITIES
 *   - Define the closed set of states a request can be in.
 *   - Nothing else — this file is pure data, like CardinalDirection or
 *     PipelineResultStatus.
 *
 * OWNERSHIP
 *   BuildPipeline.js is the only module that writes
 *   `PipelineContext.lifecycleState` — see its own header for the exact
 *   transition rules. Everything else only reads it.
 *
 * DEPENDENCIES
 *   None.
 */

/** @enum {string} */
export const RequestLifecycleState = Object.freeze({
  /** A BuildRequest now exists (BuildRequestCreationStage succeeded). */
  CREATED: "CREATED",
  /** ValidationStage, TerrainScanningStage, or InventoryStage is running. */
  VALIDATING: "VALIDATING",
  /** Every currently-implemented check passed; waiting on PlacementStage. */
  READY: "READY",
  /** The player closed the build menu. */
  CANCELLED: "CANCELLED",
  /** Reserved — not reachable until PlacementStage/CompletionStage are real (Roadmap Phase 7+). */
  COMPLETED: "COMPLETED",
  /** A validation, inventory, or unexpected error stopped the request. */
  FAILED: "FAILED",
});
