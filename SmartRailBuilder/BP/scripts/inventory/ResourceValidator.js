import { GameMode } from "@minecraft/server";
import { LocalizationKeys } from "../localization/LocalizationKeys.js";

/**
 * ResourceValidator.js
 *
 * PURPOSE
 *   Turns an InventoryReport (see inventory/InventoryManager.js) into an
 *   accept/reject decision. Mirrors terrain/PathValidator.js's future role
 *   exactly: InventoryManager reads and reports facts, ResourceValidator is
 *   the only module that turns those facts into a decision. Never reads
 *   inventory itself, never modifies anything.
 *
 * CREATIVE MODE (Project Prompt 2 + Project Prompt 8)
 *   Creative Mode bypasses quantity verification entirely — a Creative
 *   player is never rejected for "not enough rails." This does NOT mean
 *   Creative players skip every check: they still need to be holding the
 *   desired rail item so the addon knows which type to build, but that's
 *   already enforced earlier in the pipeline by
 *   core/validation/HeldItemValidator.js, which runs during ValidationStage
 *   regardless of game mode. ResourceValidator doesn't re-check it.
 *
 * DEPENDENCIES
 *   - @minecraft/server (GameMode)
 *   - localization/LocalizationKeys.js
 */

/**
 * @typedef {Object} ResourceValidationResult
 * @property {boolean} valid
 * @property {string} reason "CREATIVE_BYPASS" | "SUFFICIENT" | "INSUFFICIENT_RAILS"
 * @property {string} [localizationKey] Present only when valid is false.
 * @property {(string|number)[]} [substitutions] Message parameters, e.g. [missingQuantity].
 */

export class ResourceValidator {
  /**
   * @param {import("./InventoryManager.js").InventoryReport} report
   * @param {import("@minecraft/server").GameMode} gameMode Live game mode, read fresh by the caller.
   * @returns {ResourceValidationResult}
   */
  validate(report, gameMode) {
    if (gameMode === GameMode.Creative) {
      return { valid: true, reason: "CREATIVE_BYPASS" };
    }

    if (!report.hasEnough) {
      return {
        valid: false,
        reason: "INSUFFICIENT_RAILS",
        localizationKey: LocalizationKeys.INVENTORY_INSUFFICIENT,
        substitutions: [report.missingQuantity],
      };
    }

    return { valid: true, reason: "SUFFICIENT" };
  }
}
