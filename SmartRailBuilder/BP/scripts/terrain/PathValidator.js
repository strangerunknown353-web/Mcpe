import { TerrainClassification } from "./TerrainClassification.js";
import { PathCategory } from "./PathCategory.js";
import { LocalizationKeys } from "../localization/LocalizationKeys.js";

/**
 * PathValidator.js
 *
 * PURPOSE
 *   The only module allowed to turn a TerrainReport (see ./TerrainScanner.js)
 *   into an accept/reject decision. Real since Project Prompt 11 (Roadmap
 *   Phase 5 Part 2). Extended the same session (Roadmap Phase 11) to accept
 *   ASCENDING/DESCENDING alongside FLAT_SAFE as buildable. Extended again
 *   this session (Roadmap Phase 12) to accept TUNNEL, and to give a more
 *   specific message when an UNSUPPORTED verdict came from a failed tunnel
 *   attempt rather than a plain "too steep."
 *
 * ROADMAP PHASE 11 CHANGE: GAP/OBSTRUCTED → UNSUPPORTED
 *   TerrainScanner no longer produces GAP or OBSTRUCTED at all (see that
 *   file's §36.1) — any elevation change TerrainScanner couldn't resolve
 *   into a ±1 slope is now UNSUPPORTED, with one unified message ("Terrain
 *   too steep...") rather than the previous two separate ones ("not flat"
 *   vs "bridge required"). PathRejectionReason.NOT_FLAT and
 *   GAP_BRIDGE_REQUIRED are retired along with their lang lines — keeping
 *   them would mean a reachable code path with player-facing text that
 *   became false the moment slopes shipped ("Slopes aren't supported yet").
 *
 * PROJECT PROMPT 19: UNBREAKABLE-AT-RAIL-SPOT AND LOW-CLEARANCE MESSAGES
 *   Two more specific reasons, both set directly by `TerrainScanner._scanPosition()`'s
 *   new checks (an unbreakable block at the rail's own spot; insufficient headroom one
 *   block above it — see that file's SMART TERRAIN ANALYSIS section) and resolved
 *   through the SAME `unsupportedReason` table below every other specific UNSUPPORTED
 *   reason already uses — no new special-case code needed in `validate()` itself.
 *
 * PROJECT PROMPT 18: WATER-SPECIFIC REJECTION MESSAGE
 *   Water is no longer folded into the generic "too steep"/HAZARD messages
 *   for every case. A rail-level water column too deep to safely ride
 *   through (`unsupportedReason: "WATER_TOO_DEEP"`, set by
 *   `TerrainScanner._scanPosition()`) and a drop into a body of water
 *   (`pathCategory: WATER_CROSSING`, from the existing GapAnalyzer/
 *   PathCategory machinery, unchanged) both now resolve to the same new
 *   `WATER_CROSSING_UNSAFE` reason and a message that specifically tells
 *   the player to use Bridge or Underground Mode instead — see
 *   ARCHITECTURE.md's Project Prompt 18 entry.
 *
 * ROADMAP PHASE 12 CHANGE: SPECIFIC MESSAGES FOR FAILED TUNNEL ATTEMPTS
 *   UNSUPPORTED alone no longer tells the whole story once tunnels can
 *   fail for a specific, more informative reason (hit bedrock, would be
 *   too long) — see `TerrainPositionFact.unsupportedReason` (added this
 *   session, terrain/TerrainScanner.js). This class now checks that field
 *   when the classification is UNSUPPORTED, via UNSUPPORTED_REASON_TO_LOCALIZATION_KEY,
 *   falling back to the same generic "too steep" message Phase 11 always
 *   used for every other UNSUPPORTED case (a bigger drop, a peak/valley
 *   reversal, or a tunnel failing for an unremarkable reason like an
 *   internal floor gap — see TerrainScanner.js's "FLOOR_GAP" handling).
 *
 * RESPONSIBILITIES
 *   - Walk a TerrainReport, in path order, and return the FIRST rule
 *     violation found — never aggregate or report more than one problem at
 *     once (matches the same stop-at-first-failure convention already used
 *     by ValidationManager, see core/validation/ValidationManager.js).
 *   - Treat FLAT_SAFE, ASCENDING, DESCENDING, and TUNNEL as equally
 *     buildable — PathValidator does not care HOW a position was resolved,
 *     only that TerrainScanner considers it safe.
 *   - Attach a specific, machine-readable `reason` (PathRejectionReason) AND
 *     the matching player-facing `localizationKey`, mirroring the exact
 *     `ValidationResult` shape every other validator in this project already
 *     returns (see e.g. core/validation/DirectionValidator.js) — this keeps
 *     TerrainScanningStage's adapter code identical in shape to
 *     ValidationStage's, rather than inventing a second convention.
 *   - Classify every non-buildable TerrainClassification into exactly one
 *     PathRejectionReason via one private lookup table (CLASSIFICATION_TO_REASON,
 *     below) — HAZARD and LIQUID both map to the generic HAZARD rejection
 *     (v1 does not distinguish "why" a block is dangerous to the player,
 *     only that it is).
 *
 * WHY THIS DOES NOT RE-INSPECT BLOCKS ITSELF
 *   Every fact this class needs (classification, position, unsupportedReason)
 *   was already computed by TerrainScanner (and, for tunnels, TunnelDetector).
 *   Recomputing any of it here would duplicate that work and could drift out
 *   of sync with it. This class only reads `fact.classification`,
 *   `fact.position`, and `fact.unsupportedReason`; nothing else.
 *
 * FUTURE EXTENSIONS
 *   - Roadmap Phase 13+ (bridges): a DROP of more than 1 block would stop
 *     being an automatic UNSUPPORTED rejection the same way a too-tall RISE
 *     stopped being one this session — this file's two lookup tables would
 *     gain a BRIDGE-shaped entry the same way they gained TUNNEL-shaped
 *     ones, without changing how FLAT_SAFE/ASCENDING/DESCENDING/TUNNEL are
 *     handled.
 *
 * DEPENDENCIES
 *   - terrain/TerrainClassification.js
 *   - terrain/PathCategory.js (Project Prompt 18, for the WATER_CROSSING check)
 *   - localization/LocalizationKeys.js
 */

/** @enum {string} */
export const PathRejectionReason = Object.freeze({
  TOO_STEEP: "TOO_STEEP",
  UNBREAKABLE_BLOCK: "UNBREAKABLE_BLOCK",
  TUNNEL_TOO_LONG: "TUNNEL_TOO_LONG",
  HAZARD: "HAZARD",
  UNLOADED_CHUNK: "UNLOADED_CHUNK",
  OUT_OF_BOUNDS: "OUT_OF_BOUNDS",
  /** Added Project Prompt 18: water too deep/wide for Normal Mode to safely carry a player through — see WATER_CROSSING handling in `validate()` below. */
  WATER_CROSSING_UNSAFE: "WATER_CROSSING_UNSAFE",
  /** Added Project Prompt 19: not enough clearance one block above an otherwise-buildable rail spot — see terrain/TerrainScanner.js's `_checkHeadroom()`. */
  LOW_CLEARANCE: "LOW_CLEARANCE",
});

/** Classifications PathValidator treats as buildable — never rejected, never looked up in CLASSIFICATION_TO_REASON. */
const BUILDABLE_CLASSIFICATIONS = Object.freeze([
  TerrainClassification.FLAT_SAFE,
  TerrainClassification.ASCENDING,
  TerrainClassification.DESCENDING,
  TerrainClassification.TUNNEL,
]);

/**
 * Rule set: which PathRejectionReason each non-buildable TerrainClassification
 * maps to, BEFORE `unsupportedReason` refinement (see UNSUPPORTED_REASON_TO_REASON
 * below) is applied for UNSUPPORTED specifically. FLAT_SAFE/ASCENDING/DESCENDING/TUNNEL
 * are deliberately absent — see BUILDABLE_CLASSIFICATIONS above, checked before
 * this table is ever consulted.
 * @type {Readonly<Record<string, PathRejectionReason>>}
 */
const CLASSIFICATION_TO_REASON = Object.freeze({
  [TerrainClassification.HAZARD]: PathRejectionReason.HAZARD,
  [TerrainClassification.LIQUID]: PathRejectionReason.HAZARD,
  [TerrainClassification.UNSUPPORTED]: PathRejectionReason.TOO_STEEP,
  [TerrainClassification.UNLOADED]: PathRejectionReason.UNLOADED_CHUNK,
  [TerrainClassification.OUT_OF_BOUNDS]: PathRejectionReason.OUT_OF_BOUNDS,
});

/**
 * Added Roadmap Phase 12: refines an UNSUPPORTED classification's generic
 * TOO_STEEP reason into something more specific, when `fact.unsupportedReason`
 * (set by TerrainScanner when a tunnel attempt failed for an identifiable
 * cause) matches one of these. Deliberately does NOT cover every
 * TunnelDetector failure reason — "FLOOR_GAP" has no entry here and
 * intentionally falls through to the generic TOO_STEEP message; an internal
 * air pocket inside a hill isn't meaningfully different to a player from
 * "too steep" the way "hit bedrock" or "too long" are.
 * @type {Readonly<Record<string, PathRejectionReason>>}
 */
const UNSUPPORTED_REASON_TO_REASON = Object.freeze({
  UNBREAKABLE: PathRejectionReason.UNBREAKABLE_BLOCK,
  TOO_LONG: PathRejectionReason.TUNNEL_TOO_LONG,
  HAZARD: PathRejectionReason.HAZARD,
  UNLOADED: PathRejectionReason.UNLOADED_CHUNK,
  OUT_OF_BOUNDS: PathRejectionReason.OUT_OF_BOUNDS,
  /** Added Project Prompt 18 — see terrain/TerrainScanner.js's `_scanPosition()` "WATER DETECTION" section. */
  WATER_TOO_DEEP: PathRejectionReason.WATER_CROSSING_UNSAFE,
  /** Added Project Prompt 19 — see terrain/TerrainScanner.js's `_checkHeadroom()`. */
  LOW_CLEARANCE: PathRejectionReason.LOW_CLEARANCE,
});

/**
 * Which player-facing message accompanies each PathRejectionReason. Kept as
 * one table right next to the two lookup tables above so a new reason and
 * its message are always added together — never a machine-readable reason
 * with no matching player-facing text, or vice versa.
 * @type {Readonly<Record<string, string>>}
 */
const REASON_TO_LOCALIZATION_KEY = Object.freeze({
  [PathRejectionReason.TOO_STEEP]: LocalizationKeys.PATH_REJECTED_TOO_STEEP,
  [PathRejectionReason.UNBREAKABLE_BLOCK]: LocalizationKeys.PATH_REJECTED_UNBREAKABLE,
  [PathRejectionReason.TUNNEL_TOO_LONG]: LocalizationKeys.PATH_REJECTED_TUNNEL_TOO_LONG,
  [PathRejectionReason.HAZARD]: LocalizationKeys.PATH_REJECTED_HAZARD,
  [PathRejectionReason.UNLOADED_CHUNK]: LocalizationKeys.PATH_REJECTED_UNLOADED,
  [PathRejectionReason.OUT_OF_BOUNDS]: LocalizationKeys.PATH_REJECTED_OUT_OF_BOUNDS,
  [PathRejectionReason.WATER_CROSSING_UNSAFE]: LocalizationKeys.PATH_REJECTED_WATER_CROSSING,
  [PathRejectionReason.LOW_CLEARANCE]: LocalizationKeys.PATH_REJECTED_LOW_CLEARANCE,
});

/**
 * @typedef {Object} PathValidationResult
 * @property {boolean} valid
 * @property {PathRejectionReason} [reason] Machine-readable reason, for logging.
 * @property {string} [localizationKey] Present only when valid is false.
 * @property {{x: number, y: number, z: number}} [position] Where the violation was found.
 */

export class PathValidator {
  /**
   * @param {import("./TerrainScanner.js").TerrainScanResult} report
   * @returns {PathValidationResult}
   */
  validate(report) {
    for (const fact of report.positions) {
      if (BUILDABLE_CLASSIFICATIONS.includes(fact.classification)) {
        continue;
      }

      let reason;
      if (fact.classification === TerrainClassification.UNSUPPORTED && fact.pathCategory === PathCategory.WATER_CROSSING) {
        // Added Project Prompt 18: a drop of more than 1 block into a body
        // of water (GapAnalyzer's WATER_CROSSING gap type, Project Prompt
        // 13 — unchanged) is tagged "DEEP_DROP" the same as an ordinary
        // cliff, so `unsupportedReason` alone can't distinguish "fell off a
        // cliff" from "fell into a lake" — `pathCategory` is what actually
        // does, and is checked first, before the generic unsupportedReason
        // lookup below.
        reason = PathRejectionReason.WATER_CROSSING_UNSAFE;
      } else if (fact.classification === TerrainClassification.UNSUPPORTED && fact.unsupportedReason) {
        reason = UNSUPPORTED_REASON_TO_REASON[fact.unsupportedReason] ?? PathRejectionReason.TOO_STEEP;
      } else {
        // Defensive fallback: if TerrainScanner is ever extended with a new
        // classification before this table is updated to match, fail safe
        // (reject as TOO_STEEP) rather than silently letting an
        // unrecognized classification through as if it were fine.
        reason = CLASSIFICATION_TO_REASON[fact.classification] ?? PathRejectionReason.TOO_STEEP;
      }

      return {
        valid: false,
        reason,
        localizationKey: REASON_TO_LOCALIZATION_KEY[reason],
        position: fact.position,
      };
    }

    return { valid: true };
  }
}
