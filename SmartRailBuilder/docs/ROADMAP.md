# Smart Rail Builder — Development Roadmap

Each milestone is built, tested by you, and confirmed before the next begins.
No milestone is "done" without a defined test pass.

> **Note on numbering:** "Project Prompt N/15" (your session counter) and "Roadmap Phase N"
> (below) are two different sequences. Project Prompt 2/15 finalized decisions for this
> roadmap's Phase 1 — it does not correspond to Roadmap Phase 2. Roadmap Phase 2 (Project
> Skeleton) is still the next actual coding milestone, whichever Project Prompt number
> that ends up being.
>
> **Update:** the "/N" total has now read 15 (Prompts 1-4), 50 (Prompts 5-9), 25
> (Prompt 10), and **30 (Prompt 15)** — four different values across eleven sessions.
> Still unconfirmed either way; flagged again in TODO.md rather than guessed at.

## Phase 1 — Foundation, Architecture & Planning ✅ (Project Prompts 1–2)
Deliverables: architecture, folder structure, roadmap, risks, and all seven open design
questions from Prompt 1 — now answered and finalized in ARCHITECTURE.md §2.
No code, no manifests, no JSON.

## Phase 2 — Project Skeleton ✅ (Project Prompt 3)
**Goal:** BP + RP install cleanly with zero functionality.
- manifest.json for BP and RP, correct script module dependencies
- Empty module files matching the approved folder structure
- `main.js` logs a single startup message
**Test:** Pack imports without errors, Content Log shows the startup message, no crashes on world load.
**Status:** All files created; import graph and startup log verified outside Minecraft via
Node (see ARCHITECTURE.md §14). **Awaiting your in-game test pass** — import both packs
into a world, confirm the Content Log shows `Ryzen Rail Builder v0.1.0 loaded — skeleton
online, no gameplay wired yet.` and that nothing else happens (correct — no gameplay is
wired up yet).

## Phase 3 — Item Detection & Menu Trigger ✅ (Project Prompt 4)
**Goal:** Holding any of the 4 rail items and activating the tool opens the length menu.
- `world.beforeEvents.playerInteractWithBlock` listener filtered to the 4 rail item IDs
  (justification for this event over alternatives: ARCHITECTURE.md §15.1)
- `BuildMenu` shows a real ModalFormData slider asking for length, titled "Ryzen Rail
  Builder" with a "Build" submit button (§15.3)
- `BuildRequestValidator` re-checks player/item/length/permission at submission time (§15.5)
- A validated request is logged (rail type + length) — **still not acted on**, per this
  phase's explicit scope
**Status:** Implemented and covered by 24/24 mocked logic tests (ARCHITECTURE.md §16).
**Awaiting your in-game test pass** — see the full manual checklist below.

### Phase 3 Manual Testing Checklist

**Basic detection (Singleplayer, Creative)**
- [ ] Hold `minecraft:rail`, use it against a block → menu opens, no vanilla rail is placed
- [ ] Repeat for `minecraft:golden_rail`, `minecraft:detector_rail`, `minecraft:activator_rail`
- [ ] Hold an unrelated item (e.g. dirt), use it against a block → no menu, block places/behaves normally
- [ ] Hold nothing (empty hand), interact with a block → no menu, normal interaction (e.g. a chest still opens)

**Menu behavior**
- [ ] Menu title reads "Ryzen Rail Builder"; slider is labeled "Railway Length"
- [ ] Slider default position matches `RailConfig.LENGTH_PRESETS.DEFAULT` (currently 32 —
  confirm this is what you want; see ARCHITECTURE.md §15.6)
- [ ] Slider only moves in steps of 32, from 32 to 512
- [ ] Submit button reads "Build"
- [ ] Closing the form (X / back gesture) does not error and does not create a request
  (check Content Log for the "cancelled the build menu" debug line)

**Validation**
- [ ] Submit the menu after switching to a different rail type mid-menu → rejected with
  the "switched items" chat message
- [ ] Submit the menu after switching to a non-rail item mid-menu → same rejection
- [ ] Submit at the slider's minimum (32) and maximum (512) → both accepted

**Repeated / rapid use**
- [ ] Hold right-click on a block with a rail item → only one menu opens, not several
- [ ] Open the menu, then (without submitting) use a rail item again → get the "already
  have a build in progress" message, no second menu
- [ ] Rapidly tap-use a rail item several times in a row → still only one menu per
  completed round trip

**Game modes**
- [ ] Survival: full flow works as above
- [ ] Creative: full flow works as above (note: Creative currently uses the same
  32–512 range as Survival — true "Unlimited" is deferred, see TODO.md)

**LAN multiplayer**
- [ ] Two players each use a rail item at the same time → each gets their own menu,
  neither is blocked by the other's in-progress request
- [ ] Player A opens the menu and leaves it open; Player B builds and finishes; Player A's
  menu is unaffected

**Edge cases**
- [ ] Open the menu, then disconnect before submitting → no crash, no error in Content Log
  (check for the "PLAYER_INVALID" debug line, no message attempted)
- [ ] Open the menu, then die before submitting → respawning should close the form
  client-side, which surfaces as a normal cancellation (same code path as closing it
  manually) — confirm no crash and no error in the Content Log. This is different from
  the disconnect case above: dying doesn't invalidate the `Player` object, so this is
  handled by the form naturally closing, not by the PLAYER_INVALID check. True mid-*build*
  cancellation-on-death (once building can take multiple ticks) is Roadmap Phase 7's
  `CancellationWatcher`, not this phase.
- [ ] Open the menu while looking at different block types (stone, grass, glass, a chest)
  → menu opens the same way regardless of what's underfoot (terrain isn't scanned yet)

### Phase 3 Addendum — Build Pipeline & Validation Framework (Project Prompt 5)
Internal refactor only — **no player-visible behavior changed**, so the checklist above
is unchanged and still applies as-is. `BuildOrchestrator`'s menu → request → validate
logic was restructured into a named, ordered `BuildPipeline` of 7 stages (adding 3 real
but not-yet-implemented stages for terrain scanning, inventory, and placement — see
ARCHITECTURE.md §17), and validation was decomposed from one class into 5 independently
pluggable validators, adding a new `GameModeValidator` (Adventure/Spectator now rejected
with a clear message, where before they'd have failed confusingly further down the
chain — worth one extra manual check if you have a moment: **hold a rail item in
Adventure mode and use it → get the "not available in this game mode" message instead of
a menu.**

## Phase 4 — Direction Detection & Railway Origin System ✅ (Project Prompt 6)
**Goal:** Correctly determine which cardinal direction to build in, and the exact origin block.
- `DirectionUtils.snapYawToCardinal` (yaw-based) determines the cardinal direction —
  switched from an earlier view-direction-based approach after self-review found a real
  numerical-stability problem at steep pitch angles; see ARCHITECTURE.md §19.1/§20.1
- `core/BuildVector.js` (new) bundles direction, forward step, and origin into one reusable
  model every future placement stage reads instead of recomputing
- `DirectionValidator`/`OriginValidator` (new) added to the validation framework
- `TerrainScanningStage` sends a "Building {direction} for {length} blocks..." confirmation
  message — this is what makes the checklist below checkable in-game
- **Status:** Implemented and covered by 47 new + 12 re-confirmed mocked test cases
  (ARCHITECTURE.md §20.2). **Awaiting your in-game test pass** — see the checklist below.

### Phase 4 Manual Testing Checklist

**Cardinal directions (Singleplayer, Creative, holding any rail item)**
- [ ] Face South (yaw ≈ 0°), use the tool → menu appears, submit → chat shows "Building
  South for N blocks..."
- [ ] Face North (yaw ≈ 180°) → "Building North..."
- [ ] Face East (yaw ≈ -90°) → "Building East..."
- [ ] Face West (yaw ≈ 90°) → "Building West..."

**Near-cardinal diagonal angles**
- [ ] Face roughly 40° off South (still mostly South) → confirms as South
- [ ] Face roughly 50° off South (now closer to East/West) → confirms as the nearer
  direction — try angles just below and just above each 45°/135°/225°/315° boundary and
  confirm the direction flips exactly where expected, not early or late

**Vertical look angle (the case this session's self-review specifically found and fixed)**
- [ ] Face South, look level → "Building South..."
- [ ] Face South, look straight down at the ground in front of you → still "Building
  South..." (this is the exact scenario that was broken with the first implementation and
  fixed before this session shipped — please confirm it actually holds in-game)
- [ ] Face South, look straight up → still "Building South..."

**Physical surroundings (should NOT change the result — terrain isn't read yet)**
- [ ] Standing directly against a wall, facing into it → menu still opens, confirmation
  message still shows the correct direction (the wall itself isn't evaluated yet)
- [ ] Standing in water → same as above
- [ ] Standing on a slab → same as above
- [ ] Standing on stairs → same as above

**Game modes**
- [ ] Creative: full flow works as above
- [ ] Survival: full flow works as above

**Multiplayer (LAN)**
- [ ] Two players facing different directions use rail items at the same time → each
  gets their own correct direction in their own confirmation message, no cross-talk

**Invalid player state**
- [ ] Open the menu, then disconnect before submitting → no crash, no error in Content Log
- [ ] Open the menu, then die before submitting → form closes naturally, no crash (see
  Phase 3's checklist note on why this differs from disconnect)

## Phase 5 — Terrain Scanner & Safety Validation (flat terrain only) ✅ (Project Prompts 7 & 11)

### Part 1: Terrain Scanner ✅ (Project Prompt 7)
**Goal:** Read and classify every planned rail position — detection only, no decisions.
- `TerrainScanner.scanPath(buildVector, length, dimension)` reads the ground block and
  the rail's own position for every one of the requested positions, classifying each as
  `FLAT_SAFE` / `HAZARD` / `LIQUID` / `GAP` / `OBSTRUCTED` / `UNLOADED` / `OUT_OF_BOUNDS`
- Always scans the full requested length — never stops at the first problem — so the
  resulting `TerrainScanResult` supports a future UI showing everything found, not just
  the first issue (ARCHITECTURE.md §21.2)
- `TerrainScanningStage` calls this for real and attaches the result to
  `context.terrainReport`. **Updated by Project Prompt 8:** on a fully clean scan
  (`buildReady === true`) the stage now advances the pipeline instead of always halting —
  this doesn't mean PathValidator exists (it still doesn't; Part 2 below is still
  unbuilt) — see ARCHITECTURE.md §24 for the full, carefully-scoped reasoning. Any scan
  with even one problem is completely unchanged: still halts, still safe.
- **Status:** Implemented and covered by 33 new + 12 re-confirmed mocked test cases
  (ARCHITECTURE.md §22.2). **Awaiting your in-game test pass** — see the checklist below.

### Part 2: PathValidator ✅ (Project Prompt 11)
**Goal:** Turn a `TerrainScanResult` into an accept/reject decision.
- Accepts a path where every position is `FLAT_SAFE`
- Rejects on the first `HAZARD`/`LIQUID` position found, with a hazard message
- Stops on the first `GAP` with a distinct "bridge required" message (automatic bridge
  construction itself is not built — Phase 5's scope is stopping safely, not building over)
- Stops on the first `OBSTRUCTED` position with a "not flat / slopes not supported yet"
  message (distinct from the gap message — same v1 rule, different player-facing reason)
- Aborts cleanly with a clear message on any `UNLOADED`/`OUT_OF_BOUNDS` position
- `TerrainScanningStage` now calls `PathValidator.validate()` for real and returns
  `VALIDATION_FAILED` with the matching `localizationKey` on rejection — this **replaces**
  the interim `buildReady` shortcut from Project Prompt 8 (see ARCHITECTURE.md §24 for
  that shortcut's history and §32 for this session's real fix). This is the confirmation
  message the player actually sees on rejection, wired up for the first time.
- **Status:** Implemented. **Awaiting your in-game test pass** — see the checklist below.
  No automated mocked-test harness was included in the uploaded project archive this
  session, so validation this session is: `node --check` on all 48 script files (passed),
  full manual code review against every existing call site, and this test checklist —
  disclosed plainly rather than reporting a test-suite pass count that wasn't actually run.

### Phase 5, Part 2 Manual Testing Checklist (PathValidator)

Unlike Part 1's checklist below, these ARE now reachable in normal gameplay — a
non-`FLAT_SAFE` path now visibly stops with a specific chat message instead of silently
halting at "future expansion."

- [ ] Completely flat terrain, full requested length → no rejection message; pipeline
  proceeds to `InventoryStage` (Content Log confirms; still halts at `PlacementStage`'s
  own downstream checks only if inventory/other stages reject it)
- [ ] Path running into water → chat shows the hazard message; construction does not begin
- [ ] Path running into lava → chat shows the hazard message; construction does not begin
- [ ] Path running across a ravine/gap (one or more `GAP` positions) → chat shows the
  "bridge required" message, distinct in wording from the hazard message
- [ ] Path running into a wall/rise (one or more `OBSTRUCTED` positions) → chat shows the
  "not flat / slopes not supported yet" message, distinct from both messages above
- [ ] Path running toward an unloaded area → chat shows the unloaded message, no crash
- [ ] Path that would exceed world height bounds → chat shows the out-of-bounds message
- [ ] Path with a hazard AND a gap both present → only the message for whichever one comes
  **first** in scan order is shown (PathValidator stops at the first violation, never
  reports more than one at a time — confirm no double message)
- [ ] Confirm `PipelineOutcome` logs `TERRAIN_FAILED` (not `PENDING_FUTURE_WORK`) for every
  rejection case above — this is the "real per-hazard rejection" TODO.md tracked as the
  next piece of work; confirming it is what proves this milestone is actually done

### Phase 5, Part 1 Manual Testing Checklist (Terrain Scanner)

Part 2 above is now real, so these ARE reachable in normal gameplay as of this session —
this note originally said otherwise; corrected rather than left stale. What you're
checking is still primarily the **Content Log**, via `Logger.info`'s per-scan summary line
("Terrain scan for X: N/M safe, H hazard(s), ..."), alongside the chat message Part 2 now
sends for anything that isn't fully clean.

- [ ] Completely flat grass terrain, full requested length → log shows `M/M safe`,
  `0 hazard(s)`, `0 elevation change(s)`
- [ ] Flat stone terrain → same as grass (ground block type shouldn't matter for safety)
- [ ] Flat sand terrain → same
- [ ] Flat gravel terrain → same
- [ ] Path running into water → log shows a nonzero hazard count (water rolls into the
  hazard bucket as `LIQUID`, distinct from lava's `HAZARD` — both count the same in the
  summary but classify differently per-position)
- [ ] Path running into lava → log shows a nonzero hazard count
- [ ] Path running across a ravine/gap → log shows a nonzero elevation-change count
- [ ] Standing on a slab, path otherwise flat → behaves identically to standing on a full
  block (confirms `Vector3Utils.floor()` handles the fractional foot position correctly)
- [ ] Standing on stairs → same as slabs
- [ ] Path crossing a chunk border → completes normally, no error (chunk borders aren't
  special-cased — each position is read independently regardless of which chunk it's in)
- [ ] Path running toward an unloaded area, if you can arrange one (e.g. render distance
  edge) → log shows a nonzero unloaded count instead of an error/crash
- [ ] Maximum configured scan length (512) → log shows `512/512` in the total, completes
  without a watchdog warning or noticeable hitch (flag it if you see either — see
  ARCHITECTURE.md §21.6 for why this is the one performance question that can't be
  answered outside actual Minecraft)

## Phase 6 — Inventory Manager & Resource Validation ✅ (Project Prompt 8)
**Goal:** Confirm the player has enough rails before anything is built — a real
accept/reject decision this time, not detection-only (contrast with Phase 5 Part 1).
- `InventoryManager.buildReport()` counts matching items across every inventory slot,
  returning a full `InventoryReport` (available/required/missing/slots)
- `ResourceValidator` compares the report against the live game mode: Creative bypasses
  quantity entirely (still requires holding the item — enforced separately, upstream, by
  `HeldItemValidator`); Survival requires an exact count
- `InventoryStage` now returns a real `VALIDATION_FAILED` with a localized,
  quantity-specific message ("You need N more.") when Survival inventory is insufficient
- **Related change, not originally part of this phase:** `TerrainScanningStage` now
  advances the pipeline on a fully clean scan instead of always halting — see
  ARCHITECTURE.md §24 for the full justification. This is what makes the checklist below
  actually reachable in-game.
- **Status:** Implemented and covered by 30 new + 19 re-confirmed mocked test cases
  (ARCHITECTURE.md §26.2). **Awaiting your in-game test pass** — see the checklist below.

### Phase 6 Manual Testing Checklist

Unlike Phase 5 Part 1, this checklist IS reachable in normal gameplay on flat terrain,
thanks to the change described above. The pipeline still halts at `PlacementStage`
afterward either way — no rail is placed yet regardless of outcome.

**Survival Mode**
- [ ] Hold exactly enough rails for the requested length, flat terrain → no rejection
  message; Content Log shows "Inventory check passed... Survival verified"
- [ ] Hold fewer rails than requested → chat shows "You don't have enough rails. You need
  N more." with the correct number
- [ ] Empty inventory (no rails at all) → same message, missing count equals the full
  requested length
- [ ] Rails split across multiple stacks/slots (e.g. 10 + 10 + 12) → counted correctly as
  their sum
- [ ] Mixed rail types in inventory (some Rail, some Powered Rail, etc.) → only the type
  you're actually holding/building counts toward the total
- [ ] Full inventory (36/36 slots occupied) with no matching rails → correctly reports 0
  available, not an error

**Creative Mode**
- [ ] Empty inventory, any requested length → no rejection; proceeds past `InventoryStage`
- [ ] Switch away from the rail item before submitting the menu → rejected earlier, by the
  existing "you switched items" message — confirms Creative still needs the item held

**Inventory changing while the menu is open**
- [ ] Open the menu, then (before submitting) drop or move your rails to a different
  slot/stack arrangement → the count at submission time reflects reality at submission
  time, not what was true when the menu opened

**Multiplayer**
- [ ] Two players with different inventory amounts build at the same time → each gets
  their own correct accept/reject result, no cross-talk

**Rapid repeated requests**
- [ ] Trigger several build attempts in quick succession (same guard behavior as prior
  sessions) → still only one in-flight request per player; inventory is re-read fresh
  for each one, not reused from an earlier attempt

### Addendum — Pipeline Integration & Creative Mode Review (Project Prompt 9)
This session didn't add new gameplay capability — it confirmed every system built across
Phases 2-6 works together end-to-end, and added a request lifecycle, standardized outcome
categories, and non-spammy actionbar progress feedback on top. See ARCHITECTURE.md §27
for the full review, including why "Build Menu / Build Request Creation / Direction
Detection" stay one stage rather than three despite the requested diagram showing them
separately.

**Manual Testing Checklist (Project Prompt 9)**

- [ ] Full successful run (Survival, sufficient rails, flat terrain) → actionbar shows,
  in sequence: "Preparing railway..." → "Analyzing terrain..." → "Checking
  inventory..." → "Validation successful." Only ONE chat message appears (the direction
  confirmation) — confirm no chat spam from the 4 actionbar updates
- [ ] Insufficient rails → actionbar sequence stops after "Checking inventory..." (no
  "Validation successful."); chat shows the direction confirmation, then the rejection
  message
- [ ] Creative Mode, zero rails, clean terrain → identical actionbar sequence to a fully-
  resourced Survival run, all the way through "Validation successful."
- [ ] Creative Mode, switched away from the rail item → rejected before any of the new
  actionbar messages appear (still caught by the existing item-changed check)
- [ ] Two players building at the same time, one with enough rails and one without →
  each sees only their own actionbar/chat sequence, no cross-talk
- [ ] Invalid rail item (holding e.g. dirt) → no menu, no actionbar sequence at all
- [ ] Cancel the menu → no actionbar sequence begins (it starts at ValidationStage, which
  never runs if the menu was cancelled)
- [ ] Rapid repeated requests → same single-in-flight-request guard as always; no
  overlapping or interleaved actionbar sequences for the same player
- [ ] Maximum build length (512) → full actionbar sequence still completes normally
- [ ] Invalid/unrecoverable direction — not practically triggerable through normal play
  (direction detection can't currently fail under real conditions), so this is confirmed
  by test only, not manually testable in-game; see ARCHITECTURE.md §27 for the test coverage

## Phase 7 — Core Straight Rail Placement (Creative first) ✅ (Project Prompt 10)
**Goal:** The first fully working version — rails actually appear in the world.
- `RailBuilder` + `StraightRailStrategy` place rails via a `system.runJob` generator,
  bridged to a `Promise` via `yield*` delegation (ARCHITECTURE.md §30.2)
- `BuildSession` (now constructed from a `BuildRequest`, as always planned) +
  `CancellationWatcher` (finally wired for real) stop a build cleanly on player leave,
  dimension change, death, or game mode change, keeping whatever was already placed
- Rail orientation set explicitly via `BlockPermutation` (`rail_direction` +
  `rail_data_bit` for powered variants) — **not** relying on vanilla auto-connection; see
  ARCHITECTURE.md §30.8 for why, and for the one meaningfully unconfirmed assumption in
  this session's work (the exact Bedrock state names, sourced from a community reference)
- New `FinalSafetyCheckStage` between inventory validation and placement, plus a
  per-block re-check during placement itself — three independent safety layers, each
  covering a different window of time (§30.3/§30.4)
- Real Survival resource consumption: `InventoryManager.deductRailItems` removes exactly
  what was used, only after each block is confirmed placed, never rolling back
- **Status:** Implemented and covered by 55 new + 41 strengthened-regression test cases
  (ARCHITECTURE.md §31). **Your in-game test pass is more important than usual this
  session** — see the checklist below, and start with the orientation checks specifically.

### Phase 7 Manual Testing Checklist

**Rail orientation and connection (test these FIRST — see ARCHITECTURE.md §30.8)**
- [ ] Build a short (5-10 block) straight rail heading South → visually connects as a
  straight line, minecart rides smoothly end to end
- [ ] Repeat facing North, East, West → all four orientations look and function correctly
- [ ] Repeat with Powered Rail, Detector Rail, and Activator Rail → all visually correct
  in their default (unpowered) state

**Build lengths**
- [ ] 1 rail → completes instantly, no progress messages (below the minimum threshold)
- [ ] 10 rails → completes normally
- [ ] 64 rails → progress actionbar updates appear every 8 blocks, no stutter
- [ ] 128 rails → same, no watchdog warning
- [ ] Maximum configured length (512) → completes without a watchdog warning or
  noticeable server hitch (flag it if you see either)

**Survival Mode**
- [ ] Build with exactly enough rails → inventory slot fully empties, build completes
- [ ] Build with a large surplus → exactly the used amount is deducted, remainder untouched
- [ ] Build that would exceed available rails partway through → stops exactly where
  resources run out, keeps everything placed before that point, sends a clear message
- [ ] Confirm no item duplication and no item loss across several repeated builds

**Creative Mode**
- [ ] Build with zero rails in inventory → completes fully, nothing deducted
- [ ] Confirm every other check (terrain, direction, holding the item) still applies

**Multiplayer**
- [ ] Two players building simultaneously → each build proceeds independently, no
  cross-talk, no interference between the two placements

**Chunk borders**
- [ ] Build a railway that crosses a chunk border → completes normally, no error

**Invalid placement**
- [ ] Start a build, then have another player or a command break/change a block ahead on
  the path before the builder reaches it → the per-block re-check stops construction
  there, keeps what was placed, reports the reason

**Cancelled build**
- [ ] Start a long build (128+), then disconnect → construction stops, no crash, no error
  in the Content Log
- [ ] Start a long build, then change dimension → construction stops immediately
- [ ] Start a long build, then die → construction stops immediately
- [ ] Start a long build, then switch game mode → construction stops immediately, and any
  remaining Survival deduction behavior switches correctly if resumed in a different mode

## Phase 8 — Survival Resource Consumption ✅ (pulled forward into Project Prompt 10)
**Goal:** Tie inventory deduction to confirmed placement, with zero dupe/loss risk.
- Deduct exactly one item per block actually placed, only after placement is confirmed
- On interruption: keep every rail already placed, deduct only for those, never refund,
  never roll back, show a clear warning (finalized policy — no longer an open question)
- **Status:** implemented alongside Phase 7 rather than as a separate session, since
  placement and resource consumption were requested together this session. See Phase 7's
  checklist above — its Survival Mode section covers exactly this phase's test goal.
**Test:** Item count removed always equals blocks placed; forcing an interruption never dupes or deletes extra items and never refunds already-consumed items; repeated builds behave consistently.

## Phase 9 — Feedback, Progress & Logging Polish
**Goal:** Every state the player can hit has clear, localized feedback.
- `ProgressReporter` sends throttled actionbar updates ("Building Railway... 38 / 256") on long builds
- Success summary (blocks placed, rail type, direction)
- All error paths routed through `LocalizationKeys` + `en_US.lang`
- `Logger` event vocabulary (SCANNER_STARTED, PATH_REJECTED, CONSTRUCTION_CANCELLED, etc.) wired through every module, config-gated off by default
- **Mostly complete now, pulled forward across Prompts 9-10** (see the addendum after
  Phase 6, and Phase 7's checklist above): `MessageService.sendActionBar` is real, the 4
  pre-build actionbar progress messages exist, and — new this session —
  `ProgressReporter`'s throttled *numeric* progress ("Building Railway... 38 / 64") is
  real too, since `RailBuilder` now exists. The final "build complete" success message
  (`CONSTRUCTION_COMPLETE`) is also real, sent by `CompletionStage`. What's left for this
  phase specifically: a full audit that every remaining failure path across every phase
  has a `Logger` event-vocabulary line, and confirming the logging-disable flag with a
  full 512-block build once slopes/tunnels/bridges introduce more failure paths to check.
**Test:** Every failure path (Phases 3–8) produces a distinct, correct message; progress updates smoothly and without spam on a 256-block build; disabling the logging flag silences all debug output with zero behavior change.

## Phase 10 — Singleplayer + LAN Safety Pass
**Goal:** Confirmed v1 scope is Singleplayer and LAN Multiplayer (not dedicated servers).
- Per-player build lock via `BuildSession` registry (prevent double-activation)
- Handle overlapping build paths between two LAN players
- Confirm all four `CancellationWatcher` triggers behave correctly with a second player present
**Test:** Two LAN clients building simultaneously never corrupt each other's rail; a
disconnect mid-build leaves the world in a consistent, non-broken state for everyone else
still connected.

## Phase 11 — Smart Slope Detection & Automatic Rail Climbing ✅ (Project Prompt 11, pre-Phase-12 work)
**Goal:** Support terrain that rises or falls by exactly 1 block, automatically — no player
prompt, no separate confirmation. Anything steeper stays a clean rejection (tunnels/bridges
are Phase 12+).
- `TerrainScanner` scans sequentially: each position's Y is resolved relative to the
  previous position's, trying flat first, then a ±1 step, before giving up
- New classifications `ASCENDING`/`DESCENDING` (buildable) replace the old `GAP`/`OBSTRUCTED`
  (which always rejected); a new `UNSUPPORTED` classification covers anything steeper than
  ±1, or an immediate direction reversal (see KNOWN LIMITATION below)
- `PathValidator` treats `FLAT_SAFE`/`ASCENDING`/`DESCENDING` as equally buildable
- Rail placement picks the correct `rail_direction` block state per block — flat, or one of
  4 ascending states — computed explicitly, not left to (unconfirmed) vanilla auto-connection
- **Real bug found and fixed in the same session:** `PlacementStage` was independently
  recomputing a flat-only path instead of using the terrain report slopes were validated
  against — would have silently placed every rail at the wrong height. Fixed before ever
  shipping. See ARCHITECTURE.md §36.4.
- **KNOWN LIMITATION, disclosed not hidden:** an immediate reversal — a single-block peak
  (up then straight back down) or valley (down then straight back up), with no flat block
  at the top/bottom — is rejected as `UNSUPPORTED` rather than attempted. A real sloped rail
  block can only tilt one way; representing a 1-block peak needs a flat block at the summit,
  which this phase doesn't yet insert automatically. A gentle, gradually-changing landscape
  is unaffected; a single sharp spike is not supported yet.
- **Status:** Implemented, verified against 25 assertions across 9 scenarios in a mocked
  Node test harness (flat, single ascend, single descend, continuous staircase, too-steep,
  peak-rejection, hazard-mid-flat, hazard-in-pit, placement-time re-check consistency) — see
  ARCHITECTURE.md §36.5. **Awaiting your in-game test pass** — see the checklist below.
- **HIGHEST-RISK UNCONFIRMED ASSUMPTION IN THE PROJECT:** which `rail_direction` integer
  (2-5) corresponds to which ascending compass direction could not be confirmed against an
  official, version-pinned source — see `builder/RailPermutationBuilder.js`'s "ASCENDING
  RAIL DIRECTION MAPPING" comment for the full disclosure. If wrong, ascending rails will
  visually face backwards (not crash) — **the very first slope test below checks this.**

### Phase 11 Manual Testing Checklist
- [ ] **Build a single 1-block ascending step first, alone, nothing else.** Visually confirm
  the rail tilts the correct way (climbing in your direction of travel) before testing
  anything more complex — this is the test for this session's highest-risk assumption above
- [ ] Single 1-block descending step, same visual check, tilting the correct way
- [ ] A short staircase (3+ consecutive 1-block rises) — confirm every step is sloped, no
  gaps, no flat blocks awkwardly inserted mid-staircase
- [ ] A short staircase down, same check
- [ ] Flat → ascend → flat (an isolated single step, landing flat on both sides)
- [ ] Flat → descend → flat, same
- [ ] Mixed: flat, then up, then flat, then down, then flat, all in one build
- [ ] A 2+ block rise (wall) → rejected with the "too steep" message, no partial slope attempt
- [ ] A 2+ block drop (cliff) → same rejection, same message
- [ ] A 1-block peak (up then immediately down, no flat block between) → rejected as
  UNSUPPORTED per the known limitation above — confirm the message is the same "too steep"
  text, not a crash or a broken half-built slope
- [ ] Water or lava encountered exactly where a descend would go → the hazard message, not
  a generic "too steep" — confirms the more-specific-message logic works
- [ ] Survival Mode: rails still deduct one at a time, sloped blocks cost the same as flat
- [ ] Creative Mode: unaffected, unlimited as before
- [ ] Maximum build length (64) crossing multiple slopes — confirm no watchdog warning

## Phase 12 — Intelligent Tunnel Detection & Excavation ✅ (Project Prompt 13, pre-Phase-13 work)
**Goal:** when a rise is more than 1 block (too tall for a simple ascend), automatically
bore a level tunnel through it instead of rejecting outright — bounded by a search limit,
never touching unbreakable blocks, stopping safely on hazards.
- `TunnelDetector` searches forward for a level exit; `TunnelPlanner` turns a successful
  search into buildable `TUNNEL`-classified positions carrying their own excavation data;
  `TunnelExcavator` does the actual block-breaking at placement time, with its own
  narrow re-check (the same "state can change mid-build" principle already applied to
  terrain/inventory)
- New `UnbreakableBlockRegistry.js` (bedrock, barrier, structure blocks, etc.) — a curated
  list, deliberately not a dynamic API query, given this project's `Block.isSolid` lesson
  (§34) about not trusting an unconfirmed runtime property for a safety-critical decision
- Excavation gives no loot and consumes no tool durability — a deliberate scope
  interpretation, not an oversight (see ARCHITECTURE.md §37.4)
- **Known, disclosed limitation:** an internal floor gap partway through a tunnel (a cave
  or air pocket the bore line happens to cross) is rejected rather than floor-filled
- **Real bug found via the mocked test harness, not manual review:** the tunnel exit
  condition originally required solid ground at the exit itself, incorrectly rejecting a
  wall immediately followed by a legitimate drop. Fixed — see ARCHITECTURE.md §37.5.
- **Status:** Implemented, verified against 41 total assertions (25 carried over from
  Phase 11 unchanged, 16 new tunnel scenarios) in the same mocked Node harness. **Awaiting
  your in-game test pass.**

### Phase 12 Manual Testing Checklist
- [ ] Small hill (2-3 blocks tall) → tunneled through automatically, rails appear level
      the whole way through
- [ ] Large hill (well within the 32-block search limit) → same, longer tunnel
- [ ] A hill combined with an earlier slope in the same build → both work, no interference
- [ ] Bedrock (or any world-border/bottom bedrock layer) blocking the bore →
      "unbreakable" message, no partial tunnel, no crash
- [ ] Water encountered inside a hill → hazard message, stops safely
- [ ] Lava encountered inside a hill → hazard message, stops safely
- [ ] A hill too wide to tunnel through within the search limit → "too long" message
- [ ] Gravel/sand directly above the bored path → confirm no unexpected cave-in/collapse
      behavior (this addon only removes the exact planned blocks — see ARCHITECTURE.md
      §37 excavation-rules note — but gravity-affected blocks reacting to the new air
      pocket is vanilla Minecraft behavior, not something this addon controls; just
      confirming it doesn't cause a build failure)
- [ ] Multiplayer: two players tunneling in different areas simultaneously
- [ ] Survival Mode: rails still deduct correctly through a tunnel; no items granted for
      excavated blocks
- [ ] Creative Mode: unaffected
- [ ] Maximum build length (64) including a tunnel — confirm no watchdog warning

## Phase 13 — Architecture Review, Refactoring & Bridge Foundation ✅ (Project Prompt 13)
**Goal:** review every completed system for maintainability/coupling/risk, resolve fixable
technical debt, and build the reusable foundation bridges will eventually need — without
placing a single bridge block.
- Full per-system review in ARCHITECTURE.md §38.5 — findings ranged from "no debt found"
  to two concrete, now-resolved duplication issues (§38.4: a block-read helper duplicated
  across 3 files, extracted to `utils/BlockReader.js`; hazard/unbreakable ID sets rebuilt
  independently in 3 files, now built once and exported directly)
- Bridge foundation: `BridgePlan`, `BridgeDetector`, `GapAnalyzer`, `BridgeValidation`,
  and an explicit `BridgeExecutionStrategy` placeholder (using this project's established
  stub convention, not a silent no-op) — all built, all correct in isolation, **none
  wired into any accept/reject decision** — see ARCHITECTURE.md §38.1, the load-bearing
  discipline this entire session's bridge work rests on
- Enhanced classification: `PathCategory` (Flat/Slope/Tunnel/Bridge/WaterCrossing/
  Unsupported), a simplified summary layer on top of the existing detailed
  classification, purely informational
- **Status:** Implemented and verified — 55 total assertions in the same mocked harness
  (41 carried over unchanged, 14 new gap/bridge/category scenarios). All refactoring
  re-confirmed to change zero observable behavior. **Awaiting your in-game test pass** —
  though this session's changes are almost entirely informational/foundational, so
  regression risk is low; the main thing to confirm is that ordinary builds (flat,
  slopes, tunnels) still work exactly as before.

### Phase 13 Manual Testing Checklist
- [ ] **Regression: repeat a handful of Phase 11 and Phase 12 tests** (a flat build, a
      slope, a tunnel) to confirm the technical-debt refactor changed nothing observable
- [ ] A drop of more than 1 block over open air → still rejected with the same "too
      steep" message as before (informational gap data must not change this)
- [ ] A drop of more than 1 block over a shallow depression → same rejection
- [ ] A drop of more than 1 block over water → same rejection (a "water crossing" is
      detected internally but changes nothing about the outcome yet)
- [ ] A ravine (deep drop) → same rejection
- [ ] Multiplayer: unaffected
- [ ] A long-distance scan (near maximum length, 64) crossing a gap → confirm no
      performance hitch from the new gap-analysis pass
- [ ] Maximum build length in general → unaffected

## Phase 14 — Peak/Valley Reversals Buildable via Tunnel Reuse ✅ (Project Prompt 14)
**Goal:** fix the disclosed Phase 11 limitation where an immediate reversal (a 1-block
peak or valley) was always rejected, even though a true single-block spike/dip needs no
excavation at all — the rail can simply crest it.
- A reversal now first attempts the ordinary ±1 resolution (ascend/descend) that would
  normally follow; only if that fails does it fall back to a real tunnel attempt at the
  post-reversal height, reusing all of Phase 12's tunnel machinery unchanged
- `TunnelConfig.MAX_SEARCH_LENGTH` raised 32 → 64, matching the overall build-length cap,
  after your in-game testing showed real mountains needing 20+ tunneled blocks
- **Three real mistakes were made and caught during this session's own development** —
  documented in full, procedural detail in ARCHITECTURE.md §39.2 rather than only
  presenting the final clean result, because each was only found by actually executing
  code and tracing real output (including one that produced a live crash), not by
  re-reading a diff and judging it correct
- **Confirmed by you in-game:** a flat build and a separate 14-tunnel build both
  completed successfully — the reversal fix itself is genuinely sound

### Phase 14, Second Round — Tunnel Budget Decoupled From Requested Length ✅
Your in-game testing then surfaced a DIFFERENT bug, not the reversal fix: `TUNNEL_TOO_LONG`
on mountains that had plenty of room against the 64-block ceiling but not within the
originally requested (often shorter) build length. Traced precisely: a tunnel's search
budget was tied to `requestedLength - i`, not the absolute ceiling — shrinking based on
unrelated earlier terrain in the same build, even at a full 64-length request.
- **Confirmed with you directly, two decisions:** (1) a tunnel should get its own fresh
  budget against the absolute ceiling, independent of the original request; (2) the
  total build may extend past what was originally requested — up to that same 64-block
  ceiling, never beyond it — if a tunnel genuinely needs the room
- Two more real bugs found and fixed as a DIRECT consequence of allowing builds to grow:
  `InventoryStage` was checking resources against the stale original request (would have
  under-counted rails needed for a grown build); `BuildSession.targetLength` — a more
  serious one — governed both the build loop's continue condition and its own
  `completed` check, so a stale value would have made a fully successful, tunnel-grown
  build silently stop early or report itself as failed. Full account in ARCHITECTURE.md §40.
- **Status:** Implemented, verified — the exact reported bug shape (32-length request,
  20-block tunnel needed) directly reproduced and confirmed fixed in the mocked test
  harness, alongside confirming the absolute ceiling is still genuinely enforced, never
  silently bypassed. 71 total assertions, all passing. **Awaiting your in-game test pass.**

### Phase 14 Manual Testing Checklist
- [ ] A genuine 1-block spike (a single block taller than its surroundings) → crested
      automatically, no tunnel, no rejection
- [ ] A genuine 1-block dip (a single block lower than its surroundings) → crested
      automatically, same
- [ ] Re-test the exact mountain scenario that showed `TUNNEL_TOO_LONG` at a SHORT
      requested length (e.g. 32) — confirm the build now succeeds and extends past what
      was requested, rather than failing
- [ ] Confirm the "Building N blocks..." message and the final completion message both
      show the ACTUAL number of blocks built (which may be more than what you selected
      in the menu, if a tunnel needed the extra room) — not the original menu selection
- [ ] Try a mountain wide enough that even the full 64-block ceiling isn't enough —
      confirm it still fails cleanly with a clear message, not a crash or silent overrun
- [ ] Survival Mode with a tunnel that grows the build: confirm you're not left short on
      rails partway through — the inventory check should already account for the grown
      total, not just what you originally requested
- [ ] Regression: a handful of plain flat/slope/tunnel builds, confirming this fix
      changed nothing about cases that were already working

## Phase 15 — Three Building Modes & Unified Build Configuration UI ✅ (Project Prompt 15)
**Goal:** replace the single-length-slider menu with a real choice of how the railway
gets built — NORMAL (existing straight/slope/tunnel behavior), BRIDGE (elevated,
1-16 block height), or UNDERGROUND (excavated, 1-64 block depth) — plus one
authoritative, centralized build configuration all three modes share, so future modes
never require rewriting the UI or pipeline. Configuration, UI, and validation only, per
the prompt's explicit scope limit — the real Bridge/Underground construction engines are
Phases 16/17 below, not this phase.
- `config/BuildModes.js` (new): `BuildingMode` enum + one registry (`BUILD_MODE_REGISTRY`)
  driving mode selection, mode-aware validation, and pipeline gating — a future mode is
  one registry entry, not a rewrite across 4 files
- `BuildRequest` extended with `buildingMode`/`bridgeHeight`/`undergroundDepth` rather
  than a new, second "BuildConfiguration" class — it already was the prompt's requested
  "one authoritative configuration" since Project Prompt 5; see ARCHITECTURE.md §41.3
- `BuildMenu.js` rewritten as a 3-screen flow (mode select → configuration+length →
  build summary with dedicated Build/Cancel) — adapts the prompt's 5 conceptual steps
  into 3 actual form round trips; rail type is shown as context, not re-asked, since
  it's already determined by the player's held item
- New `ModeAvailabilityStage`: stops a fully-valid Bridge/Underground request cleanly,
  with an honest player message, immediately after validation — since `TerrainScanner`
  only understands NORMAL-mode terrain rules today and the real engines aren't built yet
- New `ModeConfigValidator`: registry-driven bounds check (bridge height 1-16, default
  3; underground depth 1-64, default 5) — never trusts the form slider's bounds alone
- **A real, unrelated bug found and fixed while touching manifests for this session:**
  `Constants.js`'s reported version had drifted three releases behind the actual
  manifest version, and the Resource Pack's own manifest version had independently never
  been bumped at all since Phase 2. All now aligned. Full writeup: ARCHITECTURE.md §41.10.
- **Status:** Implemented. 45 new mocked-harness assertions covering the mode registry,
  `BuildRequest`'s new fields (including confirming a value passed for the WRONG mode is
  correctly discarded, never leaks through), `ModeConfigValidator`'s exact boundary
  values from this phase's own testing checklist below, and `ModeAvailabilityStage`'s
  gating — all passing. `node --check` clean. **`BuildMenu.js`'s actual form screens and
  `BuildRequestCreationStage.js`'s orchestration of them are NOT covered by the mocked
  harness** (both need a live player / `@minecraft/server-ui`) — code-reviewed only.
  **Awaiting your in-game test pass**, full checklist below.

### Phase 15 Manual Testing Checklist
NORMAL:
- [ ] Select Normal → set length → confirm build summary shows the right rail/length/
      direction, no height or depth row → build succeeds exactly as before this session
- [ ] Cancel at the mode screen, the configuration screen, and the summary screen
      (three separate tests) — confirm each closes cleanly with no build starting
- [ ] Invalid length (0, negative, above the configured maximum) — confirm rejected with
      a clear message, same as before this session

BRIDGE (configuration/validation only — no construction yet):
- [ ] Height 1, height 8, height 16 — each accepted through to the summary screen
- [ ] Height 17, height 0, negative height — each rejected with a clear message
- [ ] Reach the summary screen with a valid height, press Build — confirm you get an
      honest "Bridge Mode isn't buildable yet" message, not silence, a crash, or an
      ordinary NORMAL-mode build happening instead
- [ ] Cancel at every screen

UNDERGROUND (configuration/validation only — no construction yet):
- [ ] Depth 1, depth 32, depth 64 — each accepted through to the summary screen
- [ ] Depth 65, depth 0, negative depth — each rejected with a clear message
- [ ] Reach the summary screen with a valid depth, press Build — confirm the same honest
      "not buildable yet" message as Bridge above
- [ ] Cancel at every screen

MULTIPLAYER:
- [ ] Two players configuring simultaneously — different modes, different heights/
      depths, different rail types — confirm no cross-talk between them
- [ ] One player cancels while the other continues — confirm no effect on either

EDGE CASES:
- [ ] Player disconnects, dies, changes dimension, changes held rail, or changes game
      mode mid-flow — confirm no crash and no stray/duplicate build
- [ ] Trigger the menu, then trigger it again rapidly before the first flow finishes —
      confirm the existing double-menu guard still blocks it (should be unaffected by
      this session, but worth reconfirming against the new 3-screen flow specifically)

## Phase 16 — Bridge Construction Engine ✅ (Project Prompt 16)
> **⚠️ SUPERSEDED by the Pre-Prompt-18 Bug-Fix Pass below.** This entry is kept,
> unmodified, as an accurate historical record of what Phase 16 actually shipped —
> but two real bugs were found in it during testing (no gradual climb; a solid wall
> instead of a real bridge structure), and the design described here was substantially
> rewritten. Read this section for history; read the Bug-Fix Pass section for what the
> addon actually does today.

**Goal:** make a valid Bridge-mode request (height already collected and validated by
Phase 15) actually buildable. Delivered as: one fixed-elevation bridge for the whole
requested length (`railY = origin.y + bridgeHeight`, computed once, see
ARCHITECTURE.md §44.2), with a support column placed under each rail position only
where terrain doesn't already reach the deck — NOT the Phase 13 foundation's original
"auto-bridge over one detected gap" model, which turned out not to fit Phase 16's actual
requirements once they were concrete (full design decision: ARCHITECTURE.md §44.3).
- New `terrain/TerrainScanner.js` method `planBridge()`, `builder/strategies/BridgeExecutionStrategy.js`
  implemented for real (supports → surface → rails, per Project Prompt 16's exact
  construction order), new `builder/BridgeSupportBuilder.js` (mirrors
  `TunnelExcavator.js`'s shape, as that file's own header predicted)
- `terrain/BridgePlan.js`/`terrain/BridgeValidation.js` redesigned (both were dead code
  with zero callers) into their real, exercised shapes; `BridgeDetector.js`/
  `GapAnalyzer.js` deliberately left untouched — they serve a different, unrelated,
  already-live NORMAL-mode diagnostic purpose (ARCHITECTURE.md §44.1)
- One material (`minecraft:cobblestone`) for support/surface blocks this session — no
  style/material selection yet, per Project Prompt 16's explicit scope limit
- `BUILD_MODE_REGISTRY.BRIDGE.implemented` is now `true` — `ModeAvailabilityStage` no
  longer stops a Bridge-mode request
- **Status:** Implemented. 39 assertions against `planBridge()`'s real algorithm (mocked
  terrain) + a new 29-assertion end-to-end integration suite (real pipeline stage
  classes, a mutable fake world, a real inventory container — confirming actual block
  placement, exact inventory deduction, Creative bypass, ordered resource checks, a
  mid-build cancellation preserving placed blocks) — all passing. Full existing Phase 15
  suite re-run with zero real regressions. `node --check` clean. **Not yet confirmed
  in-game** — full manual checklist below, reproducing Project Prompt 16's own requested
  test matrix.

### Phase 16 Manual Testing Checklist
Heights: 1, 2, 4, 8, 12, 15, 16 (all should succeed on suitable terrain) — 17 (must be
rejected by the config screen itself, before a build is even attempted).

Terrain: flat ground, a small gap, a ravine, a valley, a water crossing, mixed terrain
along one build. For each: confirm continuous support beneath the whole railway, no
floating rail blocks, and (where terrain already reaches deck height) that a full pillar
wasn't built unnecessarily right there.

Rail types: Rail, Powered Rail, Detector Rail, Activator Rail — each should build and
orient the same way Normal Mode already does.

Game modes: Creative (should ignore both rail and material quantities), Survival with
exactly enough of both rail and material, Survival with insufficient rails specifically,
Survival with insufficient material specifically (three separate tests — confirm each
gives a distinct, correct rejection message and that NOTHING is placed for any of them).

Terrain hazards: a support column that would need to pass through lava (must reject
before construction, never silently solved); a bridge height that would put the deck
underwater (must reject, not attempt an underwater railway).

Chunk boundaries: a bridge whose length crosses into an unloaded chunk.

Interruption: cancel mid-build, die mid-build, disconnect mid-build, change dimension
mid-build — for each, confirm blocks placed before the interruption remain (no
automatic rollback) and the interruption is reported accurately.

Multiplayer: two players building bridges simultaneously with different heights/
lengths/materials-on-hand — confirm complete isolation between them.

Maximum configured length at various heights.

## Phase 17 — Advanced Underground Mode: Depth 1–64 ✅ (Project Prompt 17)
> **⚠️ Depth cap changed by the Pre-Prompt-18 Bug-Fix Pass below: maximum depth is now
> 20, not 64.** Everything else in this entry (the ramp/flat-run design, the entry
> strategy, the reuse of Phase 11/12 machinery) is unchanged and still accurate — only
> the number changed, in one place (`BUILD_MODE_REGISTRY.UNDERGROUND.max`). Kept as an
> accurate historical record of the depth this phase originally shipped with.

**Goal:** make a valid Underground-mode request (depth already collected and validated by
Phase 15) actually buildable. Delivered as: a continuous descending ramp from the surface
to the requested depth, then a flat run at that depth, with corridor excavation for both
planned up front (`railY = origin.y - depth`, the exact mirror of Bridge Mode's formula
about the same reference point — ARCHITECTURE.md §45.1).
- New `terrain/TerrainScanner.js` method `planUnderground()`; new
  `builder/strategies/UndergroundExecutionStrategy.js`, `terrain/UndergroundPlan.js`,
  `terrain/UndergroundValidation.js`, `config/UndergroundConfig.js`, `config/OreRegistry.js`
- **Entry strategy:** rails descend exactly 1 block per block travelled, so reaching depth
  D costs D ramp positions. No shaft, no ladder, no discontinuity. Consequence: a build
  needs `length >= depth + 1`, making 63 the deepest reachable depth in one build; depth
  64 is rejected with the length it would need rather than silently clamped
  (ARCHITECTURE.md §45.2 for alternatives considered)
- **Reuse over reinvention:** the ramp uses the existing Phase 11 slope shapes unchanged,
  and excavation is `TunnelExcavator` unchanged (now a shared instance) — no new rail
  geometry and no new excavation code was written this session
- **Ore policy:** default `PROTECT_VALUABLE` — diamond/emerald/ancient debris reject the
  plan before anything is modified; common ores are excavated but counted and reported.
  Two alternative policies implemented, one constant away (ARCHITECTURE.md §45.6)
- `BUILD_MODE_REGISTRY.UNDERGROUND.implemented` is now `true` — all three permanent modes
  are live
- **Status:** Implemented. 71 assertions against the real planning algorithm + a
  48-assertion end-to-end integration suite (including NORMAL/BRIDGE regression, mode
  isolation, multiplayer, all four rail types, cancellation) — all passing. One real bug
  (misleading rejection message for lava/water under the rail) found and fixed by those
  tests before shipping. `node --check` clean across 73 files. **Not yet confirmed
  in-game** — checklist below.

### Phase 17 Manual Testing Checklist
Depths: 1, 2, 5, 16, 32, 48, 63 (should succeed given enough length and suitable terrain)
— 64 (must be rejected, with a message naming the length it would need) — 65 (must be
rejected by the config screen itself, before a build is attempted).

The length/depth relationship specifically: try depth 16 with length 10 (must reject with
a clear "needs at least 17 blocks" message), then the same depth with length 32 (should
build). This is the single most important new behaviour to confirm.

Terrain: flat land, hills, mountains, and specifically through stone, dirt, deepslate,
gravel, sand, ores, near water, near lava, down to bedrock, and through an existing cave
or ravine (should reject with the unsupported-floor message rather than leaving floating
rails). Confirm sand/gravel above the corridor falling in is understood as a known
limitation, not a bug.

Ore behaviour: build through a common ore (should succeed and report the count on
completion) and through a diamond/emerald vein (should reject before modifying anything,
naming the block).

Rail types: Rail, Powered Rail, Detector Rail, Activator Rail — all four, and confirm the
ramp's sloped rails visually connect correctly (this doubles as the long-outstanding
visual check of the `rail_direction` assumption, ARCHITECTURE.md §30.8).

Game modes: Creative (ignores rail quantity), Survival with exactly enough rails,
Survival with insufficient rails (must leave the world **completely unexcavated**).

Interruption: cancel, die, disconnect, and change dimension mid-build — each should stop
safely, keep what was already built, and report accurately.

Mode isolation: build Bridge, then Underground, then Normal in sequence and confirm each
uses only its own setting.

Multiplayer: two players building underground simultaneously at different depths, with
different rail types and directions; one cancelling while the other continues.

Performance: maximum length (64) at depth 63 — the true worst case; confirm no lag spike
or watchdog warning.

## Pre-Prompt-18 Bug-Fix Pass — Bridge Redesign, Material Selection, Tunnel Clearance, Rail Crossing ✅
**Goal:** fix four real, reported problems found by testing Phases 16/17, without
restarting or re-architecting either. Project Prompt 18 was explicitly NOT started this
session — see TODO.md.

**1. Bridge elevation + solid wall (one root cause, two symptoms).** `planBridge()`
rewritten: a real ascending ramp, a flat crest, a real descending ramp, instead of one
fixed elevation for the whole span. Minimum length is `2×height + 3` — derived from the
fact that a single rail block cannot be the peak of both an up-ramp and a down-ramp at
once, so a genuine flat crest block is mandatory; this is stricter than the naive
`2×height + 1` a "just needs to get up and back down" count would suggest, and was
verified by hand before any code was written. Separately: full support columns are now
built only at piers (index 0, the last index, every 4th index by default) — everywhere
else, the deck simply floats between piers, exactly like a real pier bridge. Both the
elevation fix and the pier fix were needed; neither alone would have produced a
recognizable bridge. Full derivation: ARCHITECTURE.md §46.2.

**2. Bridge material selection.** The player now picks their own material from their
current inventory (new `InventoryManager.scanPlaceableMaterials()` + a new `BuildMenu`
screen) instead of always building with a fixed cobblestone default. No quantity entry —
the addon calculates exactly how many are needed from the plan. ARCHITECTURE.md §46.6.

**3. Underground tunnel dead end.** `planUnderground()` now reserves one extra
full-clearance landing position past the last rail (best-effort, never fails the plan),
so a player riding to the end always has somewhere to stand. NORMAL mode's separate
hill-tunnel system was reviewed and found not to share this defect. ARCHITECTURE.md §46.3.

**4. Rail crossing / connection.** New `config/RailConfig.js` export `RAIL_ITEM_ID_SET`;
an existing rail is now recognized as passable during scanning/planning in all three
modes, and preserved (never overwritten, never deducted for) by every execution
strategy. ARCHITECTURE.md §46.5.

**Also changed:** Underground Mode's maximum depth, 64 → 20 (one number,
`BUILD_MODE_REGISTRY.UNDERGROUND.max`). ARCHITECTURE.md §46.4.

**Status:** All four fixed and covered by new automated tests — 26 assertions against
the rewritten `planBridge()` algorithm, 20 assertions for material scanning/underground
depth/landing buffer/rail-crossing-at-the-scanning-layer, and a 32-assertion end-to-end
integration suite (real pipeline classes, a mutable fake world, a real inventory
container) confirming a full bridge build with a player-chosen material produces the
correct geometry and materials in the actual world, an existing rail survives a crossing
build in both BRIDGE and NORMAL mode, and Underground's landing buffer is genuinely
excavated. One real bug was found and fixed in the shipped code itself (a stale logging
reference, caught by cross-checking rather than a test failure); three test assertions
across two suites were also found to be wrong on their first run and corrected — full
honest accounting in ARCHITECTURE.md §46.10. `node --check` clean across all 73 files.
**Not yet confirmed in-game.**

### Bug-Fix Pass Manual Testing Checklist
BRIDGE (all replace the Phase 16 checklist above, which tested the old design):
- [ ] Height 1, 5, 10, 16 — confirm a REAL gradual climb (not an instant jump), a flat
      section crossing the gap, and a real gradual descent back down at the far end
- [ ] A short length that's below the new `2×height+3` minimum — confirm a clear
      rejection stating the actual minimum length needed, not a generic error
- [ ] Visually confirm the bridge looks like a real bridge — a deck with periodic piers,
      NOT a solid wall/sheet of blocks
- [ ] Build with at least 3 different materials from inventory (e.g. cobblestone, stone
      bricks, oak planks) — confirm the material screen shows only blocks you're
      actually carrying, with correct amounts, and the finished bridge uses the block
      you picked
- [ ] Attempt a bridge with zero placeable blocks in inventory — confirm a clear message,
      no crash, no empty form
- [ ] Attempt a bridge with insufficient chosen material — confirm nothing is built and
      the message states what's needed vs. what you have

UNDERGROUND:
- [ ] Depth 20 (new maximum) and depth 21 (must be rejected by the config screen)
- [ ] Ride/walk to the very end of an underground railway — confirm a proper landing
      space, not a dead end flush against a wall

RAIL CROSSING:
- [ ] Build a NORMAL railway that crosses an existing railway (yours or another
      player's) at a right angle — confirm the existing rail is untouched and your new
      railway continues on both sides of the crossing
- [ ] Repeat with a BRIDGE build crossing an existing railway near ground level
- [ ] Test with all 4 rail type combinations crossing each other (Rail+Rail,
      Powered+Rail, Detector+Rail, Activator+Rail)

REGRESSION:
- [ ] NORMAL straight railway and one-block slopes still work exactly as before
- [ ] Two players building bridges simultaneously with different materials and heights —
      confirm complete isolation
- [ ] Two players with independent underground depths — confirm complete isolation

## Phase 18 — Underwater Railway & Water-Safe Construction (Project Prompt 18) — COMPLETE (awaiting in-game confirmation)

Status: water is no longer an automatic rejection anywhere. Normal Mode safely builds
through a single shallow layer of water over solid ground (a puddle/ford/shallow
stream), and clearly rejects — pointing to Bridge or Underground Mode — anything deeper,
whether that's water stacked at rail level or a drop into open water (the latter reuses
`GapAnalyzer`'s existing `WATER_CROSSING` gap type, wired to a player message for the
first time this session). Bridge Mode now passes over water instead of rejecting a deck
or headroom position that happens to be wet — piers already correctly rose through a
water column to real ground (Project Prompt 16's design), the only real gap was two
premature rejections upstream of that. Underground Mode excavates through a water pocket
and seals the lateral/roof faces it bordered (a thin, corridor-shaped seal, never a
massive structure) instead of rejecting the whole plan or letting the tunnel flood; a
liquid FLOOR is still correctly rejected outright (sealing doesn't fabricate a floor over
nothing), and lava remains fully protected in every mode, unconditionally, regardless of
the water changes. See ARCHITECTURE.md §47 for the complete design, including two real
bugs found and fixed via this session's own new test harness before shipping, and
`tests/README.md` for how to run it (55 assertions, all passing, `node --check` clean).

### Phase 18 Manual Testing Checklist
NORMAL MODE + WATER:
- [ ] Small water crossing (a single shallow puddle/stream, solid floor) — confirm the
      rail is placed straight through it, no rejection
- [ ] Shallow water (exactly one block deep) vs. deep water (two+ blocks stacked at rail
      level) — confirm the shallow case builds and the deep case rejects with a message
      naming Bridge/Underground Mode specifically
- [ ] Step off a bank into a large/deep body of water with no floor nearby — confirm the
      same clear "use Bridge or Underground" message, not a generic "too steep" one
- [ ] Confirm NO large body of water is ever auto-drained/filled by a rejected attempt

BRIDGE MODE + WATER:
- [ ] Build a bridge whose deck passes directly over/through a lake or river — confirm
      no rejection, and confirm the water is NOT drained/filled unnecessarily
- [ ] Build a low bridge whose deck sits exactly at the water's surface — confirm it
      still builds correctly
- [ ] Confirm piers still visibly rise up through the water to real ground below

UNDERGROUND MODE + WATER:
- [ ] Tunnel beneath a lake/pond — confirm the tunnel interior stays completely dry
      (no water dripping/flowing in) end to end
- [ ] Tunnel that enters and exits a body of water along its length — confirm both
      transitions are clean, no flooding, no one-block obstruction
- [ ] Confirm a liquid FLOOR (open water directly beneath the planned rail, no ground)
      is still correctly rejected, not silently built over
- [ ] Confirm lava anywhere along the route still aborts the build safely — no automatic
      lava tunnels under any circumstances

RAIL TYPES + TRANSITIONS:
- [ ] All 4 rail types (Rail, Powered, Detector, Activator) through a shallow water
      crossing and through an Underground water-sealed section
- [ ] Normal → water → Bridge, Normal → water → Underground, Bridge → water → Bridge,
      Underground → water → Underground, Normal → Bridge → Normal, Normal → Underground
      → Normal — confirm no missing/floating rails, no water in the player's path

REGRESSION (must still work exactly as before):
- [ ] Plain NORMAL straight railway and one-block slopes on dry land
- [ ] Bridge gradual climb/crest/descent and lightweight pier structure (Phase 16/
      bugfix-pass behavior)
- [ ] Underground landing buffer at the tunnel's end, max depth 20
- [ ] Existing-rail crossings still preserved in all three modes
- [ ] Two players building through water simultaneously — confirm complete isolation

## Phase 19 — Smart Terrain Adaptation & Rail Connectivity (Project Prompt 19) — COMPLETE (awaiting in-game confirmation)

Status: reviewed every terrain/rail behavior Project Prompt 19 asked about against the
actual implementation rather than assuming gaps — most of it (one-block slopes, existing
rail preservation, strict mode isolation, order-independent rail placement, per-player
multiplayer isolation) was already correct, and is now covered by real, executing tests
for the first time, including at the EXECUTION level (not just planning) via a new
test-only `@minecraft/server` mock. Two genuine small gaps were found and closed:
Normal Mode now gives a specific "unbreakable terrain" message for a floating
obstruction directly at the rail's own spot (previously generic "too steep"), and now
checks one additional block of headroom above the rail so a build no longer silently
plans a rail directly beneath a 1-block-low overhang. See ARCHITECTURE.md §48 for the
complete write-up, including why neither new check short-circuits the existing
ascend/tunnel fallback machinery (letting a real player-like "climb over it" solution
be tried first is the smarter, more "carefully built railway" behavior, not a bug) and
a real bug this session's own test harness caught and fixed in itself before it could
give a false negative on real code.

### Phase 19 Manual Testing Checklist
TERRAIN:
- [ ] Completely flat terrain, a one-block hill, a one-block depression — unchanged
      from Phase 11, confirm still smooth
- [ ] A multi-step staircase (several consecutive one-block rises) — confirm a real,
      continuous climb, no floating rails, no gaps
- [ ] A steep, THIN obstruction (should auto-tunnel) vs. a genuinely un-tunnelable one
      (solid/unbreakable, wide) — confirm the first bores through and the second
      rejects cleanly with a specific message, never a sudden vertical jump
- [ ] A single floating unbreakable block (e.g. exposed bedrock) directly in the path,
      with open space just above it — confirm the build now climbs over it automatically
      rather than rejecting
- [ ] A rail position with solid ceiling exactly 1 block above it (a low overhang) —
      confirm this is now rejected with a specific "not enough clearance" message,
      not silently built with a rider clipping into the ceiling

RAILS / INTERSECTIONS:
- [ ] Cross an existing hand-built rail with a new Normal Mode railway — confirm the
      existing rail's shape/orientation is completely undisturbed after the new build
      finishes (this is the one thing this session's Node-only tests cannot confirm —
      see ARCHITECTURE.md §48.6's disclosed neighbor-update-side-effect uncertainty)
- [ ] Repeat crossing at a T-junction and a perpendicular intersection
- [ ] Cross each of the 4 rail types with a new build using a DIFFERENT rail type
- [ ] Build a new railway that crosses ANOTHER completed build from this addon (two
      generated railways meeting) — confirm both remain intact and connected on both sides

STARTING / ENDING RAIL:
- [ ] Start a build directly facing a wall/bedrock/low ceiling — confirm a specific,
      accurate rejection message, and confirm the player's facing direction (not some
      other direction) is what's reported
- [ ] Confirm the very first and very last rail of an ordinary build are not rotated
      or connected in an unexpected direction

REGRESSION (must still work exactly as before):
- [ ] Bridge Mode: gradual ascent, height 1-16, material selection + automatic quantity
- [ ] Underground Mode: depth 1-20, tunnel clearance, waterproof tunnels
- [ ] Underwater support (Phase 18) — shallow crossings, Bridge-over-water, Underground
      water sealing
- [ ] Cancellation (leave/dimension change/death/game mode change) still stops a build
      cleanly and immediately
- [ ] Two players building simultaneously (including near/through each other) — confirm
      complete isolation and no corruption from either build

## Phase 20 — Pre-Prompt-21 Integration Test (Project Prompt 20) — COMPLETE (awaiting in-game confirmation)

Status: full integration/stabilization pass, no new features. This session read every
remaining unreviewed script file in the addon for the first time in the project's
history — `main.js`'s full dependency graph, the complete `BuildPipeline` stage order,
every validator, `ui/BuildMenu.js`, the tunnel-detection subsystem, and every small
utility file — and found three small, safe bugs from cross-session interactions: a
`TerrainPositionFact` shape inconsistency in `TunnelPlanner.js` (missing 3 fields added
by Project Prompts 18-19), one stale doc comment, and one fully dead code file. All
three fixed. The pipeline wiring itself (`RailDetectionStage` through `CompletionStage`)
was traced end to end and confirmed correct, not redesigned. A new test file,
`tests/integration.test.mjs`, builds the exact same dependency graph `main.js` does and
runs the real `BuildPipeline` end to end for all three modes plus four rejection paths
plus a two-player multiplayer scenario — the first test in this project to verify the
WIRING itself, not just individual pieces. See ARCHITECTURE.md §49 for the complete
write-up, including two real bugs this session's own new tests caught in themselves
(wrong assumed coordinates, under-provisioned mock terrain/inventory) before being
trusted. **A new, testable `.mcaddon` was packaged and delivered this session** — version
0.1.13. 191 assertions across 4 test files, all passing; `node --check` clean.

### Phase 20 Manual Testing Checklist
See this session's final report (delivered alongside the `.mcaddon`) for the complete,
numbered Minecraft PE testing checklist covering all three modes, all four rail types,
lengths 1/5/20/64, bridge heights 1/4/8/12/16, underground depths 1/5/10/15/20/21
(rejection), underwater scenarios, all rail-intersection geometries, Survival/Creative
resource behavior, cancellation, and multiplayer — organized by this session's own
Test Scenarios 1-13.

## Phase 21 — Polished Mobile UI & Build Configuration (Project Prompt 21) — COMPLETE (awaiting in-game confirmation)

Status: UI/text/validation polish pass, no engine or architecture rebuild. The existing
4-screen flow (mode → \[bridge material\] → configuration → summary) was confirmed to
already satisfy the prompt's flow/mobile-UX/cancellation/multiplayer-isolation
requirements structurally — no screen was added, removed, or reordered. Real, concrete
fixes made: three player-facing `.lang` strings that had gone factually stale (claiming
Bridge/Underground were still "coming in a future update," years after both shipped);
canonical terminology unified to "Length"/"Height"/"Depth"/"Material" everywhere per the
Accessibility requirement; validation messages rewritten to the "Required: X / Available:
Y" two-line format (rails and, newly, the named bridge material); a duplicated
material-display-name formatter consolidated into one shared `utils/BlockDisplayName.js`;
the summary screen now shows "Required Rails" pre-confirmation (cheap, already known) and
the real Bridge material quantity is revealed honestly in a new post-confirmation chat
line — once TerrainScanningStage has actually run — rather than fabricated before it,
respecting the Performance requirement against scanning the world just to draw a form. A
new `@minecraft/server-ui` test mock and `tests/uiMenu.test.mjs` finally close the one gap
flagged in every session since Project Prompt 18: `ui/BuildMenu.js` is now covered by 25
real assertions, including a structural proof that Bridge Height/Underground Depth can
never be set to 0 or out-of-range values. See ARCHITECTURE.md §50 for the complete
write-up. **A new, testable `.mcaddon` was packaged and delivered this session** — version
0.1.14. 216 assertions across 5 test files, all passing; `node --check` clean.

### Phase 21 Manual Testing Checklist
See this session's final report (delivered alongside the `.mcaddon`) for the complete,
numbered 16-item Minecraft PE testing checklist covering the mode screen, each mode's
configuration screen, material selection and its automatic calculation, out-of-range
rejection, cancellation, the build summary's accuracy, Survival vs. Creative, and two
simultaneous players.

## Phase 22 — Smart Build Preview, Validation & Safety (Project Prompt 22) — COMPLETE (awaiting in-game confirmation)

Status: a consolidation and hardening pass on top of the existing pipeline, not a redesign —
the conceptual flow (UI → BuildConfiguration → BuildPlan → TerrainScanner → PathValidator →
InventoryValidator → FinalValidation → Construction) was already exactly this project's
`RailDetectionStage → ... → CompletionStage` chain; this session gave that chain a real,
consolidated `BuildPlan` object and closed its one remaining async-staleness gap. New:
`core/BuildPlan.js` (the complete build plan — rail type, mode, positions, terrain info,
required rails/material, and a world modification boundary — assembled from data the pipeline
had already computed, no new scans); a new `BuildPlanStage`, running immediately before
`PlacementStage`, that re-checks player validity, dimension, held item, and inventory one
final time (the one real gap in "immediately before construction, revalidate everything" —
`FinalSafetyCheckStage` already re-scanned terrain/plans, but nothing re-checked those four);
`core/ActiveBuildRegistry.js`, a new multiplayer safety net claiming a build's exact
modification boundary so two players' builds can never silently overlap (rejected outright
with zero blocks placed, never a silent corruption); and `config/ValidationErrorCategory.js`,
mapping every existing internal rejection reason onto the prompt's 13 named categories without
touching any existing player-facing message. One real bug found and fixed:
`ResourceValidator` always reported "INSUFFICIENT_RAILS" even when checking bridge material.
See ARCHITECTURE.md §51 for the complete write-up, including the one genuine, disclosed
tension between this session's own requirements (§1/§8's exact "Required Blocks: 84" summary
example vs. §12's performance rule) and how it was resolved — the same direction Project
Prompt 21 already chose, for the same reason. **A new, testable `.mcaddon` was packaged and
delivered this session** — version 0.1.15. 275 assertions across 6 test files, all passing;
`node --check` clean across 79 script files.

### Phase 22 Manual Testing Checklist
See this session's final report (delivered alongside the `.mcaddon`) for the complete,
numbered 20-item Minecraft PE testing checklist covering valid builds in all three modes,
every boundary/invalid case (height/depth 0 and out-of-range, insufficient rails/material),
an underwater tunnel, build cancellation, a long build, Survival vs. Creative, and a
two-player test including an inventory change before final confirmation.

## Phase 23 — Performance, Stability & Long-Build Optimization (Project Prompt 23) — COMPLETE (awaiting in-game confirmation)

Status: an audit pass across the entire pipeline (event listener → UI → BuildConfiguration →
BuildPlan → TerrainScanner → PathValidator → InventoryManager → RailBuilder → resource
transaction → MessageService), fixing what was genuinely inefficient and confirming — not
silently skipping — what was already sound. Two real fixes: `InventoryManager.hasAtLeast()`
replaces four full-container inventory scans (one per per-block placement loop across all
three modes) with an early-exit threshold check, keeping the same live, uncached read
guarantee while reducing iteration in the common case; and a practical performance-metrics
line (planning/construction duration, required rails/material, positions modified) added to
`CompletionStage`'s existing single completion log line — no new per-block logging. Confirmed
sound, not rewritten: `system.runJob` generator pacing (already yields at a sensible
granularity for this project's real 64-length ceiling), terrain caching inside `BuildPlan`
(done in Project Prompt 22), block-write minimization (already correct by construction —
excavation skips already-clear blocks, bridge/underground fill positions are pre-filtered at
planning time), `BuildPlan`'s memory footprint (measured at a maximum of 161 positions for the
heaviest realistic build — trivially small), and the API surface (no deprecated calls, no
unhandled promises, no unbounded loops). New test coverage closes a real, previously-unproven
gap: mid-construction cancellation was only ever tested via `CancellationWatcher`'s own
flag-setting, never that a strategy's GENERATOR actually stops promptly with the correct
partial state — now proven directly for all three modes, plus job lifecycle (a fresh build
starts cleanly right after a previous one completes or is cancelled) and a 3-player
simultaneous load test. See ARCHITECTURE.md §52 for the complete write-up, including real
Node-harness performance measurements (explicitly labeled as such, not real Minecraft tick
timing) and a test-authoring mistake this session's own tests caught and fixed before being
trusted. **A new, testable `.mcaddon` was packaged and delivered this session** — version
0.1.16. 319 assertions across 7 test files, all passing; `node --check` clean across 79
script files.

### Phase 23 Manual Testing Checklist
See this session's final report (delivered alongside the `.mcaddon`) for the complete,
numbered 22-item Minecraft PE testing checklist covering build lengths, all three modes at
their real boundary values, an underwater railway, rail intersections, Survival/Creative
resource behavior, cancellation, disconnect, death, two-player simultaneous builds, and
repeated builds (including immediately after a cancelled one).

## Phase 24+ — Reserved for Future Features (planned only when reached)
Underground tunnel lighting (see ARCHITECTURE.md §45.12 — the finished tunnel is
currently dark and will spawn mobs; worth a deliberate decision) · cave-floor filling for
Underground Mode (BridgeSupportBuilder is the natural reuse) · curved rails · undo
system · blueprint save/load · rail templates · additional localization · accessibility
improvements · dedicated-server-specific optimization (deferred per decision #7) ·
additional building modes beyond the three permanent ones (e.g. a future "Blueprint" or
"Curve" mode — `config/BuildModes.js` was built in Phase 15 specifically so adding one
of these is a registry entry, not a rewrite) · sealing Underground's best-effort landing
buffer against water too (currently just omitted when unsafe, see ARCHITECTURE.md
§47.10) · a wider (not just lateral) waterproof shell for large aquifer pockets, if
in-game testing shows the current thin seal is ever insufficient · an actual undo/rollback
mechanism built on top of Project Prompt 22's world modification boundary (§51.4), now that
every build's exact touched-position set is a real, inspectable value · raising
`LENGTH_PRESETS.MAX_SURVIVAL` past 64, if in-game testing of this session's performance work
shows headroom for it (a deliberate decision, not a default to change casually).

Each of these gets the same treatment as Phases 2–15: design discussion first, one
milestone at a time, your testing before moving on.
