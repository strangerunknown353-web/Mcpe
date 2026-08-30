/**
 * Vector3Utils.js
 *
 * PURPOSE
 *   Stateless math helpers for working with @minecraft/server's plain
 *   {x, y, z} location objects. Kept dependency-free so it can be unit-tested
 *   and reused by any future module (terrain scanning, rail placement,
 *   direction math) without pulling in game state.
 *
 * RESPONSIBILITIES
 *   - Basic vector arithmetic and comparison used across the addon.
 *
 * FUTURE EXTENSIONS
 *   - Curved-rail math (Roadmap Phase 11+) will likely add rotation/rounding
 *     helpers here rather than duplicating vector math in the builder module.
 *
 * DEPENDENCIES
 *   None. Must stay pure — no imports from @minecraft/server.
 */

/**
 * @typedef {{x: number, y: number, z: number}} Vector3
 */

export const Vector3Utils = Object.freeze({
  /**
   * @param {Vector3} a
   * @param {Vector3} b
   * @returns {Vector3}
   */
  add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  },

  /**
   * @param {Vector3} a
   * @param {Vector3} b
   * @returns {Vector3}
   */
  subtract(a, b) {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  },

  /**
   * @param {Vector3} v
   * @param {number} scalar
   * @returns {Vector3}
   */
  scale(v, scalar) {
    return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
  },

  /**
   * @param {Vector3} v
   * @returns {Vector3} Same vector with each component floored — useful for
   *   converting a player's continuous position into a block position.
   */
  floor(v) {
    return { x: Math.floor(v.x), y: Math.floor(v.y), z: Math.floor(v.z) };
  },

  /**
   * @param {Vector3} a
   * @param {Vector3} b
   * @returns {boolean} True if all three components are exactly equal.
   */
  equals(a, b) {
    return a.x === b.x && a.y === b.y && a.z === b.z;
  },

  /**
   * @param {Vector3} a
   * @param {Vector3} b
   * @returns {number} Euclidean distance between two points.
   */
  distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  },
});
