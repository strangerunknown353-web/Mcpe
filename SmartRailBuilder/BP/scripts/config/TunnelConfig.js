/**
 * TunnelConfig.js
 *
 * PURPOSE
 *   Single source of truth for tunnel dimensions and search limits. Data
 *   only, matching RailConfig.js's/LENGTH_PRESETS' existing pattern —
 *   TunnelDetector and TunnelExcavator both read these constants rather
 *   than hardcoding numbers, so they always agree.
 *
 * RESPONSIBILITIES
 *   - Define tunnel cross-section (width/height) per Project Prompt 12's
 *     explicit spec.
 *   - Define how far TunnelDetector is willing to search before giving up
 *     — a limit the prompt didn't specify a number for; see NOTE ON
 *     MAX_SEARCH_LENGTH below for the reasoning behind the chosen default.
 *
 * NOTE ON MAX_SEARCH_LENGTH
 *   Originally set to 32 (Project Prompt 12) as a guess with no real-world
 *   data behind it. Raised to 64 in a later session after in-game testing
 *   showed real mountains needing 20+ tunneled blocks. That raise alone
 *   did NOT fully fix the underlying problem — confirmed by further
 *   in-game testing (Project Prompt 14, second round): a tunnel's actual
 *   search room was still `min(MAX_SEARCH_LENGTH, remainingBudget)`, where
 *   `remainingBudget` was `requestedLength - i` — meaning a tunnel
 *   encountered partway through even a full 64-length build, or in any
 *   shorter build, could still be starved of room by how much flat/sloped
 *   terrain came before it in the SAME request, regardless of this
 *   constant. Confirmed with you directly: a tunnel should get its own
 *   fresh, fixed budget (this constant) — not one shrunk by unrelated
 *   earlier terrain — and the overall build may extend past what was
 *   originally requested (up to the hard `RailConfig.LENGTH_PRESETS.MAX_SURVIVAL`
 *   ceiling) if a tunnel genuinely needs the room. See
 *   terrain/TerrainScanner.js's `scanPath()` for where this is now
 *   enforced, and ARCHITECTURE.md §40 for the full design and the
 *   downstream InventoryStage fix this required.
 *
 * DEPENDENCIES
 *   None.
 */

export const TUNNEL_CONFIG = Object.freeze({
  /** Horizontal width of an excavated tunnel — always 1 (this addon's rails never curve or widen). */
  WIDTH: 1,
  /**
   * Total vertical clearance at rail level: the rail's own position plus
   * one block of headroom above it — exactly a player's 2-block hitbox,
   * per Project Prompt 12's stated rationale ("ensures the player will not
   * suffocate"). See ARCHITECTURE.md §37.2 for the interpretation this
   * resolved (this addon reads "2 blocks above the rail level" as 2 blocks
   * total including the rail level, not 2 blocks in addition to it).
   */
  HEIGHT: 2,
  /** @see NOTE ON MAX_SEARCH_LENGTH above. */
  MAX_SEARCH_LENGTH: 64,
});
