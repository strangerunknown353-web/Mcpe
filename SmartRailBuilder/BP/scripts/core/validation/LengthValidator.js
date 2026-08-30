import { LENGTH_PRESETS } from "../../config/RailConfig.js";
import { LocalizationKeys } from "../../localization/LocalizationKeys.js";

/**
 * LengthValidator.js
 *
 * PURPOSE
 *   Confirms the requested build length is a finite number within
 *   RailConfig.LENGTH_PRESETS bounds. Both game modes share the same bounds
 *   this phase — see TODO.md for the deferred Creative "Unlimited" option.
 *
 * DEPENDENCIES
 *   - config/RailConfig.js (LENGTH_PRESETS)
 *   - localization/LocalizationKeys.js
 */

export class LengthValidator {
  constructor() {
    this.name = "LengthValidator";
  }

  /**
   * @param {import("../BuildRequest.js").BuildRequest} request
   * @returns {import("./ValidationManager.js").ValidationResult}
   */
  validate(request) {
    const length = request.requestedLength;
    if (!Number.isFinite(length) || length < LENGTH_PRESETS.MIN || length > LENGTH_PRESETS.MAX_SURVIVAL) {
      return {
        valid: false,
        reason: "LENGTH_OUT_OF_RANGE",
        localizationKey: LocalizationKeys.MENU_INVALID_LENGTH,
        substitutions: [LENGTH_PRESETS.MIN, LENGTH_PRESETS.MAX_SURVIVAL],
      };
    }
    return { valid: true };
  }
}
