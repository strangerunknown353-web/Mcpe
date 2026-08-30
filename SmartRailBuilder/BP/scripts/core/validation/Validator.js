/**
 * Validator.js
 *
 * PURPOSE
 *   Plain-JS "interface" (same documented-contract convention as
 *   builder/strategies/RailBuildStrategy.js and core/pipeline/PipelineStage.js)
 *   that every individual validator must satisfy. ValidationManager depends
 *   on this shape only, never on a concrete validator class — this is what
 *   lets a new validator plug in as one new file plus one line in main.js's
 *   dependency wiring, with zero changes to ValidationManager itself.
 *
 * CONTRACT
 *   A validator is any object exposing:
 *
 *     name: string
 *       A short, stable identifier used in logs.
 *
 *     validate(request): ValidationResult
 *       Takes a BuildRequest (see ../BuildRequest.js) and returns a
 *       ValidationResult — `{ valid: true }`, or `{ valid: false, reason,
 *       localizationKey? }`. A validator is synchronous and side-effect-free:
 *       it only reads the request and live player state, never mutates
 *       either and never sends messages itself.
 *
 * FUTURE EXTENSIONS
 *   - A claims/region permission system replaces PermissionValidator's body
 *     only — this contract, ValidationManager, and every other validator are
 *     unaffected.
 *
 * DEPENDENCIES
 *   None — this file is documentation, not executable logic.
 */

export {};
