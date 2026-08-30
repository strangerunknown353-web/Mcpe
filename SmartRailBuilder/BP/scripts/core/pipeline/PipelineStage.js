/**
 * PipelineStage.js
 *
 * PURPOSE
 *   Plain-JS "interface" (documented contract, matching the convention set by
 *   builder/strategies/RailBuildStrategy.js) that every stage in the build
 *   pipeline must satisfy. This is what makes the pipeline's "insert future
 *   stages without rewriting it" requirement real: BuildPipeline depends on
 *   this shape only, never on a concrete stage class.
 *
 * CONTRACT
 *   A pipeline stage is any object exposing:
 *
 *     name: string
 *       A short, stable identifier used in logs and PipelineResult.stageName.
 *
 *     execute(context): PipelineResult | Promise<PipelineResult>
 *       Reads and/or writes `context` (see ./PipelineContext.js), and
 *       returns a PipelineResult (see ./PipelineResult.js). Returning
 *       anything other than PipelineResultStatus.SUCCESS stops the pipeline
 *       immediately — a stage never partially runs the rest of the pipeline
 *       itself.
 *
 * FUTURE EXTENSIONS
 *   - Roadmap Phase 5+: TerrainScanningStage, InventoryStage, and
 *     PlacementStage each already exist as real, named stages implementing
 *     this contract; only their `execute()` bodies change from
 *     `PipelineResult.futureExpansion(...)` to real logic when their turn
 *     comes, per ROADMAP.md.
 *
 * DEPENDENCIES
 *   None — this file is documentation, not executable logic.
 */

export {};
