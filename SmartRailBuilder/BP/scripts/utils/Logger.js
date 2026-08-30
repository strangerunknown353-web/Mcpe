import { ADDON, LOGGING } from "../config/Constants.js";

/**
 * Logger.js
 *
 * PURPOSE
 *   The only place in the addon allowed to call `console.*`. Every other
 *   module logs through this file so logging can be silenced globally with
 *   one config flag (Constants.LOGGING.ENABLED) and so log output has a
 *   consistent, greppable format.
 *
 * RESPONSIBILITIES
 *   - Provide leveled logging: DEBUG, INFO, WARN, ERROR.
 *   - Respect Constants.LOGGING.ENABLED and Constants.LOGGING.MIN_LEVEL.
 *   - Prefix every line with the addon namespace and level for easy filtering
 *     in the Content Log.
 *
 * FUTURE EXTENSIONS
 *   - Structured event logging (SCANNER_STARTED, PATH_REJECTED, etc., per
 *     ARCHITECTURE.md §10) will call `Logger.debug()`/`Logger.info()` with a
 *     consistent event-name-first message shape once those modules exist —
 *     no changes to this file are needed for that.
 *
 * DEPENDENCIES
 *   - config/Constants.js (ADDON, LOGGING)
 */

/** @enum {number} */
const LogLevel = Object.freeze({
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
});

const MIN_LEVEL_VALUE = LogLevel[LOGGING.MIN_LEVEL] ?? LogLevel.DEBUG;

/**
 * @param {keyof typeof LogLevel} level
 * @param {string} message
 * @param {unknown} [data] Optional structured payload, logged after the message.
 */
function write(level, message, data) {
  if (!LOGGING.ENABLED) return;
  if (LogLevel[level] < MIN_LEVEL_VALUE) return;

  const prefix = `[${ADDON.NAMESPACE}] [${level}]`;
  const line = `${prefix} ${message}`;

  switch (level) {
    case "ERROR":
      data === undefined ? console.error(line) : console.error(line, data);
      break;
    case "WARN":
      data === undefined ? console.warn(line) : console.warn(line, data);
      break;
    default:
      data === undefined ? console.log(line) : console.log(line, data);
      break;
  }
}

export const Logger = Object.freeze({
  /**
   * @param {string} message
   * @param {unknown} [data]
   */
  debug(message, data) {
    write("DEBUG", message, data);
  },
  /**
   * @param {string} message
   * @param {unknown} [data]
   */
  info(message, data) {
    write("INFO", message, data);
  },
  /**
   * @param {string} message
   * @param {unknown} [data]
   */
  warn(message, data) {
    write("WARN", message, data);
  },
  /**
   * @param {string} message
   * @param {unknown} [data]
   */
  error(message, data) {
    write("ERROR", message, data);
  },
});
