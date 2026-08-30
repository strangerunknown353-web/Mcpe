import { Logger } from "../utils/Logger.js";

/**
 * MessageService.js
 *
 * PURPOSE
 *   The only module allowed to send player-facing text. Every message goes
 *   through a LocalizationKeys entry, resolved as a RawMessage `{translate}`
 *   payload — never an inline string literal, per the project's localization
 *   requirement.
 *
 * RESPONSIBILITIES
 *   - Send chat and actionbar messages built from LocalizationKeys.
 *   - Decide *how* to deliver a message (chat vs. actionbar); the caller
 *     decides *what* to say, not how it appears.
 *   - Never throw back into the caller: a player who has left between the
 *     failure being detected and the message being sent is a normal race,
 *     not an error worth crashing a pipeline over.
 *
 * WHY CHAT VS. ACTIONBAR (Project Prompt 9)
 *   `sendChat` is for information worth keeping in the player's chat
 *   history — the direction confirmation, and every rejection message.
 *   `sendActionBar` (implemented for real this session, via
 *   `player.onScreenDisplay.setActionBar()`) is for transient, in-the-
 *   moment progress pings ("Analyzing terrain...", "Checking inventory...")
 *   that would be chat spam if they accumulated in the chat log — an
 *   actionbar message replaces the previous one instead of stacking, which
 *   is exactly the "avoid chat spam" requirement this session asked for.
 *
 * FUTURE EXTENSIONS
 *   - New message types are new LocalizationKeys entries plus a matching
 *     .lang line, not new methods on this class.
 *
 * DEPENDENCIES
 *   - localization/LocalizationKeys.js
 *   - utils/Logger.js
 */

export class MessageService {
  /**
   * @param {import("@minecraft/server").Player} player
   * @param {string} localizationKey One of localization/LocalizationKeys.js's values.
   * @param {(string|number)[]} [substitutions] Values for any %1$s-style placeholders in the translated string.
   * @returns {void}
   */
  sendChat(player, localizationKey, substitutions) {
    if (!player || !player.isValid) {
      // Player is gone — nothing to deliver, and nothing to treat as an error.
      return;
    }
    try {
      player.sendMessage({
        translate: localizationKey,
        with: (substitutions ?? []).map(String),
      });
    } catch (error) {
      // player.sendMessage is not restricted-execution-mode limited, so a
      // failure here is unexpected (e.g. a malformed key) rather than a
      // normal race — worth a warning, never worth throwing.
      Logger.warn(`Failed to send "${localizationKey}" to a player`, error);
    }
  }

  /**
   * @param {import("@minecraft/server").Player} player
   * @param {string} localizationKey
   * @param {(string|number)[]} [substitutions]
   * @returns {void}
   */
  sendActionBar(player, localizationKey, substitutions) {
    if (!player || !player.isValid) {
      return;
    }
    try {
      player.onScreenDisplay.setActionBar({
        translate: localizationKey,
        with: (substitutions ?? []).map(String),
      });
    } catch (error) {
      Logger.warn(`Failed to send actionbar "${localizationKey}" to a player`, error);
    }
  }
}
