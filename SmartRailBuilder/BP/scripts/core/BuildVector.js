import { DirectionUtils } from "../utils/DirectionUtils.js";
import { Vector3Utils } from "../utils/Vector3Utils.js";

/**
 * BuildVector.js
 *
 * PURPOSE
 *   The single, reusable model every future placement system reads instead
 *   of recomputing direction/position math itself — exactly the "future
 *   systems should use this object instead of calculating direction
 *   themselves" requirement from Project Prompt 6. Combines the player's
 *   cardinal facing direction, the forward-movement unit step, and the
 *   railway's starting block ("origin") into one immutable value object.
 *
 * RESPONSIBILITIES
 *   - `fromPlayer(player)`: the one place that reads a live player's
 *     rotation and location to compute a BuildVector. See "WHY
 *     player.getRotation().y" below.
 *   - `positionAt(distance)`: give any future stage (TerrainScanningStage,
 *     PlacementStage, ...) the block position `distance` steps from the
 *     origin, along this vector's direction — so no other module needs its
 *     own position-stepping math.
 *
 * WHY `player.getRotation().y` (YAW), NOT `player.getViewDirection()`
 *   (Project Prompt 6 self-review correction — see utils/DirectionUtils.js's
 *   own header for the full reasoning.) The first implementation of this
 *   class read `getViewDirection()` and used only its x/z components, on
 *   the reasoning that never touching the vertical component guarantees
 *   pitch-independence. Self-review found that reasoning incomplete: a 3D
 *   view vector's *horizontal* magnitude itself shrinks toward zero as
 *   pitch approaches straight up/down, making the direction numerically
 *   unstable at exactly the moment a player is most likely to be looking
 *   steeply down at the ground in front of them to use a placement item.
 *   Yaw has no such degradation — it's the engine's own horizontal-only
 *   rotation value, fully independent of pitch by definition — so
 *   `DirectionUtils.snapYawToCardinal(player.getRotation().y)` is what this
 *   class actually calls. "Pitch must not affect direction" is still true,
 *   just enforced by never reading pitch (`getRotation().x`) at all, rather
 *   than by discarding the y-component of a different vector.
 *
 * ORIGIN RULE ("the player's own block must never be selected")
 *   `origin` is always `playerBlock + stepVector` — exactly one block away
 *   from the player's own (floored) position along the horizontal axis
 *   they're facing, with `y` unchanged. Since `stepVector` always has
 *   magnitude 1 in exactly one horizontal axis, `origin` can never equal
 *   `playerBlock`. This is a structural guarantee, not a runtime check.
 *
 * SCOPE BOUNDARY (deliberate, see ARCHITECTURE.md §19)
 *   This class only computes WHERE the origin is and WHICH direction to
 *   build in — it does not judge whether that position is safe (inside a
 *   wall, over a gap, underwater, etc.). That's TerrainScanner/PathValidator's
 *   job, starting Roadmap Phase 5. A BuildVector computed while facing a
 *   wall is still a structurally valid BuildVector today.
 *
 * FUTURE EXTENSIONS
 *   - A "start N blocks ahead" feature (e.g. to leave room for a support
 *     pillar) would change how `origin` is computed from `playerBlock`
 *     inside `fromPlayer`, without any other module needing to change,
 *     since they all consume `origin`/`positionAt()`, never recompute it.
 *   - Curved rails (Roadmap Phase 11+) would likely add a `turn(newDirection)`
 *     method here rather than a new model elsewhere.
 *   - Slopes (Roadmap Phase 11, Project Prompt 11) did NOT need a change to
 *     this class's core model, confirming the scope boundary above was
 *     drawn in the right place — `horizontalAt()` was added alongside
 *     `positionAt()` (not instead of it) purely so TerrainScanner can track
 *     its own Y as it discovers slopes; `origin`/`direction`/`stepVector`
 *     and the "one block away, y unchanged" origin rule are all untouched.
 *
 * DEPENDENCIES
 *   - utils/DirectionUtils.js
 *   - utils/Vector3Utils.js
 */

export class BuildVector {
  /**
   * @param {Object} params
   * @param {import("../utils/DirectionUtils.js").CardinalDirection} params.direction
   * @param {{x: number, y: number, z: number}} params.origin First block of the railway.
   * @param {{x: number, y: number, z: number}} params.playerBlock Player's own floored block position (for reference/logging only — never selected as origin).
   * @param {{x: number, z: number}} params.stepVector Unit step for one block of forward travel.
   */
  constructor({ direction, origin, playerBlock, stepVector }) {
    /** @readonly */
    this.direction = direction;
    /** @readonly */
    this.origin = origin;
    /** @readonly */
    this.playerBlock = playerBlock;
    /** @readonly */
    this.stepVector = stepVector;
  }

  /**
   * @param {number} distance Number of steps forward from the origin (0 = origin itself).
   * @returns {{x: number, y: number, z: number}}
   */
  positionAt(distance) {
    return {
      x: this.origin.x + this.stepVector.x * distance,
      y: this.origin.y,
      z: this.origin.z + this.stepVector.z * distance,
    };
  }

  /**
   * Added Roadmap Phase 11 (Project Prompt 11): the horizontal-only twin of
   * positionAt(), for callers that track their own Y independently of the
   * origin's — specifically TerrainScanner, once a path can climb or
   * descend. positionAt() intentionally still always returns origin.y (flat
   * only) and is unchanged and still correct for any caller that hasn't
   * been taught about slopes — PlacementStage no longer calls it (it reads
   * already-resolved positions from the terrain report instead), but
   * nothing stops another future caller from wanting a flat reference line.
   * @param {number} distance
   * @returns {{x: number, z: number}}
   */
  horizontalAt(distance) {
    return {
      x: this.origin.x + this.stepVector.x * distance,
      z: this.origin.z + this.stepVector.z * distance,
    };
  }

  /**
   * @param {import("@minecraft/server").Player} player
   * @returns {BuildVector}
   */
  static fromPlayer(player) {
    const direction = DirectionUtils.snapYawToCardinal(player.getRotation().y);
    const stepVector = DirectionUtils.toStepVector(direction);
    const playerBlock = Vector3Utils.floor(player.location);
    const origin = {
      x: playerBlock.x + stepVector.x,
      y: playerBlock.y,
      z: playerBlock.z + stepVector.z,
    };
    return new BuildVector({ direction, origin, playerBlock, stepVector });
  }
}
