/**
 * mockWorld.mjs
 *
 * PURPOSE
 *   A small, synthetic Bedrock world for exercising the addon's PLANNING-side
 *   logic (terrain/*.js, config/*.js) with plain Node — no `@minecraft/server`
 *   dependency, matching this project's own established test-harness pattern
 *   (see ARCHITECTURE.md's Project Prompt 11/12/14 entries: "a small Node
 *   test harness — no @minecraft/server dependency, a synthetic
 *   dimension.getBlock() over a hand-specified heightmap").
 *
 * ADDED THIS SESSION (Project Prompt 18)
 *   No mocked test harness was present in the uploaded project archive (see
 *   ARCHITECTURE.md §33.2/§34.5's standing note about this gap across
 *   multiple prior sessions). This file — and tests/water.test.mjs — is
 *   this session's attempt to actually close that gap for the files this
 *   session touches, committed to the repository rather than left in a
 *   session-local temp directory, so a future session can run and extend it
 *   directly. See tests/README.md for how to run it and TODO.md for the
 *   remaining gap (only the pure planning-side modules are covered; the
 *   execution strategies import `@minecraft/server` directly and would need
 *   a module-resolution shim to test the same way — flagged, not solved,
 *   this session).
 *
 * WHAT THIS MOCKS
 *   `Dimension.getBlock(position)` only — every planning-side module in
 *   this addon reads blocks exclusively through `utils/BlockReader.js`'s
 *   `readBlock()`, which only ever calls `dimension.getBlock()`. A synthetic
 *   dimension is built from:
 *     - a flat ground height (default 63) below which every block is solid,
 *     - an explicit `overrides` map for specific (x,y,z) positions — the
 *       actual "terrain" each test cares about (water, lava, unbreakable
 *       blocks, etc.),
 *     - explicit "holes" (unloaded/out-of-bounds positions) a test can
 *       declare, mirroring readBlock()'s own documented failure modes.
 */

/**
 * @typedef {Object} MockBlockSpec
 * @property {string} typeId
 * @property {boolean} [isAir]
 * @property {boolean} [isLiquid]
 * @property {number} [liquidDepth] 0 = source block. Only meaningful when isLiquid.
 */

class MockBlock {
  constructor(spec) {
    this.typeId = spec.typeId;
    this.isAir = spec.isAir ?? spec.typeId === "minecraft:air";
    this.isLiquid = spec.isLiquid ?? false;
    this._liquidDepth = spec.liquidDepth ?? 0;
    this._permutationState = spec.permutationState ?? {};
    this.permutation = {
      getState: (key) => {
        if (key === "liquid_depth" && this.isLiquid) return this._liquidDepth;
        return this._permutationState[key];
      },
    };
  }

  setPermutation(permutation) {
    // Only used by execution-time classes this harness doesn't exercise —
    // present so a stray call doesn't throw, not because planning-side
    // code ever calls it (TerrainScanner never mutates the world).
    this.typeId = permutation?.typeId ?? this.typeId;
  }
}

export const AIR = Object.freeze({ typeId: "minecraft:air", isAir: true });
export const STONE = Object.freeze({ typeId: "minecraft:stone" });
export const WATER_SOURCE = Object.freeze({ typeId: "minecraft:water", isLiquid: true, liquidDepth: 0 });
export const WATER_FLOWING = Object.freeze({ typeId: "minecraft:water", isLiquid: true, liquidDepth: 3 });
export const LAVA = Object.freeze({ typeId: "minecraft:lava", isLiquid: true });

/**
 * @param {Object} options
 * @param {number} [options.groundY] Y of the solid ground plane — everything at or below is solid stone by default, everything above is air, unless overridden.
 * @param {Record<string, MockBlockSpec>} [options.overrides] Keyed by "x,y,z" — takes priority over the default ground plane.
 * @param {ReadonlyArray<string>} [options.unloaded] "x,y,z" keys that simulate an unloaded chunk (readBlock() -> UNLOADED).
 * @param {ReadonlyArray<string>} [options.outOfBounds] "x,y,z" keys that simulate outside world height bounds (readBlock() -> OUT_OF_BOUNDS).
 */
export function createMockDimension({ groundY = 63, overrides = {}, unloaded = [], outOfBounds = [] } = {}) {
  const unloadedSet = new Set(unloaded);
  const outOfBoundsSet = new Set(outOfBounds);

  return {
    getBlock(position) {
      const key = `${position.x},${position.y},${position.z}`;

      if (outOfBoundsSet.has(key)) {
        const error = new Error("out of bounds");
        error.name = "LocationOutOfWorldBoundariesError";
        throw error;
      }
      if (unloadedSet.has(key)) {
        return undefined;
      }
      if (overrides[key]) {
        return new MockBlock(overrides[key]);
      }
      if (position.y <= groundY) {
        return new MockBlock(STONE);
      }
      return new MockBlock(AIR);
    },
  };
}

/**
 * Minimal BuildVector stand-in — every planning method this harness
 * exercises only ever reads `.origin`, `.direction`, `.horizontalAt(i)`.
 * Real core/BuildVector.js is deliberately NOT imported here: it depends on
 * nothing from `@minecraft/server` either, but re-implementing its (tiny,
 * stable) contract directly keeps this mock self-contained and obviously
 * correct at a glance, the same reasoning ARCHITECTURE.md gives for keeping
 * WaterDetector.js's own primitives small and independently readable.
 *
 * @param {{x:number,y:number,z:number}} origin
 * @param {import("../BP/scripts/utils/DirectionUtils.js").CardinalDirection} direction
 */
export function createBuildVector(origin, direction) {
  const step = { north: { x: 0, z: -1 }, south: { x: 0, z: 1 }, east: { x: 1, z: 0 }, west: { x: -1, z: 0 } }[direction];
  return {
    origin,
    direction,
    horizontalAt(i) {
      return { x: origin.x + step.x * i, z: origin.z + step.z * i };
    },
  };
}
