/**
 * RailBuildStrategy.js
 *
 * PURPOSE
 *   Plain-JS "interface" (documented contract, enforced by convention since
 *   this project targets JavaScript, not TypeScript) that every build
 *   strategy must satisfy. This is what makes ARCHITECTURE.md's replaceability
 *   requirement real: RailBuilder depends on this shape, never on a concrete
 *   strategy class, so StraightRailStrategy can later sit alongside
 *   SlopeRailStrategy / TunnelRailStrategy / BridgeRailStrategy without
 *   RailBuilder changing at all.
 *
 * CONTRACT
 *   A build strategy is any object exposing:
 *
 *     buildPath(session, path): Generator<void, BuildResult, void>
 *       A generator function (for use with `system.runJob`) that places
 *       blocks for the given BuildSession along the given validated path,
 *       yielding after each block or small batch of blocks. Must check
 *       `session.isCancelled()` before every placement and stop immediately,
 *       without rolling back, if true.
 *
 *   `path`: strategy-specific shape (see RailBuilder.js's Project Prompt 16
 *   update) — `ReadonlyArray<TerrainPositionFact>` (see terrain/TerrainScanner.js)
 *   for StraightRailStrategy, or a feasible `BridgePlan` (see
 *   terrain/BridgePlan.js) for BridgeExecutionStrategy. RailBuilder itself
 *   never inspects `path`'s contents — it only forwards whatever
 *   PlacementStage gives it to whichever strategy PlacementStage also
 *   chose, so this contract deliberately doesn't pin the shape down
 *   further than "whatever this specific strategy needs."
 *
 *   TerrainPositionFact[] specifically (StraightRailStrategy's shape)
 *     Changed from a bare `{x,y,z}[]` in Roadmap Phase 11 (Project Prompt
 *     11): a slope-aware path's Y varies per position, and TerrainScanner
 *     already resolved exactly that during scanning — a strategy reads
 *     `path[i].position` for placement and `path[i].slopeDirection` to
 *     pick the right permutation, rather than the caller (PlacementStage)
 *     recomputing a flat coordinate list that would silently disagree with
 *     what was actually validated. See StraightRailStrategy.js's "ROADMAP
 *     PHASE 11 CHANGE" note for the full reasoning, and PlacementStage.js
 *     for where `path` now comes from.
 *
 *   @typedef {Object} BuildResult
 *   @property {number} blocksPlaced
 *   @property {boolean} completed   True only if the full target length was placed.
 *   @property {string} [stopReason] Present when completed is false.
 *
 * FUTURE EXTENSIONS
 *   - Roadmap Phase 16 (Project Prompt 16): BridgeExecutionStrategy is now
 *     a real second implementer — see above.
 *   - Roadmap Phase 17+: an UndergroundExcavationStrategy/CurvedRailStrategy
 *     would live alongside these two, each implementing the same contract.
 *
 * DEPENDENCIES
 *   None — this file is documentation, not executable logic.
 */

export {};
