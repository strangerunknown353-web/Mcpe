/**
 * TerrainClassification.js
 *
 * PURPOSE
 *   The TerrainClassification enum, extracted from terrain/TerrainScanner.js
 *   into its own file this session (Roadmap Phase 12, Project Prompt 12).
 *
 * WHY THIS WAS EXTRACTED, NOT LEFT ON TerrainScanner.js
 *   TunnelPlanner.js needs TerrainClassification.TUNNEL to build correctly-
 *   shaped facts. TerrainScanner.js needs TunnelPlanner.js to attempt tunnel
 *   resolution. If the enum stayed defined inside TerrainScanner.js,
 *   TunnelPlanner.js importing it from there would create a circular
 *   import (TerrainScanner → TunnelPlanner → TerrainScanner). ES modules
 *   can sometimes tolerate circular imports depending on evaluation order,
 *   but relying on that working correctly in Bedrock's script environment
 *   wasn't something this session could confirm — and this project's own
 *   recent lesson (§34, `Block.isSolid`) is specifically about not trusting
 *   an unconfirmed behavior when a confirmed alternative exists. Extracting
 *   the enum to a leaf file with no imports of its own removes the cycle
 *   entirely rather than hoping around it.
 *   `terrain/TerrainScanner.js` re-exports this for full backward
 *   compatibility — every existing `import { TerrainClassification } from
 *   "./TerrainScanner.js"` (or "../terrain/TerrainScanner.js") elsewhere in
 *   the codebase continues to work unchanged.
 *
 * DEPENDENCIES
 *   None — this is a leaf file by design.
 */

/** @enum {string} */
export const TerrainClassification = Object.freeze({
  /** Ground is solid, the rail's own position is clear, same Y as the previous position — buildable, flat rail. */
  FLAT_SAFE: "FLAT_SAFE",
  /** Ground or rail position matches a HazardRegistry block id (lava, fire, cactus, ...). */
  HAZARD: "HAZARD",
  /** Reserved/defensive as of Project Prompt 18: `_scanPosition()` no longer produces this classification directly. A liquid ground position now resolves through the same not-solid-ground path as an ordinary gap (UNSUPPORTED), and a liquid rail-spot over solid ground resolves to FLAT_SAFE with `isUnderwater: true` (safe, shallow) or UNSUPPORTED/"WATER_TOO_DEEP" (unsafe, too deep) — see terrain/WaterDetector.js and terrain/TerrainScanner.js's Project Prompt 18 section. Kept for defensive symmetry with PathValidator's/PathCategory's existing unrecognized-classification fallbacks, not because anything still emits it. */
  LIQUID: "LIQUID",
  /** Terrain dropped by exactly 1 block relative to the previous position — buildable, descending rail. Added Roadmap Phase 11. */
  DESCENDING: "DESCENDING",
  /** Terrain rose by exactly 1 block relative to the previous position — buildable, ascending rail. Added Roadmap Phase 11. */
  ASCENDING: "ASCENDING",
  /** A rise of more than 1 block that TunnelPlanner successfully bored through — buildable once excavated. Added Roadmap Phase 12. */
  TUNNEL: "TUNNEL",
  /** Elevation change of more than 1 block with no viable tunnel (or a drop of more than 1 block, tunnels not attempted for those — see TunnelDetector.js), or a reversal (peak/valley) immediately after an ascend/descend — not buildable this phase. Replaces GAP/OBSTRUCTED (Roadmap Phase 11; see ARCHITECTURE.md §36.1 for the migration). */
  UNSUPPORTED: "UNSUPPORTED",
  /** Chunk not currently loaded — can't verify. */
  UNLOADED: "UNLOADED",
  /** Outside the dimension's world-height bounds. */
  OUT_OF_BOUNDS: "OUT_OF_BOUNDS",
});
