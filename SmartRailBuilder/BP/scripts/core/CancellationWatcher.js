import { world } from "@minecraft/server";
import { Logger } from "../utils/Logger.js";

/**
 * CancellationWatcher.js
 *
 * PURPOSE
 *   Detects the four events that must safely stop an in-progress build:
 *   the player leaving, changing dimension, dying, or changing game mode.
 *   Confirmed against the current stable @minecraft/server API in Project
 *   Prompt 2 (ARCHITECTURE.md §8) and unchanged since: `world.beforeEvents.
 *   playerLeave`, `world.afterEvents.playerDimensionChange`,
 *   `world.afterEvents.entityDie` (filtered to `minecraft:player`), and
 *   `world.afterEvents.playerGameModeChange`.
 *
 * RESPONSIBILITIES
 *   - Subscribe to the four cancellation-relevant world events exactly once.
 *   - Track which player owns which active BuildSession.
 *   - On a matching event, call session.markCancelled(reason) and leave all
 *     reporting to whatever calls it — this class only detects and flags.
 *
 * IMPLEMENTED PROJECT PROMPT 10
 *   Wired for real now that RailBuilder's multi-tick placement (via
 *   `system.runJob`) is real too — a build spread across many ticks is
 *   exactly the scenario that needs live cancellation detection; a
 *   same-tick synchronous pipeline (everything before PlacementStage)
 *   didn't. `registerSession`/`unregisterSession` are called by
 *   PlacementStage around each build (try/finally, so a session is always
 *   unregistered even if placement throws).
 *
 * FUTURE EXTENSIONS
 *   - Roadmap Phase 10: extending session tracking to a full per-player
 *     registry (for the "prevent double-activation" build lock) reuses the
 *     same registerSession/unregisterSession methods already defined here —
 *     BuildOrchestrator's own `_activePlayerIds` Set already serves that
 *     purpose at the whole-pipeline level today.
 *
 * DEPENDENCIES
 *   - core/BuildSession.js (the object whose cancelled flag this class sets)
 *   - @minecraft/server world events
 *   - utils/Logger.js
 */

export class CancellationWatcher {
  constructor() {
    /** @type {Map<string, import("./BuildSession.js").BuildSession>} playerId -> session */
    this._sessionsByPlayerId = new Map();
    /** @private */
    this._initialized = false;
  }

  /**
   * Subscribes to the four cancellation events. Must be called exactly once
   * during addon startup (main.js), not per-build.
   * @returns {void}
   */
  initialize() {
    if (this._initialized) {
      Logger.warn("CancellationWatcher.initialize() called more than once — ignoring the extra call.");
      return;
    }
    this._initialized = true;

    world.beforeEvents.playerLeave.subscribe((event) => {
      this._cancelIfActive(event.player.id, "playerLeave");
    });

    world.afterEvents.playerDimensionChange.subscribe((event) => {
      this._cancelIfActive(event.player.id, "playerDimensionChange");
    });

    world.afterEvents.entityDie.subscribe(
      (event) => {
        this._cancelIfActive(event.deadEntity.id, "playerDeath");
      },
      { entityTypes: ["minecraft:player"] }
    );

    world.afterEvents.playerGameModeChange.subscribe((event) => {
      this._cancelIfActive(event.player.id, "playerGameModeChange");
    });

    Logger.debug("CancellationWatcher initialized — subscribed to 4 cancellation events.");
  }

  /**
   * @param {string} playerId
   * @param {import("./BuildSession.js").BuildSession} session
   */
  registerSession(playerId, session) {
    this._sessionsByPlayerId.set(playerId, session);
  }

  /**
   * @param {string} playerId
   */
  unregisterSession(playerId) {
    this._sessionsByPlayerId.delete(playerId);
  }

  /**
   * @param {string} playerId
   * @param {string} reason
   * @private
   */
  _cancelIfActive(playerId, reason) {
    const session = this._sessionsByPlayerId.get(playerId);
    if (!session || session.isCancelled()) return;
    session.markCancelled(reason);
    Logger.debug(`Build cancelled for player ${playerId}: ${reason}`);
  }
}
