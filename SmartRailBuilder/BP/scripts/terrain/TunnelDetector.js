import { HAZARD_BLOCK_ID_SET } from "../config/HazardRegistry.js";
import { UNBREAKABLE_BLOCK_ID_SET } from "../config/UnbreakableBlockRegistry.js";
import { TUNNEL_CONFIG } from "../config/TunnelConfig.js";
import { readBlock } from "../utils/BlockReader.js";

/**
 * TunnelDetector.js
 *
 * PURPOSE
 *   Answers exactly one question: starting from a position where the
 *   normal ±1 slope resolution failed because the rail's own spot (or the
 *   headroom above it) is blocked by more than 1 block, is a level tunnel
 *   through this obstruction possible? "Detection" only, per Project
 *   Prompt 12's explicit separation of concerns — this class never
 *   excavates anything and never decides whether the OVERALL path is
 *   accepted; see terrain/TunnelPlanner.js for what turns a successful
 *   detection into a concrete plan, and terrain/PathValidator.js for the
 *   final accept/reject decision.
 *
 * ROADMAP PHASE 12 SCOPE: RISES ONLY, NOT DROPS
 *   Project Prompt 12's own testing list (small hill, large hill) and its
 *   explicit trigger condition ("when the railway cannot continue because
 *   the terrain rises by more than one block") both describe a wall/hill
 *   blocking upward, not a ravine/cliff dropping away. A drop of more than
 *   1 block remains UNSUPPORTED, unchanged — that's bridge territory
 *   (Roadmap Phase 13+, explicitly deferred: "Do NOT build bridges yet").
 *   TerrainScanner only calls this class for the rise case; see that
 *   file's `_resolveSteppedPosition()`.
 *
 * ALGORITHM
 *   Bores a straight, LEVEL tunnel at the current rail Y — no vertical
 *   change, matching a real "tunnel through a mountain," not a spiral or
 *   sloped bore. Walks forward one horizontal step at a time — up to
 *   TUNNEL_CONFIG.MAX_SEARCH_LENGTH, or however many positions remain
 *   before the hard absolute build-length ceiling
 *   (`RailConfig.LENGTH_PRESETS.MAX_SURVIVAL`), whichever is smaller.
 *   Fixed in Project Prompt 14's second round: this search room is
 *   deliberately NOT reduced by how much of the ORIGINALLY REQUESTED
 *   build length has already been used — a tunnel gets its own fresh
 *   budget against the absolute ceiling, confirmed with you directly,
 *   since the overall build may extend past what was originally
 *   requested (up to that same ceiling) to fit a tunnel that needs the
 *   room. See config/TunnelConfig.js's NOTE ON MAX_SEARCH_LENGTH and
 *   ARCHITECTURE.md §40 for the full history — the requested-length-based
 *   version was the actual cause of "tunnel would be too long" failures
 *   reported after that constant was already raised to 64. Checking, at
 *   each step, the rail spot and the headroom block above it:
 *   - Both already clear (rail spot and headroom) → the exit: the original
 *     obstruction has ended here. Normal terrain scanning resumes at this
 *     exact position afterward, using its own existing logic for whatever
 *     the ground actually looks like — flat, a drop, even another rise —
 *     which is deliberately NOT this class's concern; see the FLOOR_GAP
 *     bullet below for why solid ground is checked separately, not as
 *     part of the exit condition.
 *   - Either blocked by an UNBREAKABLE_BLOCK_IDS entry → impossible, stop
 *     immediately (Project Prompt 12: "if an unbreakable block blocks the
 *     tunnel, stop construction, display a localized error").
 *   - Either blocked by a hazard or liquid → impossible, stop immediately
 *     (Project Prompt 12: liquid handling is detection-only this phase —
 *     "do NOT implement liquid management yet").
 *   - Still blocked (not yet an exit) AND the GROUND (one below rail
 *     level) isn't solid → an air pocket inside the hill, genuinely not
 *     walkable — impossible, stop. See ARCHITECTURE.md §37.3 for why this
 *     known limitation was accepted rather than also attempting to
 *     floor-fill such gaps this phase. Checked only once the exit
 *     condition above has already ruled out "this is just where the wall
 *     ends and the ground legitimately drops" — an earlier version of
 *     this class conflated the two and incorrectly failed on a wall
 *     immediately followed by a drop; caught by the mocked test harness,
 *     see ARCHITECTURE.md §37.5.
 *   - Otherwise → needs excavating, keep going.
 *   - Search limit reached with no exit found → impossible, too long.
 *
 * WHAT THIS CLASS DOES NOT DO
 *   Never reads or writes anything outside this straight, level line —
 *   width is always exactly 1 (TUNNEL_CONFIG.WIDTH), matching this
 *   addon's straight-only railway shape. Never removes a block. Never
 *   decides whether the caller SHOULD tunnel here versus reporting
 *   UNSUPPORTED — that decision already happened in TerrainScanner before
 *   this class is even called.
 *
 * DEPENDENCIES
 *   - config/HazardRegistry.js (HAZARD_BLOCK_ID_SET)
 *   - config/UnbreakableBlockRegistry.js (UNBREAKABLE_BLOCK_ID_SET)
 *   - config/TunnelConfig.js
 *   - utils/BlockReader.js (readBlock — shared with TerrainScanner.js and
 *     BridgeDetector.js as of Project Prompt 13's architecture review;
 *     previously duplicated here, see utils/BlockReader.js's header)
 */

/**
 * @typedef {Object} TunnelDetectionResult
 * @property {boolean} possible
 * @property {number} [length] Number of positions (starting at the search origin) that need excavating. Present only if possible.
 * @property {string} [reason] One of "UNBREAKABLE", "HAZARD", "TOO_LONG", "UNLOADED", "OUT_OF_BOUNDS". Present only if !possible.
 * @property {string} [blockingBlockId] Present only when reason is "UNBREAKABLE".
 */

export class TunnelDetector {
  /**
   * @param {import("@minecraft/server").Dimension} dimension
   * @param {import("../core/BuildVector.js").BuildVector} buildVector
   * @param {number} startIndex The first blocked position (already known to need excavating).
   * @param {number} railY The Y level to bore through — unchanged for the whole tunnel (level bore, no slope).
   * @param {number} positionsUntilAbsoluteCeiling How many positions remain before the
   *   hard absolute build-length ceiling (`RailConfig.LENGTH_PRESETS.MAX_SURVIVAL`) —
   *   NOT before the originally requested length. Renamed from `remainingBudget` in
   *   Project Prompt 14's second round, when the old name's actual behavior (tied to
   *   the request, not the ceiling) was found to be the real cause of reported
   *   "tunnel too long" failures on builds that had room to spare against the ceiling.
   *   A tunnel can never be planned past the absolute ceiling, but CAN extend past
   *   what was originally requested — see terrain/TerrainScanner.js's `scanPath()`.
   * @returns {TunnelDetectionResult}
   */
  detect(dimension, buildVector, startIndex, railY, positionsUntilAbsoluteCeiling) {
    const searchLimit = Math.min(TUNNEL_CONFIG.MAX_SEARCH_LENGTH, positionsUntilAbsoluteCeiling);

    for (let offset = 0; offset < searchLimit; offset++) {
      const index = startIndex + offset;
      const { x, z } = buildVector.horizontalAt(index);

      const groundRead = readBlock(dimension, { x, y: railY - 1, z });
      const railRead = readBlock(dimension, { x, y: railY, z });
      const headroomRead = readBlock(dimension, { x, y: railY + 1, z });

      if (groundRead.status !== "OK") return { possible: false, reason: groundRead.status };
      if (railRead.status !== "OK") return { possible: false, reason: railRead.status };
      if (headroomRead.status !== "OK") return { possible: false, reason: headroomRead.status };

      const blockingCheck = this._checkBlocked(groundRead.block, railRead.block, headroomRead.block);
      if (blockingCheck) return { possible: false, ...blockingCheck };

      const railClear = railRead.block.isAir;
      const headroomClear = headroomRead.block.isAir;

      if (railClear && headroomClear) {
        // The original obstruction has ended here — this position becomes
        // the exit and is NOT included in the tunnel itself (offset, not
        // offset + 1). Normal terrain scanning resumes at this exact
        // index afterward, handling whatever the ground actually looks
        // like here using its own existing logic — flat, a drop, even
        // another rise — not this class's. Deliberately does NOT require
        // solid ground at the tunnel's own level to recognize an exit: a
        // legitimate drop right where the wall ends is a DESCENDING case
        // for the caller, not a tunnel failure. Found and fixed via the
        // mocked test harness (a wall immediately followed by a drop) —
        // see ARCHITECTURE.md §37.5.
        return { possible: true, length: offset };
      }

      const groundSolid = !groundRead.block.isAir && !groundRead.block.isLiquid;
      if (!groundSolid) {
        // Still blocked here (rail spot and/or headroom not clear) AND
        // nothing to stand on either — a genuine floor gap INSIDE the
        // tunnel (an air pocket inside the hill), not a drop at the exit.
        // See ARCHITECTURE.md §37.3 for why this is a disclosed limitation
        // rather than also being handled (e.g. by floor-filling it).
        return { possible: false, reason: "FLOOR_GAP" };
      }
      // Otherwise: rail spot and/or headroom is blocked by ordinary,
      // breakable terrain, with solid ground beneath it — keep going.
    }

    return { possible: false, reason: "TOO_LONG" };
  }

  /**
   * @param {import("@minecraft/server").Block} groundBlock
   * @param {import("@minecraft/server").Block} railBlock
   * @param {import("@minecraft/server").Block} headroomBlock
   * @returns {{reason: string, blockingBlockId?: string}|null} Null if none of the three blocks makes the tunnel impossible at this position.
   * @private
   */
  _checkBlocked(groundBlock, railBlock, headroomBlock) {
    for (const block of [groundBlock, railBlock, headroomBlock]) {
      if (UNBREAKABLE_BLOCK_ID_SET.has(block.typeId)) {
        return { reason: "UNBREAKABLE", blockingBlockId: block.typeId };
      }
      if (HAZARD_BLOCK_ID_SET.has(block.typeId)) {
        return { reason: "HAZARD" };
      }
      if (block.isLiquid) {
        return { reason: "HAZARD" }; // Reuses the existing hazard message — see TunnelPlanner.js/PathValidator.js.
      }
    }
    return null;
  }
}
