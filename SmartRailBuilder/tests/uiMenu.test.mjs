/**
 * uiMenu.test.mjs
 *
 * Project Prompt 21 ("Polished Mobile UI & Build Configuration") test suite
 * — the first suite to exercise ui/BuildMenu.js directly, unlocked by the
 * new `node_modules/@minecraft/server-ui` mock (see that package's own
 * header). Every prior session's tests/README.md listed this as a known,
 * unsolved gap; `integration.test.mjs` has always substituted a scripted
 * stub for the whole class instead.
 *
 * Run with: node tests/uiMenu.test.mjs
 */

import { BuildMenu } from "../BP/scripts/ui/BuildMenu.js";
import { BuildingMode, BUILD_MODE_ORDER, BUILD_MODE_REGISTRY } from "../BP/scripts/config/BuildModes.js";
import { queueFormResponse, resetFormResponses } from "@minecraft/server-ui";
import { createMockPlayer } from "./mockPlayer.mjs";

let passed = 0;
let failed = 0;
const failures = [];

function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
function assertTrue(actual, label) {
  assertEqual(Boolean(actual), true, label);
}
/**
 * BuildMenu never lets a `.show()` failure escape as a thrown error (see its
 * own header: "Never throw... caught and reported as a cancellation at that
 * step") — so an out-of-range slider value rejected by the mock surfaces
 * here as `{cancelled: true}`, not a raised exception. Asserting that is the
 * real proof: an impossible value can never come back as a usable config.
 */
async function assertBecomesCancelled(fn, label) {
  const result = await fn();
  assertTrue(result.cancelled, label);
}

const menu = new BuildMenu();

// ---------------------------------------------------------------------------
// 1. Mode screen: one button per registry entry, correct order, never
//    auto-changes anything — it only reports back what was clicked.
// ---------------------------------------------------------------------------
{
  resetFormResponses();
  const player = createMockPlayer({ id: "p1" });
  queueFormResponse(player, { canceled: false, selection: 1 });
  const result = await menu.promptForMode(player);

  assertTrue(!result.cancelled, "mode screen: not cancelled on a real selection");
  assertEqual(result.mode, BUILD_MODE_ORDER[1], "mode screen: selection index maps to the correct BuildingMode");
  assertEqual(BUILD_MODE_ORDER, [BuildingMode.NORMAL, BuildingMode.BRIDGE, BuildingMode.UNDERGROUND], "mode screen: button order is Normal, Bridge, Underground");
}

// ---------------------------------------------------------------------------
// 2. Mode screen: cancellation path never returns a mode.
// ---------------------------------------------------------------------------
{
  resetFormResponses();
  const player = createMockPlayer({ id: "p2" });
  queueFormResponse(player, { canceled: true, cancelationReason: "UserClosed" });
  const result = await menu.promptForMode(player);

  assertTrue(result.cancelled, "mode screen: closing the form reports cancelled");
  assertTrue(result.mode === undefined, "mode screen: no mode is returned on cancel");
}

// ---------------------------------------------------------------------------
// 3. Configuration screen: Bridge Height slider is physically bounded to
//    [1, 16] — "impossible to select 0 or 21+" is enforced by the slider's
//    own construction, not by a separate check. An out-of-range scripted
//    submission is rejected by the mock (simulating a value no real slider
//    could ever produce); BuildMenu never lets that escape as a thrown
//    error, so it surfaces as a cancelled config instead of a usable one.
// ---------------------------------------------------------------------------
{
  const bridgeDef = BUILD_MODE_REGISTRY[BuildingMode.BRIDGE];
  assertEqual(bridgeDef.min, 1, "bridge height: registry minimum is 1");
  assertEqual(bridgeDef.max, 16, "bridge height: registry maximum is 16");

  resetFormResponses();
  const player = createMockPlayer({ id: "p3" });
  // formValues[0] = height (slider added first for a requiresConfig mode), formValues[1] = length.
  queueFormResponse(player, { canceled: false, formValues: [0, 10] }); // height 0 — below the real slider's minimum
  await assertBecomesCancelled(
    () => menu.promptForConfiguration(player, BuildingMode.BRIDGE, { minLength: 3, maxLength: 128, step: 1, defaultLength: 10 }),
    "bridge height: a scripted value of 0 is rejected as physically impossible on the real slider"
  );

  resetFormResponses();
  queueFormResponse(player, { canceled: false, formValues: [21, 10] }); // height 21 — above the real slider's maximum
  await assertBecomesCancelled(
    () => menu.promptForConfiguration(player, BuildingMode.BRIDGE, { minLength: 3, maxLength: 128, step: 1, defaultLength: 10 }),
    "bridge height: a scripted value of 21 is rejected as physically impossible on the real slider"
  );
}

// ---------------------------------------------------------------------------
// 4. Configuration screen: Underground Depth is physically bounded to
//    [1, 20], same proof as above.
// ---------------------------------------------------------------------------
{
  const undergroundDef = BUILD_MODE_REGISTRY[BuildingMode.UNDERGROUND];
  assertEqual(undergroundDef.min, 1, "underground depth: registry minimum is 1");
  assertEqual(undergroundDef.max, 20, "underground depth: registry maximum is 20");

  resetFormResponses();
  const player = createMockPlayer({ id: "p4" });
  queueFormResponse(player, { canceled: false, formValues: [0, 10] }); // depth 0
  await assertBecomesCancelled(
    () => menu.promptForConfiguration(player, BuildingMode.UNDERGROUND, { minLength: 3, maxLength: 128, step: 1, defaultLength: 10 }),
    "underground depth: a scripted value of 0 is rejected as physically impossible on the real slider"
  );

  resetFormResponses();
  queueFormResponse(player, { canceled: false, formValues: [21, 10] }); // depth 21
  await assertBecomesCancelled(
    () => menu.promptForConfiguration(player, BuildingMode.UNDERGROUND, { minLength: 3, maxLength: 128, step: 1, defaultLength: 10 }),
    "underground depth: a scripted value of 21 is rejected as physically impossible on the real slider"
  );
}

// ---------------------------------------------------------------------------
// 5. Configuration screen: NORMAL mode shows exactly one field (Length) —
//    Bridge Height / Underground Depth never appear when irrelevant.
// ---------------------------------------------------------------------------
{
  resetFormResponses();
  const player = createMockPlayer({ id: "p5" });
  queueFormResponse(player, { canceled: false, formValues: [15] });
  const result = await menu.promptForConfiguration(player, BuildingMode.NORMAL, { minLength: 3, maxLength: 128, step: 1, defaultLength: 10 });

  assertTrue(!result.cancelled, "normal config: not cancelled");
  assertEqual(result.modeValue, undefined, "normal config: no modeValue field for a mode with requiresConfig=false");
  assertEqual(result.length, 15, "normal config: length is read from the only field present");
}

// ---------------------------------------------------------------------------
// 6. Configuration screen: BRIDGE mode reads height then length correctly
//    from the combined form (fieldOrder mapping).
// ---------------------------------------------------------------------------
{
  resetFormResponses();
  const player = createMockPlayer({ id: "p6" });
  queueFormResponse(player, { canceled: false, formValues: [8, 40] });
  const result = await menu.promptForConfiguration(player, BuildingMode.BRIDGE, { minLength: 3, maxLength: 128, step: 1, defaultLength: 10 });

  assertEqual(result.modeValue, 8, "bridge config: modeValue reads the height field");
  assertEqual(result.length, 40, "bridge config: length reads the second field");
}

// ---------------------------------------------------------------------------
// 7. Material screen: button count/order matches the supplied materials
//    list exactly (BuildMenu never re-derives it), and the response maps
//    back to the correct typeId — including the shared display-name
//    formatter (utils/BlockDisplayName.js) used in the button label.
// ---------------------------------------------------------------------------
{
  resetFormResponses();
  const player = createMockPlayer({ id: "p7" });
  const materials = [
    { typeId: "minecraft:cobblestone", totalAvailable: 64 },
    { typeId: "minecraft:stone_bricks", totalAvailable: 12 },
  ];
  queueFormResponse(player, { canceled: false, selection: 1 });
  const result = await menu.promptForBridgeMaterial(player, materials);

  assertEqual(result.materialId, "minecraft:stone_bricks", "material screen: selection maps back to the correct typeId");

  resetFormResponses();
  queueFormResponse(player, { canceled: true, cancelationReason: "UserClosed" });
  const cancelled = await menu.promptForBridgeMaterial(player, materials);
  assertTrue(cancelled.cancelled, "material screen: cancellation path reports cancelled");
}

// ---------------------------------------------------------------------------
// 8. Summary screen: MessageFormData selection 0 = Build, 1 = Cancel — the
//    distinct-buttons "no accidental construction" contract. Cancelling the
//    form itself is neither Build nor Cancel-button-pressed.
// ---------------------------------------------------------------------------
{
  resetFormResponses();
  const player = createMockPlayer({ id: "p8" });
  const summaryArgs = {
    railTypeId: "minecraft:rail",
    mode: BuildingMode.NORMAL,
    length: 20,
    direction: "north",
  };

  queueFormResponse(player, { canceled: false, selection: 0 });
  const buildResult = await menu.promptForSummary(player, summaryArgs);
  assertTrue(!buildResult.cancelled && buildResult.confirmed, "summary screen: selection 0 confirms Build");

  resetFormResponses();
  queueFormResponse(player, { canceled: false, selection: 1 });
  const cancelButtonResult = await menu.promptForSummary(player, summaryArgs);
  assertTrue(!cancelButtonResult.cancelled && !cancelButtonResult.confirmed, "summary screen: selection 1 (Cancel button) is not confirmed");

  resetFormResponses();
  queueFormResponse(player, { canceled: true, cancelationReason: "UserClosed" });
  const closedResult = await menu.promptForSummary(player, summaryArgs);
  assertTrue(closedResult.cancelled && !closedResult.confirmed, "summary screen: closing the form (not pressing either button) is cancelled, not confirmed");
}

// ---------------------------------------------------------------------------
// 9. Multiplayer isolation: two players' scripted responses never
//    cross-contaminate — Player A's mode screen never reads Player B's
//    queued response, matching Project Prompt 21's per-player UI state
//    requirement.
// ---------------------------------------------------------------------------
{
  resetFormResponses();
  const playerA = createMockPlayer({ id: "pA" });
  const playerB = createMockPlayer({ id: "pB" });
  queueFormResponse(playerA, { canceled: false, selection: 0 }); // NORMAL
  queueFormResponse(playerB, { canceled: false, selection: 2 }); // UNDERGROUND

  const [resultA, resultB] = await Promise.all([menu.promptForMode(playerA), menu.promptForMode(playerB)]);

  assertEqual(resultA.mode, BuildingMode.NORMAL, "multiplayer: player A's own selection is unaffected by player B's queue");
  assertEqual(resultB.mode, BuildingMode.UNDERGROUND, "multiplayer: player B's own selection is unaffected by player A's queue");
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed (${passed + failed} assertions total).`);
if (failed > 0) {
  console.log("\nFailures:");
  for (const failure of failures) {
    console.log(`  - ${failure}`);
  }
  process.exitCode = 1;
}
