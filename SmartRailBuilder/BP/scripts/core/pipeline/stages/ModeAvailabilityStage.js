import { BUILD_MODE_REGISTRY } from "../../../config/BuildModes.js";
import { LocalizationKeys } from "../../../localization/LocalizationKeys.js";
import { Logger } from "../../../utils/Logger.js";
import { PipelineResult } from "../PipelineResult.js";

/**
 * ModeAvailabilityStage.js
 *
 * PURPOSE (Project Prompt 15)
 *   New pipeline stage, inserted between ValidationStage and
 *   TerrainScanningStage. Stops a request cleanly, with an honest
 *   player-facing message, when `context.request.buildingMode`'s
 *   construction engine isn't wired into the pipeline yet
 *   (`BUILD_MODE_REGISTRY[mode].implemented === false` — BRIDGE and
 *   UNDERGROUND both, this session; see config/BuildModes.js).
 *
 * WHY THIS STAGE EXISTS, RATHER THAN LETTING TerrainScanningStage FAIL
 * NATURALLY
 *   TerrainScanner/PathValidator only understand NORMAL-mode terrain rules
 *   today (flat/slope/tunnel over a straight path) — they were never told
 *   about a chosen bridge height or underground depth, and Project Prompt
 *   15 explicitly scopes those construction algorithms OUT of this
 *   session. Running TerrainScanningStage anyway for a BRIDGE/UNDERGROUND
 *   request would either silently ignore the player's chosen height/depth
 *   (scanning ordinary NORMAL terrain instead — actively misleading, since
 *   the summary screen just confirmed a "Bridge, height 8" build) or throw
 *   an unexpected error. Neither is acceptable per this project's "bugs
 *   must be disclosed honestly, never silently smoothed over" standard.
 *   A named, explicit gate here means a Bridge/Underground request is
 *   rejected for the true reason ("not built yet"), not a confusing
 *   downstream symptom.
 *
 * WHY NOT A VALIDATION_FAILED RESULT
 *   The request IS valid — ValidationStage and ModeConfigValidator already
 *   confirmed the mode and its height/depth are well-formed. This isn't a
 *   rejection of bad input; it's the pipeline correctly stopping at a
 *   real, named stage whose logic isn't built yet — exactly
 *   PipelineResultStatus.FUTURE_EXPANSION's documented purpose (see
 *   PipelineResult.js), which had been unused/unreachable since every
 *   other stage went from stub to real between Project Prompts 7-11. This
 *   session is the first time a FUTURE_EXPANSION result carries a
 *   `localizationKey` — see PipelineResult.futureExpansion's Project
 *   Prompt 15 extension and BuildOrchestrator.js's matching
 *   PENDING_FUTURE_WORK case, both updated this session specifically so
 *   this stage's message actually reaches the player instead of being
 *   silently logged only (which was correct for every PRIOR stage this
 *   status could apply to, since a player never explicitly chose to
 *   trigger them).
 *
 * RESPONSIBILITIES
 *   - Look up the request's buildingMode in BUILD_MODE_REGISTRY.
 *   - If `implemented` is true (NORMAL today), pass through untouched.
 *   - Otherwise, stop the pipeline with FUTURE_EXPANSION, a clear
 *     MODE_NOT_YET_AVAILABLE message, and the mode's display name as a
 *     substitution.
 *
 * DEPENDENCIES
 *   - config/BuildModes.js (BUILD_MODE_REGISTRY)
 *   - localization/LocalizationKeys.js
 *   - utils/Logger.js
 *   - ../PipelineResult.js
 */

export class ModeAvailabilityStage {
  constructor() {
    this.name = "ModeAvailabilityStage";
  }

  /**
   * @param {import("../PipelineContext.js").PipelineContext} context
   * @returns {PipelineResult}
   */
  execute(context) {
    const modeDef = BUILD_MODE_REGISTRY[context.request.buildingMode];

    if (modeDef?.implemented) {
      return PipelineResult.success();
    }

    Logger.info(
      `${context.request.player.name} configured a valid ${context.request.buildingMode} build, ` +
        "but that mode's construction engine isn't implemented yet — stopping cleanly."
    );

    return PipelineResult.futureExpansion(
      this.name,
      `${context.request.buildingMode}_MODE_NOT_IMPLEMENTED`,
      LocalizationKeys.MODE_NOT_YET_AVAILABLE,
      [modeDef?.displayName ?? context.request.buildingMode]
    );
  }
}
