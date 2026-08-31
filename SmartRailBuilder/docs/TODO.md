# TODO — Smart Rail Builder (formerly Ryzen Rail Builder)

## ⚠️ Needs Your Confirmation
1. **Branding: full break from "Ryzen," or was "Ryzen Smart Rail Builder" meant instead?**
   This session explicitly renamed the product to "Smart Rail Builder," which was done
   exactly as asked — but this addon was previously part of a "Ryzen"-branded portfolio
   (RyzenVeinMiner, RyzenBackpacks, RyzenMap+, etc., per established project context).
   Proceeded with the literal instruction; flagging the portfolio-consistency question in
   case a full break wasn't intended. See CHANGELOG.md's Project Prompt 10 entry. Still
   unresolved as of Project Prompt 15 — the new build summary/mode screens use "Smart
   Rail Builder" consistently, not "Ryzen Rail Builder" (which is how Project Prompt
   15's own document header refers to the project) — see TODO note below.
2. **Default railway length: 256 or 32?** Currently **32**. One-line change either way.
3. **Project length: 15, 50, or 25 sessions?** Prompts 1-4 read "N/15." Prompts 5-9 read
   "N/50." Prompt 10 reads "N/25." **Project Prompt 15 reads "N/30"** — a fourth distinct
   total across eleven sessions. Proceeded on the newest number; still unconfirmed.
4. **Rail orientation — please verify visually in-game.** This session's placement engine
   sets `rail_direction`/`rail_data_bit` block states sourced from a community reference,
   not an official Microsoft document (none could be found). If rails don't connect or
   orient correctly in-game, this is the first place to look. See ARCHITECTURE.md §30.8.
5. **Form body substitutions and `\n` line breaks in forms — please verify visually
   in-game (Project Prompt 15).** The new build-summary screen is the first place this
   project has used `{translate, with}` (real substitutions, not just a bare key) on a
   form's `.body()`, and the first place `.lang` values use literal `\n` for line breaks
   inside a form. Both are common, expected-to-work patterns, but neither had been
   exercised anywhere in this codebase before this session. If the summary screen shows
   raw `%1$s` placeholders or one run-on line instead of a formatted list, see
   ARCHITECTURE.md §41.8 for where to look.
6. **Bridge Mode — please run the full manual testing checklist (Project Prompt 16).**
   This is the first genuinely new construction engine since the original NORMAL-mode
   pipeline — thoroughly tested by mocked harness (68 new assertions between the
   planning-algorithm suite and a real end-to-end integration suite, see
   ARCHITECTURE.md §44.9) but never run against a live client. Full checklist:
   ROADMAP.md's Phase 16 entry.
7. **`player.dimension`/`Dimension.id` — please verify visually (Project Prompt 22).** New
   pipeline stage `BuildPlanStage` reads a dimension's own `.id` for the first time in this
   project's history, to detect a player changing dimension immediately before construction.
   Documented as a real, stable Bedrock API property, but not previously exercised anywhere
   in this codebase. Non-blocking if wrong: at worst this specific check misses a dimension
   change, still caught mid-build by the existing, unchanged `CancellationWatcher`. See
   ARCHITECTURE.md §51.13.
8. **`PROTECTED_STRUCTURE_BLOCK_IDS` — please review the list (Project Prompt 24).**
   `config/UnbreakableBlockRegistry.js`'s new curated list of chests/crafting stations/doors/
   beds/signs/etc. this addon now never excavates or builds through. Same "flagged for
   review, one-line change to add or remove an entry" convention as the hazard/unbreakable
   lists (items #1/#5 above) — not claimed to be exhaustive of every block a player might
   consider "their structure." See ARCHITECTURE.md §53.2/§53.7.

## Resolved Questions — Summary (full detail in ARCHITECTURE.md, sections noted)
- **Prompts 2, 4-9** (§§2, 15, 17, 19, 21, 23-24, 27): see prior TODO history in
  CHANGELOG.md — pipeline/validation architecture, direction detection, terrain scanning,
  inventory validation, lifecycle/outcome tracking, actionbar feedback, all finalized.
- **Prompt 10** (§30): rail orientation computed explicitly (not vanilla auto-connection);
  every block re-verified during placement, not just once upfront (state can change
  during a multi-tick build, same principle already applied to inventory); a new
  `FinalSafetyCheckStage` added between inventory validation and placement, distinct from
  both the original scan and the per-block re-check; `CancellationWatcher` finally wired
  for real; product renamed (see flag #1 above).
- **Prompt 15** (§41): three-mode architecture is registry-driven (`config/BuildModes.js`)
  so future modes need no rewrite; `BuildRequest` extended rather than a new competing
  "BuildConfiguration" class introduced (full reasoning §41.3); UI flow adapted from the
  prompt's 5 conceptual steps into 3 actual form round trips, documented and justified
  (§41.4); a real, unrelated version-drift bug (`Constants.js`/both manifests
  disagreeing) found and fixed while touching manifests anyway (§41.10).
- **Bugfix session, between Prompts 15/16** (§§42–43): ground decoration (grass,
  flowers, etc.) no longer blocks rail construction — new
  `config/ReplaceableBlockRegistry.js`; `.mcaddon` packaging fixed to the confirmed-
  correct two-`.mcpack`-files structure, `docs/` no longer included in it.
- **Prompt 16** (§44): Bridge Mode fully implemented — one fixed-elevation bridge for
  the whole railway (not per-gap auto-bridging, see §44.3 for why), one authoritative
  height formula (§44.2), Phase 13's dead-code `BridgePlan`/`BridgeValidation`
  redesigned into their real shapes while the LIVE `BridgeDetector`/`GapAnalyzer`
  (unrelated NORMAL-mode diagnostic purpose) were deliberately left untouched (§44.1).
- **Prompt 17** (§45): Underground Mode fully implemented — descending ramp then flat
  run, one authoritative depth formula that mirrors Bridge Mode's height formula about
  the same reference point (§45.1); the length-must-exceed-depth constraint is
  geometric, not a limitation, and is reported clearly rather than clamped (§45.2);
  ramp geometry and excavation both reuse existing Phase 11/12 machinery unchanged; a
  two-tier ore policy protects irreplaceable finds while keeping deep tunnels usable
  (§45.6); a real bug (misleading lava/water-under-rail message) was found and fixed by
  this session's own tests before shipping.
- **Pre-Prompt-18 Bug-Fix Pass** (§46): Bridge Mode substantially redesigned — a real
  ascending/flat/descending ramp instead of one fixed elevation, and lightweight piers
  instead of a full support column at every position, fixing both the "no gradual
  climb" and "solid wall" bugs from one shared root cause (§46.2); bridge material is
  now player-chosen from inventory, not fixed (§46.6); an existing rail crossing a new
  railway is now preserved rather than overwritten, in all three modes (§46.5);
  Underground Mode's tunnel no longer ends in a flush wall (§46.3); Underground's
  maximum depth lowered to 20 (§46.4).

## Remaining Open Questions (low-stakes — fine to defer or leave to my judgment)
1. **Hazard block list** — populated in `config/HazardRegistry.js`. Please review.
2. **Pack icons** — `pack_icon.png` still not generated.
3. **Creative "Unlimited" length UI** — deferred. Needs a dropdown.
4. ~~`isAboveReplaceable` conservatism~~ — **FIXED**, bugfix session between Prompts 15/16.
   You reported this in-game (grass blocking rail formation) before it was ever acted on
   from this list. See ARCHITECTURE.md §42. New: **`config/ReplaceableBlockRegistry.js`
   block list — please review**, same as the hazard/unbreakable registries (item #1).
5. **`block.isSolid` stability** — one source flagged this as possibly still subject to
   change. Watch for it; no action needed now.
6. **Logging verbosity before release** — `Constants.LOGGING.MIN_LEVEL` defaults to
   `"DEBUG"`. Fine for testing; raise to `"INFO"`/`"WARN"` before any release build.
7. **`rail_direction`/`rail_data_bit` state names** — the single highest-risk unconfirmed
   assumption in the project so far. Please verify visually. Project Prompt 26 closed the
   one remaining gap in this assumption's OWN internal consistency (the ascending
   `rail_direction` mapping — 2=east, 3=west, 4=north, 5=south — had only ever been
   unit-tested for `north`; all four are now tested and agree with each other), but this
   does NOT confirm the mapping is correct against real Bedrock — only that the addon is
   now internally consistent across all four directions. Still needs your visual
   confirmation.
8. **`.mcaddon` packaging structure — FIXED**, bugfix session between Prompts 15/16.
   You reported "not a valid archive" — root cause and fix in ARCHITECTURE.md §43.
   **Please confirm the rebuilt `.mcaddon` actually imports** before anything else gets
   tested, since nothing in Phase 15 could be tested at all while this was broken.
9. **Underground ramp clearance (3 blocks vs. 2) — Project Prompt 17.** Ramp positions
   excavate one extra block of headroom versus flat ones, since a minecart sits higher
   on a sloped rail. If in-game testing shows 2 is plainly sufficient, dropping this is
   a one-line change in `config/UndergroundConfig.js`'s `SLOPE_LEVEL_CLEARANCE`. See
   ARCHITECTURE.md §45.5.
10. **No tunnel lighting yet — Project Prompt 17.** A finished Underground railway is
    completely dark and will spawn hostile mobs in it. Not requested this session, and
    genuinely worth a deliberate decision (torches every N blocks? glowstone in the
    floor? leave it to the player?) rather than a default picked without your input.
    Flagged as the top candidate for the next small session, not started.
11. **Underground ore policy default (`PROTECT_VALUABLE`) — please review.** Diamond/
    emerald/ancient debris block a build outright; common ores are excavated and
    reported. Two alternative policies (`PROTECT_ALL`, `EXCAVATE_ALL`) are fully built
    and one constant away in `config/UndergroundConfig.js` if you'd prefer a different
    default. See ARCHITECTURE.md §45.6.
12. **Bridge material button icons — please verify visually (Pre-Prompt-18 Bug-Fix Pass).**
    The material-selection screen's buttons use a best-effort `textures/items/<name>`
    icon path — confirmed to work for some vanilla items, not confirmed for every
    possible block a player might be carrying. Non-blocking if wrong (the button's text
    and selection still work, only the icon graphic might be missing) — but worth a
    look. See ARCHITECTURE.md §46.7.
13. **Bridge pier spacing (every 4th position) — please review.** No specific number was
    requested; 4 was chosen as a reasonable visual default. One constant,
    `BridgeConfig.PIER_SPACING`, if you'd prefer piers closer together (sturdier-looking,
    more blocks) or farther apart (more minimal, fewer blocks).
14. **Bridge ramp clearance (3 blocks vs. 2) — Pre-Prompt-18 Bug-Fix Pass.** Same
    reasoning and same one-line fix as item #9 above, now also applied to Bridge Mode's
    ascending/descending ramp sections. See `config/BridgeConfig.js`'s
    `RAMP_LEVEL_CLEARANCE` and ARCHITECTURE.md §46.2.

## ⚠️ Order Note (Bugfix Session, between Project Prompts 15 and 16)
Project Prompt 16 (Bridge Mode) was uploaded this same turn but **intentionally not
started**. Two real bugs were reported from testing Phase 15's delivered build — one
(`.mcaddon` not importable) meant Phase 15's new UI couldn't be tested in-game at all
yet, and starting Prompt 16 (a large session building directly on top of Phase 15's
`BuildConfiguration`/pipeline changes) before that milestone is confirmed working would
violate this project's own "in-game confirmation required before the next phase begins"
rule. Fixed both bugs this session instead; Prompt 16 is queued and ready to start as
soon as you've had a chance to reimport and retest. See CHANGELOG.md's Bugfix Session
entry and ARCHITECTURE.md §§42–43.

## ⚠️ Order Note (Project Prompt 15)
Project Prompt 15's own document header calls the project "Ryzen Rail Builder" and
describes the immediate next step as continuing "exactly where the previous session
ended" — but the handoff doc's next step ("Phase 15: bridge placement") and this
prompt's actual content (three-mode configuration/UI foundation, real bridge/underground
engines explicitly deferred to Prompts 16/17, roadmap expanded 25→30) are two different
scopes. Flagged before starting, proceeded on the prompt's own detailed instructions
rather than the shorter handoff summary — see ARCHITECTURE.md §41.1 for the full
reconciliation. "Smart Rail Builder" branding (Prompt 10's rename) was kept, not
reverted to "Ryzen Rail Builder," consistent with flag #1 above still being open.

## ⚠️ Order Note (Project Prompt 13)
Project Prompt 13 originally requested the architecture review + bridge foundation
directly, listing "Tunnel System" among systems to review. Flagged before starting: Phase
12 (tunnels) had never been built — no code for it existed anywhere. You chose to build
Phase 12 first, then Prompt 13. Both are done, in this session, documented together in
CHANGELOG.md's Project Prompt 13 entry and ARCHITECTURE.md §37 (tunnels) / §38 (review +
bridge foundation).

## ⚠️ Order Note (Project Prompt 11)
Project Prompt 11 originally requested Roadmap Phase 11 (slope detection) directly.
Flagged before starting: `PathValidator` (Phase 5 Part 2) was still an unbuilt stub, Phase
10 hadn't been started, and ROADMAP.md's own Phase 11+ section calls for design discussion
before starting that work — none of that had happened yet. You chose: finish PathValidator
(flat-only) first, then move to slopes. That's what this session did. **Phase 10 remains
open and was consciously deferred, not forgotten** — see below.

## Completed — Roadmap Phase 14: Peak/Valley Reversals via Tunnel Reuse ✅
- [x] Immediate reversals (1-block peaks/valleys) now try the ordinary ±1 resolution
      first, falling back to a real tunnel only if that fails — see ARCHITECTURE.md §39
- [x] `TunnelConfig.MAX_SEARCH_LENGTH` raised 32 → 64, matching the overall build cap
- [x] 3 real mistakes made and caught during this session's own development, fully
      documented in ARCHITECTURE.md §39.2 (not hidden or smoothed over) — including one
      that produced a live crash, caught by actually running the code
- [x] **Confirmed by you in-game:** a flat build (5 ascending/3 descending) and a
      14-tunnel build both completed successfully — the reversal fix itself is sound

## Completed — Roadmap Phase 14 (second round): Tunnel Budget Decoupled From Requested Length ✅
- [x] Root cause found from your fresh Content Log: `TunnelDetector`'s search budget was
      tied to `requestedLength - i`, not the absolute 64-block ceiling — shrinking based
      on unrelated earlier terrain in the same build, even at a full 64-length request
- [x] Confirmed with you directly: a tunnel gets its own fresh budget against the
      absolute ceiling; the total build may extend past what was requested (up to that
      same ceiling) if a tunnel needs the room
- [x] Two more real bugs found and fixed as a direct consequence of allowing builds to
      grow: `InventoryStage` under-counting resources against the stale original
      request; `BuildSession.targetLength` — more seriously — could have made a fully
      successful, tunnel-grown build stop early or misreport itself as failed
- [x] A genuine leftover `ReferenceError` bug caught by a full-codebase grep after the
      first pass of fixes, not assumed complete — see ARCHITECTURE.md §40
- [x] The exact reported bug shape directly reproduced and confirmed fixed in the mocked
      test harness; the absolute ceiling separately confirmed still genuinely enforced
- [x] 71 total assertions, up from 65
- [ ] **Awaiting your in-game test pass** — see ROADMAP.md's Phase 14 checklist,
      especially retesting the exact mountain from your original Content Log report

## Completed — Roadmap Phase 12 (Tunnels) & Phase 13 (Review + Bridge Foundation) ✅
- [x] `TunnelDetector`/`TunnelPlanner`/`TunnelExcavator` — full tunnel system, see
      ARCHITECTURE.md §37
- [x] Real bug found via the mocked test harness and fixed: `TunnelDetector`'s exit
      condition (§37.5)
- [x] Full per-system architecture review, findings in ARCHITECTURE.md §38.5
- [x] Two technical debt items found and resolved: duplicated block-read logic (extracted
      to `utils/BlockReader.js`), duplicated hazard/unbreakable Set construction
      (centralized in each registry) — see §38.4
- [x] Bridge foundation: `BridgePlan`, `BridgeDetector`, `GapAnalyzer`, `BridgeValidation`,
      `BridgeExecutionStrategy` placeholder — none wired into any accept/reject decision,
      see §38.1
- [x] `PathCategory` — simplified 6-category classification layer, informational only
- [x] 55 total assertions in the mocked test harness (up from 25 at the start of this
      arc), all passing, including immediately after the technical-debt refactor
- [ ] **Awaiting your in-game test pass** — see ROADMAP.md's Phase 12 and Phase 13
      checklists

## Completed — Pre-Phase-12 Fixes: Length Range, Substitutions Bug (Project Prompt 12 pre-work) ✅
- [x] `LENGTH_PRESETS`: MIN 32→1, MAX_SURVIVAL 512→64, STEP 32→1, DEFAULT unchanged (32)
- [x] Real bug fixed: `ValidationStage` now passes `substitutions` through (was silently
      dropping them, unlike `InventoryStage`); `LengthValidator` now attaches `[MIN, MAX]`
- [x] "Area not loaded past 64 blocks" explained (simulation vs. render distance) and
      resolved as a consequence of the range cap — full writeup in ARCHITECTURE.md §35
- [x] "Vanish completely if removed" confirmed already true — no persistent storage used
      anywhere in the addon (grep-confirmed); placed rails correctly remain, by design
- [x] Manifest bumped to 0.1.2 (now 0.1.4 — see below)
- [x] Confirmed working by you ✅

## Completed — Roadmap Phase 11: Smart Slope Detection & Automatic Rail Climbing ✅
- [x] `TerrainScanner` extended with sequential Y resolution and rail-shape resolution
- [x] `ASCENDING`/`DESCENDING`/`UNSUPPORTED` classifications replace `GAP`/`OBSTRUCTED`
- [x] `PathValidator` treats all three buildable classifications as safe
- [x] `RailPermutationBuilder.buildAscendingRailPermutation()` added (highest-risk
      unconfirmed assumption in the project — see ARCHITECTURE.md §36.3)
- [x] `StraightRailStrategy` picks the correct permutation per block
- [x] Real bug found and fixed: `PlacementStage` was recomputing a flat-only path instead
      of using the validated terrain report — see ARCHITECTURE.md §36.4
- [x] Known limitation disclosed: immediate peak/valley reversals rejected, not attempted
- [x] Confirmed working by you ✅ (including the ascending-direction visual check)

## Also Up Next — Roadmap Phase 10: Singleplayer + LAN Safety Pass
(Still open — deferred across several sessions, not forgotten.)
- [ ] Broader multiplayer stress-testing beyond the 2-player cases already confirmed
- [ ] Confirm behavior under real network latency/timing, not just mocked concurrency

## Completed — Real Bug Fix: `isGroundSolid` (Project Prompt 11 follow-up) ✅
- [x] Root cause found: `Block.isSolid` is experimental/pre-release per Bedrock's own docs,
      unlike `isAir`/`isLiquid` — it doesn't reliably read `true` for ordinary terrain
      without an experiment toggle most players won't have on. Confirmed via your Content
      Log report (0/32 safe, 32 elevation changes, uniform across a Flat world).
- [x] `TerrainScanner._scanPosition()`'s `isGroundSolid` now built from `!isAir && !isLiquid`
      instead — the only `.isSolid` call site in the whole codebase, fixes both the scan
      and placement-time re-verification (same underlying method)
- [x] Full diagnosis in ARCHITECTURE.md §34
- [x] Confirmed working by you ✅

## Completed — Real PathValidator (Project Prompt 11) ✅
- [x] `PathValidator.validate(terrainScanResult)` implemented for real: accepts an all-
      `FLAT_SAFE` result; rejects on the first `HAZARD`/`LIQUID`; stops with a distinct
      "bridge required" message on the first `GAP`; stops with a distinct "not flat"
      message on the first `OBSTRUCTED`; aborts cleanly on `UNLOADED`/`OUT_OF_BOUNDS`
- [x] `TerrainScanningStage`'s `buildReady` shortcut (Project Prompt 8) replaced with real
      calls into `PathValidator` — `PipelineOutcome.TERRAIN_FAILED` is now reachable
      through the normal scan path, not just through `FinalSafetyCheckStage`
- [x] 5 new lang lines added to `en_US.lang`, one per rejection reason
- [x] Corrected 2 stale comments found during review: `PipelineOutcome.BUILD_ACCEPTED`
      (already reachable since Prompt 10, comment said otherwise) and `TERRAIN_FAILED`
      (updated to reflect this session's fix)
- [x] Confirmed working by you ✅

## Completed — First Working Railway Builder (Project Prompt 10) ✅
- [x] `builder/RailPermutationBuilder.js` (new): explicit rail orientation, not vanilla
      auto-connection — see the flagged uncertainty above
- [x] `StraightRailStrategy` real implementation: per-block re-verification of
      cancellation, terrain, and live resources; fresh game-mode read every iteration
- [x] `RailBuilder` real implementation: `system.runJob` ↔ `Promise` bridge via `yield*`
- [x] `InventoryManager.deductRailItems` real implementation: anti-duplication-safe,
      confirmed by 11 dedicated tests
- [x] `CancellationWatcher` real implementation (reserved since Project Prompt 2)
- [x] `BuildSession` now constructed from a `BuildRequest`, as always planned
- [x] New `FinalSafetyCheckStage`; `PlacementStage`/`CompletionStage`/`ProgressReporter`
      all real
- [x] Product renamed to "Smart Rail Builder" (see flag #1)
- [x] 55 new + 41 strengthened-regression tests passed, on top of 48/48 `node --check`
- [x] Full manual testing checklist added to ROADMAP.md's Phase 7 entry — starting with
      rail orientation, this session's highest-priority thing to verify in-game

## Completed — Pipeline Integration & Creative Mode Review (Project Prompt 9) ✅
- [x] `RequestLifecycleState` + `PipelineOutcome`; `MessageService.sendActionBar` real

## Completed — Inventory Manager & Resource Validation (Project Prompt 8) ✅
- [x] `InventoryManager.buildReport()`, `ResourceValidator`, Known API Risks section

## Completed — Terrain Scanner (Project Prompt 7) ✅
- [x] `TerrainScanner.scanPath()`: 7-way classification, full-path scanning

## Completed — Direction Detection & Railway Origin System (Project Prompt 6) ✅
- [x] Yaw-based direction detection; self-review caught a numerical-stability bug

## Completed — Build Pipeline & Validation Framework (Project Prompt 5) ✅
- [x] `core/pipeline/` (now 8 named stages) and `core/validation/` (pluggable validators)

## Completed — Roadmap Phases 2-3 ✅
- [x] Full BP/RP skeleton; item detection; ModalFormData menu; double-menu defenses

## Completed — Roadmap Phase 15: Three Building Modes & Unified Build Configuration UI ✅
- [x] `config/BuildModes.js` (new): `BuildingMode` enum + `BUILD_MODE_REGISTRY`, single
      source of truth for mode selection, validation, and pipeline gating
- [x] `BuildRequest` extended (not replaced) with `buildingMode`/`bridgeHeight`/
      `undergroundDepth` — see ARCHITECTURE.md §41.3 for why this, not a new class
- [x] `BuildMenu.js` rewritten: mode select → configuration+length → build summary,
      3 form round trips covering the prompt's 5 conceptual steps
- [x] New `ModeAvailabilityStage` cleanly stops valid Bridge/Underground requests with an
      honest player message, since their construction engines aren't built yet
- [x] New `ModeConfigValidator`, registry-driven bounds check (bridge 1-16, underground
      1-64)
- [x] Real, unrelated version-drift bug found and fixed: `Constants.js` said 0.1.0,
      `BP/manifest.json` said 0.1.6, `RP/manifest.json` said 0.1.0 — all three now 0.1.7
- [x] 45 new mocked-harness assertions, all passing, reproducing the prompt's own
      boundary-value testing checklist exactly
- [ ] **Not covered by the automated harness — needs code walkthrough + in-game test:**
      `BuildMenu.js`'s three actual form screens and `BuildRequestCreationStage.js`'s
      orchestration of them (both need live `@minecraft/server-ui` / a player)
- [ ] **Awaiting your in-game test pass** — full checklist in ROADMAP.md's Phase 15 entry

## Completed — Roadmap Phase 16: Advanced Bridge Mode: Height 1–16 ✅
- [x] Started per your explicit "Start prompt 16" instruction, ahead of an in-game
      confirmation of the immediately-preceding bugfix session — see the Order Note
      directly below.
- [x] `terrain/TerrainScanner.js` gained `planBridge()`: one fixed elevation for the
      whole railway (`origin.y + bridgeHeight`), a support column per rail position only
      where terrain doesn't already reach the deck — see ARCHITECTURE.md §44.2–§44.3 for
      why this, not the Phase 13 foundation's original per-gap auto-bridging idea
- [x] `terrain/BridgePlan.js`/`terrain/BridgeValidation.js` redesigned (zero prior live
      callers, confirmed by search first — safe to replace); `BridgeDetector.js`/
      `GapAnalyzer.js` deliberately left untouched (different, unrelated, already-live
      purpose) — ARCHITECTURE.md §44.1
- [x] `builder/strategies/BridgeExecutionStrategy.js` implemented for real (replacing the
      Project Prompt 13 stub); new `builder/BridgeSupportBuilder.js`
- [x] `builder/RailBuilder.js`'s `run()` now takes its strategy per call;
      `PlacementStage.js` picks via a new `strategiesByMode` registry
- [x] Four pipeline stages made mode-aware (`TerrainScanningStage`, `InventoryStage`,
      `FinalSafetyCheckStage`, `PlacementStage`) — NORMAL branches unchanged verbatim
- [x] `BUILD_MODE_REGISTRY.BRIDGE.implemented` flipped to `true`
- [x] 39 new assertions against the real `planBridge()` algorithm (mocked terrain) + 29
      new end-to-end integration assertions (real pipeline classes, fake world, real
      inventory container) — all passing. Full existing Phase 15 suite re-run: 40/45
      pass unchanged, 5 are stale "Bridge not implemented" assertions now correctly
      failing (expected). `node --check` clean across all 68 script files.
- [ ] **Awaiting your in-game test pass** — full checklist in ROADMAP.md's Phase 16
      entry, reproducing Project Prompt 16's own requested test matrix

## ⚠️ Order Note (Project Prompt 16)
Uploaded in the same turn as two urgent bug reports (grass blocking rail construction;
`.mcaddon` not a valid archive) from testing Phase 15's build. Those two bugs were fixed
first, in their own session, before Prompt 16 was started — see the Bugfix Session Order
Note above. You then explicitly said "Start prompt 16," so this session proceeded
**without** an in-game confirmation that either bugfix actually works — a deliberate,
flagged exception to this project's own "confirm in-game before the next phase begins"
rule, made at your direction. Please prioritize confirming the grass fix and a
successful `.mcaddon` import alongside everything in Phase 16's own testing checklist —
neither was independently confirmed before Bridge Mode was layered on top of them.

## Completed — Roadmap Phase 17: Advanced Underground Mode: Depth 1–64 ✅
- [x] Started per the uploaded Prompt 17 document — same milestone-gating situation as
      Phase 16: neither Phase 16 nor the bugfix session before it has been confirmed
      in-game yet. This is now the THIRD consecutive session on an unverified base — see
      the Order Note directly below.
- [x] `terrain/TerrainScanner.js` gained `planUnderground()`: a continuous descending
      ramp from the surface to the requested depth, then a flat run — see
      ARCHITECTURE.md §45.1–§45.2 for the depth formula and the entry-strategy reasoning
- [x] **Key constraint, documented not hidden:** rails descend 1 block per block
      travelled, so a build needs `length >= depth + 1`. Depth 64 is therefore
      unreachable in a single build (63 is the max) — rejected with the exact minimum
      length it would need, never silently clamped
- [x] Ramp reuses the existing Phase 11 slope geometry unchanged; excavation reuses
      `TunnelExcavator` completely unchanged (now a shared instance) — no new rail
      geometry or excavation code was written
- [x] New `config/OreRegistry.js` + `config/UndergroundConfig.js`'s `ORE_POLICY`:
      default `PROTECT_VALUABLE` (diamond/emerald/ancient debris block the build before
      anything is modified; common ores are excavated but counted and reported — never
      destroyed silently). Two alternative policies implemented, one constant away
- [x] `BUILD_MODE_REGISTRY.UNDERGROUND.implemented` flipped to `true` — all three
      permanent modes are now live
- [x] 71 new assertions against the real `planUnderground()` algorithm + 48 new
      end-to-end integration assertions (real pipeline classes, fake world, real
      inventory container) — all passing, including NORMAL and BRIDGE regression run
      through the same wired graph, mode isolation, multiplayer, all four rail types,
      and mid-build cancellation
- [x] One real bug found and fixed by these tests before shipping: lava/water directly
      beneath a rail was reported as "cave with no solid floor" — correct rejection,
      misleading cause. Now reports the true cause.
- [x] Performance measured directly, not estimated: worst case (length 64, depth 63) is
      255 block reads, 191 excavations, ~0.1ms planning — ARCHITECTURE.md §45.10
- [ ] **Awaiting your in-game test pass** — full checklist in ROADMAP.md's Phase 17
      entry, reproducing Project Prompt 17's own requested test matrix

## ⚠️ Order Note (Project Prompt 17)
Uploaded as a standard next-prompt document, with no bug reports attached this time.
Proceeded on it directly. This is nonetheless the **third** consecutive session
(bugfix session → Prompt 16 → Prompt 17) built without an in-game confirmation of
anything underneath it — the grass fix, the `.mcaddon` packaging fix, and all of
Bridge Mode remain exactly as unconfirmed as they were after Prompt 16. If any of them
turn out to be broken, please test in roughly that order (packaging first, since
nothing else can be tested in-game until an `.mcaddon` actually imports) so any bug
report is easier to trace back to the session that introduced it.

**On test coverage provenance, stated plainly:** this session's own two new suites (71
+ 48 assertions) were run repeatedly against the final code and all pass. The
STANDALONE Phase 15 (45 assertions) and Phase 16 (39+29 assertions) suites from their
own sessions could not be re-run this session — the sandbox that held those exact test
files did not persist between sessions, only the project code itself did. Their
regression coverage was NOT skipped, though: this session's own integration suite
(Scenario 7/8) runs real NORMAL and real BRIDGE builds end-to-end through the exact
same wired dependency graph as Underground Mode, using the actual
`StraightRailStrategy`/`BridgeExecutionStrategy` classes, and both passed. That is
genuine regression evidence, just not a re-run of the original files byte-for-byte.

## Completed — Pre-Prompt-18 Bug-Fix Pass ✅
- [x] **Bridge elevation + solid wall fixed** (one root cause, two symptoms) —
      `planBridge()` rewritten with a real ascending ramp, flat crest, real descending
      ramp, and lightweight piers (full support columns only every 4th position + both
      ends) instead of a fixed elevation and a full column at every position. Minimum
      length is `2×height+3`, derived from real rail geometry (a single block can't be
      the peak of both an up-ramp and a down-ramp) and verified by hand before coding.
      ARCHITECTURE.md §46.2.
- [x] **Bridge material is now player-chosen** — new `InventoryManager.scanPlaceableMaterials()`
      + a new `BuildMenu` screen. No quantity entry; the addon calculates it. §46.6.
- [x] **Underground tunnel dead end fixed** — a landing buffer is now reserved past the
      last rail (best-effort). NORMAL mode's separate hill-tunnel system reviewed and
      confirmed NOT to share this defect. §46.3.
- [x] **Rail crossing/connection fixed** — new `RAIL_ITEM_ID_SET`; an existing rail is
      recognized during scanning and preserved (never overwritten) during placement, in
      all three modes. §46.5.
- [x] **Underground max depth: 64 → 20.** §46.4.
- [x] 78 new assertions across three suites (26 + 20 + 32), all passing. One real bug
      found and fixed in the shipped code itself via cross-checking (a stale logging
      reference), separate from three test-authoring mistakes also found and fixed —
      full honest accounting in ARCHITECTURE.md §46.10. `node --check` clean across all
      73 files.
- [ ] **Awaiting your in-game test pass** — full checklist in ROADMAP.md's new Bug-Fix
      Pass entry, which replaces Phase 16's now-stale checklist.

## Completed — Roadmap Phase 18: Underwater Railway & Water-Safe Construction ✅
- [x] **Normal Mode builds through shallow water** — a single layer over solid ground is
      safely buildable (`isUnderwater: true`); anything deeper, or a drop into open
      water with no floor (reuses `GapAnalyzer`'s existing `WATER_CROSSING` gap type),
      rejects with a new, specific message naming Bridge/Underground Mode. §47.3, §47.5.
- [x] **Bridge Mode passes over water** — deck/headroom liquid no longer rejects the
      plan; piers already correctly rose through water to real ground (Phase 16). Fixed
      a real gap along the way: `BridgeExecutionStrategy`'s own execution-time re-check
      would have halted a now-valid plan mid-build. §47.4.
- [x] **Underground Mode waterproofs a tunnel** instead of rejecting or flooding it —
      corridor water is excavated and its lateral/roof faces sealed with a thin, free
      solid lining; a liquid FLOOR is still correctly rejected outright. Fixed a real
      gap along the way: `TunnelExcavator.excavateRow()` unconditionally rejected any
      liquid regardless of what the plan now expected. §47.6.
- [x] **Lava remains fully protected in every mode**, unconditionally, regardless of the
      water changes — no automatic lava tunnels.
- [x] **First committed, executable test harness** (`tests/`) — no `@minecraft/server`
      dependency, 55 assertions, all passing. Closes a gap this document (via
      ARCHITECTURE.md §33.2/§34.5) has flagged across multiple prior sessions. Two real
      bugs were found and fixed by this process before shipping — see §47.11.
- [x] `node --check` clean across every script file. Manifests + `Constants.js` version
      bumped 0.1.10 → 0.1.11.
- [ ] **Awaiting your in-game test pass** — full checklist in ROADMAP.md's new Phase 18
      entry.

## Completed — Roadmap Phase 19: Smart Terrain Adaptation & Rail Connectivity ✅
- [x] **Reviewed, confirmed correct, not rewritten**: one-block slopes, existing-rail
      preservation across every crossing geometry, strict mode isolation, and
      rail-placement-order independence. §48.1/§48.4/§48.5/§48.6.
- [x] **Added: specific "unbreakable terrain" message** for a floating unbreakable
      block directly at the rail's own spot (previously generic "too steep"). §48.2.
- [x] **Added: Available clearance check** — Normal Mode now checks one block of
      headroom above the rail, rejecting with a specific `"LOW_CLEARANCE"` reason
      instead of silently planning a rail under a low overhang. Neither new check
      blocks the existing ascend/tunnel fallback from trying a real fix first. §48.2.
- [x] **Added: `isExistingRail`** explicit field (informational only, no behavior
      change). §48.3.
- [x] **Added: a test-only `@minecraft/server` mock + mock Player** — unlocks testing
      every execution-side class for the first time. Never bundled into the `.mcaddon`.
- [x] **Fixed a real bug in the test harness's own mock world** (stateless block reads
      silently discarding execution-time mutations) before it could produce a false
      negative on real code. §48.7.
- [x] 160 assertions across 3 test files (55 + 66 new + 39 new), all passing.
      `node --check` clean across every script file.
- [ ] **Awaiting your in-game test pass** — full checklist in ROADMAP.md's new Phase 19
      entry, including the one thing this session's Node-only tests genuinely cannot
      confirm: whether placing a new rail next to a hand-built one ever disturbs the
      hand-built one's own shape via an engine-level neighbor update (§48.6/§48.10).

## Completed — Pre-Prompt-21 Integration Test (Project Prompt 20) ✅
- [x] **Full integration/stabilization review, no new features** — read every
      remaining unreviewed script file in the addon (`main.js`, `BuildPipeline.js`,
      every validator, `ui/BuildMenu.js`, tunnel detection, small utilities). Pipeline
      wiring confirmed correct end to end, not redesigned. §49.1/§49.3.
- [x] **Fixed: `TunnelPlanner.js`'s fact shape** was missing 3 fields
      (`isExistingRail`/`isUnderwater`/`waterInfo`) the OTHER fact-producer already had
      — harmless in practice, a real inconsistency, fixed with a new regression test.
      §49.2.
- [x] **Fixed a stale doc comment** (`RequestLifecycleState.js`'s `COMPLETED`, wrong
      for ten sessions) and **removed fully dead code** (`utils/NotImplemented.js`,
      zero remaining call sites). §49.2.
- [x] **Added `tests/integration.test.mjs`** — builds the real dependency graph and
      runs the real `BuildPipeline` end to end for all 3 modes, 4 rejection paths, and
      a 2-player multiplayer scenario. First test in the project to verify the WIRING
      itself. Two real bugs in the test's own first draft were found and fixed before
      being trusted. §49.4.
- [x] **UI and error-message review** — `BuildMenu.js`'s full flow and every rejection
      message re-checked; 0 missing/orphaned localization keys. §49.7.
- [x] 191 assertions across 4 test files, all passing. `node --check` clean across
      every script file (73, one fewer — dead code removed).
- [x] **New `.mcaddon` packaged, version 0.1.13** — structure verified.
- [ ] **Awaiting your in-game test pass** — full numbered checklist delivered alongside
      the `.mcaddon` in this session's final report. Same standing limitation as every
      prior session: neighbor-update side effects on a pre-existing rail (§48.6) remain
      genuinely unconfirmable without a live client.

## Completed — Roadmap Phase 21: Polished Mobile UI & Build Configuration ✅
- [x] **Fixed three factually stale player-facing messages** — `menu.modeBody` and
      `path.rejected.tooSteep` still claimed Bridge/Underground were "coming in a future
      update," false since Prompts 16-17; rewritten to describe all three modes
      accurately and point players at the real alternatives. §50.2.
- [x] **Canonical terminology unified** — slider/summary labels trimmed to the bare
      "Length"/"Height"/"Depth" the prompt's Accessibility section names explicitly; the
      two validation messages keep the prompt's own fuller literal wording, matched
      exactly. §50.3.
- [x] **Validation messages rewritten to "Required: X / Available: Y"** for both rails
      and (newly, naming the material) bridge material shortfalls. §50.4.
- [x] **Added `utils/BlockDisplayName.js`** — one shared display-name formatter,
      replacing a private duplicate inside `ui/BuildMenu.js`. §50.5.
- [x] **Build summary now shows "Required Rails" pre-confirmation** (cheap, already
      known) and reveals the real Bridge material quantity honestly in a new
      post-confirmation chat message, once the real terrain scan has actually run —
      never fabricated before it, respecting the "don't scan the world for a form"
      constraint. §50.6/§50.8.
- [x] **Confirmed, not changed**: Bridge Height (1-16)/Underground Depth (1-20) were
      already structurally impossible to set out of range (slider bounds sourced
      directly from the mode registry). §50.7.
- [x] **Added a `@minecraft/server-ui` test mock + `tests/uiMenu.test.mjs`** (25 new
      assertions) — closes the gap flagged in every session since Prompt 18; proves the
      out-of-range slider impossibility, multiplayer isolation, and every screen's
      cancellation path directly rather than by inspection. §50.9.
- [x] 216 assertions across 5 test files, all passing. `node --check` clean.
- [x] **New `.mcaddon` packaged, version 0.1.14** — structure verified.
- [ ] **Awaiting your in-game test pass** — full numbered checklist delivered alongside
      the `.mcaddon` in this session's final report. Same standing limitations as prior
      sessions (§50.11): the two `ui/BuildMenu.js` visual-confirmation items
      (`.body()` substitutions rendering, material button icon paths) and neighbor-update
      side effects on a pre-existing rail (§48.6) remain unconfirmable without a live
      client.

## Completed — Roadmap Phase 22: Smart Build Preview, Validation & Safety ✅
- [x] **Added `core/BuildPlan.js`** — the complete, consolidated build plan (positions,
      terrain info, required rails/material, world modification boundary), assembled from
      data the pipeline had already computed — no new scans. §51.3.
- [x] **Added `core/pipeline/stages/BuildPlanStage.js`** — the last real
      immediately-before-construction gap, closed: re-checks player validity, dimension,
      held item, and a fresh inventory read right before `PlacementStage`. Zero blocks
      placed on any failure. §51.7.
- [x] **Added `core/ActiveBuildRegistry.js`** — new multiplayer safety net: two players'
      overlapping builds are now rejected outright (`RAIL_CONFLICT`), never silently
      corrupting each other. Race-free by construction. §51.6.
- [x] **Added `config/ValidationErrorCategory.js`** — every existing rejection reason
      mapped onto the prompt's 13 named categories, without touching any existing
      player-facing message. §51.11.
- [x] **Added a "STATUS: CANNOT BUILD" chat prefix** for every real, zero-modification
      rejection. §51.11.
- [x] **Fixed a real bug**: `ResourceValidator` always reported "INSUFFICIENT_RAILS" even
      for a bridge material shortfall — harmless to players, misleading to anything
      inspecting the reason. §51.2.
- [x] **Confirmed, not rewritten**: terrain/mode-specific validation and existing-rail
      protection were already fully implemented — re-verified against the prompt's own
      checklist. §51.5.
- [x] 59 new assertions (`tests/buildPlanSafety.test.mjs`), 275 total across 6 files, all
      passing. `node --check` clean across 79 script files.
- [x] **New `.mcaddon` packaged, version 0.1.15** — structure verified.
- [ ] **Awaiting your in-game test pass** — full numbered checklist delivered alongside the
      `.mcaddon` in this session's final report. Same standing limitations as prior
      sessions, plus one new one (§51.13): `player.dimension`/`Dimension.id` is new API
      surface for this project, not previously exercised — see flag #7 above.

## Completed — Roadmap Phase 23: Performance, Stability & Long-Build Optimization ✅
- [x] **Added `InventoryManager.hasAtLeast()`** — replaces four full-container inventory
      scans (one per per-block placement loop, all three modes) with an early-exit
      threshold check. Same live, uncached read guarantee. §52.2.
- [x] **Added practical performance metrics** to the existing single completion log line —
      planning/construction duration, required rails/material, positions modified. Still one
      `INFO` line per build. §52.3.
- [x] **Confirmed sound, not rewritten**: `system.runJob` pacing, terrain caching inside
      `BuildPlan`, block-write minimization (already correct by construction),
      `BuildPlan`'s memory footprint (measured: max 161 positions at this project's real
      ceiling), and the API surface (no deprecated calls, no unhandled promises, no
      unbounded loops). §52.4-§52.7.
- [x] **Added `tests/performanceStability.test.mjs`** (44 new assertions) — mid-construction
      cancellation proven for ALL THREE modes' actual generators (not just
      `CancellationWatcher`'s flag), job lifecycle after completion/cancellation, the real
      64-length ceiling succeeding for all three modes, and a 3-player load test. A real bug
      in this test file's own first draft was found and fixed before being trusted. §52.8.
- [x] **Performance measured directly** (Node-harness timing, explicitly not real Minecraft
      tick timing) — every stage's cost stays flat as build size grows; no algorithmic
      blowup found. §52.9.
- [x] 319 assertions across 7 test files, all passing. `node --check` clean across 79
      script files.
- [x] **New `.mcaddon` packaged, version 0.1.16** — structure verified.
- [ ] **Awaiting your in-game test pass** — full numbered checklist delivered alongside the
      `.mcaddon` in this session's final report. Same standing limitations as prior
      sessions (§52.10) — nothing new this session, since no new player-facing behavior or
      API surface was added.

## Completed — Roadmap Phase 24: Advanced Railway Routing & Terrain Intelligence ✅
- [x] **Added player-structure protection** — `PROTECTED_STRUCTURE_BLOCK_IDS` (chests,
      crafting/utility stations, doors, beds, signs, etc.) unioned into the existing
      `UNBREAKABLE_BLOCK_ID_SET`, protecting them across all three modes with zero changes
      to any consumer file. §53.2.
- [x] **Fixed 3 misleading "unbreakable block" messages** ("bedrock or similar" was false
      for a protected structure) — reworded for accuracy.
- [x] **Closed 2 real terrain-transition test gaps**: "Depression → Flat" and a descending
      staircase, both empirically verified against the real scanner. §53.3.
- [x] **Added `tests/structureProtection.test.mjs`** (14 new assertions) covering all three
      modes plus bridge-material exclusion.
- [x] **Confirmed sound, not rewritten**: Normal Mode terrain following, steep-terrain
      rejection (structurally guaranteed), Bridge/Underground routing, lava safety,
      existing-rail preservation (re-tested), player intent (no pathfinding exists),
      performance, and multiplayer isolation. §53.4-§53.6.
- [x] 343 assertions across 8 test files, all passing. `node --check` clean across 79
      script files.
- [x] **New `.mcaddon` packaged, version 0.1.17** — structure verified.
- [ ] **Awaiting your in-game test pass** — full numbered checklist delivered alongside the
      `.mcaddon` in this session's final report. One new, honest limitation (§53.7): a
      player structure made of ORDINARY blocks (a stone wall, a wood house) still cannot be
      distinguished from natural terrain — only specific block types and existing rails are
      reliably protected. Every other standing limitation from prior sessions is unchanged.

## Completed — Roadmap Phase 25: Professional Railway Construction & Feature Integration ✅
- [x] **No production code changed** — a construction-quality audit against the full §1-§22
      checklist found no new bugs; everything asked for was already correct.
- [x] **Added a direct proof for the Underground landing buffer** (the historically-reported
      "one-block space" bug) — now empirically non-empty, not just documented as fixed. §54.2.
- [x] **Added a direct proof that both bridge endpoints anchor to real ground** — a real
      support column confirmed at both the starting and ending pier column. §54.3.
- [x] **Added post-construction world-vs-BuildPlan verification** for full BRIDGE/UNDERGROUND
      pipeline runs — every rail/support/excavated position checked against the actual world,
      scoped to the plan's own positions only. §54.4.
- [x] **Added a full-pipeline rail-type-preservation proof** — a powered rail survives an
      entire Bridge build end to end, never silently substituted with plain rail. §54.5.
- [x] **Confirmed sound, not rewritten**: construction quality, all transitions, bridge
      material consistency, supports over uneven terrain/water, lava safety, existing-rail
      preservation, resource transactions, partial-build policy, multiplayer, performance,
      error handling, and UI. §54.6.
- [x] 356 assertions across 8 test files, all passing. `node --check` clean across 79
      script files (unchanged — no production code touched).
- [x] **New `.mcaddon` packaged, version 0.1.18** — structure verified.
- [ ] **Awaiting your in-game test pass** — full numbered checklist delivered alongside the
      `.mcaddon` in this session's final report. Every standing limitation from prior
      sessions (§54.7) is unchanged — nothing new added this session.

## Completed — Roadmap Phase 26: Final Feature Integration & Advanced Railway Behavior ✅
- [x] **Remaining project schedule established** — Prompt 27 (bug-fixing/compatibility/
      multiplayer/optimization), Prompt 28 (release candidate), Prompt 29 (branding),
      Prompt 30 (final polish/packaging).
- [x] **Found and closed a real, significant test-coverage gap: direction coverage.**
      Over 300 assertions across every prior session traveled EAST exclusively; the
      ascending `rail_direction` mapping's 3 untested values (west/east/south — only north
      was ever checked) are now all verified. §55.2.
- [x] **Added `tests/directionCoverage.test.mjs`** (64 new assertions) — all three modes,
      all four directions, all passing against the real, unmodified code. A coverage gap,
      not a functional bug.
- [x] **Confirmed sound, not rewritten**: railway continuity, rail type consistency,
      start/end position handling, slope quality, bridge/underground transitions and
      structure, underwater railway, rail intersections, existing structures, resource
      transactions, interruption handling, multiplayer, conflict protection, UI,
      configuration validation, performance, error messages. §55.3.
- [x] 420 assertions across 9 test files, all passing. `node --check` clean across 79
      script files (no production code changed this session).
- [x] **New `.mcaddon` packaged, version 0.1.19** — structure verified.
- [ ] **Awaiting your in-game test pass** — full numbered checklist delivered alongside the
      `.mcaddon` in this session's final report. Every standing limitation from prior
      sessions (§55.4) is unchanged. The ascending `rail_direction` mapping is now
      internally consistent across all four directions but STILL not confirmed against
      real Bedrock (flag #7 above) — the single highest-priority thing to verify visually.

## ⚠️ Order Note (Pre-Prompt-18 Bug-Fix Pass)
Uploaded with four specific bug reports and four screenshots, explicitly instructing
"DO NOT START PROJECT PROMPT 18 YET." Honored — Project Prompt 18 was not started.
This is now the **fourth** consecutive session (bugfix session → Prompt 16 → Prompt 17
→ this pass) where nothing underneath the current session had been confirmed in-game
before more was built on top of it — and this session exists specifically because that
practice produced four real, user-facing bugs. All four are now fixed and covered by
new tests, but this makes an in-game confirmation pass more valuable than it has been at
any earlier point in the project, not less. If anything below turns out to still be
broken, the packaging fix (bugfix session) and the `.mcaddon` import itself remain the
right place to start ruling things out first, since nothing else can be verified until
that works.

## Completed — Roadmap Phase 27: Final Engineering, Bug Fixing, Compatibility & Stability Pass ✅
- [x] **Full audit of every module, both manifests, and every documented behavior** —
      not a new feature session, per Project Prompt 27's own explicit framing. Every
      script file read this session, directly or via an independent parallel review pass.
- [x] **Fixed: `PlacementStage.js`'s "construction started" message fired before the
      multiplayer conflict claim check**, not after — a rejected build (RAIL_CONFLICT)
      confusingly told the player construction had begun. §56.2.
- [x] **Fixed: `ModeConfigValidator.js`'s stale docstring** (claimed underground depth
      1-64; actual, always-correctly-enforced bound is 1-20). §56.2.
- [x] **Re-investigated the rail-crossing bug from scratch, confirmed still correctly
      fixed** — `RAIL_ITEM_ID_SET`'s "never touch what's already there" policy re-traced
      end to end across all 3 strategies and all 4 rail types. §56.3.
- [x] **Found and closed a real test-coverage gap**: 3 of `CancellationWatcher.js`'s 4
      cancellation events (dimension change, death, game mode change) were implemented
      and subscribed since Prompt 10 but never tested — only `playerLeave` was. Added
      5 new test blocks / 11 assertions in `tests/execution.test.mjs`, including an
      orphaned-lock regression test. §56.4.
- [x] **API compatibility, manifests, and config registries all re-validated** — no
      deprecated/incorrect API usage found; no UUID/version inconsistency; no
      contradictory entries across the 3 block registries. §56.5-§56.8.
- [x] **Honestly disclosed: 2 of 3 planned parallel review passes were interrupted by a
      platform rate limit** before completing; their assigned files were covered only
      indirectly this session, not individually re-read. Flagged, not hidden. §56.7.
- [x] 432 assertions across 9 test files, all passing (420 prior + 12 new). `node --check`
      clean across 79 script files.
- [x] **New `.mcaddon` packaged, version 0.1.20** — structure verified.
- [ ] **Awaiting your in-game test pass** — full numbered checklist delivered alongside
      the `.mcaddon` in this session's final report. Every standing limitation from prior
      sessions is unchanged (§56.9): the ascending `rail_direction` mapping remains the
      single highest-priority thing to verify visually; the neighbor-update-tick risk at
      a hand-placed-rail crossing (§56.3/§48.6) is still open and unconfirmable without a
      live client.

## Up Next — Roadmap Phase 28: Release Candidate (not started)
Per Project Prompt 27's own explicit instruction, Prompt 28 was NOT started this session.
Its focus, per this session's own findings: (1) your in-game test pass of THIS session's
`.mcaddon` is the top input, especially the ascending `rail_direction` mapping and the
rail-crossing neighbor-update-tick risk, since Phase 28 is the natural place to fix either
if in-game testing shows it wrong; (2) anything your testing surfaces across the 40-item
checklist delivered this session; (3) the items no session's tests can confirm without a
live client: neighbor-update side effects on a pre-existing rail (§48.6), the two
`ui/BuildMenu.js` visual-confirmation items (§50.11), `player.dimension`/`Dimension.id`
(§51.13), and "ordinary-block player structures can't be detected" (§53.7) — none of them
touched this session; (4) the one honestly-disclosed audit-coverage gap from this session
(§56.7) — `inventory/ResourceValidator.js`, several pipeline stage files, `BuildRequest.js`/
`BuildVector.js`, and the `pipeline/*.js` support files were not individually re-read this
session beyond what the passing test suite already exercises, and are recommended as the
first checklist item for a further engineering pass if one is warranted before the release
candidate is finalized. Per Project Prompt 26's own "do not add these yet" list, curved
rails/pathfinding/undo/blueprints/stations/custom items/mobs/branding remain out of scope
through at least Phase 28.

## Up Next — Roadmap Phase 14: Bridge Placement
(Superseded by the Phase 15/16/17 split above — see the Order Note higher in this file.
The checklist that used to live under this heading now lives under Phase 16, where the
actual bridge engine has now been built. Heading kept, body intentionally emptied, for
session-history continuity — not a second, duplicate copy of the same checklist.)

## Backlog (Roadmap Phase 27+, not scheduled yet)
- [ ] Curved rail placement (extends `RailPermutationBuilder.js`, per its own design notes)
- [x] ~~Underwater railways~~ — done, Roadmap Phase 18 (Project Prompt 18). See
      ARCHITECTURE.md §47.
- [ ] Sealing Underground Mode's best-effort landing buffer against water (currently
      just omitted when unsafe — ARCHITECTURE.md §47.10)
- [ ] A wider (non-lateral-only) waterproof shell for large aquifer pockets, if needed
- [x] ~~A `@minecraft/server-ui` test mock so `ui/BuildMenu.js` can be covered by an
      automated test~~ — done, Roadmap Phase 21 (Project Prompt 21). See
      ARCHITECTURE.md §50.9.
- [ ] Undo system — now has its prerequisite: `BuildPlan.modificationBoundary` (Roadmap
      Phase 22, Project Prompt 22) is a real, inspectable set of every position a build
      touched. See ARCHITECTURE.md §51.4.
- [ ] Railway blueprint save/load
- [ ] Railway templates
- [ ] Additional language support
- [ ] Accessibility improvements
- [ ] Dedicated-server-specific optimization (deferred per decision #7)
