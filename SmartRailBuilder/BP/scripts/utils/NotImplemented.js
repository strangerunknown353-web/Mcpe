/**
 * NotImplemented.js
 *
 * PURPOSE
 *   Every domain module created in Roadmap Phase 2 (Project Skeleton) has a
 *   real class shape and documented public methods, but the gameplay logic
 *   inside those methods is intentionally deferred to a later Roadmap Phase.
 *   This helper gives every stub method the same clear, informative failure
 *   instead of each file hand-rolling its own error string.
 *
 * RESPONSIBILITIES
 *   - Throw one consistent error shape that names the module, the method,
 *     and the Roadmap Phase that will implement it.
 *
 * FUTURE EXTENSIONS
 *   - As each stub method is implemented, its call to notImplemented() is
 *     replaced by real logic — this file's job for that method is done at
 *     that point, nothing here needs to change.
 *
 * DEPENDENCIES
 *   None.
 */

/**
 * @param {string} moduleName e.g. "TerrainScanner"
 * @param {string} methodName e.g. "scanPath"
 * @param {number|string} roadmapPhase e.g. 5, or "5 (Terrain Scanner & Safety Validation)"
 * @returns {never}
 */
export function notImplemented(moduleName, methodName, roadmapPhase) {
  throw new Error(
    `[${moduleName}.${methodName}] Not implemented yet — scheduled for ` +
      `Roadmap Phase ${roadmapPhase}. See docs/ROADMAP.md.`
  );
}
