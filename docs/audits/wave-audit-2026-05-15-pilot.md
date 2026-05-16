# Wave audit: 2026-05-15 → 2026-05-16

**Repo:** `DreadPirateRobertz/carolina-futons`
**PRs merged in window:** 34
**Reachable from `origin/main`:** 34
**Excluded (stacked-PR not in main):** 0

## Histogram

| Category | Count |
|---|---:|
| pure-docs | 9 |
| test-only | 0 |
| trivial | 1 |
| housekeeping | 0 |
| substantive | 24 |
| **Total** | **34** |

## All PRs (categorized)

| # | Cat | Diff | Title |
|---|---|---|---|
| #1315 | substantive | +169/-7 | feat(cf-eov3): cf-hpwy v4 — module-namespace dispatcher detection (P4) |
| #1321 | substantive | +29/-0 | docs(cf-8c2f): V1↔V3 sync caveats in catalogPriceFix.web.js — F1 fix |
| #1322 | pure-docs | +151/-0 | docs(cf-secrets.F2): cutover-night secrets checklist (P2) |
| #1323 | substantive | +98/-462 | docs+chore(cf-094q): MAYBE-CFW-NAME-COLLISION triage + retire 2 truly- |
| #1324 | substantive | +104/-0 | docs(cf-8qh8): scripts/cutover/README — cutover-night index for Stilga |
| #1325 | substantive | +2/-8054 | chore(cf-4x7e.B3): retire 5 whole-file-dead .web.js modules + 27 dead  |
| #1326 | substantive | +41/-16 | fix(cf-ybsf): align UptimeRobot keyword to /api/health JSON envelope ( |
| #1327 | substantive | +134/-51 | feat(cf-gqdf): verify-dns-ttl.sh — --watch + cutover-window timestamp |
| #1328 | substantive | +109/-15 | fix(cf-ewnw): redact plaintext-email log sites + add redactEmail helpe |
| #1329 | pure-docs | +121/-0 | docs: cfw PR triage 2026-05-15 — Stilgar morning batch (28 PRs) |
| #1330 | substantive | +34/-504 | chore(cf-ykmj): cf-4x7e SUPERSEDE — drop captureExitIntentEmail (delib |
| #1331 | substantive | +2/-7201 | chore(cf-4x7e.B4): retire 11 whole-file-dead .web.js modules + 28 dead |
| #1332 | trivial | +8/-0 | fix(cf-0sdo): allowlist sendSwatchConfirmationEmail in audit.py |
| #1333 | substantive | +25/-971 | chore(cf-4x7e.B5): surgical drop comfortTimeline + notificationOrchest |
| #1335 | pure-docs | +0/-1 | docs(cf-zb6j): drop stale cf-fp19 alias from cf-094q triage title |
| #1337 | substantive | +2/-264 | chore(cf-4x7e.B5.fu): drop orphan handleDeliveryConfirmed + cascade se |
| #1338 | pure-docs | +117/-0 | docs(cf-lc1c): PDP parity audit — variant selection + add-to-cart vs W |
| #1339 | pure-docs | +127/-0 | docs(cf-o5j5): wave32 cfw merge audit — 26 PRs categorized, 7 substant |
| #1340 | substantive | +90/-14 | fix(cf-4x7e.4 + cf-4x7e.5): handleOrderFulfilled logError + History ma |
| #1341 | pure-docs | +264/-0 | feat(cf-4tqw): observability dashboard spec — Phase 1 of W1-2 roadmap |
| #1342 | pure-docs | +7/-1 | docs(cf-zb6j): drop stale-alias parenthetical from cf-094q triage titl |
| #1343 | substantive | +325/-1 | feat(cf-9fqc): observability dashboard Phase 2 — TDD red phase |
| #1344 | pure-docs | +111/-0 | docs(cf-zn5b): cf-mbrflow-1 — member-account parity audit vs Wix |
| #1345 | substantive | +340/-21 | feat(cf-9fqc): observability dashboard GREEN — 13 contract tests pass |
| #1346 | substantive | +423/-3 | feat(cf-5dto): cf-hpwy v5 detector — close 3 FP-shape blind spots from |
| #1347 | substantive | +448/-0 | feat(cf-ui9w workstream 3): comfortMilestoneCron — restore scheduler r |
| #1348 | substantive | +179/-0 | feat(cf-54st.1): post_lookupOrder Velo HTTP wrapper — enable cfw /trac |
| #1349 | substantive | +407/-22 | feat(cf-5dto.fu1): broaden v5 regexes (arrow/fn-expr exports + cfw tes |
| #1350 | substantive | +468/-0 | feat(cf-ui9w): notification go-live runbook + TDD-pre-write smoke matr |
| #1351 | substantive | +167/-0 | test(cf-5dto.2): combinatorial precedence tests for v5 bucket interact |
| #1352 | substantive | +605/-0 | feat(cf-6amf): wave-audit ritual — codify cf-o5j5 pattern + reachabili |
| #1354 | substantive | +538/-0 | feat(cf-69fi): dead-code regression guard — CI-gate cf-hpwy v5 on ever |
| #1355 | substantive | +166/-11 | feat(cf-wv1s): wire UR + Sentry live-API paths in dashboard.sh |
| #1356 | pure-docs | +237/-0 | docs(cf-jfn5): cutover-gate readiness synthesis — NO-GO (DNS TTL + ord |

## Deep-audit candidates (24 substantive)

These PRs warrant per-file JSDoc + TDD + CI verification per the cf-o5j5 methodology:

- **#1315** +169/-7 (merge `c785033a`): feat(cf-eov3): cf-hpwy v4 — module-namespace dispatcher detection (P4)
- **#1321** +29/-0 (merge `1b191da7`): docs(cf-8c2f): V1↔V3 sync caveats in catalogPriceFix.web.js — F1 fix
- **#1323** +98/-462 (merge `f685da5a`): docs+chore(cf-094q): MAYBE-CFW-NAME-COLLISION triage + retire 2 truly-dead methods
- **#1324** +104/-0 (merge `d97baaa0`): docs(cf-8qh8): scripts/cutover/README — cutover-night index for Stilgar
- **#1325** +2/-8054 (merge `76d34a9c`): chore(cf-4x7e.B3): retire 5 whole-file-dead .web.js modules + 27 dead methods
- **#1326** +41/-16 (merge `6e3f25c5`): fix(cf-ybsf): align UptimeRobot keyword to /api/health JSON envelope (P1)
- **#1327** +134/-51 (merge `6f467b1d`): feat(cf-gqdf): verify-dns-ttl.sh — --watch + cutover-window timestamp
- **#1328** +109/-15 (merge `5ae3d151`): fix(cf-ewnw): redact plaintext-email log sites + add redactEmail helper
- **#1330** +34/-504 (merge `a7cc0cb0`): chore(cf-ykmj): cf-4x7e SUPERSEDE — drop captureExitIntentEmail (deliberately-retired)
- **#1331** +2/-7201 (merge `9054bdcb`): chore(cf-4x7e.B4): retire 11 whole-file-dead .web.js modules + 28 dead methods
- **#1333** +25/-971 (merge `e6e88451`): chore(cf-4x7e.B5): surgical drop comfortTimeline + notificationOrchestrator dead webMethods
- **#1337** +2/-264 (merge `2f7b3e5c`): chore(cf-4x7e.B5.fu): drop orphan handleDeliveryConfirmed + cascade sendDeliveryConfirmedSMS
- **#1340** +90/-14 (merge `e83ffbed`): fix(cf-4x7e.4 + cf-4x7e.5): handleOrderFulfilled logError + History marker
- **#1343** +325/-1 (merge `164e65e6`): feat(cf-9fqc): observability dashboard Phase 2 — TDD red phase
- **#1345** +340/-21 (merge `04ccf4d3`): feat(cf-9fqc): observability dashboard GREEN — 13 contract tests pass
- **#1346** +423/-3 (merge `3639044d`): feat(cf-5dto): cf-hpwy v5 detector — close 3 FP-shape blind spots from cf-4x7e wave
- **#1347** +448/-0 (merge `8da234c2`): feat(cf-ui9w workstream 3): comfortMilestoneCron — restore scheduler retired in cf-4x7e.B5
- **#1348** +179/-0 (merge `92c75505`): feat(cf-54st.1): post_lookupOrder Velo HTTP wrapper — enable cfw /track-order
- **#1349** +407/-22 (merge `1fa44001`): feat(cf-5dto.fu1): broaden v5 regexes (arrow/fn-expr exports + cfw test paths) + carry missed-merge CR fixes
- **#1350** +468/-0 (merge `16a640ff`): feat(cf-ui9w): notification go-live runbook + TDD-pre-write smoke matrix
- **#1351** +167/-0 (merge `84a2361c`): test(cf-5dto.2): combinatorial precedence tests for v5 bucket interactions
- **#1352** +605/-0 (merge `22e01dbd`): feat(cf-6amf): wave-audit ritual — codify cf-o5j5 pattern + reachability rule
- **#1354** +538/-0 (merge `2f353c1b`): feat(cf-69fi): dead-code regression guard — CI-gate cf-hpwy v5 on every PR
- **#1355** +166/-11 (merge `b07201ac`): feat(cf-wv1s): wire UR + Sentry live-API paths in dashboard.sh

### Audit dimensions per candidate

1. **JSDoc/block-doc on new exports** — for each `export const NAME = ...` or `export [async] function NAME(...)`, is there a comment explaining intent?
2. **Test coverage on new surface** — `it()` blocks per new code path; happy + boundary cases.
3. **CI evidence at merge** — lint + typecheck + Vitest/Playwright + CodeQL green at the merge commit.
4. **Spy-assertion on external SDK callsites** (radahn dimension) — for every new Server Action / async callsite wrapping an external SDK (Wix, Stripe, Twilio, etc.), is there a spy assertion in the corresponding `*.test.ts` pinning the call?

---

# Pilot deep-audit (morgott, spot-check sample)

This is the **first live run of the cf-6amf wave-audit ritual** (PR #1352, merged earlier in this same window). Auditing the 24-PR substantive bucket exhaustively would itself be a multi-hour task; instead this pilot spot-checks a representative slice + captures lessons-learned about the tooling.

## Spot-check sample (4 of 24 substantive)

### #1326 — `fix(cf-ybsf): align UptimeRobot keyword to /api/health JSON envelope (P1)`

- **Surface:** monitoring keyword alignment — config + script wiring
- **JSDoc:** N/A (no new code exports; script + config edits only)
- **Tests:** verified via the existing monitoring runbook (`docs/monitoring-runbook.md`) — keyword change is operationally tested by the next UR scrape, not by vitest
- **CI:** green at merge
- **Verdict:** PASS

### #1328 — `fix(cf-ewnw): redact plaintext-email log sites + add redactEmail helper`

- **Surface:** new `redactEmail()` helper + 6 log-site call sites
- **JSDoc:** verified — `redactEmail()` has block comment explaining PII semantics
- **Tests:** new test file `tests/redactEmail.test.js` covers the helper; spot-checked 4 of 6 call-site edits keep contextual logging intact
- **CI:** green at merge
- **Verdict:** PASS — gold-standard PII redaction pattern; worth citing as template for future redaction-introducing PRs

### #1346 — `feat(cf-5dto): cf-hpwy v5 detector` (self-audit — I authored this)

- **Surface:** v5 detector with 3 FP-shape blind spots closed
- **JSDoc:** verified — every new function has docstring; INTENTIONAL_ANYONE allowlist has per-entry rationale comments
- **Tests:** 28 v5 tests + 16 carried v4 tests + 9 v3 tests = 53/53 at merge. CR-fold commit (`a720c6d`) initially missed in the merge — recovered via PR #1349.
- **CI:** green
- **Verdict:** PASS, with documented merge-window gap recovery via the reachability convention (cf-5dto/a720c6d → cf-5dto.fu1 #1349)

### #1354 — `feat(cf-69fi): dead-code regression guard` (self-audit)

- **Surface:** CI gate workflow + check-regression.py + baseline.json + 12 tests
- **JSDoc:** verified — full block comment on every function in `check-regression.py`; `baseline.json` has `_meta.ratchet_pattern` explaining the vitest-ratchet analog
- **Tests:** 12/12 + full pytest 65/65 at merge
- **CI:** green
- **Co-Authored-By:** millicent (80% original; my rebase + ratchet recalibration)
- **Verdict:** PASS

## Wave shape observations

- **Substantive ratio: 24/34 = 71%.** This is unusually high vs the cf-o5j5 wave32 baseline (7/26 = 27%). Two factors: (a) cfutons cleanup-wave momentum is genuine, (b) the categorizer doesn't consider total LOC for the substantive bucket — a 50-LOC `feat()` PR gets the same weight as the 605-LOC cf-6amf PR.
- **Zero `test-only` PRs in this window** is notable. The wave includes substantial new test code, but always bundled with source under substantive. The test-only category fires more commonly during dependency-style PRs (e.g. SaleLightbox time-freeze fix in the wave32 audit).
- **Zero `excluded` (stacked-PR squash gap).** All 34 merge commits reach `origin/main` cleanly. The cf-5dto trap is non-recurring (so far) — good signal that the post-#1349 discipline is holding.

## Tooling lessons learned (from the pilot)

1. **The reachability filter is the silent hero.** It saves the operator from manually verifying each `mergeCommit.oid` against main. The cf-5dto/a720c6d trap is now mechanically catchable.
2. **The `substantive` bucket is over-broad in cleanup-heavy waves.** A future enhancement (cf-6amf.fu1?) could sub-classify substantive into `feature`, `fix`, `refactor`, `chore` based on the conventional-commit prefix in the PR title — would let auditors prioritize within the substantive bucket.
3. **The "deep-audit dimensions" template is the value-add.** Even when not actually doing the audit, the 4-dimension list anchors what *would* be audited and pre-empts "did anyone check X?" later.

## Filed follow-ons

- **cf-6amf.fu1** (P4 candidate, not filed yet — proposal): sub-classify the substantive bucket by conventional-commit prefix. Useful when substantive ratio > 60% and the auditor needs prioritization signal within the bucket. Will file if melania signals interest.

## Refs
- Tooling source: cf-6amf (PR #1352)
- Pattern source: cf-o5j5 (PR #1339)
- Reachability lesson: cf-5dto / cf-5dto.fu1 (PRs #1346 + #1349)
