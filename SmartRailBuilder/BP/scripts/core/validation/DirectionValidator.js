import { CardinalDirection } from "../../utils/DirectionUtils.js";
import { LocalizationKeys } from "../../localization/LocalizationKeys.js";

/**
 * DirectionValidator.js
 *
 * PURPOSE
 *   Confirms `request.buildVector.direction` is one of the 4 recognized
 *   cardinal directions. Under normal operation this is unreachable —
 *   `DirectionUtils.fromViewDirection` (see utils/DirectionUtils.js) always
 *   returns a valid CardinalDirection, never null/undefined — but this
 *   validator exists for the same reason RailDetectionStage's redundant
 *   check does: independent testability and a clear, specific failure
 *   message if a future change to direction computation ever introduces a
 *   bug, instead of an obscure downstream error.
 *
 * DEPENDENCIES
 *   - utils/DirectionUtils.js (CardinalDirection)
 *   - localization/LocalizationKeys.js
 */

const VALID_DIRECTIONS = Object.freeze(Object.values(CardinalDirection));

export class DirectionValidator {
  constructor() {
    this.name = "DirectionValidator";
  }

  /**
   * @param {import("../BuildRequest.js").BuildRequest} request
   * @returns {import("./ValidationManager.js").ValidationResult}
   */
  validate(request) {
    const direction = request.buildVector?.direction;
    if (!direction || !VALID_DIRECTIONS.includes(direction)) {
      return {
        valid: false,
        reason: "INVALID_DIRECTION",
        localizationKey: LocalizationKeys.VALIDATION_INVALID_DIRECTION,
      };
    }
    return { valid: true };
  }
}
