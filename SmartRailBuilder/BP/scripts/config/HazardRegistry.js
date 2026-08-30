/**
 * HazardRegistry.js
 *
 * PURPOSE
 *   Single source of truth for which blocks make a path unsafe to build
 *   through. Data only — PathValidator (Roadmap Phase 5) is the only module
 *   that will read this list to make accept/reject decisions.
 *
 * RESPONSIBILITIES
 *   - Enumerate vanilla block IDs considered hazardous to walk/build through.
 *
 * FUTURE EXTENSIONS
 *   - This starter list (lava, fire, cactus, and similarly damaging blocks)
 *     is a first pass and is flagged for your review — see TODO.md. Adding
 *     or removing a hazard later is a one-line change here, nothing else
 *     needs to change.
 *
 * DEPENDENCIES
 *   None.
 */

/**
 * Block type IDs treated as hazards. A path containing any of these is
 * rejected by PathValidator before construction starts (Roadmap Phase 5).
 * @type {ReadonlyArray<string>}
 */
export const HAZARD_BLOCK_IDS = Object.freeze([
  "minecraft:lava",
  "minecraft:flowing_lava",
  "minecraft:fire",
  "minecraft:soul_fire",
  "minecraft:cactus",
  "minecraft:magma",
  "minecraft:campfire",
  "minecraft:soul_campfire",
  "minecraft:sweet_berry_bush",
  "minecraft:wither_rose",
  "minecraft:powder_snow",
]);

/**
 * Added Project Prompt 13 (architecture review): every consumer of
 * HAZARD_BLOCK_IDS only ever did `new Set(HAZARD_BLOCK_IDS)` — by this
 * session, independently in 3 separate files (TerrainScanner.js,
 * TunnelDetector.js, TunnelExcavator.js), each rebuilding an identical Set
 * from the same frozen source array at module load. Harmless in cost
 * (three tiny Sets built once at startup, not per call) but a real
 * "single source of truth" smell, and exactly the kind of finding this
 * session's architecture review asked to look for and fix where it can be
 * done without breaking anything. Built here once instead — every
 * consumer now imports this directly. See ARCHITECTURE.md §38.4.
 * @type {ReadonlySet<string>}
 */
export const HAZARD_BLOCK_ID_SET = new Set(HAZARD_BLOCK_IDS);
