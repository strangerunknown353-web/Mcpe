/**
 * DirectionUtils.js
 *
 * PURPOSE
 *   Stateless math for converting a player's facing into a cardinal
 *   direction and a unit step vector. Deliberately knows nothing about the
 *   game world beyond the plain numbers/vectors passed in.
 *
 * RESPONSIBILITIES
 *   - Snap a yaw angle to one of North/South/East/West — the primary method
 *     used by core/BuildVector.js. See NOTE ON METHOD CHOICE below for why.
 *   - Determine the same 4-direction result from a 3D view-direction vector,
 *     kept as an alternate method — see the same note for why it is NOT
 *     what BuildVector uses.
 *   - Convert a cardinal direction into a {x, z} unit step vector.
 *
 * NOTE ON METHOD CHOICE (Project Prompt 6 self-review finding)
 *   Two methods exist: `snapYawToCardinal(yaw)` (Roadmap Phase 2) and
 *   `fromViewDirection(viewDirection)` (added, then reconsidered, this
 *   session). `fromViewDirection` was the first implementation used by
 *   BuildVector, on the reasoning that never reading the vertical (y)
 *   component makes pitch-independence true "by construction." Self-review
 *   found a real problem with that reasoning: a 3D view-direction vector's
 *   *horizontal* (x, z) magnitude shrinks toward zero as pitch approaches
 *   straight up/down (mathematically, both scale with cos(pitch)) — so at
 *   steep look angles, which of x or z is larger becomes numerically
 *   unstable, and a player looking steeply down at the ground right in
 *   front of them (a very ordinary way to use a placement item) could get
 *   an unpredictable direction.
 *
 *   Yaw does not have this problem: it is the engine's own horizontal-only
 *   rotation value, entirely independent of pitch by definition, with no
 *   projection or degradation at any pitch. `snapYawToCardinal` was
 *   therefore made the method `BuildVector.fromPlayer` actually calls.
 *   `fromViewDirection` is kept — it's still correct in its own terms and
 *   may suit a future 3D-facing use case — but is flagged here so nobody
 *   reaches for it for this purpose by mistake.
 *
 * FUTURE EXTENSIONS
 *   - 8-direction (diagonal) snapping, if ever needed for curved rails
 *     (Roadmap Phase 11+), would be added as a second function here rather
 *     than changing the 4-direction behavior other modules depend on.
 *
 * DEPENDENCIES
 *   None. Must stay pure.
 */

/** @enum {string} */
export const CardinalDirection = Object.freeze({
  NORTH: "north",
  SOUTH: "south",
  EAST: "east",
  WEST: "west",
});

/** {x, z} unit step for each direction, matching Minecraft's axis convention. */
const DIRECTION_VECTORS = Object.freeze({
  [CardinalDirection.NORTH]: Object.freeze({ x: 0, z: -1 }),
  [CardinalDirection.SOUTH]: Object.freeze({ x: 0, z: 1 }),
  [CardinalDirection.EAST]: Object.freeze({ x: 1, z: 0 }),
  [CardinalDirection.WEST]: Object.freeze({ x: -1, z: 0 }),
});

const DISPLAY_NAMES = Object.freeze({
  [CardinalDirection.NORTH]: "North",
  [CardinalDirection.SOUTH]: "South",
  [CardinalDirection.EAST]: "East",
  [CardinalDirection.WEST]: "West",
});

const OPPOSITE_DIRECTIONS = Object.freeze({
  [CardinalDirection.NORTH]: CardinalDirection.SOUTH,
  [CardinalDirection.SOUTH]: CardinalDirection.NORTH,
  [CardinalDirection.EAST]: CardinalDirection.WEST,
  [CardinalDirection.WEST]: CardinalDirection.EAST,
});

export const DirectionUtils = Object.freeze({
  /**
   * Snaps a yaw angle to the nearest cardinal direction. This is the
   * primary method used by core/BuildVector.js — see NOTE ON METHOD CHOICE
   * above for why yaw, not a view-direction vector, is the robust choice.
   * Minecraft yaw: 0 = south, 90 = west, ±180 = north, -90 = east. Yaw is
   * defined independently of pitch by the engine, so passing
   * `player.getRotation().y` here is unaffected by how far up or down the
   * player is looking.
   *
   * NORMALIZATION RULE: the yaw is wrapped into 0-360 and split into four
   * 90°-wide bands centered on each cardinal direction (e.g. South covers
   * 315°-360° and 0°-45°). A boundary value (exactly 45°, 135°, 225°, or
   * 315°) always resolves to the band on the higher/further side (e.g.
   * exactly 45° resolves to West, not South) — an arbitrary but
   * deterministic, documented tie-break, consistent with how ties are
   * handled in fromViewDirection() below.
   *
   * @param {number} yaw Degrees, in the range (-180, 180].
   * @returns {CardinalDirection}
   */
  snapYawToCardinal(yaw) {
    const normalized = ((yaw % 360) + 360) % 360; // 0..360
    if (normalized >= 315 || normalized < 45) return CardinalDirection.SOUTH;
    if (normalized >= 45 && normalized < 135) return CardinalDirection.WEST;
    if (normalized >= 135 && normalized < 225) return CardinalDirection.NORTH;
    return CardinalDirection.EAST;
  },

  /**
   * Determines the horizontal-only cardinal direction from a 3D view
   * direction vector (e.g. `player.getViewDirection()`), reading only its
   * x/z components. NOT used by BuildVector as of Project Prompt 6's
   * self-review — see NOTE ON METHOD CHOICE above for the numerical-
   * stability reason. Kept for possible future 3D-facing use cases.
   *
   * NORMALIZATION RULE: whichever horizontal axis has the larger magnitude
   * wins — |x| > |z| means East/West, otherwise North/South. At an exact
   * tie (|x| === |z|), resolves to North/South.
   *
   * @param {{x: number, y: number, z: number}} viewDirection
   * @returns {CardinalDirection}
   */
  fromViewDirection(viewDirection) {
    const { x, z } = viewDirection;
    if (Math.abs(x) > Math.abs(z)) {
      return x > 0 ? CardinalDirection.EAST : CardinalDirection.WEST;
    }
    return z > 0 ? CardinalDirection.SOUTH : CardinalDirection.NORTH;
  },

  /**
   * @param {CardinalDirection} direction
   * @returns {{x: number, z: number}} Unit step vector for one block of travel.
   */
  toStepVector(direction) {
    const vector = DIRECTION_VECTORS[direction];
    if (!vector) {
      throw new Error(`DirectionUtils: unknown direction "${direction}"`);
    }
    return vector;
  },

  /**
   * @param {CardinalDirection} direction
   * @returns {string} Human-readable form for player-facing messages, e.g. "North".
   */
  toDisplayName(direction) {
    return DISPLAY_NAMES[direction] ?? direction;
  },

  /**
   * Added Roadmap Phase 11 (Project Prompt 11) for descending-slope rail shape
   * computation: a descending step's sloped rail block belongs to the HIGHER
   * (earlier) position, oriented as "ascending toward where the player came
   * from" — i.e. the reverse of the direction of travel. See
   * terrain/TerrainScanner.js's rail-shape resolution and
   * builder/RailPermutationBuilder.js for how this is used.
   * @param {CardinalDirection} direction
   * @returns {CardinalDirection}
   */
  opposite(direction) {
    const result = OPPOSITE_DIRECTIONS[direction];
    if (!result) {
      throw new Error(`DirectionUtils: unknown direction "${direction}"`);
    }
    return result;
  },
});
