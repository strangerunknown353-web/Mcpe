import { GameMode } from "@minecraft/server";
import { LocalizationKeys } from "../../localization/LocalizationKeys.js";

/**
 * GameModeValidator.js
 *
 * PURPOSE
 *   Confirms the player is in a game mode Ryzen Rail Builder actually
 *   supports (Survival or Creative, per Project Prompt 2's finalized scope).
 *   New this session — Project Prompt 4's validation only branched on game
 *   mode implicitly (through length limits); this makes it an explicit,
 *   independent check with its own message, so an Adventure-mode player
 *   holding a rail item gets a clear reason instead of a confusing failure
 *   further down the chain.
 *
 * DEPENDENCIES
 *   - @minecraft/server (GameMode)
 *   - localization/LocalizationKeys.js
 */

const SUPPORTED_GAME_MODES = Object.freeze([GameMode.Survival, GameMode.Creative]);

export class GameModeValidator {
  constructor() {
    this.name = "GameModeValidator";
  }

  /**
   * @param {import("../BuildRequest.js").BuildRequest} request
   * @returns {import("./ValidationManager.js").ValidationResult}
   */
  validate(request) {
    const gameMode = request.player.getGameMode();
    if (!SUPPORTED_GAME_MODES.includes(gameMode)) {
      return {
        valid: false,
        reason: "UNSUPPORTED_GAME_MODE",
        localizationKey: LocalizationKeys.VALIDATION_UNSUPPORTED_GAME_MODE,
      };
    }
    return { valid: true };
  }
}
