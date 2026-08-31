/**
 * UnbreakableBlockRegistry.js
 *
 * PURPOSE
 *   Single source of truth for which blocks TunnelDetector must never
 *   attempt to excavate. Data only — mirrors HazardRegistry.js's existing
 *   pattern exactly (see that file), added Roadmap Phase 12 (Project
 *   Prompt 12) for tunnel excavation.
 *
 * WHY A CURATED LIST, NOT A DYNAMIC API QUERY
 *   Bedrock has an official `minecraft:destructible_by_mining` block
 *   component (stable, not experimental) that in principle describes
 *   exactly this — but it's documented as a block-DEFINITION property (used
 *   when authoring a custom block's JSON), and this session's research
 *   could not confirm it's readable via `Block.getComponent()` at runtime
 *   for arbitrary VANILLA blocks the way this addon would need. Given this
 *   project's own recent, concrete lesson (§34 — `Block.isSolid` looked
 *   like the obviously-right dynamic property and turned out to be
 *   experimental and unreliable), depending on another unconfirmed dynamic
 *   property for a decision this safety-critical (never break bedrock, a
 *   structure block, or similar) was judged the wrong tradeoff. A curated
 *   list is exactly the same pattern already proven in production by
 *   HazardRegistry — easy to extend, and its correctness doesn't depend on
 *   an unverified runtime behavior.
 *
 * EXTENDED PROJECT PROMPT 24 (Roadmap Phase 24): PLAYER-STRUCTURE PROTECTION
 *   Project Prompt 24 §11 asks the routing system to protect "existing
 *   structures... buildings... chests... important blocks" and never
 *   destroy one just to make a railway fit — rejecting the route instead
 *   when no safe solution exists. Vanilla Bedrock has no metadata
 *   distinguishing a player-placed chest from a naturally-generated one, or
 *   a hand-built wall from ordinary stone (the exact same "no reliable
 *   dynamic signal" situation `Block.isSolid` and `destructible_by_mining`
 *   already taught this project not to guess at, above) — so there is no
 *   way to build a true "is this part of a player structure" detector.
 *   What IS reliably knowable, with the same curated-list approach already
 *   proven here: which specific block TYPES represent something a player
 *   almost certainly placed deliberately and would not want silently
 *   destroyed (storage, crafting/utility stations, doors, beds, signs,
 *   decorative furniture blocks). This registry now protects those too —
 *   every consumer that already treats `UNBREAKABLE_BLOCK_ID_SET` as
 *   "never plan to break this, reject the route instead" (TunnelDetector,
 *   TunnelExcavator, BridgeSupportBuilder, TerrainScanner) gets this
 *   protection for free, with zero changes to any of those files: the same
 *   check, the same rejection path, the same player-facing message already
 *   used for bedrock. See ARCHITECTURE.md §53.6 for the honest limitation
 *   this doesn't solve (a player's stone-brick bridge PIER looks identical
 *   to natural stone — only the functionally important part, an existing
 *   RAIL block, is reliably protected, via config/RailConfig.js's
 *   RAIL_ITEM_ID_SET, unchanged since Project Prompt 19).
 *
 * RESPONSIBILITIES
 *   - Enumerate vanilla block IDs TunnelDetector/BridgeSupportBuilder/
 *     TerrainScanner must never plan to break or place through — both
 *     truly indestructible blocks and player-structure blocks this addon
 *     chooses to always protect.
 *
 * FUTURE EXTENSIONS
 *   - Like HazardRegistry, adding or removing an entry is a one-line change
 *     here — flagged for your review, same as that list was.
 *   - If Bedrock's `destructible_by_mining` component is later confirmed
 *     readable at runtime for vanilla blocks, it could supplement (not
 *     necessarily replace) this list as a second signal — not attempted
 *     this session given the confirmation gap above.
 *
 * DEPENDENCIES
 *   None.
 */

/**
 * Block type IDs TunnelDetector treats as impossible to excavate — matches
 * Project Prompt 12's explicit examples (bedrock, barrier, structure
 * blocks) plus other vanilla blocks with the same "hardness -1,
 * unbreakable in Survival" property. Not claimed to be exhaustive of every
 * possible future or custom unbreakable block — see FUTURE EXTENSIONS above.
 * @type {ReadonlyArray<string>}
 */
export const UNBREAKABLE_BLOCK_IDS = Object.freeze([
  "minecraft:bedrock",
  "minecraft:barrier",
  "minecraft:structure_block",
  "minecraft:structure_void",
  "minecraft:command_block",
  "minecraft:chain_command_block",
  "minecraft:repeating_command_block",
  "minecraft:jigsaw",
  "minecraft:end_portal_frame",
  "minecraft:end_portal",
  "minecraft:end_gateway",
  "minecraft:reinforced_deepslate",
  "minecraft:allow",
  "minecraft:deny",
  "minecraft:border_block",
  "minecraft:unknown",
]);

/**
 * Added Project Prompt 24 §11 — see EXTENDED PROJECT PROMPT 24 above. Common
 * vanilla blocks representing deliberate player construction: storage,
 * crafting/utility stations, doors/access blocks, sleeping, and signage/
 * decorative furniture. Not exhaustive — flagged for your review, same as
 * every other list in this file.
 * @type {ReadonlyArray<string>}
 */
export const PROTECTED_STRUCTURE_BLOCK_IDS = Object.freeze([
  // Storage
  "minecraft:chest",
  "minecraft:trapped_chest",
  "minecraft:ender_chest",
  "minecraft:barrel",
  "minecraft:shulker_box",
  // Crafting / utility stations
  "minecraft:crafting_table",
  "minecraft:furnace",
  "minecraft:lit_furnace",
  "minecraft:blast_furnace",
  "minecraft:lit_blast_furnace",
  "minecraft:smoker",
  "minecraft:lit_smoker",
  "minecraft:brewing_stand",
  "minecraft:enchanting_table",
  "minecraft:anvil",
  "minecraft:chipped_anvil",
  "minecraft:damaged_anvil",
  "minecraft:grindstone",
  "minecraft:stonecutter_block",
  "minecraft:loom",
  "minecraft:cartography_table",
  "minecraft:fletching_table",
  "minecraft:smithing_table",
  "minecraft:composter",
  "minecraft:lectern",
  "minecraft:beacon",
  "minecraft:respawn_anchor",
  // Doors / access
  "minecraft:wooden_door",
  "minecraft:iron_door",
  "minecraft:trapdoor",
  "minecraft:iron_trapdoor",
  // Sleeping
  "minecraft:bed",
  // Signage / decorative furniture
  "minecraft:standing_sign",
  "minecraft:wall_sign",
  "minecraft:hanging_sign",
  "minecraft:frame", // item frame
  "minecraft:glow_frame", // glow item frame
  "minecraft:armor_stand",
  "minecraft:jukebox",
  "minecraft:flower_pot",
]);

/** @type {ReadonlySet<string>} Same construction-time-Set pattern as HAZARD_BLOCK_ID_SET below. */
export const PROTECTED_STRUCTURE_BLOCK_ID_SET = new Set(PROTECTED_STRUCTURE_BLOCK_IDS);

/**
 * Added Project Prompt 13 (architecture review), same reasoning as
 * HazardRegistry.js's HAZARD_BLOCK_ID_SET — see that file's comment. Now
 * ALSO includes `PROTECTED_STRUCTURE_BLOCK_ID_SET` (Project Prompt 24) —
 * every one of this set's 8 existing consumers (TunnelDetector,
 * TunnelExcavator, BridgeSupportBuilder, TerrainScanner, InventoryManager)
 * already treats membership here as "never plan to break/place through
 * this, reject the route instead" — exactly the behavior §11 asks for a
 * player-placed chest/furnace/door/etc. to get too. Unioning here means
 * every one of those consumers gets the new protection with ZERO changes
 * to any of them.
 * @type {ReadonlySet<string>}
 */
export const UNBREAKABLE_BLOCK_ID_SET = new Set([...UNBREAKABLE_BLOCK_IDS, ...PROTECTED_STRUCTURE_BLOCK_IDS]);
