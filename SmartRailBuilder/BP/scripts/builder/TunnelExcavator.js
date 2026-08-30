import { BlockPermutation } from "@minecraft/server";
import { UNBREAKABLE_BLOCK_ID_SET } from "../config/UnbreakableBlockRegistry.js";
import { HAZARD_BLOCK_ID_SET } from "../config/HazardRegistry.js";
import { readBlock } from "../utils/BlockReader.js";

/**
 * TunnelExcavator.js
 *
 * PURPOSE
 *   "Tunnel Execution" per Project Prompt 12's requested separation of
 *   concerns: the only class that actually breaks a block for tunnel
 *   purposes. Used by StraightRailStrategy (not RailBuilder directly —
 *   see that file's contract, unchanged) exactly like
 *   RailPermutationBuilder is: a focused helper called per-block, not a
 *   parallel build strategy that would duplicate the placement loop,
 *   cancellation handling, inventory deduction, and progress reporting
 *   StraightRailStrategy already owns correctly.
 *
 * WHAT "EXCAVATE" MEANS HERE (Project Prompt 12's explicit scope)
 *   Sets a block to air. Does NOT give the player the mined item, does NOT
 *   simulate tool durability, does NOT check what tool (if any) the player
 *   is holding — Project Prompt 12 asked for exactly this ("do not
 *   consume tools," "do not simulate mining durability") and never asked
 *   for loot drops. This is a deliberate interpretation, not an oversight:
 *   giving the player free blocks/ores with no tool or durability cost
 *   would be a balance decision this session's prompt didn't ask for. See
 *   ARCHITECTURE.md §37.4 if this needs revisiting.
 *
 * WHY THIS RE-CHECKS BREAKABILITY ITSELF, NOT JUST TRUSTING THE PLAN
 *   TunnelDetector already confirmed every block along the bore was
 *   breakable, potentially many ticks before this method actually runs
 *   (placement is spread across ticks — see StraightRailStrategy.js). The
 *   same "state can change mid-build" principle already applied to
 *   terrain, inventory, and rail placement applies here: a block could
 *   have changed between planning and excavation (e.g. another player
 *   placed something). This re-check is deliberately narrow — breakability
 *   and hazard/liquid only, not a full re-run of TunnelDetector's forward
 *   search — since the overall path shape was already committed to by the
 *   time excavation starts; a changed block here is a "stop and report,"
 *   not a "re-plan."
 *
 * RESPONSIBILITIES
 *   - Given the excavation positions for one tunnel row (from
 *     `TerrainPositionFact.futureMetadata.excavationPositions` — see
 *     terrain/TunnelPlanner.js), re-verify each is still breakable, then
 *     set it to air.
 *   - Stop and report a specific reason (never throw a generic error) if
 *     any position is no longer safe to excavate.
 *
 * FUTURE EXTENSIONS
 *   - Bridge support (Roadmap Phase 13+) will need its own placement-time
 *     helper alongside this one, following the same "small, focused,
 *     called per-block by the existing strategy" shape rather than a new
 *     parallel strategy class.
 *
 * DEPENDENCIES
 *   - config/UnbreakableBlockRegistry.js
 *   - config/HazardRegistry.js
 *   - utils/BlockReader.js (shared with TerrainScanner.js/TunnelDetector.js/BridgeDetector.js — see that file's header)
 */

/**
 * @typedef {Object} ExcavationResult
 * @property {boolean} success
 * @property {string} [reason] One of "UNBREAKABLE", "HAZARD", "UNLOADED". Present only if !success.
 */

export class TunnelExcavator {
  /**
   * @param {import("@minecraft/server").Dimension} dimension
   * @param {ReadonlyArray<{x: number, y: number, z: number}>} excavationPositions
   * @returns {ExcavationResult}
   */
  excavateRow(dimension, excavationPositions) {
    for (const position of excavationPositions) {
      const read = readBlock(dimension, position);
      if (read.status !== "OK") {
        return { success: false, reason: "UNLOADED" };
      }
      const block = read.block;
      if (block.isAir) {
        continue; // Already clear — nothing to do, and nothing wrong.
      }
      if (UNBREAKABLE_BLOCK_ID_SET.has(block.typeId)) {
        return { success: false, reason: "UNBREAKABLE" };
      }
      if (HAZARD_BLOCK_ID_SET.has(block.typeId) || block.isLiquid) {
        return { success: false, reason: "HAZARD" };
      }

      // Deliberately BlockPermutation.resolve() + setPermutation() rather
      // than a hypothetical setType() shortcut — this is the exact
      // mechanism RailPermutationBuilder already uses for rail placement,
      // confirmed working in this addon. Reusing a proven call over an
      // unverified one, consistent with this project's isSolid lesson
      // (§34) about not trusting an assumed API without confirmation.
      block.setPermutation(BlockPermutation.resolve("minecraft:air"));
    }

    return { success: true };
  }
}
