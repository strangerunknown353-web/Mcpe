/**
 * PositionKey.js
 *
 * PURPOSE
 *   Added Project Prompt 22 (Smart Build Preview, Validation & Safety): the
 *   one canonical "{x,y,z} -> string" formatter used everywhere a block
 *   position needs to be a Map/Set key — `core/BuildPlan.js`'s world
 *   modification boundary and `core/ActiveBuildRegistry.js`'s per-position
 *   claims both need the exact same key shape so a boundary position and a
 *   claimed position are recognized as the same block. Extracted here once
 *   rather than each file writing its own template string, matching this
 *   project's established pattern for shared formatting logic (see
 *   utils/BlockDisplayName.js's own header for the precedent).
 *
 * DEPENDENCIES
 *   None.
 */

/**
 * @param {{x: number, y: number, z: number}} position
 * @returns {string} e.g. "10,64,-3".
 */
export function positionKey(position) {
  return `${position.x},${position.y},${position.z}`;
}
