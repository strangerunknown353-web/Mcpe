/**
 * PipelineResult.js
 *
 * PURPOSE
 *   The single return shape every PipelineStage (see ./PipelineStage.js) and
 *   BuildPipeline itself produces. Replaces the informal `{valid, reason,
 *   localizationKey}` shape used ad hoc in Project Prompt 4 with one
 *   consistent, richer result type that also covers cancellation, unexpected
 *   errors, and "this stage is a future no-op" — not just pass/fail.
 *
 * RESPONSIBILITIES
 *   - Define the five possible pipeline outcomes as a closed enum
 *     (`PipelineResultStatus`).
 *   - Provide one static factory method per outcome so callers never
 *     hand-construct a result with an inconsistent shape.
 *
 * FUTURE EXTENSIONS
 *   - New outcome types (should they ever be needed) are a new enum member
 *     plus a new static factory — existing call sites are unaffected.
 *
 * DEPENDENCIES
 *   None.
 */

/** @enum {string} */
export const PipelineResultStatus = Object.freeze({
  /** The stage succeeded; the pipeline should continue to the next stage. */
  SUCCESS: "SUCCESS",
  /** The player cancelled (e.g. closed the menu) — not an error, no message needed. */
  CANCELLED: "CANCELLED",
  /** A validator rejected the request — stop, show `localizationKey` to the player. */
  VALIDATION_FAILED: "VALIDATION_FAILED",
  /** An unhandled exception was thrown and caught by BuildPipeline. */
  UNEXPECTED_ERROR: "UNEXPECTED_ERROR",
  /**
   * The stage is a real, named part of the pipeline whose logic isn't built
   * yet (TerrainScanningStage, InventoryStage, PlacementStage this phase).
   * Not an error — this is the pipeline correctly stopping exactly where
   * the project currently ends, by design.
   */
  FUTURE_EXPANSION: "FUTURE_EXPANSION",
});

export class PipelineResult {
  /**
   * @param {Object} params
   * @param {keyof typeof PipelineResultStatus} params.status
   * @param {string} [params.stageName]
   * @param {string} [params.reason] Machine-readable reason, for logging.
   * @param {string} [params.localizationKey] Present only for VALIDATION_FAILED.
   * @param {(string|number)[]} [params.substitutions] Message parameters for
   *   `localizationKey`'s %1$s-style placeholders — added Project Prompt 8 so
   *   messages like "You need N more rails" can carry the actual number.
   * @param {unknown} [params.error] Present only for UNEXPECTED_ERROR.
   * @param {unknown} [params.data] Optional payload a stage wants to hand forward.
   */
  constructor({ status, stageName, reason, localizationKey, substitutions, error, data }) {
    this.status = status;
    this.stageName = stageName;
    this.reason = reason;
    this.localizationKey = localizationKey;
    this.substitutions = substitutions;
    this.error = error;
    this.data = data;
  }

  /** @returns {boolean} True only for SUCCESS — the pipeline runner's sole "continue" condition. */
  isSuccess() {
    return this.status === PipelineResultStatus.SUCCESS;
  }

  /** @param {unknown} [data] @returns {PipelineResult} */
  static success(data) {
    return new PipelineResult({ status: PipelineResultStatus.SUCCESS, data });
  }

  /** @param {string} stageName @param {string} [reason] @returns {PipelineResult} */
  static cancelled(stageName, reason) {
    return new PipelineResult({ status: PipelineResultStatus.CANCELLED, stageName, reason });
  }

  /**
   * @param {string} stageName
   * @param {string} reason
   * @param {string} localizationKey
   * @param {(string|number)[]} [substitutions]
   * @returns {PipelineResult}
   */
  static validationFailed(stageName, reason, localizationKey, substitutions) {
    return new PipelineResult({ status: PipelineResultStatus.VALIDATION_FAILED, stageName, reason, localizationKey, substitutions });
  }

  /** @param {string} stageName @param {unknown} error @returns {PipelineResult} */
  static unexpectedError(stageName, error) {
    return new PipelineResult({ status: PipelineResultStatus.UNEXPECTED_ERROR, stageName, error });
  }

  /**
   * @param {string} stageName
   * @param {string} [reason]
   * @param {string} [localizationKey] Added Project Prompt 15 — optional,
   *   additive parameter (existing 2-arg call sites are unaffected). Every
   *   FUTURE_EXPANSION result before this session was an internal stage a
   *   player never explicitly chose to reach, so silence (no message) was
   *   correct. ModeAvailabilityStage (Project Prompt 15) is the first
   *   stage where a player DID just explicitly confirm a build summary —
   *   silence there would look like a broken "Build" button. Passing this
   *   parameter is how a FUTURE_EXPANSION stage opts into telling the
   *   player why, without changing the outcome's fundamental meaning
   *   ("every implemented check passed; this part isn't built yet").
   * @param {(string|number)[]} [substitutions] Message parameters for `localizationKey`.
   * @returns {PipelineResult}
   */
  static futureExpansion(stageName, reason, localizationKey, substitutions) {
    return new PipelineResult({ status: PipelineResultStatus.FUTURE_EXPANSION, stageName, reason, localizationKey, substitutions });
  }
}
