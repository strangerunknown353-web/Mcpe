import { LocalizationKeys } from "../localization/LocalizationKeys.js";
import { Logger } from "../utils/Logger.js";
import { PipelineContext } from "./pipeline/PipelineContext.js";
import { PipelineOutcome, classifyOutcome } from "./pipeline/PipelineOutcome.js";

/**
 * BuildOrchestrator.js
 *
 * PURPOSE
 *   The entry point called by main.js's item-interaction listener.
 *   Constructs a PipelineContext, runs the injected BuildPipeline (see
 *   ./pipeline/BuildPipeline.js), and translates the final PipelineResult
 *   into player feedback. All sequencing (menu -> BuildRequest ->
 *   validation -> terrain -> inventory -> future stages) lives in the
 *   pipeline stages themselves; see ARCHITECTURE.md §17 for the pipeline
 *   refactor's rationale and §27 for this session's integration review.
 *
 * RESPONSIBILITIES
 *   - Guard against a player opening a second menu/build while one is
 *     already in progress (per-player, so this never blocks other players).
 *   - Run the pipeline against a fresh PipelineContext.
 *   - Classify the terminal result via PipelineOutcome (Project Prompt 9 —
 *     see ./pipeline/PipelineOutcome.js) and map each outcome to the
 *     correct player feedback: CANCELLED and PENDING_FUTURE_WORK need no
 *     message (working as designed); VALIDATION_FAILED/TERRAIN_FAILED/
 *     INVENTORY_FAILED all send the result's localizationKey (the outcome
 *     distinguishes *which kind* of rejection for logging/future-UI
 *     purposes, even though today they're all delivered the same way);
 *     UNEXPECTED_ERROR sends a generic error message.
 *   - Guarantee the active-build guard is always released, even if the
 *     pipeline throws somehow (BuildPipeline itself already catches stage
 *     errors, but this try/finally is defensive against a bug in the
 *     orchestrator's own code, never leaving a player permanently locked out).
 *
 * DEPENDENCIES
 *   - core/pipeline/BuildPipeline.js (injected, pre-composed with its stages)
 *   - core/pipeline/PipelineContext.js
 *   - core/pipeline/PipelineOutcome.js
 *   - ui/MessageService.js (injected)
 *   - localization/LocalizationKeys.js
 */

export class BuildOrchestrator {
  /**
   * @param {Object} dependencies
   * @param {import("./pipeline/BuildPipeline.js").BuildPipeline} dependencies.pipeline
   * @param {import("../ui/MessageService.js").MessageService} dependencies.messageService
   */
  constructor({ pipeline, messageService }) {
    /** @private */
    this._pipeline = pipeline;
    /** @private */
    this._messageService = messageService;
    /**
     * Per-player guard against opening a second menu/build while one is
     * already in progress for that player. Keyed by player ID, never global.
     * @private
     * @type {Set<string>}
     */
    this._activePlayerIds = new Set();
  }

  /**
   * Entry point called by the item-interaction listener in main.js.
   * @param {import("@minecraft/server").Player} player
   * @param {string} railTypeId
   * @returns {Promise<void>}
   */
  async startBuild(player, railTypeId) {
    const playerId = player.id;

    if (this._activePlayerIds.has(playerId)) {
      Logger.debug(`Ignored duplicate build trigger from ${player.name} — one is already in progress.`);
      this._messageService.sendChat(player, LocalizationKeys.VALIDATION_ALREADY_BUILDING);
      return;
    }
    this._activePlayerIds.add(playerId);

    try {
      const context = new PipelineContext({ player, railTypeId });
      const result = await this._pipeline.run(context);
      this._reportResult(player, result, context);
    } catch (error) {
      // Defensive only — BuildPipeline already converts stage exceptions
      // into UNEXPECTED_ERROR results internally. Reaching this branch
      // means the orchestrator's own code broke, not a stage.
      Logger.error(`Unexpected error running the build pipeline for ${player.name}`, error);
      this._messageService.sendChat(player, LocalizationKeys.GENERIC_ERROR);
    } finally {
      this._activePlayerIds.delete(playerId);
    }
  }

  /**
   * @param {import("@minecraft/server").Player} player
   * @param {import("./pipeline/PipelineResult.js").PipelineResult} result
   * @param {import("./pipeline/PipelineContext.js").PipelineContext} context
   * @private
   */
  _reportResult(player, result, context) {
    const outcome = classifyOutcome(result);
    Logger.debug(
      `Build outcome for ${player.name}: ${outcome} (stage=${result.stageName ?? "n/a"}, ` +
        `finalLifecycleState=${context.lifecycleState ?? "n/a"})`
    );

    switch (outcome) {
      case PipelineOutcome.BUILD_ACCEPTED:
        // Nothing to do here — CompletionStage (the pipeline's final stage,
        // real since Project Prompt 10) already sent the "build complete"
        // chat message itself before this method ever runs.
        break;

      case PipelineOutcome.CANCELLED:
        // Menu-close cancellation (BuildRequestCreationStage) needs no
        // message — the player just closed a form, nothing to explain.
        // Mid-build cancellation (PlacementStage, via CancellationWatcher —
        // disconnect, dimension change, death, game mode change) is
        // different: the player may still be present and deserves to know
        // their railway construction stopped and why, per Project Prompt
        // 10's "display a clear message" error-recovery requirement.
        if (result.stageName === "PlacementStage") {
          this._messageService.sendChat(player, LocalizationKeys.CONSTRUCTION_CANCELLED, [
            result.reason ?? "unknown",
            context.buildSession?.blocksPlaced ?? 0,
          ]);
        }
        break;

      case PipelineOutcome.VALIDATION_FAILED:
      case PipelineOutcome.TERRAIN_FAILED:
      case PipelineOutcome.INVENTORY_FAILED:
        // Added Project Prompt 22 §8/§9: a clear "STATUS: CANNOT BUILD"
        // lead-in before the specific reason, for every outcome that means
        // literally nothing was modified — matches the confirmation
        // screen's own "STATUS: READY TO BUILD" framing (ui/BuildMenu.js),
        // giving the player the same status/reason shape whether the news
        // is good or bad. Deliberately NOT sent for PLACEMENT_INCOMPLETE
        // below — that outcome means some rails WERE placed and kept, which
        // "CANNOT BUILD" would misrepresent; CONSTRUCTION_STOPPED already
        // says so clearly on its own.
        if (result.localizationKey) {
          this._messageService.sendChat(player, LocalizationKeys.STATUS_CANNOT_BUILD);
          this._messageService.sendChat(player, result.localizationKey, result.substitutions);
        }
        break;

      case PipelineOutcome.PLACEMENT_INCOMPLETE:
        if (result.localizationKey) {
          this._messageService.sendChat(player, result.localizationKey, result.substitutions);
        }
        break;

      case PipelineOutcome.PENDING_FUTURE_WORK:
        // Working as designed — every implemented check passed and the
        // pipeline correctly stopped at a stage that isn't built yet.
        // Project Prompt 15: if that stage attached a localizationKey
        // (ModeAvailabilityStage does, for a valid Bridge/Underground
        // request), the player just explicitly pressed "Build" and
        // deserves to know why nothing happened — send it. Every other
        // FUTURE_EXPANSION source remains silent-by-default, unchanged.
        if (result.localizationKey) {
          this._messageService.sendChat(player, result.localizationKey, result.substitutions);
        }
        Logger.info(
          `Pipeline stopped at "${result.stageName}" (pending future work) for ${player.name} — ` +
            "expected until that stage's Roadmap phase is implemented."
        );
        break;

      case PipelineOutcome.UNEXPECTED_ERROR:
        this._messageService.sendChat(player, LocalizationKeys.GENERIC_ERROR);
        break;

      default:
        Logger.warn(`Unhandled PipelineOutcome: ${outcome}`);
        break;
    }
  }
}
