import { GAP_CONFIG } from "../config/GapConfig.js";
import { readBlock } from "../utils/BlockReader.js";

/**
 * BridgeDetector.js
 *
 * PURPOSE
 *   Bridge foundation, added Roadmap Phase 13 (Project Prompt 13) per this
 *   session's explicit request: reusable concepts for future bridge
 *   support, without placing a single bridge block. Mirrors
 *   TunnelDetector's shape deliberately (see that file) — this project's
 *   established pattern for "answer feasibility, let a Planner turn a yes
 *   into buildable data, let an Execution strategy actually place blocks"
 *   is reused here rather than inventing a second pattern for a
 *   structurally similar problem (crossing an obstruction the ±1 rule
 *   can't handle).
 *
 * WHAT "DETECTION ONLY" MEANS HERE, CONCRETELY
 *   `detect()` answers "is this gap structurally plausible to bridge, in
 *   principle" — span within `GAP_CONFIG.MAX_BRIDGE_SPAN`, solid landing
 *   ground on the far side. It does NOT get called anywhere in the actual
 *   accept/reject path this session: `TerrainScanner` attaches its result
 *   to a fact purely as informational data (see that file's Roadmap Phase
 *   13 section), and `PathValidator` does not consult it — a drop of more
 *   than 1 block remains UNSUPPORTED exactly as before, regardless of
 *   what this class concludes. This is the load-bearing distinction this
 *   whole session's bridge work rests on — see ARCHITECTURE.md §38.1.
 *
 * RESPONSIBILITIES
 *   - Given a gap's measured depth/type (from GapAnalyzer) and a search
 *     direction, look for solid landing ground on the far side, within
 *     GAP_CONFIG.MAX_BRIDGE_SPAN horizontal blocks.
 *   - Report structural feasibility and span — nothing about WHICH bridge
 *     style would be used (that's BridgeExecutionStrategy's eventual job,
 *     still an unbuilt placeholder this session — see that file).
 *
 * FUTURE EXTENSIONS (not implemented this session)
 *   - A real BridgeExecutionStrategy would likely want gapAnalysis.gapType
 *     to pick a material/style (e.g. a WATER_CROSSING bridge might want a
 *     different rail support structure than a RAVINE one) — the parameter
 *     is already threaded through detect() for exactly that, unused for
 *     now.
 *
 * DEPENDENCIES
 *   - config/GapConfig.js
 *   - utils/BlockReader.js (shared with TerrainScanner.js and TunnelDetector.js — see that file's header)
 */

/**
 * @typedef {Object} BridgeFeasibility
 * @property {boolean} feasible
 * @property {number} [span] Horizontal distance to the far landing, if feasible.
 * @property {string} [reason] One of "TOO_WIDE", "UNLOADED", "OUT_OF_BOUNDS". Present only if !feasible.
 */

export class BridgeDetector {
  /**
   * @param {import("@minecraft/server").Dimension} dimension
   * @param {import("../core/BuildVector.js").BuildVector} buildVector
   * @param {number} startIndex The first position over the gap.
   * @param {number} railY The Y a bridge deck would sit at — the height of
   *   the position just before the gap, unchanged across the span (a level
   *   bridge, matching TunnelDetector's level-bore precedent).
   * @param {import("./GapAnalyzer.js").GapAnalysis} gapAnalysis Reserved
   *   for future per-gap-type span/material logic — see FUTURE EXTENSIONS
   *   above. Not used by this session's structural-only check.
   * @returns {BridgeFeasibility}
   */
  detect(dimension, buildVector, startIndex, railY, gapAnalysis) {
    void gapAnalysis;

    for (let offset = 1; offset <= GAP_CONFIG.MAX_BRIDGE_SPAN; offset++) {
      const index = startIndex + offset;
      const { x, z } = buildVector.horizontalAt(index);

      const groundRead = readBlock(dimension, { x, y: railY - 1, z });
      if (groundRead.status !== "OK") {
        return { feasible: false, reason: groundRead.status };
      }

      if (!groundRead.block.isAir && !groundRead.block.isLiquid) {
        return { feasible: true, span: offset };
      }
    }

    return { feasible: false, reason: "TOO_WIDE" };
  }
}
