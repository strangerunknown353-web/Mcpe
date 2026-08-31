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
 * @property {string} reason "CREATIVE_BYPASS" | "SUFFICIENT" | "INSUFFICIENT_RAILS" | "INSUFFICIENT_MATERIAL"
 * @property {string} [localizationKey] Present only when valid is false.
 * @property {(string|number)[]} [substitutions] Message parameters: [requiredQuantity, totalAvailable] —
 *   changed from a single [missingQuantity] Project Prompt 21, so rejection
 *   messages can show the "Required: X / Available: Y" format the UI polish
 *   pass asked for instead of a bare "need N more."
 */

export class ResourceValidator {
  /**
   * @param {import("./InventoryManager.js").InventoryReport} report
   * @param {import("@minecraft/server").GameMode} gameMode Live game mode, read fresh by the caller.
   * @param {"RAILS"|"MATERIAL"} [resourceKind] Added Project Prompt 22 — selects
   *   which insufficiency reason to report. Before this, every call
   *   (rails AND bridge material alike) hardcoded `"INSUFFICIENT_RAILS"`,
   *   which was actively misleading for a material shortfall — a real,
   *   found-and-fixed inconsistency (see ARCHITECTURE.md §51.2). Defaults to
   *   `"RAILS"` so every pre-existing call site (never passing this
   *   parameter) keeps its exact previous behavior.
   * @returns {ResourceValidationResult}
   */
  validate(report, gameMode, resourceKind = "RAILS") {
    if (gameMode === GameMode.Creative) {
      return { valid: true, reason: "CREATIVE_BYPASS" };
    }

    if (!report.hasEnough) {
      return {
        valid: false,
        reason: resourceKind === "MATERIAL" ? "INSUFFICIENT_MATERIAL" : "INSUFFICIENT_RAILS",
        localizationKey: LocalizationKeys.INVENTORY_INSUFFICIENT,
        substitutions: [report.requiredQuantity, report.totalAvailable],
      };
    }

    return { valid: true, reason: "SUFFICIENT" };
  }
}
