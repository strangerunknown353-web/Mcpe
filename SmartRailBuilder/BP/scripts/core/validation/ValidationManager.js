/**
 * ValidationManager.js
 *
 * PURPOSE
 *   Runs an ordered list of Validator objects (see ./Validator.js) against a
 *   single BuildRequest, stopping at the first failure. Replaces Project
 *   Prompt 4's `BuildRequestValidator` — which had the same stop-at-first-
 *   failure behavior but hardcoded its four checks as private methods — with
 *   a manager that accepts any list of validators via constructor injection.
 *   Adding a validator is now a new file, not an edit to this one.
 *
 *   Deliberately decoupled from the pipeline concepts in ../pipeline/ — this
 *   class only knows about BuildRequest and Validator, so it can be
 *   constructed and tested completely standalone (as it was in Project
 *   Prompt 4's mocked test suite, unchanged in spirit this session). The
 *   thin ../pipeline/stages/ValidationStage.js adapts its output into a
 *   PipelineResult; this class doesn't know the pipeline exists.
 *
 * RESPONSIBILITIES
 *   - Run each validator in order against a BuildRequest.
 *   - Stop and return the first failing ValidationResult; never aggregate or
 *     partially report multiple failures at once.
 *
 * FUTURE EXTENSIONS
 *   - New validators (e.g. a future claims/region PermissionValidator body)
 *     are added to the array this class is constructed with in main.js —
 *     nothing in this file changes.
 *
 * DEPENDENCIES
 *   - ./Validator.js (contract)
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {string} [reason] Machine-readable reason code, for logging.
 * @property {string} [localizationKey] Present when valid is false and a
 *   player-facing message should be sent.
 */

export class ValidationManager {
  /**
   * @param {ReadonlyArray<{name: string, validate: (request: import("../BuildRequest.js").BuildRequest) => ValidationResult}>} validators
   *   Ordered list of objects satisfying the Validator contract.
   */
  constructor(validators) {
    /** @private */
    this._validators = validators;
  }

  /**
   * @param {import("../BuildRequest.js").BuildRequest} request
   * @returns {ValidationResult}
   */
  validate(request) {
    for (const validator of this._validators) {
      const result = validator.validate(request);
      if (!result.valid) {
        return result;
      }
    }
    return { valid: true };
  }
}
