/**
 * ValidationErrorCategory.js
 *
 * PURPOSE
 *   Added Project Prompt 22 §9 ("Validation Errors" — "create clear
 *   user-facing error categories... do not expose raw technical
 *   exceptions"). Every validator/stage in this project already returns a
 *   specific, internal `reason` string (see core/validation/*.js,
 *   terrain/PathValidator.js's PathRejectionReason, terrain/BridgePlan.js's
 *   BridgeRejectionReason, terrain/UndergroundPlan.js's
 *   UndergroundRejectionReason, inventory/ResourceValidator.js) — this file
 *   does NOT replace any of them (each one drives its own precise,
 *   already-good player-facing `.lang` message, and changing that would be
 *   pure churn for no benefit). It adds ONE new, smaller, closed
 *   classification layer on top, mapping every one of those internal reason
 *   strings to exactly one of Project Prompt 22's named categories — for
 *   anything that wants to reason about "what KIND of problem was this"
 *   (tests, future logging/telemetry, the new "STATUS: CANNOT BUILD" chat
 *   prefix in core/BuildOrchestrator.js) without re-deriving that mapping
 *   itself or, worse, drifting from a second copy of it.
 *
 * WHY A SEPARATE LAYER, NOT A RENAME OF EVERY EXISTING REASON STRING
 *   Many existing reasons are intentionally more specific than any one of
 *   Project Prompt 22's 13 categories (e.g. BridgePlan's
 *   `LENGTH_TOO_SHORT_FOR_HEIGHT` carries real geometric meaning no bare
 *   `INVALID_LENGTH` would preserve) — collapsing them at the source would
 *   throw away information every existing `.lang` line and log statement
 *   still depends on. `categorize()` is a many-to-one lookup, never a
 *   replacement.
 *
 * APPROXIMATIONS, STATED PLAINLY
 *   A handful of existing reasons don't map cleanly onto any one of the 13
 *   given categories (e.g. a water-crossing rejection, or an excavated
 *   protected ore) — these are mapped to the closest fit (`UNSAFE_TERRAIN`
 *   in both cases) rather than invented as new categories outside the
 *   prompt's own list. See the mapping table below for every such call.
 *
 * DEPENDENCIES
 *   None. Pure data + a lookup function.
 */

/** @enum {string} */
export const ValidationErrorCategory = Object.freeze({
  INVALID_CONFIGURATION: "INVALID_CONFIGURATION",
  INVALID_LENGTH: "INVALID_LENGTH",
  INVALID_HEIGHT: "INVALID_HEIGHT",
  INVALID_DEPTH: "INVALID_DEPTH",
  INSUFFICIENT_RAILS: "INSUFFICIENT_RAILS",
  INSUFFICIENT_MATERIAL: "INSUFFICIENT_MATERIAL",
  UNSAFE_TERRAIN: "UNSAFE_TERRAIN",
  UNSAFE_LAVA: "UNSAFE_LAVA",
  UNBREAKABLE_BLOCK: "UNBREAKABLE_BLOCK",
  CHUNK_UNAVAILABLE: "CHUNK_UNAVAILABLE",
  RAIL_CONFLICT: "RAIL_CONFLICT",
  INSUFFICIENT_CLEARANCE: "INSUFFICIENT_CLEARANCE",
  INVALID_PLAYER_STATE: "INVALID_PLAYER_STATE",
  /** No existing reason string maps here yet — the fallback for a future
   * rejection reason this table hasn't been updated for. Never silently
   * mis-categorized as something more specific than is actually known. */
  UNKNOWN: "UNKNOWN",
});

/**
 * Every internal `reason` string this project currently produces, mapped to
 * one category. Reason strings are unique across every validator/stage —
 * confirmed by direct inspection of core/validation/*.js,
 * terrain/PathValidator.js, terrain/BridgePlan.js, terrain/UndergroundPlan.js,
 * and inventory/ResourceValidator.js — so a flat lookup (no stage-name
 * disambiguation needed) is sufficient and never ambiguous.
 * @type {Readonly<Record<string, ValidationErrorCategory>>}
 */
const REASON_TO_CATEGORY = Object.freeze({
  // core/validation/*.js
  PLAYER_INVALID: ValidationErrorCategory.INVALID_PLAYER_STATE,
  UNSUPPORTED_GAME_MODE: ValidationErrorCategory.INVALID_PLAYER_STATE,
  ITEM_CHANGED: ValidationErrorCategory.INVALID_PLAYER_STATE,
  INVALID_DIRECTION: ValidationErrorCategory.INVALID_CONFIGURATION,
  INVALID_DIMENSION: ValidationErrorCategory.INVALID_PLAYER_STATE,
  INVALID_ORIGIN: ValidationErrorCategory.INVALID_CONFIGURATION,
  LENGTH_OUT_OF_RANGE: ValidationErrorCategory.INVALID_LENGTH,
  UNKNOWN_BUILD_MODE: ValidationErrorCategory.INVALID_CONFIGURATION,
  BRIDGEHEIGHT_OUT_OF_RANGE: ValidationErrorCategory.INVALID_HEIGHT,
  UNDERGROUNDDEPTH_OUT_OF_RANGE: ValidationErrorCategory.INVALID_DEPTH,

  // terrain/PathValidator.js's PathRejectionReason (NORMAL mode)
  TOO_STEEP: ValidationErrorCategory.UNSAFE_TERRAIN,
  UNBREAKABLE_BLOCK: ValidationErrorCategory.UNBREAKABLE_BLOCK,
  TUNNEL_TOO_LONG: ValidationErrorCategory.UNSAFE_TERRAIN,
  HAZARD: ValidationErrorCategory.UNSAFE_TERRAIN,
  UNLOADED_CHUNK: ValidationErrorCategory.CHUNK_UNAVAILABLE,
  OUT_OF_BOUNDS: ValidationErrorCategory.CHUNK_UNAVAILABLE,
  WATER_CROSSING_UNSAFE: ValidationErrorCategory.UNSAFE_TERRAIN,
  LOW_CLEARANCE: ValidationErrorCategory.INSUFFICIENT_CLEARANCE,

  // terrain/BridgePlan.js's BridgeRejectionReason
  LENGTH_TOO_SHORT_FOR_HEIGHT: ValidationErrorCategory.INVALID_LENGTH,
  BLOCKED_BY_TERRAIN: ValidationErrorCategory.UNSAFE_TERRAIN,
  BLOCKED_BY_UNBREAKABLE: ValidationErrorCategory.UNBREAKABLE_BLOCK,
  BLOCKED_BY_HAZARD: ValidationErrorCategory.UNSAFE_TERRAIN,
  BLOCKED_BY_LIQUID: ValidationErrorCategory.UNSAFE_TERRAIN,
  SUPPORT_HAZARD: ValidationErrorCategory.UNSAFE_TERRAIN,
  SUPPORT_UNAVAILABLE: ValidationErrorCategory.UNSAFE_TERRAIN,

  // terrain/UndergroundPlan.js's UndergroundRejectionReason
  LENGTH_TOO_SHORT_FOR_DEPTH: ValidationErrorCategory.INVALID_LENGTH,
  BLOCKED_BY_LAVA: ValidationErrorCategory.UNSAFE_LAVA,
  BLOCKED_BY_WATER: ValidationErrorCategory.UNSAFE_TERRAIN,
  PROTECTED_ORE: ValidationErrorCategory.UNSAFE_TERRAIN,
  UNSUPPORTED_FLOOR: ValidationErrorCategory.UNSAFE_TERRAIN,

  // inventory/ResourceValidator.js
  INSUFFICIENT_RAILS: ValidationErrorCategory.INSUFFICIENT_RAILS,
  INSUFFICIENT_MATERIAL: ValidationErrorCategory.INSUFFICIENT_MATERIAL,

  // core/ActiveBuildRegistry.js, via PlacementStage.js — Project Prompt 22 §11
  RAIL_CONFLICT: ValidationErrorCategory.RAIL_CONFLICT,

  // core/pipeline/stages/BuildPlanStage.js — Project Prompt 22 §10's
  // immediately-before-construction revalidation
  INVENTORY_CHANGED_BEFORE_BUILD: ValidationErrorCategory.INSUFFICIENT_RAILS,
  MATERIAL_CHANGED_BEFORE_BUILD: ValidationErrorCategory.INSUFFICIENT_MATERIAL,

  // core/pipeline/stages/FinalSafetyCheckStage.js's own re-plan rejections
  TERRAIN_CHANGED_BEFORE_BUILD: ValidationErrorCategory.UNSAFE_TERRAIN,
  BRIDGE_CHANGED_BEFORE_BUILD: ValidationErrorCategory.UNSAFE_TERRAIN,
  UNDERGROUND_CHANGED_BEFORE_BUILD: ValidationErrorCategory.UNSAFE_TERRAIN,
});

/**
 * @param {string|undefined} reason One of the internal reason strings above.
 * @returns {ValidationErrorCategory} `UNKNOWN` for an unrecognized or missing reason — never guessed.
 */
export function categorize(reason) {
  return REASON_TO_CATEGORY[reason] ?? ValidationErrorCategory.UNKNOWN;
}
