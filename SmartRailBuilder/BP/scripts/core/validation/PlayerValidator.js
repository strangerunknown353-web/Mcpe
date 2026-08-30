/**
 * PlayerValidator.js
 *
 * PURPOSE
 *   Confirms the player behind a BuildRequest still exists (hasn't
 *   disconnected between the menu opening and this validation running).
 *
 * DEPENDENCIES
 *   None.
 */

export class PlayerValidator {
  constructor() {
    this.name = "PlayerValidator";
  }

  /**
   * @param {import("../BuildRequest.js").BuildRequest} request
   * @returns {import("./ValidationManager.js").ValidationResult}
   */
  validate(request) {
    if (!request.player || !request.player.isValid) {
      // No localizationKey — a player who no longer exists can't receive one.
      return { valid: false, reason: "PLAYER_INVALID" };
    }
    return { valid: true };
  }
}
