/**
 * BridgeValidation.js
 *
 * PURPOSE
 *   A second, independent sanity check on a `BridgePlan` (see
 *   ./BridgePlan.js) `TerrainScanner.planBridge()` just computed — the
 *   same "never trust a value without a separate check" defense-in-depth
 *   principle already applied throughout this project (e.g.
 *   ModeConfigValidator re-checking BuildMenu's raw slider values rather
 *   than trusting them). Called once by `TerrainScanningStage` immediately
 *   after `planBridge()` returns, before the plan is trusted for resource
 *   counting or construction.
 *
 * SUPERSEDES Roadmap Phase 13's ORIGINAL, NEVER-CALLED VERSION
 *   The Project Prompt 13 version validated the old, now-replaced
 *   `feasible`/`span`/`gapType` shape (see BridgePlan.js's header for why
 *   that shape was replaced) and, by its own header's admission, had zero
 *   live callers — "nothing in this codebase calls validate() below yet."
 *   Confirmed via direct search before this redesign. Safe to replace
 *   outright.
 *
 * WHAT THIS DOES NOT DO
 *   Does not re-read any block from the world — `planBridge()` already did
 *   that. This only checks the PLAN's own internal arithmetic is
 *   consistent (a plan claiming `feasible: true` actually has the counts
 *   and arrays a feasible plan should have) — the same "reads facts /
 *   makes no world-reading decisions of its own" boundary every other
 *   *Validator in this project already respects.
 *
 * REVISED in the bugfix pass before Project Prompt 18: checks the
 * elevation profile directly, not a single `plan.railY`
 *   Project Prompt 16's version of this class checked
 *   `Number.isInteger(plan.railY)` — a single constant no longer exists on
 *   the plan (see BridgePlan.js's header). This version independently
 *   re-derives the expected ramp-up/crest/ramp-down Y for every index from
 *   `plan.deckPositions[0].y` (the plan's own recorded starting elevation)
 *   and `plan.bridgeHeight`, and confirms every position matches — the
 *   exact same "catch a broken step before it ever reaches the world"
 *   purpose UndergroundValidation.js's own elevation-profile check serves,
 *   applied to the new symmetric up/flat/down shape instead of a single
 *   down-ramp.
 *
 * DEPENDENCIES
 *   None (typedef-only reference to ./BridgePlan.js).
 */

/**
 * @typedef {Object} BridgeValidationResult
 * @property {boolean} valid
 * @property {string} [reason] Present only if !valid.
 */

export class BridgeValidation {
  /**
   * @param {import("./BridgePlan.js").BridgePlan} plan
   * @returns {BridgeValidationResult}
   */
  validate(plan) {
    if (!plan.feasible) {
      return { valid: false, reason: plan.rejectionReason ?? "NOT_FEASIBLE" };
    }
    if (!Number.isInteger(plan.length) || plan.length <= 0) {
      return { valid: false, reason: "INVALID_LENGTH" };
    }
    if (!Array.isArray(plan.deckPositions) || plan.deckPositions.length !== plan.length) {
      return { valid: false, reason: "DECK_POSITIONS_MISMATCH" };
    }
    if (plan.requiredRailCount !== plan.deckPositions.length) {
      return { valid: false, reason: "RAIL_COUNT_MISMATCH" };
    }
    const expectedSupportCount = (plan.supportPositions?.length ?? 0) + (plan.surfacePositions?.length ?? 0);
    if (plan.requiredSupportBlockCount !== expectedSupportCount) {
      return { valid: false, reason: "SUPPORT_COUNT_MISMATCH" };
    }
    if (!Number.isInteger(plan.bridgeHeight) || plan.bridgeHeight <= 0) {
      return { valid: false, reason: "INVALID_HEIGHT" };
    }
    if (plan.length < 2 * plan.bridgeHeight + 3) {
      // Mirrors planBridge()'s own MINIMUM LENGTH guard — a feasible plan
      // should never reach here without satisfying it, but re-checking
      // costs nothing and catches exactly the class of bug this file
      // exists for if that guard is ever changed inconsistently.
      return { valid: false, reason: "LENGTH_BELOW_GEOMETRIC_MINIMUM" };
    }

    const originY = plan.deckPositions[0].position.y;
    const H = plan.bridgeHeight;
    for (let i = 0; i < plan.deckPositions.length; i++) {
      let expectedY;
      if (i <= H) {
        expectedY = originY + i;
      } else {
        const distanceFromEnd = plan.length - 1 - i;
        expectedY = distanceFromEnd <= H ? originY + distanceFromEnd : originY + H;
      }
      if (plan.deckPositions[i].position.y !== expectedY) {
        return { valid: false, reason: "ELEVATION_PROFILE_BROKEN" };
      }
      const isFlatExpected = i === 0 || i === plan.length - 1 || (i > H && plan.length - 1 - i > H);
      const actuallyFlat = plan.deckPositions[i].slopeDirection === null;
      if (isFlatExpected !== actuallyFlat) {
        return { valid: false, reason: "SLOPE_PROFILE_BROKEN" };
      }
    }
    if (plan.deckPositions[plan.length - 1].position.y !== originY) {
      return { valid: false, reason: "DOES_NOT_RETURN_TO_START_ELEVATION" };
    }

    return { valid: true };
  }
}
