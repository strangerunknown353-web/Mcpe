/**
 * Constants.js
 *
 * PURPOSE
 *   Single source of truth for global, non-domain-specific tunables used across
 *   the addon. Nothing in this file should contain logic — it is data only.
 *
 * RESPONSIBILITIES
 *   - Hold the addon-wide identity (namespace, version) used for logging and
 *     dynamic property keys elsewhere in the project.
 *   - Hold cross-cutting tunables that are not specific to rails (logging,
 *     progress feedback, build limits) so every future module reads from one
 *     place instead of hardcoding numbers.
 *
 * FUTURE EXTENSIONS
 *   - Multiplayer-specific tunables (per-player build cooldown, dedicated
 *     server toggles) will be added here once Roadmap Phase 10/11+ begins.
 *   - Feature toggles for slopes/tunnels/bridges/underwater will be added as
 *     flat booleans here once those milestones start, so they can be flipped
 *     off without touching the modules that implement them.
 *
 * DEPENDENCIES
 *   None. This file must never import from other project modules — everything
 *   else imports from it, not the other way around.
 */

/** Addon-wide identity, used by Logger and any future dynamic property keys. */
export const ADDON = Object.freeze({
  // NAMESPACE stays "ryzenRailBuilder" — Project Prompt 10 renamed the product to
  // "Smart Rail Builder," but this string is an internal, player-invisible prefix used
  // in every localization key ("ryzenRailBuilder.menu.title", etc.) and log line.
  // Renaming it would mean touching every key across LocalizationKeys.js and
  // en_US.lang for zero player-facing benefit — deliberately left as-is; see
  // CHANGELOG.md's Project Prompt 10 entry for the full rename scope decision.
  NAMESPACE: "ryzenRailBuilder",
  DISPLAY_NAME: "Smart Rail Builder",
  // FIXED Project Prompt 15: this had drifted to "0.1.0" while BP/manifest.json's
  // header/module version had already advanced to 0.1.6 — meaning every startup
  // log line since at least Project Prompt 6 has misreported the running version
  // by several releases. Found while bumping the manifest for this session (also
  // discovered RP/manifest.json's own version was independently stuck at 0.1.0 —
  // fixed alongside this one). All three numbers — this constant, BP/manifest.json,
  // and RP/manifest.json — should be bumped together going forward. See
  // CHANGELOG.md's Project Prompt 15 entry and TODO.md for the full write-up of
  // this finding. Bumped to 0.1.13 this session (Project Prompt 20 — Full
  // Integration, Stability & Real-World Test Build); all three numbers
  // confirmed in sync.
  VERSION: "0.1.15",
});

/**
 * Logging configuration. See utils/Logger.js.
 * Set ENABLED to false to silence all logging output with zero behavior change
 * elsewhere — no module should ever call console directly, only Logger.
 */
export const LOGGING = Object.freeze({
  ENABLED: true,
  /** One of LogLevel values in utils/Logger.js. Messages below this level are dropped. */
  MIN_LEVEL: "DEBUG",
});

/**
 * Progress feedback configuration. Consumed by ui/ProgressReporter.js once the
 * build pipeline exists (Roadmap Phase 9).
 */
export const PROGRESS = Object.freeze({
  /** Only show progress feedback for builds at least this long. */
  MIN_LENGTH_FOR_PROGRESS_UPDATES: 16,
  /** Send an actionbar update every N blocks placed, not every block. */
  UPDATE_INTERVAL_BLOCKS: 8,
});

/**
 * Reserved for future multiplayer-scope tunables (Roadmap Phase 10/11+).
 * Present now, empty by design, so BuildSession/CancellationWatcher can be
 * written today against a stable import even though nothing reads from this
 * yet.
 */
export const MULTIPLAYER = Object.freeze({
  // Intentionally empty during Roadmap Phase 2 (Project Skeleton).
  // Confirmed scope per Project Prompt 2: Singleplayer + LAN for v1.
});
