import { RAIL_ITEM_IDS } from "../../../config/RailConfig.js";
import { PipelineResult } from "../PipelineResult.js";

/**
 * RailDetectionStage.js
 *
 * PURPOSE
 *   First stage in the pipeline. Confirms `context.railTypeId` is one of
 *   the 4 recognized vanilla rail items. In normal operation this is
 *   redundant with main.js's event-listener filter (which decides whether
 *   to run the pipeline at all) — that redundancy is intentional: it makes
 *   the pipeline independently correct and independently testable without
 *   needing to go through a real Bedrock event first, per Project Prompt 5's
 *   "design every manager so it can be tested independently" requirement.
 *
 * DEPENDENCIES
 *   - config/RailConfig.js (RAIL_ITEM_IDS)
 *   - ../PipelineResult.js
 */

export class RailDetectionStage {
  constructor() {
    this.name = "RailDetectionStage";
  }

  /**
   * @param {import("../PipelineContext.js").PipelineContext} context
   * @returns {PipelineResult}
   */
  execute(context) {
    if (!context.railTypeId || !RAIL_ITEM_IDS.includes(context.railTypeId)) {
      return PipelineResult.unexpectedError(this.name, new Error(`Unrecognized rail type: ${context.railTypeId}`));
    }
    return PipelineResult.success();
  }
}
