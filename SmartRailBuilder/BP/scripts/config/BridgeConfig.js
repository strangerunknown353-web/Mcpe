/**
 * BridgeConfig.js
 *
 * PURPOSE
 *   Single source of truth for Bridge Mode's construction constants —
 *   added Roadmap Phase 16 (Project Prompt 16), matching
 *   config/TunnelConfig.js's/RailConfig.js's existing pattern of "data
 *   only, read by every module that needs to agree on a number rather than
 *   each hardcoding its own copy." Substantially revised in the bugfix
 *   pass before Project Prompt 18 — see REVISION HISTORY below.
 *
 * REVISION HISTORY (bugfix pass before Project Prompt 18)
 *   `MATERIAL_ITEM_ID` is no longer the material every bridge uses — the
 *   player now picks their own from their current inventory (see
 *   ui/BuildMenu.js's `promptForBridgeMaterial()` and
 *   core/BuildRequest.js's `bridgeMaterialId`), exactly the "future
 *   material-selection feature" this constant's original documentation
 *   said this file's design was already positioned for. Kept, renamed to
 *   `FALLBACK_MATERIAL_ID`, as the value used only in the — expected to be
 *   unreachable in normal play — case where a material choice somehow
 *   never reached execution; see BridgeExecutionStrategy.js.
 *   `PIER_SPACING`, `FLAT_LEVEL_CLEARANCE`, and `RAMP_LEVEL_CLEARANCE` are
 *   new, replacing the single implicit "2 blocks of headroom, full column
 *   every position" assumption that produced the reported solid-wall
 *   bridges — see ARCHITECTURE.md §46.1-§46.2 for the full diagnosis and
 *   TerrainScanner.js's `planBridge()` for how each constant is used.
 *
 * NOTE ON PIER_SPACING
 *   No explicit number given by the bug-fix request beyond "use
 *   significantly fewer blocks... look like an actual railway bridge."
 *   4 was chosen as a reasonable, visually plausible default (real
 *   pier/truss bridges commonly space supports every few span-lengths,
 *   and a Minecraft rail block is exactly 1 span) — flagged for your
 *   adjustment, same as every other numeric default in this project that
 *   wasn't explicitly specified. A pier is also always placed at index 0
 *   and the last index regardless of spacing, so both ends of any bridge
 *   are always anchored no matter what this number is set to.
 *
 * NOTE ON MAX_SUPPORT_SEARCH_DEPTH
 *   Unchanged from Project Prompt 16 — see that session's reasoning,
 *   still valid: a bridge's deck can sit up to BUILD_MODE_REGISTRY.BRIDGE.max
 *   (16) blocks above the origin, and the terrain below could ALSO already
 *   be a genuine drop, so the worst-case distance from deck to real ground
 *   is meaningfully larger than a same-elevation gap search ever needs to
 *   consider. Now only actually used at pier positions (see planBridge()'s
 *   PIER STRUCTURE note) rather than every position, so its practical cost
 *   is far lower than when it was written even though the value itself
 *   hasn't changed.
 *
 * NOTE ON RAMP_LEVEL_CLEARANCE
 *   3, one more than FLAT_LEVEL_CLEARANCE's 2 — identical reasoning to
 *   config/UndergroundConfig.js's `SLOPE_LEVEL_CLEARANCE`: a minecart sits
 *   higher on a sloped rail, so the diagonal ascending/descending sections
 *   of the new ramp get one extra block of headroom. Flagged the same way
 *   that constant is: if in-game testing shows 2 is plainly sufficient on
 *   a bridge's ramps too, this is a one-line change.
 *
 * DEPENDENCIES
 *   None.
 */

export const BRIDGE_CONFIG = Object.freeze({
  /**
   * Used only if a bridge material somehow never reached execution —
   * expected to be unreachable in normal play, since BuildMenu always
   * requires a material selection before a bridge build can proceed. See
   * REVISION HISTORY above.
   */
  FALLBACK_MATERIAL_ID: "minecraft:cobblestone",
  /** @see NOTE ON MAX_SUPPORT_SEARCH_DEPTH above. */
  MAX_SUPPORT_SEARCH_DEPTH: 48,
  /** @see NOTE ON PIER_SPACING above. */
  PIER_SPACING: 4,
  /** Rail's own block plus one block of headroom above it — matches TUNNEL_CONFIG.HEIGHT's established interpretation. */
  FLAT_LEVEL_CLEARANCE: 2,
  /** @see NOTE ON RAMP_LEVEL_CLEARANCE above. */
  RAMP_LEVEL_CLEARANCE: 3,
});
