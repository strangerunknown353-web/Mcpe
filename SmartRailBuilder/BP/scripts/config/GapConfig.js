/**
 * GapConfig.js
 *
 * PURPOSE
 *   Single source of truth for GapAnalyzer's and BridgeDetector's search
 *   limits. Data only, matching TunnelConfig.js's/RailConfig.js's existing
 *   pattern. Added Roadmap Phase 13 (Project Prompt 13).
 *
 * NOTE ON THE CHOSEN DEFAULTS
 *   Project Prompt 13 didn't give explicit numbers for either value —
 *   same situation TunnelConfig.js's MAX_SEARCH_LENGTH was in last
 *   session, resolved the same way (a reasonable default, flagged for
 *   your adjustment):
 *   - MAX_DEPTH_SEARCH (12): how far down GapAnalyzer looks for solid
 *     ground before concluding "open air/void." world height segments
 *     rarely have meaningful terrain features taller than this close
 *     together; deeper than this and a bridge probably isn't a sensible
 *     answer anyway even once bridges are actually built.
 *   - RAVINE_DEPTH_THRESHOLD (5): depth up to which a drop is a "small
 *     valley" rather than a "ravine" — chosen so an ordinary shallow dip
 *     doesn't get the more dramatic label, while an actual ravine
 *     (canonically much deeper) does.
 *   - MAX_BRIDGE_SPAN (16): how far BridgeDetector will consider a gap
 *     "structurally plausible" to eventually bridge, once bridges are
 *     actually built (Roadmap Phase 13+, not this session) — a quarter of
 *     `RailConfig.LENGTH_PRESETS.MAX_SURVIVAL`, matching the reasoning
 *     already used for `TunnelConfig.MAX_SEARCH_LENGTH`.
 *
 * DEPENDENCIES
 *   None.
 */

export const GAP_CONFIG = Object.freeze({
  /** @see NOTE ON THE CHOSEN DEFAULTS above. */
  MAX_DEPTH_SEARCH: 12,
  /** @see NOTE ON THE CHOSEN DEFAULTS above. */
  RAVINE_DEPTH_THRESHOLD: 5,
  /** @see NOTE ON THE CHOSEN DEFAULTS above. Not used for any accept/reject decision this session — bridges aren't built yet. */
  MAX_BRIDGE_SPAN: 16,
});
