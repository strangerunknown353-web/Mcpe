import { LocalizationKeys } from "../localization/LocalizationKeys.js";

/**
 * BuildModes.js
 *
 * PURPOSE
 *   Single source of truth for the three permanent building modes (Project
 *   Prompt 15): NORMAL, BRIDGE, UNDERGROUND. Everything that needs to know
 *   about modes — BuildMenu's mode-selection screen, ModeConfigValidator,
 *   ModeAvailabilityStage, and the summary screen — reads this registry
 *   instead of hardcoding a switch/if-chain over mode names. Adding a
 *   fourth mode (Blueprint, Curve, etc. — see ROADMAP.md's Phase 15+
 *   backlog) is one new registry entry here; none of the four consuming
 *   modules need to change. This is the literal mechanism behind Project
 *   Prompt 15's "adding a new mode should not require rewriting the UI or
 *   Build Pipeline" requirement.
 *
 * RESPONSIBILITIES
 *   - Enumerate the mode IDs (`BuildingMode`).
 *   - For each mode: its button/label translate key, a plain-English
 *     `displayName` (see NOTE ON displayName below), whether it needs a
 *     numeric config value (height/depth), that value's bounds/default/
 *     translate keys, and whether the mode's actual construction engine is
 *     wired up yet (`implemented`).
 *
 * NOTE ON `displayName` (plain string, not a translate key)
 *   Every OTHER piece of mode text (button labels, the mode-select body) is
 *   a real translate key, per Project Prompt 15's localization requirement.
 *   `displayName` is deliberately different: it exists only to be *inserted
 *   into* an already-translated summary line (e.g. "Mode: %1$s") as a
 *   `with`-substitution value — the exact same pattern this project already
 *   uses for direction names (see utils/DirectionUtils.js's own
 *   `DISPLAY_NAMES`/`toDisplayName()`, which is plain English for the same
 *   reason: RawMessage substitution values are inserted verbatim, not
 *   re-translated). Since this project supports only en_US today (see
 *   RP/texts/languages.json), this is a faithful continuation of an
 *   existing, deliberate pattern — not a new localization gap. If a second
 *   language is ever added, this becomes a small lookup table exactly like
 *   DirectionUtils' would.
 *
 * NOTE ON `implemented: false` FOR BRIDGE/UNDERGROUND (Project Prompt 15)
 *   This session builds the mode model, UI, and validation — not the
 *   construction engines. `implemented` is the single flag
 *   ModeAvailabilityStage reads to stop a fully-valid Bridge/Underground
 *   request cleanly, with an honest player-facing message, before it
 *   reaches TerrainScanner (which only knows NORMAL-mode terrain rules
 *   today). Flip to `true` the session each mode's real engine ships
 *   (Bridge: Prompt 16 per the handoff doc; Underground: Prompt 17).
 *
 * DEPENDENCIES
 *   - localization/LocalizationKeys.js
 */

/** @enum {string} */
export const BuildingMode = Object.freeze({
  NORMAL: "NORMAL",
  BRIDGE: "BRIDGE",
  UNDERGROUND: "UNDERGROUND",
});

/**
 * @typedef {Object} BuildModeDefinition
 * @property {string} id One of BuildingMode's values.
 * @property {string} buttonLabelKey Translate key for the mode-select button and summary "Mode" row label context.
 * @property {string} displayName Plain-English name — see NOTE ON displayName above. Used only as a `with` substitution value.
 * @property {boolean} requiresConfig Whether this mode needs a numeric height/depth value before Length.
 * @property {string|null} configField The BuildRequest field this mode's value is stored in (e.g. "bridgeHeight"), or null.
 * @property {string|null} configLabelKey Translate key for that value's slider label, or null.
 * @property {string|null} invalidConfigKey Translate key for that value's out-of-range rejection message, or null.
 * @property {number|null} min Inclusive minimum for the config value, or null.
 * @property {number|null} max Inclusive maximum for the config value, or null.
 * @property {number|null} default Default slider value, or null.
 * @property {boolean} implemented Whether this mode's construction engine is wired into the pipeline yet.
 */

/** @type {Readonly<Record<string, BuildModeDefinition>>} */
export const BUILD_MODE_REGISTRY = Object.freeze({
  [BuildingMode.NORMAL]: Object.freeze({
    id: BuildingMode.NORMAL,
    buttonLabelKey: LocalizationKeys.MODE_NORMAL_LABEL,
    displayName: "Normal",
    requiresConfig: false,
    configField: null,
    configLabelKey: null,
    invalidConfigKey: null,
    min: null,
    max: null,
    default: null,
    implemented: true,
  }),
  [BuildingMode.BRIDGE]: Object.freeze({
    id: BuildingMode.BRIDGE,
    buttonLabelKey: LocalizationKeys.MODE_BRIDGE_LABEL,
    displayName: "Bridge",
    requiresConfig: true,
    configField: "bridgeHeight",
    configLabelKey: LocalizationKeys.MENU_BRIDGE_HEIGHT_LABEL,
    invalidConfigKey: LocalizationKeys.MENU_INVALID_HEIGHT,
    min: 1,
    max: 16,
    default: 3,
    // Flipped Roadmap Phase 16 (Project Prompt 16) — the real construction
    // engine (terrain/TerrainScanner.js's planBridge(), builder/strategies/
    // BridgeExecutionStrategy.js) now exists. This one flag is what
    // re-enables Bridge Mode past core/pipeline/stages/ModeAvailabilityStage.js
    // — see that file's header, unchanged since Project Prompt 15.
    implemented: true,
  }),
  [BuildingMode.UNDERGROUND]: Object.freeze({
    id: BuildingMode.UNDERGROUND,
    buttonLabelKey: LocalizationKeys.MODE_UNDERGROUND_LABEL,
    displayName: "Underground",
    requiresConfig: true,
    configField: "undergroundDepth",
    configLabelKey: LocalizationKeys.MENU_UNDERGROUND_DEPTH_LABEL,
    invalidConfigKey: LocalizationKeys.MENU_INVALID_DEPTH,
    min: 1,
    max: 20,
    default: 5,
    // Flipped Roadmap Phase 17 (Project Prompt 17) — the real excavation
    // engine (terrain/TerrainScanner.js's planUnderground(), builder/
    // strategies/UndergroundExecutionStrategy.js) now exists. As with
    // BRIDGE in Project Prompt 16, this one flag is what re-enables the
    // mode past core/pipeline/stages/ModeAvailabilityStage.js — that stage
    // itself remains unchanged since Project Prompt 15.
    implemented: true,
  }),
});

/** Stable button order for BuildMenu's mode-selection screen (insertion order of the registry above). */
export const BUILD_MODE_ORDER = Object.freeze(Object.values(BUILD_MODE_REGISTRY).map((mode) => mode.id));

/** BuildMenu's default pre-selected mode is always NORMAL — the zero-config, always-available path. */
export const DEFAULT_BUILDING_MODE = BuildingMode.NORMAL;
