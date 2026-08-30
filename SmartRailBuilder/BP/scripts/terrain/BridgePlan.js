/**
 * BridgePlan.js
 *
 * PURPOSE
 *   The complete, deterministic construction plan for a Bridge Mode build
 *   — computed exactly once by `TerrainScanner.planBridge()`, consumed
 *   as-is by InventoryStage (resource counts), FinalSafetyCheckStage (a
 *   fresh re-plan, `.feasible` re-checked), and BridgeExecutionStrategy
 *   (the actual position lists, in construction order). Satisfies Project
 *   Prompt 16's explicit requirement: "the plan must be deterministic...
 *   once validated, execution should not need to repeatedly recalculate
 *   the entire bridge."
 *
 * REVISED in the bugfix pass before Project Prompt 18 (superseding Project
 * Prompt 16's shape, NOT superseding Roadmap Phase 13's — that redesign
 * already happened once, see git history / CHANGELOG.md's Project Prompt
 * 16 entry for that earlier replacement)
 *   Project Prompt 16's version described a single fixed elevation for the
 *   whole bridge (`railY`, one number) and a full support column at every
 *   position needing fill. Both were real, reported bugs — no gradual
 *   climb, and a continuous solid wall wherever terrain was flat. This
 *   version's elevation is per-position (there is no single `railY`
 *   field any more — see `deckPositions[i].y`), and support material is
 *   now split between `surfacePositions` (every column needing fill gets
 *   exactly one — the deck itself) and `supportPositions` (a full column
 *   down to real ground, but ONLY at pier positions). See
 *   ARCHITECTURE.md §46.1-§46.2 for the full diagnosis and
 *   TerrainScanner.js's `planBridge()` for the complete geometric
 *   derivation this shape now reflects.
 *
 * ONE AUTHORITATIVE BRIDGE HEIGHT DEFINITION (Project Prompt 16's explicit
 * requirement, still true of the crest height specifically: "do not allow
 * different modules to interpret bridge height differently")
 *   `computeBridgeRailY()` below now specifically means "the flat crest's
 *   elevation" — the highest point the railway reaches, still `origin.y +
 *   bridgeHeight`, still computed in exactly one place and called by
 *   `planBridge()`'s per-index elevation resolver rather than
 *   re-derived. The ramp/descent elevations are a second, related formula
 *   — see `planBridge()`'s private `_resolveBridgeElevation()` — since
 *   Project Prompt 16's single-value model no longer describes the whole
 *   railway, only its peak.
 *
 * DEPENDENCIES
 *   None.
 */

/**
 * Bridge Height = vertical distance between the elevation a NORMAL-mode
 * rail would occupy at the build's origin, and the CREST of the bridge —
 * the flat section that actually crosses the gap. `buildVector.origin.y`
 * already IS that normal-rail elevation — confirmed directly from
 * core/BuildVector.js's own `fromPlayer()`: `origin.y = playerBlock.y`
 * (the player's own floored feet position, unchanged from horizontal-only
 * movement), and separately confirmed from terrain/TerrainScanner.js's
 * `_scanPosition()` call convention, where `railPosition.y` (== `origin.y`
 * at index 0) is always exactly 1 above the ground block a NORMAL rail
 * sits on. So bridgeHeight=1 places the bridge's crest at the SAME
 * elevation flat ground would already put a normal rail at the origin —
 * the minimum bridge is "barely elevated relative to where you're
 * standing," which reads more intuitively for the UI's stated minimum of
 * 1 than an alternative offset would have.
 *
 * @param {number} originY `buildVector.origin.y`.
 * @param {number} bridgeHeight `request.bridgeHeight`, already validated 1-16 by ModeConfigValidator.
 * @returns {number} The Y the bridge's flat crest sits at — NOT every rail's Y; see `deckPositions[i].y` for the actual per-position elevation, which ramps up to and back down from this value.
 */
export function computeBridgeRailY(originY, bridgeHeight) {
  return originY + bridgeHeight;
}

/**
 * @typedef {Object} BridgeTerrainSummary
 *   Project Prompt 16's requested "Terrain information" field — informational
 *   only, never consulted for accept/reject (that's `feasible`/`rejectionReason`).
 * @property {number} originGroundY The Y of the solid ground block at the build's origin.
 * @property {number} columnsRequiringFill How many of the `length` columns needed any placed support/surface material (0 means every column already had solid ground exactly at deck-1 — terrain alone was sufficient).
 * @property {number} deepestFillColumn The tallest single support+surface column computed, in blocks (0 if columnsRequiringFill is 0). Only pier columns can exceed 1 — see PIER STRUCTURE in planBridge()'s header.
 * @property {number} pierSpacing The config/BridgeConfig.js PIER_SPACING this plan was computed with — carried on the plan so a reader never has to guess which config version produced it.
 */

/**
 * @typedef {Object} BridgePlan
 * @property {boolean} feasible
 * @property {{x: number, y: number, z: number}} [startPosition] First deck position (flat, at the starting elevation). Present only if feasible.
 * @property {{x: number, y: number, z: number}} [endPosition] Last deck position (flat, back at the starting elevation). Present only if feasible.
 * @property {import("../utils/DirectionUtils.js").CardinalDirection} [direction]
 * @property {number} [length] Number of rail positions (== deckPositions.length).
 * @property {number} [bridgeHeight] The validated 1-16 input this plan was computed from — the crest's height above `origin.y`, see `computeBridgeRailY`.
 * @property {ReadonlyArray<{position: {x: number, y: number, z: number}, slopeDirection: import("../utils/DirectionUtils.js").CardinalDirection|null}>} [deckPositions]
 *   One per rail block, in build order. Shaped like Underground Mode's
 *   `UndergroundRailStep` (position + slopeDirection) rather than a bare
 *   `{x,y,z}`, for the same reason: the ramp sections need a sloped rail
 *   permutation, and BridgeExecutionStrategy reads `slopeDirection`
 *   exactly the way UndergroundExecutionStrategy already does. Elevation
 *   ramps: flat at the start, climbs one block per position for
 *   `bridgeHeight` positions (slopeDirection = the build's own travel
 *   direction), holds flat at the crest, descends back down for
 *   `bridgeHeight` positions (slopeDirection = the OPPOSITE of travel —
 *   mirrors Underground's own down-ramp convention), flat at the end. See
 *   `planBridge()`'s ELEVATION PROFILE doc for the full derivation.
 * @property {ReadonlyArray<{x: number, y: number, z: number}>} [surfacePositions]
 *   The single topmost placed block (directly beneath the rail) for EVERY
 *   column that needed any fill, pier or not — the block each such rail
 *   directly sits on. Excludes columns where terrain already had solid
 *   ground exactly beneath the deck (nothing to place there).
 * @property {ReadonlyArray<{x: number, y: number, z: number}>} [supportPositions]
 *   Every OTHER placed block, strictly below its column's surface
 *   position, bottom-to-top — ONLY present at pier columns (index 0, the
 *   last index, and every `BridgeConfig.PIER_SPACING`th index). A
 *   non-pier column needing fill gets a `surfacePositions` entry and
 *   NOTHING here — the deck floats. See planBridge()'s PIER STRUCTURE doc
 *   for why, and ARCHITECTURE.md §46.2 for the block-count comparison
 *   against the previous, full-column-every-position design.
 * @property {number} [requiredRailCount] == deckPositions.length.
 * @property {number} [requiredSupportBlockCount] == supportPositions.length + surfacePositions.length
 *   — combined, matching Project Prompt 16's own "Bridge support/surface block count"
 *   resource-calculation grouping (one combined count, not two separate ones, for
 *   inventory purposes — see inventory/InventoryStage.js).
 * @property {BridgeTerrainSummary} [terrainSummary]
 * @property {string} [rejectionReason] Present only if !feasible. One of BridgeRejectionReason below.
 * @property {{x: number, y: number, z: number}} [rejectionPosition] Present only if !feasible and the cause was position-specific.
 * @property {number} [minimumRequiredLength]
 *   Present only for rejectionReason === LENGTH_TOO_SHORT_FOR_HEIGHT — the
 *   actual minimum length this bridgeHeight needs (`2*bridgeHeight + 3`;
 *   see planBridge()'s MINIMUM LENGTH doc for why `+3`, not `+1`).
 */

/** @enum {string} */
export const BridgeRejectionReason = Object.freeze({
  /** Geometrically impossible: a real rail peak needs a flat crest block, so climbing to and back down from this height needs more room than the requested length. @see planBridge()'s MINIMUM LENGTH doc. */
  LENGTH_TOO_SHORT_FOR_HEIGHT: "LENGTH_TOO_SHORT_FOR_HEIGHT",
  BLOCKED_BY_TERRAIN: "BLOCKED_BY_TERRAIN",
  BLOCKED_BY_UNBREAKABLE: "BLOCKED_BY_UNBREAKABLE",
  BLOCKED_BY_HAZARD: "BLOCKED_BY_HAZARD",
  BLOCKED_BY_LIQUID: "BLOCKED_BY_LIQUID",
  SUPPORT_HAZARD: "SUPPORT_HAZARD",
  SUPPORT_UNAVAILABLE: "SUPPORT_UNAVAILABLE",
  UNLOADED_CHUNK: "UNLOADED_CHUNK",
  OUT_OF_BOUNDS: "OUT_OF_BOUNDS",
});
