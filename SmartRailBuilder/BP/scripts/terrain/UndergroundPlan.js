/**
 * UndergroundPlan.js
 *
 * PURPOSE
 *   The complete, deterministic construction plan for an Underground Mode
 *   build — computed exactly once by `TerrainScanner.planUnderground()`,
 *   consumed as-is by InventoryStage (rail count), FinalSafetyCheckStage (a
 *   fresh re-plan, `.feasible` re-checked), and UndergroundExecutionStrategy
 *   (the position lists, in construction order). Satisfies Project Prompt
 *   17's "the plan should be deterministic... execution should not
 *   repeatedly recalculate the complete route."
 *
 *   Directly mirrors terrain/BridgePlan.js's shape and role (Project
 *   Prompt 16) on purpose — the two modes are opposites geometrically but
 *   identical structurally, and a future session reading either file
 *   should find the same organization.
 *
 * ONE AUTHORITATIVE DEPTH DEFINITION (Project Prompt 17's explicit
 * requirement: "there must be one authoritative interpretation throughout
 * the project... every subsystem must use the same definition")
 *   `computeUndergroundRailY()` below is the ONLY place that formula is
 *   written, exactly as `computeBridgeRailY()` is for Bridge Mode.
 *
 * DEPENDENCIES
 *   None.
 */

/**
 * Underground Depth = vertical distance between the elevation a NORMAL-mode
 * rail would occupy at the build's origin, and the underground railway's
 * final flat rail level.
 *
 * This is the exact mirror of Bridge Mode's `computeBridgeRailY()` (see
 * terrain/BridgePlan.js and ARCHITECTURE.md §44.2) — same reference point
 * (`buildVector.origin.y`, which already IS "where a normal rail would sit
 * at the start"; confirmed from core/BuildVector.js's `fromPlayer()` and
 * TerrainScanner's own `_scanPosition()` convention), same sign convention,
 * opposite direction. Choosing the same reference for both modes means
 * "height 8" and "depth 8" are symmetric about the same line, which is
 * both the least surprising reading of the UI and the only choice that
 * keeps one shared mental model across all three build modes.
 *
 * NOTE: this is the depth of the FINAL FLAT RUN, not of every rail in the
 * build — the descending ramp positions that lead down to it are, by
 * definition, at intermediate depths between 0 and `depth`. See
 * DESCENDING-RAMP ENTRY STRATEGY below.
 *
 * @param {number} originY `buildVector.origin.y`.
 * @param {number} depth `request.undergroundDepth`, already validated 1-64 by ModeConfigValidator.
 * @returns {number} The Y every FLAT underground rail sits at.
 */
export function computeUndergroundRailY(originY, depth) {
  return originY - depth;
}

/**
 * DESCENDING-RAMP ENTRY STRATEGY (Project Prompt 17's "vertical access /
 * entry" requirement, and the single most consequential design decision of
 * this session)
 *
 *   Project Prompt 17 requires the underground railway to "connect safely
 *   to the starting area," forbids "an impossible railway that starts
 *   underground with no valid transition," and explicitly forbids
 *   improvising "an unsafe staircase or shaft" — instructing a clear
 *   rejection instead when a safe transition can't be generated.
 *
 *   THE HARD CONSTRAINT: Minecraft rails slope at exactly one block of
 *   descent per one block of horizontal travel. There is no steeper rail
 *   geometry, and none can be invented — a vertical shaft simply cannot
 *   carry a railway. So reaching depth D *by rail* costs exactly D
 *   horizontal positions of descending track, with no way to compress it.
 *
 *   THE STRATEGY: indices 0 .. D-1 are a continuous descending ramp (each
 *   one block lower than the last, each carrying a sloped rail shape via
 *   the EXISTING Phase 11 slope architecture — see `rampSlopeDirection`
 *   below); index D onward is the flat run at `railY`. The railway
 *   therefore starts at the surface, at exactly the elevation a NORMAL
 *   build would start at, and descends continuously into the ground. There
 *   is no shaft, no ladder, no teleport, and no discontinuity anywhere.
 *
 *   THE CONSEQUENCE, STATED PLAINLY: a build of length L can only reach
 *   depth D if L >= D + 1 (D positions of ramp, plus at least one flat
 *   position at the bottom to actually be an underground railway rather
 *   than just a descent). Requesting depth 20 (the maximum, as of the
 *   PRE-PROMPT-18 bug-fix pass — see below) with length 20 is not a bug
 *   and not a limitation worth engineering around — it is geometrically
 *   impossible, and is rejected with a message stating the minimum length
 *   that depth needs. Since the project's hard length ceiling is 64
 *   (LENGTH_PRESETS.MAX_SURVIVAL) and depth now tops out at 20, this
 *   constraint is rarely the binding one in practice any more — any
 *   length of 21 or more can reach the maximum depth. This is documented,
 *   not silently clamped, per this project's standing "honest scope
 *   reduction over hacks" principle. See ARCHITECTURE.md §45.3 for the
 *   alternatives considered and rejected, and §46.4 for why the maximum
 *   depth itself was lowered from 64 to 20.
 */

/**
 * The compass direction a descending-ramp rail block should visually climb
 * toward. Reuses — rather than reinvents — the exact convention Project
 * Prompt 11 established and ARCHITECTURE.md §36.2 derived: "the sloped
 * block belongs to the higher of the two positions it connects," so a
 * block that steps DOWN toward the direction of travel climbs toward where
 * the player came FROM, i.e. the opposite of the travel direction. Every
 * ramp position in an Underground plan is the higher end of a descent, so
 * every one of them takes the same value.
 *
 * Kept as a named function (rather than an inline `DirectionUtils.opposite`
 * call at the one call site) purely so this reasoning has somewhere to
 * live next to the thing it explains.
 *
 * @param {import("../utils/DirectionUtils.js").CardinalDirection} travelDirection
 * @param {typeof import("../utils/DirectionUtils.js").DirectionUtils} directionUtils
 * @returns {import("../utils/DirectionUtils.js").CardinalDirection}
 */
export function rampSlopeDirection(travelDirection, directionUtils) {
  return directionUtils.opposite(travelDirection);
}

/**
 * @typedef {Object} UndergroundTerrainSummary
 *   Project Prompt 17's requested "terrain information" — informational
 *   only, never consulted for accept/reject (that's `feasible`/`rejectionReason`).
 * @property {number} surfaceReferenceY The `buildVector.origin.y` this plan was computed from.
 * @property {number} rampPositionCount How many positions are descending ramp (== depth).
 * @property {number} flatPositionCount How many positions are flat run at `railY`.
 * @property {number} alreadyClearCount Excavation positions that were already air — counted so the "blocks excavated" figure isn't inflated by empty space (e.g. an intersected cave).
 * @property {number} commonOresExcavated Ores from OreRegistry's COMMON tier in the excavation volume, reported to the player rather than destroyed silently.
 */

/**
 * @typedef {Object} UndergroundRailStep
 *   One rail position and everything execution needs for it. Mirrors the
 *   shape TunnelPlanner.js already attaches to its TUNNEL facts
 *   (`excavationPositions` riding along on the per-position record) so
 *   UndergroundExecutionStrategy can reuse `TunnelExcavator.excavateRow()`
 *   unchanged — see ARCHITECTURE.md §45.5.
 * @property {{x: number, y: number, z: number}} position The rail block itself.
 * @property {import("../utils/DirectionUtils.js").CardinalDirection|null} slopeDirection
 *   Non-null for ramp positions (see rampSlopeDirection above), null for flat ones —
 *   the exact same field name and meaning as TerrainPositionFact's, so
 *   RailPermutationBuilder is called identically to how StraightRailStrategy calls it.
 * @property {ReadonlyArray<{x: number, y: number, z: number}>} excavationPositions
 *   The rail block plus its headroom (2 total flat, 3 on a ramp — see
 *   config/UndergroundConfig.js), bottom-up.
 */

/**
 * @typedef {Object} UndergroundPlan
 * @property {boolean} feasible
 * @property {{x: number, y: number, z: number}} [startPosition] First rail position (at the surface, top of the ramp).
 * @property {{x: number, y: number, z: number}} [endPosition] Last rail position (underground, end of the flat run).
 * @property {import("../utils/DirectionUtils.js").CardinalDirection} [direction]
 * @property {number} [length] Number of rail positions (== railSteps.length).
 * @property {number} [depth] The validated 1-64 input this plan was computed from.
 * @property {number} [railY] @see computeUndergroundRailY — the flat run's single resolved elevation.
 * @property {number} [tunnelWidth] From config/UndergroundConfig.js — carried on the plan so a reader never has to guess which config a given plan was built under.
 * @property {number} [tunnelHeight] Flat-run clearance, same source.
 * @property {ReadonlyArray<UndergroundRailStep>} [railSteps] One per rail block, in build order (surface first, descending, then flat).
 * @property {ReadonlyArray<{x: number, y: number, z: number}>} [landingExcavationPositions]
 *   Bugfix pass before Project Prompt 18: one extra full-clearance position excavated
 *   immediately past the last rail (no rail placed in it) so the tunnel never ends in a
 *   flush wall — see ARCHITECTURE.md §46.3. Best-effort: empty if that one extra
 *   position couldn't be safely excavated; never affects `feasible`.
 * @property {number} [requiredRailCount] == railSteps.length.
 * @property {number} [totalExcavationCount] Every excavation position across every step, including ones already clear.
 * @property {UndergroundTerrainSummary} [terrainSummary]
 * @property {string} [rejectionReason] Present only if !feasible. One of UndergroundRejectionReason below.
 * @property {{x: number, y: number, z: number}} [rejectionPosition] Present only if !feasible and the cause was position-specific.
 * @property {string} [blockingBlockId] Present only for rejections where naming the exact block helps the player act (unbreakable, valuable ore).
 * @property {number} [minimumRequiredLength] Present only for LENGTH_TOO_SHORT_FOR_DEPTH — the length this depth would actually need.
 */

/** @enum {string} */
export const UndergroundRejectionReason = Object.freeze({
  /** Geometrically impossible: reaching this depth by rail needs more horizontal room than the requested length. @see DESCENDING-RAMP ENTRY STRATEGY. */
  LENGTH_TOO_SHORT_FOR_DEPTH: "LENGTH_TOO_SHORT_FOR_DEPTH",
  BLOCKED_BY_UNBREAKABLE: "BLOCKED_BY_UNBREAKABLE",
  BLOCKED_BY_HAZARD: "BLOCKED_BY_HAZARD",
  BLOCKED_BY_LAVA: "BLOCKED_BY_LAVA",
  BLOCKED_BY_WATER: "BLOCKED_BY_WATER",
  PROTECTED_ORE: "PROTECTED_ORE",
  /** The rail would have nothing solid beneath it — an intersected cave/ravine. @see ARCHITECTURE.md §45.7. */
  UNSUPPORTED_FLOOR: "UNSUPPORTED_FLOOR",
  UNLOADED_CHUNK: "UNLOADED_CHUNK",
  /** Below the world's build limit — caught by BlockReader's existing OUT_OF_BOUNDS status. */
  OUT_OF_BOUNDS: "OUT_OF_BOUNDS",
});
