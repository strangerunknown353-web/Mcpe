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

    Logger.info(
      `Build completed for ${player.name}: railType=${railTypeId}, length=${actualLength}, session=${sessionId}.`
    );

    this._messageService.sendChat(player, LocalizationKeys.CONSTRUCTION_COMPLETE, [
      actualLength,
      DirectionUtils.toDisplayName(buildVector.direction),
    ]);

    return PipelineResult.success();
  }
}
