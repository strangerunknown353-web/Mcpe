/**
 * RailConfig.js
 *
 * PURPOSE
 *   Single source of truth for everything specific to rail *types* — vanilla
 *   item IDs, build-length limits, and the future length-preset system. Data
 *   only, no logic, so the UI, PathValidator, and RailBuilder always agree on
 *   what a "valid length" or "valid rail" means without duplicating the rules.
 *
 * RESPONSIBILITIES
 *   - Enumerate the 4 supported vanilla rail item IDs and their metadata.
 *   - Define the build-length preset system approved in Project Prompt 2
 *     (design only — no UI or validation logic reads this yet).
 *
 * FUTURE EXTENSIONS
 *   - Additional rail types (e.g. from other addons) would be added to
 *     RAIL_TYPES without touching any module that consumes this file.
 *   - Curved/sloped placement metadata (Roadmap Phase 11+) will extend each
 *     rail type's entry rather than requiring a new config file.
 *
 * DEPENDENCIES
 *   None.
 */

/**
 * The 4 vanilla rail items this addon recognizes. Keyed by item type ID so
 * lookups from an ItemStack are a single object access.
 *
 * @typedef {Object} RailTypeDefinition
 * @property {string} itemId       Vanilla item type ID.
 * @property {string} blockId      Vanilla block type ID placed for this rail type.
 * @property {boolean} poweredType Whether this rail type has powered/unpowered states.
 * @property {string} displayName  Plain-English name for the build-summary screen (Project
 *   Prompt 15). Deliberately a plain string, not a translate key — see
 *   config/BuildModes.js's "NOTE ON displayName" for why this mirrors
 *   utils/DirectionUtils.js's existing DISPLAY_NAMES pattern rather than
 *   introducing a new one.
 */
export const RAIL_TYPES = Object.freeze({
  "minecraft:rail": Object.freeze({
    itemId: "minecraft:rail",
    blockId: "minecraft:rail",
    poweredType: false,
    displayName: "Rail",
  }),
  "minecraft:golden_rail": Object.freeze({
    itemId: "minecraft:golden_rail",
    blockId: "minecraft:golden_rail",
    poweredType: true,
    displayName: "Powered Rail",
  }),
  "minecraft:detector_rail": Object.freeze({
    itemId: "minecraft:detector_rail",
    blockId: "minecraft:detector_rail",
    poweredType: false,
    displayName: "Detector Rail",
  }),
  "minecraft:activator_rail": Object.freeze({
    itemId: "minecraft:activator_rail",
    blockId: "minecraft:activator_rail",
    poweredType: true,
    displayName: "Activator Rail",
  }),
});

/** Convenience list, derived once, for the item-use event filter (Roadmap Phase 3). */
export const RAIL_ITEM_IDS = Object.freeze(Object.keys(RAIL_TYPES));

/**
 * Fast-lookup form of RAIL_ITEM_IDS. Added in the bugfix pass before
 * Project Prompt 18 — see EXISTING-RAIL DETECTION below for what this is
 * for.
 *
 * EXISTING-RAIL DETECTION (rail crossing/connection bugfix)
 *   Root cause of the reported crossing bug: `RailPermutationBuilder.js`'s
 *   `buildStraightRailPermutation()` always computes a forced, explicit
 *   `rail_direction` from the BUILD's own travel direction alone — by
 *   design (see that file's "WHY EXPLICIT, NOT AUTO-CONNECTED" — vanilla's
 *   neighbor-sensing auto-connect isn't confirmed to run for a raw
 *   `setPermutation()` call, so this addon computes shapes itself instead
 *   of relying on it). That design is correct for an EMPTY position, but
 *   was never checking whether a position already held rail from an
 *   earlier build (this addon's own, or hand-placed) before overwriting it
 *   — silently destroying the existing rail's shape and replacing it with
 *   the new build's forced straight direction, which is exactly what
 *   produced the broken intersection reported (and visible in the
 *   uploaded screenshot).
 *
 *   The fix, used by every placement strategy
 *   (StraightRailStrategy/BridgeExecutionStrategy/UndergroundExecutionStrategy)
 *   and by the scanning/planning methods that decide whether a path is
 *   buildable at all (TerrainScanner's `_scanPosition()`/`planBridge()`/
 *   `planUnderground()`): a position that already holds ANY of the 4 rail
 *   types (regardless of which one, and regardless of the new build's own
 *   chosen rail type) is treated as already-clear for pathing purposes —
 *   like a position TerrainScanner would classify FLAT_SAFE — and is
 *   simply left untouched at placement time rather than overwritten. See
 *   ARCHITECTURE.md §46.5 for the full write-up.
 * @type {ReadonlySet<string>}
 */
export const RAIL_ITEM_ID_SET = new Set(RAIL_ITEM_IDS);

/**
 * Build-length preset system, finalized in Project Prompt 2, now consumed by
 * BuildMenu.js and core/validation/LengthValidator.js (Project Prompt 4-5).
 *
 * NOTE ON RANGE — MIN/MAX_SURVIVAL changed from 32/512 to 1/64 (Project Prompt 12
 * pre-work, your instruction) so building starts at 1 block and tops out at 64.
 * STEP changed from 32 to 1 to match — a slider step of 32 across a 1-64 range
 * wouldn't divide evenly and could produce an invalid ModalFormData slider.
 * This also resolves the "area not loaded" reports for 65+ block builds: those
 * lengths simply can't be requested anymore. See CHANGELOG.md for why very long
 * builds could outrun the world's *simulation* distance even at a generous
 * client render distance — a separate setting from what "render distance"
 * controls, and one this addon can't detect or change from script.
 */
export const LENGTH_PRESETS = Object.freeze({
  /** Reserved for a future dropdown-of-presets UI — not read by any code today (see BuildMenu.js). */
  OPTIONS: Object.freeze([1, 16, 32, 48, 64]),
  /** Smallest selectable length — also the BuildMenu slider's minimum. */
  MIN: 1,
  /** Default slider value — unchanged by the Project Prompt 12 range update, still within 1-64. */
  DEFAULT: 32,
  /** BuildMenu slider step size; keeps every reachable value one of OPTIONS' multiples. */
  STEP: 1,
  /** Highest length a Survival player may build in one activation. */
  MAX_SURVIVAL: 64,
  /**
   * Creative Mode may exceed the finite preset list entirely — NOT YET
   * IMPLEMENTED. BuildMenu and core/validation/LengthValidator.js both apply
   * MAX_SURVIVAL to Creative too; see TODO.md for the deferred "Unlimited" UI.
   */
  UNLIMITED_ALLOWED_GAME_MODE: "Creative",
});
