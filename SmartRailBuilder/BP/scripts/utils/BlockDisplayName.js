/**
 * BlockDisplayName.js
 *
 * PURPOSE
 *   Added Project Prompt 21 (UI polish self-review): formats a vanilla
 *   item/block type ID into a human-readable display name —
 *   "minecraft:stone_bricks" -> "Stone Bricks". Previously a private
 *   function duplicated verbatim inside `ui/BuildMenu.js` (for the material
 *   selection screen's button labels and the summary screen's material
 *   line); `core/pipeline/stages/InventoryStage.js` needed the exact same
 *   transform for its own "Not enough <Material Name>" rejection message
 *   (see that file's REVISION HISTORY) and would otherwise have been a
 *   second, independent copy of the same logic. Extracted here once instead
 *   — exactly the kind of duplication this session's self-review asked to
 *   find and remove.
 *
 * WHY A PLAIN-STRING TRANSFORM, NOT A TRANSLATE-KEY LOOKUP
 *   The candidate is whatever block the player happens to be holding — any
 *   of hundreds of possible vanilla blocks — so there is no fixed,
 *   pre-registerable set of localization keys this could use, unlike
 *   config/RailConfig.js's own small, fixed `displayName` list. Same
 *   reasoning already established for utils/DirectionUtils.js's own
 *   `toDisplayName()` — see config/BuildModes.js's "NOTE ON displayName"
 *   for the fuller version of this argument.
 *
 * DEPENDENCIES
 *   None.
 */

/**
 * @param {string} typeId Vanilla item/block type ID, e.g. "minecraft:stone_bricks".
 * @returns {string} e.g. "Stone Bricks".
 */
export function formatBlockDisplayName(typeId) {
  return typeId
    .replace(/^minecraft:/, "")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
