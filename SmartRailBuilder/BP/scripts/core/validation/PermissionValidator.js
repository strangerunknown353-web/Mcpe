import { LocalizationKeys } from "../../localization/LocalizationKeys.js";

/**
 * PermissionValidator.js
 *
 * PURPOSE
 *   A real, permanent hook for a future permission or claims/region system —
 *   not a placeholder comment. Its body always passes today because no such
 *   system exists yet. A future integration (precedented by RyzenVeinMiner's
 *   multiplayer claims registry) replaces only this file's `validate()`
 *   body; ValidationManager, the Validator contract, and every other
 *   validator are unaffected.
 *
 *   `LocalizationKeys.VALIDATION_NOT_ALLOWED` is already declared and has
 *   real English text in en_US.lang, ready for the day this validator's
 *   body actually has a reason to return it.
 *
 * DEPENDENCIES
 *   - localization/LocalizationKeys.js
 */

export class PermissionValidator {
  constructor() {
    this.name = "PermissionValidator";
  }

  /**
   * @param {import("../BuildRequest.js").BuildRequest} request
   * @returns {import("./ValidationManager.js").ValidationResult}
   */
  validate(request) {
    void LocalizationKeys.VALIDATION_NOT_ALLOWED; // referenced for the future body noted above
    return { valid: true };
  }
}
