/**
 * BlockReader.js
 *
 * PURPOSE
 *   Extracted during Project Prompt 13's architecture review: the
 *   "convert undefined/thrown-error into a status" block-read pattern
 *   originally written once in TerrainScanner.js (Project Prompt 7) had,
 *   by this session, been copy-pasted nearly verbatim into
 *   TunnelDetector.js and (in a slightly different shape) BridgeDetector.js
 *   — three independent implementations of the same defensive logic. This
 *   file is that logic, written once.
 *
 * WHY THIS WASN'T DONE WHEN TunnelDetector.js FIRST DUPLICATED IT
 *   TunnelDetector.js's own header candidly flagged the duplication as
 *   deliberate for that session ("a larger change than this session's
 *   scope calls for... flagged for a future cleanup pass") rather than
 *   silently accepting it as fine. This session's architecture review is
 *   that flagged future pass — the exact kind of technical debt Project
 *   Prompt 13 asked to identify and resolve where it can be done without
 *   breaking existing behavior. Confirmed safe: TerrainScanner.js's
 *   `_scanPosition()` still gets its own `status`/`block` pair from this
 *   function, with identical behavior before and after — see the mocked
 *   test harness, all 55 assertions still pass unchanged after this
 *   extraction.
 *
 * RESPONSIBILITIES
 *   - Read a single block, converting the documented "undefined for an
 *     unloaded chunk" return and any thrown location error into one of
 *     three statuses, instead of letting an exception escape for the
 *     expected cases. Docs describe `getBlock()` as returning `undefined`
 *     for an unloaded chunk but *also* list it as able to throw
 *     `LocationInUnloadedChunkError`/`LocationOutOfWorldBoundariesError` —
 *     this function defensively handles both the undefined-return and the
 *     thrown-error path for each case, since the exact split wasn't fully
 *     pinned down (see ARCHITECTURE.md §21.5). Errors are distinguished by
 *     `error.name` (a plain string check) rather than `instanceof` against
 *     an imported error class, since it wasn't confirmed those classes are
 *     directly importable — a genuinely unrecognized error is re-thrown,
 *     not swallowed, so callers' own error handling (ultimately
 *     BuildPipeline's) catches it as UNEXPECTED_ERROR instead of this
 *     function silently misclassifying it.
 *
 * DEPENDENCIES
 *   None.
 */

/**
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {{x: number, y: number, z: number}} position
 * @returns {{status: "OK", block: import("@minecraft/server").Block} | {status: "UNLOADED"|"OUT_OF_BOUNDS"}}
 */
export function readBlock(dimension, position) {
  try {
    const block = dimension.getBlock(position);
    if (!block) {
      return { status: "UNLOADED" };
    }
    return { status: "OK", block };
  } catch (error) {
    if (error?.name === "LocationOutOfWorldBoundariesError") {
      return { status: "OUT_OF_BOUNDS" };
    }
    if (error?.name === "LocationInUnloadedChunkError") {
      return { status: "UNLOADED" };
    }
    throw error;
  }
}
