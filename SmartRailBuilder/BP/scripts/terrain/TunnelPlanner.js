import { TunnelDetector } from "./TunnelDetector.js";
import { TerrainClassification } from "./TerrainClassification.js";

/**
 * TunnelPlanner.js
 *
 * PURPOSE
 *   Turns a successful TunnelDetector result into a concrete TunnelPlan —
 *   the actual per-position facts TerrainScanner needs to splice into its
 *   results, and the exact excavation positions TunnelExcavator needs at
 *   placement time. "Planning" is deliberately separate from "detection"
 *   (Project Prompt 12's own requested split): TunnelDetector answers
 *   yes/no and how far; this class is the only place that decides what a
 *   "yes" actually looks like as buildable data.
 *
 * RESPONSIBILITIES
 *   - Call TunnelDetector once, given a starting position, direction, and
 *     remaining build budget.
 *   - On success, build one TerrainPositionFact per tunneled position,
 *     classification TUNNEL, each carrying its own excavation positions
 *     (the rail spot and the headroom block above it — TUNNEL_CONFIG.WIDTH
 *     is always 1, so there's never a third position per row to excavate).
 *   - On failure, return a single UNSUPPORTED-shaped fact at the starting
 *     position with the specific reason attached — PathValidator maps that
 *     reason to a specific message the same way it already does for every
 *     other rejection (see terrain/PathValidator.js).
 *
 * WHY EXCAVATION POSITIONS LIVE ON THE FACT, NOT COMPUTED AGAIN AT PLACEMENT TIME
 *   TunnelDetector already read every block along the bore once. Recomputing
 *   "which 2 blocks need breaking here" during placement — potentially many
 *   ticks later — would mean either re-deriving the same geometry
 *   (duplicated logic) or re-reading blocks that may have changed (a
 *   question StraightRailStrategy's per-block re-check already answers
 *   correctly for the RAIL position; excavation positions ride along on the
 *   same fact so that re-check covers them too, with no separate mechanism).
 *
 * DEPENDENCIES
 *   - ./TunnelDetector.js
 */

/**
 * @typedef {Object} TunnelPlan
 * @property {boolean} possible
 * @property {number} length Number of TUNNEL positions in `positions` (0 if !possible).
 * @property {ReadonlyArray<import("./TerrainScanner.js").TerrainPositionFact>} positions
 * @property {string} [failureReason] Present only if !possible — see TunnelDetector's TunnelDetectionResult.reason.
 * @property {string} [blockingBlockId] Present only when failureReason is "UNBREAKABLE".
 */

export class TunnelPlanner {
  constructor() {
    /** @private */
    this._detector = new TunnelDetector();
  }

  /**
   * @param {import("@minecraft/server").Dimension} dimension
   * @param {import("../core/BuildVector.js").BuildVector} buildVector
   * @param {number} startIndex
   * @param {number} railY
   * @param {number} positionsUntilAbsoluteCeiling See TunnelDetector.detect()'s doc — tied
   *   to the hard build-length ceiling, not the originally requested length.
   * @returns {TunnelPlan}
   */
  plan(dimension, buildVector, startIndex, railY, positionsUntilAbsoluteCeiling) {
    const detection = this._detector.detect(dimension, buildVector, startIndex, railY, positionsUntilAbsoluteCeiling);

    if (!detection.possible) {
      return {
        possible: false,
        length: 0,
        positions: [],
        failureReason: detection.reason,
        blockingBlockId: detection.blockingBlockId,
      };
    }

    const positions = [];
    for (let offset = 0; offset < detection.length; offset++) {
      const index = startIndex + offset;
      const { x, z } = buildVector.horizontalAt(index);
      const railPosition = { x, y: railY, z };
      const headroomPosition = { x, y: railY + 1, z };

      positions.push({
        position: railPosition,
        groundBlockId: undefined,
        aboveBlockId: undefined,
        isGroundSolid: true,
        isAboveReplaceable: false, // it isn't yet — that's the whole point, TunnelExcavator makes it so before placement
        // isExistingRail/isUnderwater/waterInfo added Project Prompt 18/19 to
        // TerrainPositionFact — a tunnel position is never either (a bored
        // rock tunnel is never a pre-existing rail or a body of water; if it
        // legitimately were, TunnelDetector's own hazard/liquid check would
        // have already failed the tunnel before this fact is ever built).
        // Explicit here rather than left absent, matching
        // TerrainScanner.js's own `_unsupportedFact()`/`_unreadableFact()` —
        // this is the only OTHER place in the codebase that constructs a
        // TerrainPositionFact, and every producer should agree on its shape.
        isExistingRail: false,
        isLoaded: true,
        isInBounds: true,
        classification: TerrainClassification.TUNNEL,
        hazardBlockId: undefined,
        slopeDirection: null,
        unsupportedReason: undefined,
        futureMetadata: { excavationPositions: [railPosition, headroomPosition] },
        isUnderwater: false,
        waterInfo: undefined,
      });
    }

    return { possible: true, length: detection.length, positions };
  }
}
