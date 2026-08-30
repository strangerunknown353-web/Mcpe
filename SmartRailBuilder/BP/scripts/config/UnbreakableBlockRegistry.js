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
 * RESPONSIBILITIES
 *   - Enumerate vanilla block IDs TunnelDetector must never plan to break.
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
 * Added Project Prompt 13 (architecture review), same reasoning as
 * HazardRegistry.js's HAZARD_BLOCK_ID_SET — see that file's comment.
 * @type {ReadonlySet<string>}
 */
export const UNBREAKABLE_BLOCK_ID_SET = new Set(UNBREAKABLE_BLOCK_IDS);
