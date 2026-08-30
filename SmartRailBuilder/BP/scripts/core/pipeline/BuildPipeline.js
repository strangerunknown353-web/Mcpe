import { Logger } from "../../utils/Logger.js";
import { PipelineResult, PipelineResultStatus } from "./PipelineResult.js";
import { RequestLifecycleState } from "./RequestLifecycleState.js";

/**
 * BuildPipeline.js
 *
 * PURPOSE
 *   Runs an ordered list of PipelineStage objects (see ./PipelineStage.js)
 *   against a single PipelineContext, stopping at the first stage that
 *   doesn't return PipelineResultStatus.SUCCESS. This is the "brain" of the
 *   addon requested in Project Prompt 5: every future capability (terrain
 *   scanning, inventory checks, placement) is added by inserting a new stage
 *   into the list this class is constructed with.
 *
 * REVISED CLAIM (Project Prompt 9): Project Prompt 5's header said "this
 * class is intentionally 'finished' ... new behavior is new stages, not
 * changes here." That held for four sessions. It no longer fully holds:
 * Project Prompt 9 asked for a request lifecycle and structured per-stage
 * debug logging, and the least-duplicative place to implement both is
 * exactly here, once, rather than as boilerplate every individual stage
 * would otherwise repeat. This is still not "new pipeline behavior" in the
 * sense the original claim meant (no new stage-skipping, no new branching
 * of what runs) — it's bookkeeping *around* the same unchanged run loop.
 *
 * RESPONSIBILITIES
 *   - Iterate stages in order, awaiting each `execute(context)`.
 *   - Catch any exception a stage throws and convert it into a
 *     PipelineResultStatus.UNEXPECTED_ERROR result — a bug in one stage can
 *     never crash the addon or leave the pipeline half-run.
 *   - Stop immediately (never partially execute later stages) the moment a
 *     non-SUCCESS result is produced, whatever the reason.
 *   - Update `context.lifecycleState` as the request progresses (Project
 *     Prompt 9) — see `_lifecycleStateFor()` below for the exact rules.
 *     This is the ONLY place in the codebase that writes this field.
 *   - Log a structured "entering stage" debug line before every stage runs,
 *     so every stage gets consistent debug visibility without needing to
 *     remember to log it itself.
 *
 * FUTURE EXTENSIONS
 *   - New stages are still just new entries in the array this class is
 *     constructed with. `_lifecycleStateFor()`'s stage-name lookup needs
 *     one new entry when a genuinely new *phase* is introduced (e.g. a
 *     future PlacementStage that actually places blocks would move from
 *     implicitly "READY" to a real in-progress state) — everything else is
 *     unaffected.
 *
 * DEPENDENCIES
 *   - ./PipelineResult.js
 *   - ./RequestLifecycleState.js
 *   - utils/Logger.js
 */

/**
 * Maps a stage name to the lifecycle state a request enters right before
 * that stage runs. Stages not listed here don't change the lifecycle state
 * on entry (currently just RailDetectionStage, which runs before any
 * BuildRequest exists — there's nothing to report a lifecycle for yet).
 * @type {Readonly<Record<string, string>>}
 */
const STAGE_ENTRY_LIFECYCLE_STATE = Object.freeze({
  BuildRequestCreationStage: RequestLifecycleState.CREATED,
  ValidationStage: RequestLifecycleState.VALIDATING,
  // Added Project Prompt 15: gates BRIDGE/UNDERGROUND requests whose
  // construction engines aren't wired in yet. Runs after ValidationStage
  // (mode/height/depth already confirmed well-formed) and before
  // TerrainScanningStage (which only understands NORMAL-mode terrain
  // rules) — see core/pipeline/stages/ModeAvailabilityStage.js.
  ModeAvailabilityStage: RequestLifecycleState.VALIDATING,
  TerrainScanningStage: RequestLifecycleState.VALIDATING,
  InventoryStage: RequestLifecycleState.VALIDATING,
  FinalSafetyCheckStage: RequestLifecycleState.VALIDATING,
  PlacementStage: RequestLifecycleState.READY,
  CompletionStage: RequestLifecycleState.COMPLETED,
});

export class BuildPipeline {
  /**
   * @param {ReadonlyArray<{name: string, execute: (context: import("./PipelineContext.js").PipelineContext) => (PipelineResult|Promise<PipelineResult>)}>} stages
   *   Ordered list of objects satisfying the PipelineStage contract.
   */
  constructor(stages) {
    /** @private */
    this._stages = stages;
  }

  /**
   * @param {import("./PipelineContext.js").PipelineContext} context
   * @returns {Promise<PipelineResult>} The result of the last stage run —
   *   SUCCESS only if every stage in the list succeeded.
   */
  async run(context) {
    for (const stage of this._stages) {
      const entryState = STAGE_ENTRY_LIFECYCLE_STATE[stage.name];
      if (entryState) {
        context.lifecycleState = entryState;
      }
      Logger.debug(`Entering stage "${stage.name}" (lifecycleState=${context.lifecycleState ?? "none yet"})`);

      let result;
      try {
        result = await stage.execute(context);
      } catch (error) {
        context.lifecycleState = RequestLifecycleState.FAILED;
        Logger.error(`Pipeline stage "${stage.name}" threw an unhandled error`, error);
        return PipelineResult.unexpectedError(stage.name, error);
      }

      if (!result.isSuccess()) {
        context.lifecycleState = this._terminalLifecycleStateFor(result);
        Logger.debug(`Pipeline stopped at "${stage.name}": ${result.status}${result.reason ? ` (${result.reason})` : ""}`);
        return result;
      }
    }
    context.lifecycleState = RequestLifecycleState.COMPLETED;
    return PipelineResult.success();
  }

  /**
   * @param {PipelineResult} result A non-SUCCESS terminal result.
   * @returns {import("./RequestLifecycleState.js").RequestLifecycleState}
   * @private
   */
  _terminalLifecycleStateFor(result) {
    if (result.status === PipelineResultStatus.CANCELLED) return RequestLifecycleState.CANCELLED;
    // FUTURE_EXPANSION means every implemented check passed and the
    // pipeline correctly stopped at a not-yet-built stage — that's "ready
    // and waiting," not a failure.
    if (result.status === PipelineResultStatus.FUTURE_EXPANSION) return RequestLifecycleState.READY;
    return RequestLifecycleState.FAILED;
  }
}
