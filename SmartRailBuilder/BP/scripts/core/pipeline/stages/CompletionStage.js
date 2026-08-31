import { DirectionUtils } from "../../../utils/DirectionUtils.js";
import { LocalizationKeys } from "../../../localization/LocalizationKeys.js";
import { Logger } from "../../../utils/Logger.js";
import { PipelineResult } from "../PipelineResult.js";

/**
 * CompletionStage.js
 *
 * PURPOSE
 *   Final pipeline stage, reached only if every earlier stage — including
 *   PlacementStage — returned SUCCESS, i.e. only for a fully-completed
 *   build. Real as of Project Prompt 10: sends the player a "build
 *   complete" chat message and logs a completion summary.
 *
 * PERFORMANCE METRICS (Project Prompt 23 §21)
 *   The completion summary now includes a practical duration split —
 *   "planning" (from `PipelineContext.createdAt`, set the instant the
 *   trigger fired, to `BuildSession.startedAt`, set the instant
 *   PlacementStage constructed the session — covers the menu round trip
 *   plus every validation/terrain/inventory stage) and "construction" (from
 *   `BuildSession.startedAt` to now — the actual multi-tick placement) —
 *   plus the plan's own required-rails/material counts and modification
 *   boundary size, when `context.buildPlan` is present (Project Prompt 22).
 *   This is a SINGLE `Logger.info` line per completed build, not new
 *   per-block logging — see Constants.js's `LOGGING.MIN_LEVEL` for how to
 *   silence it entirely (raising it past `INFO`) without a code change.
 *
 * DEPENDENCIES
 *   - utils/DirectionUtils.js (toDisplayName)
 *   - localization/LocalizationKeys.js
 *   - utils/Logger.js
 *   - ui/MessageService.js (injected)
 *   - ../PipelineResult.js
 */

export class CompletionStage {
  /**
   * @param {import("../../../ui/MessageService.js").MessageService} messageService
   */
  constructor(messageService) {
    this.name = "CompletionStage";
    /** @private */
    this._messageService = messageService;
  }

  /**
   * @param {import("../PipelineContext.js").PipelineContext} context
   * @returns {PipelineResult}
   */
  execute(context) {
    const { player, railTypeId, buildVector, sessionId } = context.request;
    // context.buildSession.targetLength is the ACTUAL final length — may
    // exceed context.request.requestedLength if a tunnel extended the
    // build (Project Prompt 14, second round). This stage only runs on
    // success, so buildSession is guaranteed populated by PlacementStage.
    // See BuildSession.js's header for the full fix.
    const actualLength = context.buildSession.targetLength;

    const planningDurationMs = context.buildSession.startedAt - context.createdAt;
    const constructionDurationMs = Date.now() - context.buildSession.startedAt;
    const planSummary = context.buildPlan
      ? `, requiredRails=${context.buildPlan.requiredRailCount}` +
        (context.buildPlan.requiredMaterialCount !== null ? `, requiredMaterial=${context.buildPlan.requiredMaterialCount}` : "") +
        `, modifiedPositions=${context.buildPlan.modificationBoundary.size}`
      : "";

    Logger.info(
      `Build completed for ${player.name}: railType=${railTypeId}, length=${actualLength}, session=${sessionId}` +
        `${planSummary}, planningMs=${planningDurationMs}, constructionMs=${constructionDurationMs}.`
    );

    this._messageService.sendChat(player, LocalizationKeys.CONSTRUCTION_COMPLETE, [
      actualLength,
      DirectionUtils.toDisplayName(buildVector.direction),
    ]);

    return PipelineResult.success();
  }
}
