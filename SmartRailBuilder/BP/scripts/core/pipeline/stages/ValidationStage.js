import { LocalizationKeys } from "../../../localization/LocalizationKeys.js";
import { PipelineResult } from "../PipelineResult.js";

/**
 * ValidationStage.js
 *
 * PURPOSE
 *   Third pipeline stage. Thin adapter between ValidationManager (see
 *   ../../validation/ValidationManager.js, which knows nothing about the
 *   pipeline) and PipelineResult (which ValidationManager knows nothing
 *   about). All the actual validation logic lives in ValidationManager and
 *   its injected validators — this file's only job is translating one
 *   result shape into the other, plus (Project Prompt 9) a brief actionbar
 *   progress ping so the player sees something happening.
 *
 * BUG FIX (Project Prompt 12 pre-work): this adapter previously dropped
 * `result.substitutions` when building the VALIDATION_FAILED PipelineResult
 * — any validator returning e.g. `{ substitutions: [min, max] }` would have
 * that data silently discarded, and the player would see an unfilled
 * placeholder like "between %1$s and %2$s blocks" instead of real numbers.
 * No validator populated `substitutions` until LengthValidator started doing
 * so this session, so this had not yet visibly manifested. Now matches
 * InventoryStage.js's already-correct pattern (see that file).
 *
 * DEPENDENCIES
 *   - core/validation/ValidationManager.js (injected)
 *   - ui/MessageService.js (injected — new this session, actionbar only,
 *     never chat, per MessageService.js's own chat-vs-actionbar reasoning)
 *   - localization/LocalizationKeys.js
 *   - ../PipelineResult.js
 */

export class ValidationStage {
  /**
   * @param {import("../../validation/ValidationManager.js").ValidationManager} validationManager
   * @param {import("../../../ui/MessageService.js").MessageService} messageService
   */
  constructor(validationManager, messageService) {
    this.name = "ValidationStage";
    /** @private */
    this._validationManager = validationManager;
    /** @private */
    this._messageService = messageService;
  }

  /**
   * @param {import("../PipelineContext.js").PipelineContext} context
   * @returns {PipelineResult}
   */
  execute(context) {
    this._messageService.sendActionBar(context.request.player, LocalizationKeys.ACTIONBAR_PREPARING);

    const result = this._validationManager.validate(context.request);
    context.validationResult = result;

    if (!result.valid) {
      return PipelineResult.validationFailed(this.name, result.reason, result.localizationKey, result.substitutions);
    }
    return PipelineResult.success();
  }
}
