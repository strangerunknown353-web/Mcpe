/**
 * GapAnalyzer.js
 *
 * PURPOSE
 *   Added Roadmap Phase 13 (Project Prompt 13), as the "GAP DETECTION"
 *   piece of this session's bridge foundation work. Given a position where
 *   the ground drops away by more than 1 block (TerrainScanner's existing
 *   ±1 DESCENDING resolution already handles a simple 1-block step —
 *   tunnels handle a too-tall RISE, this class is the equivalent
 *   groundwork for a too-deep DROP), determines what KIND of gap it is:
 *   open air, a ravine, a small valley, or a water crossing. Detection
 *   only — per this session's explicit scope ("Do not build anything"),
 *   this class never decides a drop is buildable and never places a block.
 *   `TerrainScanner` attaches its output as purely informational data
 *   alongside the existing UNSUPPORTED classification — a drop of more
 *   than 1 block is exactly as unbuildable today as it was before this
 *   session; see ARCHITECTURE.md §38.1 for why "detected" and "buildable"
 *   were kept strictly separate this session.
 *
 * RESPONSIBILITIES
 *   - Measure how far down solid ground actually is, up to a search limit
 *     (GAP_CONFIG.MAX_DEPTH_SEARCH — see config/GapConfig.js), starting
 *     from the position where the drop was first detected.
 *   - Classify the result: AIR (a shallow open drop with no ground found
 *     within the search limit — cliff/void), RAVINE (deep — solid ground
 *     found, but farther down than GAP_CONFIG.RAVINE_DEPTH_THRESHOLD),
 *     SMALL_VALLEY (solid ground found within that threshold), or
 *     WATER_CROSSING (a liquid block found anywhere in the search column —
 *     checked first, before depth, since a shallow pond and a deep lake are
 *     both "water crossings" to a player, regardless of exact depth).
 *
 * DEPENDENCIES
 *   - config/GapConfig.js
 *   - utils/BlockReader.js (shared with TerrainScanner.js/TunnelDetector.js/BridgeDetector.js — see that file's header)
 */

import { GAP_CONFIG } from "../config/GapConfig.js";
import { readBlock } from "../utils/BlockReader.js";

/** @enum {string} */
export const GapType = Object.freeze({
  WATER_CROSSING: "WATER_CROSSING",
  SMALL_VALLEY: "SMALL_VALLEY",
  RAVINE: "RAVINE",
  AIR: "AIR",
});

/**
 * @typedef {Object} GapAnalysis
 * @property {GapType} gapType
 * @property {number} [depth] Blocks from the drop position down to the first solid ground found. Undefined if none was found within the search limit (gapType AIR).
 * @property {boolean} hasWater True if any liquid block was found in the search column.
 */

export class GapAnalyzer {
  /**
   * @param {import("@minecraft/server").Dimension} dimension
   * @param {{x: number, y: number, z: number}} dropPosition The rail position where the drop starts (one below this is already known to be non-solid).
   * @returns {GapAnalysis}
   */
  analyze(dimension, dropPosition) {
    let hasWater = false;
    let depth;

    for (let d = 1; d <= GAP_CONFIG.MAX_DEPTH_SEARCH; d++) {
      const checkPosition = { x: dropPosition.x, y: dropPosition.y - d, z: dropPosition.z };
      const read = readBlock(dimension, checkPosition);
      if (read.status !== "OK") break; // Out of bounds or unloaded going down — stop searching, use what's known so far.
      const block = read.block;

      if (block.isLiquid) {
        hasWater = true;
      }
      if (!block.isAir && !block.isLiquid) {
        depth = d;
        break; // Found solid ground.
      }
    }

    if (hasWater) {
      return { gapType: GapType.WATER_CROSSING, depth, hasWater: true };
    }
    if (depth === undefined) {
      return { gapType: GapType.AIR, depth: undefined, hasWater: false };
    }
    if (depth <= GAP_CONFIG.RAVINE_DEPTH_THRESHOLD) {
      return { gapType: GapType.SMALL_VALLEY, depth, hasWater: false };
    }
    return { gapType: GapType.RAVINE, depth, hasWater: false };
  }
}
