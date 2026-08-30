import { system } from "@minecraft/server";

/**
 * RailBuilder.js
 *
 * PURPOSE
 *   Owns the `system.runJob` generator execution for a build. Depends only
 *   on the RailBuildStrategy contract (see builder/strategies/RailBuildStrategy.js),
 *   never on a concrete strategy class — this is what lets a future
 *   SmartTerrainScanner or a new strategy slot in without RailBuilder
 *   changing, per ARCHITECTURE.md's replaceability requirement.
 *
 * ROADMAP PHASE 16 CHANGE: strategy is now passed to run(), not fixed at
 * construction (Project Prompt 16)
 *   Through Project Prompt 15, exactly one strategy (StraightRailStrategy)
 *   existed, so binding it once at construction (`new RailBuilder(strategy)`)
 *   was the simplest correct design — BridgeExecutionStrategy.js's own
 *   header candidly noted this had never actually been exercised with a
 *   second implementer. Now that one exists for real, PlacementStage needs
 *   to pick StraightRailStrategy or BridgeExecutionStrategy per build,
 *   based on `context.request.buildingMode` — so `run()` now takes the
 *   strategy as its third argument instead of this class holding one
 *   fixed reference. RailBuilder itself is otherwise completely unchanged:
 *   it still never inspects which concrete strategy it was given, only
 *   that it satisfies the RailBuildStrategy contract.
 *
 * RESPONSIBILITIES
 *   - Accept a validated BuildSession, a path, and a RailBuildStrategy.
 *   - Run the strategy's generator via `system.runJob`, letting the engine
 *     spread block placement across ticks.
 *   - Report the final BuildResult back to its caller (PlacementStage) —
 *     RailBuilder does not decide what message the player sees.
 *
 * HOW `run()` BRIDGES A GENERATOR TO A PROMISE (Project Prompt 10)
 *   `system.runJob(generator)` schedules a Generator object to run to
 *   completion across ticks — it does not itself return a Promise resolving
 *   to that generator's final return value. `run()` wraps the strategy's
 *   generator in a small outer generator that uses `yield*` delegation
 *   (standard JS: transparently forwards every yield from the inner
 *   generator, and captures its final `return` value once it completes),
 *   then resolves/rejects an outer Promise from inside that wrapper. This
 *   is what lets `PlacementStage.execute()` simply `await` a placement that
 *   is, under the hood, spread across many ticks.
 *
 * FUTURE EXTENSIONS
 *   - A future UndergroundExcavationStrategy (Roadmap Phase 17+) needs no
 *     change here either — PlacementStage picks it the same way it now
 *     picks between the two existing strategies.
 *
 * DEPENDENCIES
 *   - builder/strategies/RailBuildStrategy.js (contract)
 *   - core/BuildSession.js
 *   - @minecraft/server (system.runJob)
 */

export class RailBuilder {
  /**
   * @param {import("../core/BuildSession.js").BuildSession} session
   * @param {ReadonlyArray<import("../terrain/TerrainScanner.js").TerrainPositionFact>|import("../terrain/BridgePlan.js").BridgePlan} path
   *   Pre-validated, pre-resolved positions for StraightRailStrategy, or a
   *   feasible BridgePlan for BridgeExecutionStrategy — see
   *   RailBuildStrategy.js's contract doc for why this stays intentionally
   *   opaque to RailBuilder itself.
   * @param {import("./strategies/RailBuildStrategy.js")} strategy Any object implementing the RailBuildStrategy contract. Added Project Prompt 16 — see ROADMAP PHASE 16 CHANGE above.
   * @returns {Promise<import("./strategies/RailBuildStrategy.js").BuildResult>}
   */
  run(session, path, strategy) {
    const innerGenerator = strategy.buildPath(session, path);

    return new Promise((resolve, reject) => {
      function* driver() {
        try {
          const result = yield* innerGenerator;
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }
      system.runJob(driver());
    });
  }
}
