import { readBlock } from "../utils/BlockReader.js";
import { DirectionUtils } from "../utils/DirectionUtils.js";

/**
 * WaterDetector.js
 *
 * PURPOSE
 *   Added Project Prompt 18 ("Underwater Railway & Water-Safe
 *   Construction"): the water-specific detection primitives every mode's
 *   water handling is built from. Mirrors terrain/GapAnalyzer.js's and
 *   terrain/BridgeDetector.js's established "detection only, reuse
 *   readBlock, attach structured data" pattern rather than inventing a new
 *   one — see this project's standing "extend the existing Terrain
 *   Scanner... do not duplicate block-detection logic" principle.
 *
 * WHAT LIVES HERE VS. WHAT DOESN'T
 *   This file never decides whether a path/plan is buildable — that's still
 *   entirely TerrainScanner's (`_scanPosition`/`planBridge`/`planUnderground`)
 *   job, exactly like GapAnalyzer/BridgeDetector never decide either. It
 *   only answers narrow, reusable geometric/informational questions:
 *   - Is there more liquid stacked above a given position? (used by Normal
 *     Mode to tell a safe single-layer puddle from water too deep to ride
 *     through, AND by Underground Mode to check for water above a tunnel's
 *     ceiling.)
 *   - Which of a position's two LATERAL (perpendicular-to-travel) neighbors
 *     aren't already solid? (Underground Mode's waterproofing: exactly the
 *     faces a corridor position that was itself water could keep leaking in
 *     from once cleared, never the direction of travel itself.)
 *   - Is a liquid block a source or actively flowing? (purely informational,
 *     reported in logs/summaries — never gates an accept/reject decision.)
 *
 * DEPENDENCIES
 *   - utils/BlockReader.js (readBlock — shared with every other detector in
 *     this project)
 *   - utils/DirectionUtils.js (toStepVector, for perpendicularOffsets)
 */

/**
 * Reads up to `height` blocks directly above `position`, returning true if
 * ANY of them is a liquid. Fails safe: an unreadable position (unloaded
 * chunk, out of bounds) counts as "yes, more water" rather than "no" — the
 * caller is always evaluating whether it's safe to treat what's below as a
 * SHALLOW body of water, and assuming the unconfirmed case is safe would be
 * the wrong direction to guess in. See ARCHITECTURE.md's Project Prompt 18
 * entry for the full reasoning.
 *
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {{x: number, y: number, z: number}} position
 * @param {number} [height] How many blocks upward to check. Default 1.
 * @returns {boolean}
 */
export function hasLiquidAbove(dimension, position, height = 1) {
  for (let h = 1; h <= height; h++) {
    const read = readBlock(dimension, { x: position.x, y: position.y + h, z: position.z });
    if (read.status !== "OK") {
      return true;
    }
    if (read.block.isLiquid) {
      return true;
    }
  }
  return false;
}

/**
 * Best-effort source-vs-flowing check, for logging/reporting only — never
 * consulted by any accept/reject decision. Bedrock's liquid depth block
 * state ("liquid_depth", 0 == source) isn't confirmed stable across every
 * liquid type the way `Block.isLiquid`/`Block.isAir` are (see
 * ARCHITECTURE.md §34's `Block.isSolid` lesson about not trusting an
 * unconfirmed API for a real decision) — so this only ever affects a
 * cosmetic log line, and defaults to "source" on any read failure rather
 * than throwing or guessing in a way that could matter.
 *
 * @param {import("@minecraft/server").Block} block Already confirmed `isLiquid`.
 * @returns {boolean}
 */
export function isSourceBlock(block) {
  try {
    const depth = block.permutation.getState("liquid_depth");
    return depth === 0 || depth === undefined;
  } catch {
    return true;
  }
}

/**
 * The two unit offsets perpendicular to `direction` — i.e. immediately
 * beside a corridor position, never ahead of or behind it along the travel
 * line. Plain 2D rotation of the direction's own step vector (rotate ±90°),
 * reusing utils/DirectionUtils.js's existing `toStepVector` rather than
 * hardcoding a second direction table.
 *
 * @param {import("../utils/DirectionUtils.js").CardinalDirection} direction
 * @returns {[{x: number, z: number}, {x: number, z: number}]}
 */
export function perpendicularOffsets(direction) {
  const { x, z } = DirectionUtils.toStepVector(direction);
  return [
    { x: -z, z: x },
    { x: z, z: -x },
  ];
}

/**
 * Underground Mode's waterproofing primitive (Project Prompt 18): given one
 * corridor position already confirmed to be a liquid block (see
 * terrain/TerrainScanner.js's `planUnderground()`), finds which of its two
 * LATERAL neighbors — same Y, perpendicular to travel — are not already
 * solid. Those are exactly the faces water could keep leaking in from once
 * this position is cleared to air; sealing them (and only them, never a
 * full ring or a whole extra layer) is what keeps the newly-air'd interior
 * dry without "a massive solid structure." A neighbor that's already solid
 * ground is left completely alone — nothing to seal, and placing a block
 * there anyway would be a wasted write (see PERFORMANCE in this project's
 * Project Prompt 18 entry).
 *
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {{x: number, y: number, z: number}} waterPosition
 * @param {import("../utils/DirectionUtils.js").CardinalDirection} direction Travel direction of the whole build.
 * @returns {ReadonlyArray<{x: number, y: number, z: number}>}
 */
export function findLateralSealPositions(dimension, waterPosition, direction) {
  const offsets = perpendicularOffsets(direction);
  const sealPositions = [];

  for (const offset of offsets) {
    const neighbor = { x: waterPosition.x + offset.x, y: waterPosition.y, z: waterPosition.z + offset.z };
    const read = readBlock(dimension, neighbor);
    if (read.status !== "OK") {
      // Unreadable neighbor: nothing can be placed there anyway (execution's
      // own per-block re-check would hit the same unloaded state), and this
      // is a bonus safety feature, not a build-blocking requirement — skip
      // rather than reject an otherwise-feasible plan over it. See
      // ARCHITECTURE.md's Project Prompt 18 KNOWN LIMITATIONS.
      continue;
    }
    const alreadySolid = !read.block.isAir && !read.block.isLiquid;
    if (!alreadySolid) {
      sealPositions.push(neighbor);
    }
  }

  return sealPositions;
}
