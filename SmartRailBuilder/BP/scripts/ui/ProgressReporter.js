import { PROGRESS } from "../config/Constants.js";
import { LocalizationKeys } from "../localization/LocalizationKeys.js";

/**
 * ProgressReporter.js
 *
 * PURPOSE
 *   Sends throttled progress feedback ("Building Railway... 12 / 64") to
 *   the player during a long build. Decides only *when* to report, not
 *   *how* the message is formatted or localized — that's MessageService's
 *   job. Uses actionbar, not chat, matching Project Prompt 9's established
 *   "transient updates go in the actionbar" pattern (see MessageService.js)
 *   — a progress ping that fired via chat would be genuine spam over the
 *   course of a long build.
 *
 * RESPONSIBILITIES
 *   - Only report for builds at least Constants.PROGRESS.
 *     MIN_LENGTH_FOR_PROGRESS_UPDATES long — a 1-block build finishes
 *     before a progress update would mean anything.
 *   - Only report every Constants.PROGRESS.UPDATE_INTERVAL_BLOCKS blocks —
 *     not on every single block, which would flood the actionbar with
 *     updates faster than a player could read them.
 *
 * FUTURE EXTENSIONS
 *   - None expected; cadence tuning is a config change in Constants.js, not
 *     a change here.
 *
 * DEPENDENCIES
 *   - config/Constants.js (PROGRESS)
 *   - localization/LocalizationKeys.js
 *   - ui/MessageService.js (injected — actual message delivery)
 */

export class ProgressReporter {
  /**
   * @param {import("../ui/MessageService.js").MessageService} messageService
   */
  constructor(messageService) {
    /** @private */
    this._messageService = messageService;
  }

  /**
   * @param {import("../core/BuildSession.js").BuildSession} session
   * @returns {void}
   */
  reportIfDue(session) {
    if (session.targetLength < PROGRESS.MIN_LENGTH_FOR_PROGRESS_UPDATES) return;
    if (session.blocksPlaced % PROGRESS.UPDATE_INTERVAL_BLOCKS !== 0) return;

    this._messageService.sendActionBar(session.player, LocalizationKeys.CONSTRUCTION_PROGRESS, [
      session.blocksPlaced,
      session.targetLength,
    ]);
  }
}
