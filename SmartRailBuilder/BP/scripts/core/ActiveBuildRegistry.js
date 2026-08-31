import { Logger } from "../utils/Logger.js";

/**
 * ActiveBuildRegistry.js
 *
 * PURPOSE
 *   Added Project Prompt 22 §11 ("Multiplayer Safety" — "if two players
 *   attempt conflicting builds in the same area: handle the conflict safely
 *   ... never allow one player's build to silently corrupt another player's
 *   railway"). A tiny, in-memory registry of which player currently "owns"
 *   which block positions for the duration of an active placement —
 *   PlacementStage claims a BuildPlan's `modificationBoundary` right before
 *   calling RailBuilder.run(), and releases it in the same try/finally that
 *   already unregisters the session from CancellationWatcher.
 *
 * WHY THIS RUNS INSIDE PlacementStage, NOT A SEPARATE PIPELINE STAGE
 *   A conflict CHECK done in an earlier stage and a CLAIM done later would
 *   leave a window between them where a second player's build could slip
 *   through — a classic check-then-act race. The Bedrock scripting engine
 *   runs all synchronous code for one event/tick to completion before
 *   another player's code can interleave, so doing the check-and-claim
 *   together, synchronously, in one call (this class's `claim()`) — and
 *   specifically BEFORE the one `await` in PlacementStage.execute() — is
 *   race-free without needing a lock of any kind. See PlacementStage.js.
 *
 * WHY BY PLAYER ID, NOT BY BuildSession
 *   A player can only ever have one active build (BuildOrchestrator's own
 *   `_activePlayerIds` guard already prevents a second concurrent trigger),
 *   so `player.id` is already a unique-enough claim owner — no need for a
 *   second identifier.
 *
 * RESPONSIBILITIES
 *   - `claim(ownerId, positionKeys)`: atomically claim every position, or
 *     none of them, reporting exactly which ones (if any) already belong to
 *     a DIFFERENT owner.
 *   - `release(ownerId)`: free every position this owner had claimed.
 *   - Never silently let a second owner's claim overwrite an existing one.
 *
 * DEPENDENCIES
 *   - utils/Logger.js
 */

export class ActiveBuildRegistry {
  constructor() {
    /** @type {Map<string, string>} positionKey -> ownerId. @private */
    this._ownerByPosition = new Map();
    /** @type {Map<string, Set<string>>} ownerId -> Set(positionKey). @private */
    this._positionsByOwner = new Map();
  }

  /**
   * @param {string} ownerId
   * @param {Iterable<string>} positionKeys Pre-formatted position keys — see utils/PositionKey.js.
   * @returns {{claimed: boolean, conflictingKeys: ReadonlyArray<string>}}
   */
  claim(ownerId, positionKeys) {
    const conflicts = [];
    for (const key of positionKeys) {
      const existingOwner = this._ownerByPosition.get(key);
      if (existingOwner && existingOwner !== ownerId) {
        conflicts.push(key);
      }
    }

    if (conflicts.length > 0) {
      Logger.warn(`ActiveBuildRegistry: ${ownerId} could not claim ${conflicts.length} position(s) already held by another build.`);
      return { claimed: false, conflictingKeys: conflicts };
    }

    const claimedSet = new Set();
    for (const key of positionKeys) {
      this._ownerByPosition.set(key, ownerId);
      claimedSet.add(key);
    }
    this._positionsByOwner.set(ownerId, claimedSet);
    return { claimed: true, conflictingKeys: [] };
  }

  /**
   * @param {string} ownerId
   * @returns {void}
   */
  release(ownerId) {
    const keys = this._positionsByOwner.get(ownerId);
    if (!keys) return;

    for (const key of keys) {
      // Only clear an entry this owner actually still holds — defensive
      // against a hypothetical double-release, never clears another
      // owner's claim.
      if (this._ownerByPosition.get(key) === ownerId) {
        this._ownerByPosition.delete(key);
      }
    }
    this._positionsByOwner.delete(ownerId);
  }
}
