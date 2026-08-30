import { TerrainClassification } from "./TerrainClassification.js";
import { GapType } from "./GapAnalyzer.js";

/**
 * PathCategory.js
 *
 * PURPOSE
 *   Added Roadmap Phase 13 (Project Prompt 13)'s "PATH CLASSIFICATION"
 *   request: a simplified, 6-category summary layer — Flat, Slope, Tunnel,
 *   Bridge, WaterCrossing, Unsupported — sitting ON TOP of the existing,
 *   detailed `TerrainClassification` (FLAT_SAFE/ASCENDING/DESCENDING/
 *   TUNNEL/UNSUPPORTED/HAZARD/LIQUID/UNLOADED/OUT_OF_BOUNDS). Exists
 *   purely so a future consumer (a UI summary, a different build strategy,
 *   a debugging tool) can ask "broadly, what kind of terrain is this"
 *   without needing to know every detailed classification's meaning —
 *   Project Prompt 13's own words: "ensure future systems can consume
 *   this classification directly."
 *
 * WHY THIS DOES NOT REPLACE TerrainClassification
 *   `PathValidator` and every existing accept/reject decision in this
 *   codebase are keyed on the detailed `TerrainClassification` — that
 *   precision (e.g. distinguishing HAZARD from LIQUID, or a peak/valley
 *   UNSUPPORTED from a too-tall-rise UNSUPPORTED) matters for correct
 *   behavior and specific player messaging, and collapsing it into 6
 *   broad categories would lose exactly the detail those decisions need.
 *   This is an additional, informational field
 *   (`TerrainPositionFact.pathCategory`) — see terrain/TerrainScanner.js's
 *   Roadmap Phase 13 section for where it's attached — not a replacement.
 *
 * WHY "Bridge" AND "WaterCrossing" DON'T MEAN "BUILDABLE"
 *   A position categorized `Bridge` still has `classification: UNSUPPORTED`
 *   underneath — it means "this drop is over a gap `BridgeDetector`
 *   considers structurally plausible to eventually bridge," purely
 *   descriptive. `PathValidator` never looks at `pathCategory`, only at
 *   `classification` — see terrain/PathValidator.js and
 *   terrain/BridgeValidation.js's header for the same load-bearing
 *   distinction stated from the other side.
 *
 * DEPENDENCIES
 *   - ./TerrainClassification.js
 *   - ./GapAnalyzer.js (GapType)
 */

/** @enum {string} */
export const PathCategory = Object.freeze({
  FLAT: "Flat",
  SLOPE: "Slope",
  TUNNEL: "Tunnel",
  BRIDGE: "Bridge",
  WATER_CROSSING: "WaterCrossing",
  UNSUPPORTED: "Unsupported",
});

/**
 * @param {import("./TerrainScanner.js").TerrainClassification} classification
 * @param {import("./GapAnalyzer.js").GapAnalysis|undefined} gapAnalysis Present only for a gap position (Roadmap Phase 13) — see TerrainScanner.js.
 * @param {import("./BridgeDetector.js").BridgeFeasibility|undefined} bridgeFeasibility Present only for a gap position where BridgeDetector actually ran.
 * @returns {PathCategory}
 */
export function derivePathCategory(classification, gapAnalysis, bridgeFeasibility) {
  switch (classification) {
    case TerrainClassification.FLAT_SAFE:
      return PathCategory.FLAT;
    case TerrainClassification.ASCENDING:
    case TerrainClassification.DESCENDING:
      return PathCategory.SLOPE;
    case TerrainClassification.TUNNEL:
      return PathCategory.TUNNEL;
    case TerrainClassification.UNSUPPORTED:
      if (gapAnalysis?.gapType === GapType.WATER_CROSSING) {
        return PathCategory.WATER_CROSSING;
      }
      if (bridgeFeasibility?.feasible) {
        return PathCategory.BRIDGE;
      }
      return PathCategory.UNSUPPORTED;
    default:
      // HAZARD, LIQUID, UNLOADED, OUT_OF_BOUNDS — none of these are a
      // "shape" of path the way the other 5 categories are; they're error
      // states. Folded into UNSUPPORTED for this simplified view rather
      // than growing it to 9+ categories, which would defeat the point of
      // having a simplified view at all.
      return PathCategory.UNSUPPORTED;
  }
}
