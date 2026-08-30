import { LocalizationKeys } from "../../localization/LocalizationKeys.js";

/**
 * OriginValidator.js
 *
 * PURPOSE
 *   Confirms the request's dimension exists and `buildVector.origin` is a
 *   set of finite coordinates. This is a STRUCTURAL check only — it does
 *   NOT judge whether the origin is a safe or buildable position (inside a
 *   wall, over a gap, underwater, unloaded, out of world bounds). That
 *   block-level safety judgment is intentionally deferred to
 *   terrain/PathValidator.js (Roadmap Phase 5), which is the only module
 *   with a reason to actually read blocks. Validating it here too would
 *   duplicate logic that's about to be built properly next phase — see
 *   ARCHITECTURE.md §19 for the full reasoning behind this scope boundary.
 *
 * DEPENDENCIES
 *   - localization/LocalizationKeys.js
 */

export class OriginValidator {
  constructor() {
    this.name = "OriginValidator";
  }

  /**
   * @param {import("../BuildRequest.js").BuildRequest} request
   * @returns {import("./ValidationManager.js").ValidationResult}
   */
  validate(request) {
    if (!request.dimension) {
      return {
        valid: false,
        reason: "INVALID_DIMENSION",
        localizationKey: LocalizationKeys.VALIDATION_INVALID_ORIGIN,
      };
    }

    const origin = request.buildVector?.origin;
    const hasFiniteCoordinates = origin && [origin.x, origin.y, origin.z].every(Number.isFinite);
    if (!hasFiniteCoordinates) {
      return {
        valid: false,
        reason: "INVALID_ORIGIN",
        localizationKey: LocalizationKeys.VALIDATION_INVALID_ORIGIN,
      };
    }

    return { valid: true };
  }
}
