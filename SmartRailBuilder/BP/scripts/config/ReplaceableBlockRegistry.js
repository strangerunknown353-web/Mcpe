/**
 * ReplaceableBlockRegistry.js
 *
 * PURPOSE (bugfix, reported by you after Project Prompt 15 — testing in-game)
 *   Single source of truth for which non-air blocks are safe for the
 *   railway to build straight through — short grass, flowers, dead bushes,
 *   thin snow, and similar naturally-spawning ground cover that a rail
 *   should silently replace, exactly like placing a rail by hand does in
 *   vanilla. Before this fix, `TerrainScanner._scanPosition()` treated
 *   `isAboveReplaceable` as `aboveBlock.isAir` ONLY (see ARCHITECTURE.md
 *   §21.4 for the original, deliberate-but-conservative reasoning) — so a
 *   single tuft of grass in the path made that position classify as
 *   `UNSUPPORTED`, the exact same classification as an actual wall or
 *   too-steep rise. Reported symptom: the rail stopping or leaving a gap
 *   wherever ordinary decorative grass was on the ground, i.e. almost
 *   everywhere on natural terrain. Root cause and full fix write-up:
 *   ARCHITECTURE.md §42.
 *
 * RESPONSIBILITIES
 *   - Enumerate vanilla block IDs that are non-solid, naturally-spawning
 *     ground decoration — safe to silently overwrite when a rail is placed
 *     on top of them, never anything a player deliberately built or grew.
 *
 * DELIBERATELY EXCLUDED (see ARCHITECTURE.md §42.2 for the full list and reasoning)
 *   - Crops (wheat, carrots, potatoes, beetroot, melon/pumpkin stems) and
 *     other player-tended plants — silently destroying a player's farm to
 *     build a rail through it is a different, much more destructive action
 *     than clearing incidental wild grass, and this addon should never do
 *     that without an explicit, separate confirmation this session doesn't
 *     add.
 *   - Anything already on HazardRegistry.js's list (fire, cacti, sweet
 *     berry bush, wither rose, powder snow, etc.) — those are correctly
 *     rejected for player-safety reasons, not obstruction, and must keep
 *     stopping the build.
 *   - Anything solid enough to require real excavation (saplings are
 *     included since they're a thin non-solid decoration, but full-grown
 *     trees/logs/leaves are not — those already correctly trigger the
 *     tunnel system instead, which is the right behavior for them).
 *
 * FUTURE EXTENSIONS
 *   - This list is a first pass covering what's visible in your reported
 *     screenshot's short-grass case plus the obvious neighbors (flowers,
 *     ferns, dead bush, snow layers, seagrass/kelp for future water-bridge
 *     work) and is flagged for your review, same as HazardRegistry.js and
 *     UnbreakableBlockRegistry.js were — see TODO.md. Adding or removing an
 *     entry later is a one-line change here; nothing else needs to change.
 *
 * DEPENDENCIES
 *   None.
 */

/**
 * Block type IDs treated as safely replaceable ground decoration. A
 * position where the block directly above the ground is one of these is
 * classified `FLAT_SAFE`, not `UNSUPPORTED` — see
 * terrain/TerrainScanner.js's `_scanPosition()`.
 * @type {ReadonlyArray<string>}
 */
export const REPLACEABLE_BLOCK_IDS = Object.freeze([
  // Short ground-cover grass/foliage (the exact case from your screenshot).
  "minecraft:short_grass",
  "minecraft:tallgrass", // pre-1.20-flattening alias some worlds/tools still emit
  "minecraft:fern",
  "minecraft:large_fern",
  "minecraft:tall_grass", // the 2-block-tall variant (both the lower AND upper half use this ID)
  "minecraft:double_plant", // legacy 2-block-tall plants (lilac/rose bush/peony/large fern), pre-flattening ID
  // Flowers.
  "minecraft:dandelion",
  "minecraft:poppy",
  "minecraft:allium",
  "minecraft:azure_bluet",
  "minecraft:blue_orchid",
  "minecraft:oxeye_daisy",
  "minecraft:cornflower",
  "minecraft:lily_of_the_valley",
  "minecraft:red_flower", // legacy pre-flattening ID covering the poppy/tulip family
  "minecraft:yellow_flower", // legacy pre-flattening ID covering the dandelion
  "minecraft:torchflower",
  "minecraft:pink_petals",
  "minecraft:wither_rose", // NOTE: also on HAZARD_BLOCK_IDS — hazard check runs first in
  // _scanPosition() and always wins, so listing it here too is inert but documents
  // that its absence from this list was never the reason it stops a build.
  // Dead/dry ground cover.
  "minecraft:deadbush",
  "minecraft:dead_bush",
  // Thin snow — vanilla rail placement silently replaces this exactly like grass.
  "minecraft:snow_layer",
  "minecraft:snow",
  // Saplings — thin, non-solid, not yet a tree.
  "minecraft:sapling",
  "minecraft:oak_sapling",
  "minecraft:spruce_sapling",
  "minecraft:birch_sapling",
  "minecraft:jungle_sapling",
  "minecraft:acacia_sapling",
  "minecraft:dark_oak_sapling",
  "minecraft:cherry_sapling",
  "minecraft:mangrove_propagule",
  // Underwater ground cover — not exercised until a future water-crossing/underground
  // phase, included now so this registry doesn't need a second pass then.
  "minecraft:seagrass",
  "minecraft:tall_seagrass",
  "minecraft:kelp",
  "minecraft:small_dripleaf",
]);

/**
 * Same "build the Set once, at module load, in one place" reasoning
 * already established for HAZARD_BLOCK_IDS/HAZARD_BLOCK_ID_SET (Project
 * Prompt 13's architecture review) and UNBREAKABLE_BLOCK_IDS — applied
 * from the start here rather than repeated as a second finding later.
 * @type {ReadonlySet<string>}
 */
export const REPLACEABLE_BLOCK_ID_SET = new Set(REPLACEABLE_BLOCK_IDS);
