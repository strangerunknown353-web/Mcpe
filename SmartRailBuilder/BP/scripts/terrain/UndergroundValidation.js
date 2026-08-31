/**
 * UndergroundValidation.js
 *
 * PURPOSE
 *   A second, independent sanity check on an `UndergroundPlan` (see
 *   ./UndergroundPlan.js) that `TerrainScanner.planUnderground()` just
 *   computed — the same defense-in-depth principle applied throughout this
 *   project, and the exact counterpart of terrain/BridgeValidation.js
 *   (Project Prompt 16) for the other new mode. Called once by
 *   `TerrainScanningStage` immediately after planning, before the plan is
 *   trusted for resource counting or construction.
 *
 * WHAT THIS DOES NOT DO
 *   Does not re-read any block from the world — `planUnderground()` already
 *   did that. This only checks the PLAN's own internal arithmetic and
 *   geometry are self-consistent: a plan claiming `feasible: true` actually
 *   has the counts, arrays, and (critically) the *elevation profile* a
 *   feasible plan must have. Same "reads facts / makes no world-reading
 *   decisions of its own" boundary every other *Validation/*Validator in
 *   this project respects.
 *
 * WHY THE ELEVATION-PROFILE CHECK IS WORTH ITS LINES
 *   The ramp arithmetic in `planUnderground()` (index i sits at
 *   `originY - i` until it flattens at `railY`) is the one piece of this
 *   session's logic where an off-by-one would produce a plan that looks
 *   structurally fine — right counts, right array lengths — but describes
 *   a railway with a broken step in it, which would only surface in-game
 *   as rails that don't connect. Checking the profile directly here means
 *   that class of bug is caught before a single block is modified, rather
 *   than by visual inspection of a half-built railway.
 *
 * DEPENDENCIES
 *   None (typedef-only reference to ./UndergroundPlan.js).
 */

/**
 * @typedef {Object} UndergroundValidationResult
 * @property {boolean} valid
 * @property {string} [reason] Present only if !valid.
 */

export class UndergroundValidation {
  /**
   * @param {import("./UndergroundPlan.js").UndergroundPlan} plan
   * @returns {UndergroundValidationResult}
   */
  validate(plan) {
    if (!plan.feasible) {
      return { valid: false, reason: plan.rejectionReason ?? "NOT_FEASIBLE" };
    }
    if (!Number.isInteger(plan.length) || plan.length <= 0) {
      return { valid: false, reason: "INVALID_LENGTH" };
    }
    if (!Array.isArray(plan.railSteps) || plan.railSteps.length !== plan.length) {
      return { valid: false, reason: "RAIL_STEPS_MISMATCH" };
    }
    if (plan.requiredRailCount !== plan.railSteps.length) {
      return { valid: false, reason: "RAIL_COUNT_MISMATCH" };
    }
    if (!Number.isInteger(plan.railY)) {
      return { valid: false, reason: "INVALID_RAIL_Y" };
    }
    if (!Number.isInteger(plan.depth) || plan.depth <= 0) {
      return { valid: false, reason: "INVALID_DEPTH" };
    }

    // A feasible plan must have at least one flat position at railY —
    // otherwise it's a ramp to nowhere, not an underground railway.
    if (plan.length <= plan.depth) {
      return { valid: false, reason: "NO_FLAT_RUN" };
    }

    // Elevation profile: strictly descending by exactly 1 per position
    // through the ramp, then exactly railY forever after. See WHY THE
    // ELEVATION-PROFILE CHECK IS WORTH ITS LINES above.
    for (let i = 0; i < plan.railSteps.length; i++) {
      const step = plan.railSteps[i];
      const expectedY = i < plan.depth ? plan.railY + (plan.depth - i) : plan.railY;
      if (step.position.y !== expectedY) {
        return { valid: false, reason: "ELEVATION_PROFILE_BROKEN" };
      }
      const shouldSlope = i < plan.depth;
      if (shouldSlope !== (step.slopeDirection !== null)) {
        return { valid: false, reason: "SLOPE_PROFILE_BROKEN" };
      }
      if (!Array.isArray(step.excavationPositions) || step.excavationPositions.length === 0) {
        return { valid: false, reason: "MISSING_EXCAVATION_POSITIONS" };
      }
      // Added Project Prompt 18 (WATERPROOF TUNNEL): every step must carry
      // a sealPositions array, even if empty for an ordinary dry row — a
      // missing array (as opposed to an empty one) would indicate
      // planUnderground()'s own arithmetic dropped the field somewhere.
      if (!Array.isArray(step.sealPositions)) {
        return { valid: false, reason: "MISSING_SEAL_POSITIONS" };
      }
    }

    return { valid: true };
  }
}
