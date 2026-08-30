/**
 * OreRegistry.js
 *
 * PURPOSE
 *   Block IDs Underground Mode's excavation treats as ores, split into two
 *   tiers so `config/UndergroundConfig.js`'s `ORE_POLICY` can act on them
 *   differently. Added Roadmap Phase 17 (Project Prompt 17), matching the
 *   established `HazardRegistry.js`/`UnbreakableBlockRegistry.js`/
 *   `ReplaceableBlockRegistry.js` pattern exactly: a documented array plus
 *   a derived Set, one line to extend later, read by every consumer rather
 *   than each hardcoding its own copy.
 *
 * WHY TWO TIERS RATHER THAN ONE "IS AN ORE" LIST
 *   Project Prompt 17 asked for a policy that "prefers safety over
 *   aggressive excavation" while also warning against destroying valuable
 *   blocks silently — but a single all-or-nothing list makes the feature
 *   either destructive or useless. Rejecting on ANY ore would fail almost
 *   every real deep tunnel (coal/copper/iron are everywhere below y=0),
 *   making Underground Mode unusable in practice; excavating every ore
 *   silently would quietly consume a player's diamonds, and this addon's
 *   excavation deliberately does NOT drop the mined block as an item (an
 *   established, documented decision from Project Prompt 12 — see
 *   builder/TunnelExcavator.js), so that loss would be permanent and
 *   invisible.
 *
 *   Splitting the difference: genuinely irreplaceable finds
 *   (`VALUABLE_ORE_IDS`) stop the build BEFORE anything is modified, with
 *   the exact blocking coordinate reported so the player can pick a
 *   different depth or location; ordinary ores (`COMMON_ORE_IDS`) are
 *   excavated but COUNTED and reported in the completion message, so
 *   nothing is destroyed *silently* even under the permissive tier. See
 *   ARCHITECTURE.md §45.6 for the full policy write-up and the two
 *   alternative policies that are also implemented and one constant away.
 *
 * DEPENDENCIES
 *   None.
 */

/**
 * Stops an Underground build outright under the default `PROTECT_VALUABLE`
 * policy. Deliberately short — only blocks whose permanent, silent loss a
 * player would genuinely regret, not everything that happens to be shiny.
 * @type {ReadonlyArray<string>}
 */
export const VALUABLE_ORE_IDS = Object.freeze([
  "minecraft:diamond_ore",
  "minecraft:deepslate_diamond_ore",
  "minecraft:emerald_ore",
  "minecraft:deepslate_emerald_ore",
  "minecraft:ancient_debris",
]);

/**
 * Excavated (but counted and reported) under the default policy. These are
 * common enough at depth that rejecting on them would make Underground
 * Mode fail on most real terrain — see WHY TWO TIERS above.
 * @type {ReadonlyArray<string>}
 */
export const COMMON_ORE_IDS = Object.freeze([
  "minecraft:coal_ore",
  "minecraft:deepslate_coal_ore",
  "minecraft:iron_ore",
  "minecraft:deepslate_iron_ore",
  "minecraft:copper_ore",
  "minecraft:deepslate_copper_ore",
  "minecraft:gold_ore",
  "minecraft:deepslate_gold_ore",
  "minecraft:redstone_ore",
  "minecraft:lit_redstone_ore",
  "minecraft:deepslate_redstone_ore",
  "minecraft:lit_deepslate_redstone_ore",
  "minecraft:lapis_ore",
  "minecraft:deepslate_lapis_ore",
  "minecraft:quartz_ore",
  "minecraft:nether_gold_ore",
]);

/** @type {ReadonlySet<string>} */
export const VALUABLE_ORE_ID_SET = new Set(VALUABLE_ORE_IDS);
/** @type {ReadonlySet<string>} */
export const COMMON_ORE_ID_SET = new Set(COMMON_ORE_IDS);

/**
 * True for any block on either tier. Used by the `PROTECT_ALL` policy and
 * by the excavated-ore counter, so neither has to check both Sets itself.
 * @param {string} blockTypeId
 * @returns {boolean}
 */
export function isOre(blockTypeId) {
  return VALUABLE_ORE_ID_SET.has(blockTypeId) || COMMON_ORE_ID_SET.has(blockTypeId);
}
