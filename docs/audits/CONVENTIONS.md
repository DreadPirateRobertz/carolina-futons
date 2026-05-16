# Wave audit conventions

**Bead:** cf-6amf (cf-roadmap.3)
**Pattern source:** cf-o5j5 wave32 audit (2026-05-15, PR #1339)
**Codified:** 2026-05-16

This doc codifies the wave-audit ritual that emerged from cf-o5j5. Run via `scripts/wave-audit/wave-audit.sh <since-date> [<until-date>]` — the script implements every rule below.

---

## 1. Scope: what's audited

A **wave** is the set of PRs merged into `origin/main` of a single repo within a date range. Default cadence is Monday-on-prior-week, but ad-hoc windows are fine.

## 2. Reachability rule (the cf-5dto trap)

**A PR is counted only if its merge commit is reachable from `origin/main`.**

```bash
git merge-base --is-ancestor <merge_commit_oid> origin/main
```

Why: GitHub's `state=MERGED` means "this PR's source branch was merged into its target branch." For **stacked PRs** the target may be a feature branch (not main), and the source can drift further before main pulls. cf-5dto / PR #1346 hit this exact trap: the CR-fold commit `a720c6d` was on the v5 detector branch but the merge to main happened from an earlier `5f86bde` head — the CR fixes never landed. The reachability check catches that asymmetry.

`scripts/wave-audit/wave-audit.sh` runs the check per PR and surfaces excluded PRs in a dedicated "Excluded" section. Auditors should treat each excluded entry as a follow-up: was this an intentional non-merge, or a missed merge that needs a salvage PR?

## 3. Categorization rubric

Five mutually-exclusive categories. Precedence is top-down — first matching category wins. See `scripts/wave-audit/categorize.py` for the implementation and `test_categorize.py` for the pinned contract.

| Category | Rule | Deep-audit applies? |
|---|---|---|
| `pure-docs` | All files are under `docs/` (`.md`) OR top-level docs (README, CHANGELOG, LICENSE, CONTRIBUTING, CODEOWNERS, AGENTS, CLAUDE, GEMINI) | No — no testable surface |
| `test-only` | All files match `(?:^|/)(?:tests|__tests__|e2e)/.*\.(?:test|spec)\.(?:tsx?|jsx?|mjs|cjs)$` | No — the change *is* tests |
| `housekeeping` | All files are config/runtime/agent-state: `.gitignore`, `.gitattributes`, `.runtime/*`, `.claude/*`, agent guide MDs | No — no production code |
| `trivial` | Total LOC ≤ 12 OR all files are lockfile/dep-manifest | No — surface too small to host gap |
| `substantive` | Anything else | **Yes — deep-audit target** |

Threshold rationale: 12 LOC is the cf-o5j5 cut — captures aria-hidden / one-line-fix / config-tweak PRs that don't have meaningful audit surface. Lockfile-only PRs are trivial regardless of size (mechanical, dep-resolver-generated).

A docs-mixed-with-source PR is **substantive**, not pure-docs — the source-code half is the audit target.

## 4. Deep-audit dimensions per substantive PR

For every PR in the `substantive` bucket, audit these four dimensions:

### a. JSDoc / block-doc on new exports
For each `export const NAME = ...` or `export [async] function NAME(...)` introduced, is there at least a block comment explaining intent?

The cf-5dto v5 detector (`scripts/cf-dead-routes/audit.py`) tracks the export inventory; wave-audit doesn't need to re-scan from scratch — just diff the PR's added/modified exports.

### b. Test coverage on new surface
For each new public surface (route handler, async helper, component), at least one `it()` block covering happy path. Boundary cases (error, missing input, rate-limit, etc.) ideally pinned.

### c. CI evidence at merge
The merge commit's CI must show: lint + typecheck + Vitest/Playwright (whichever applies) + CodeQL green. A PR that merged on red is a real signal — file follow-up bead.

### d. Spy-assertion on external SDK callsites (radahn dimension)
For every new Server Action / async callsite wrapping an external SDK (Wix, Stripe, Twilio, fetch to a third-party API), is there a spy assertion in the corresponding `*.test.{ts,tsx}` pinning the call? This generalizes the cf-o5j5 #566 EmailCapturePopup finding: spy-on-callsite is a recurring audit dimension, not a one-off.

## 5. Output deliverables

Every wave-audit run produces:

1. **One audit doc** under `docs/audits/cf-<bead>-<window>.md` with:
   - Categorization table
   - Per-PR verdict on the four dimensions for each substantive PR
   - Gap callouts → filed as P3 follow-up beads
2. **Zero or more P3 follow-up beads** per gap found. Naming: `cf-<wave-bead>.fu<N>` if directly attributable, or fresh bead if cross-cutting.
3. **No code changes in the audit PR.** The audit is read-only; fixes are separate PRs.

## 6. Frequency

- **Weekly Monday-cadence**: prior-week merges, default cadence
- **Ad-hoc burst**: when a merge wave > 10 PRs lands in a short window (the cf-o5j5 trigger)
- **Pre-cutover**: before any major release / DNS cutover, audit the trailing 14-day window

## 7. Tooling

- **Run:** `scripts/wave-audit/wave-audit.sh <since-date> [<until-date>]`
- **Cross-repo:** set `WAVE_AUDIT_REPO=DreadPirateRobertz/carolina-futons-web` (or any other gh-accessible repo) — defaults to the cfutons monorepo
- **Output:** markdown to stdout — redirect to `docs/audits/cf-<bead>-<window>-WIP.md` and curate manually before committing

## 8. Process integration

Once the ritual has run 2-3 weeks consistently, propose to mayor as a standing process. Each wave-audit doc lands as its own PR (5-agent CR per mayor's 2026-05-15 mandate); the wave-audit script + this conventions doc are infrastructure that travels with the ritual.

## 9. Pre-dispatch staleness check (cf-4hys)

**Before dispatching crew to an OPEN/HOOKED bead, run:**

```bash
python3 scripts/check_stale_hooked_bead.py <bead-id>
```

The script grep's the last 50 merged PRs for direct bead-ID matches or strong (≥2 distinctive) keyword overlap with the bead's title. Exit 0 = clean (safe to dispatch), exit 1 = warning (likely already shipped — investigate before dispatching).

**Why:** the 2026-05-16 session saw 7+ dispatch collisions where work had already shipped under a different bead-ID (cf-q8m2 shipped via cf-4x7e.A / PR #1285, cf-8r7v shipped via cf-gift-g1 / PR #589, cf-b8n8 shipped via check-doc-bead-refs.py, etc.). `bd show` reports HOOKED state but doesn't cross-reference recent merges — a bead can stay HOOKED indefinitely if the crew member shipped under a sibling bead-id and never ran `bd close` on the original.

**Where it fires:** PM workflow before any dispatch call. The PM should look at the warning, run `gh pr view <pr-number>` to verify, then either close the bead (if confirmed-shipped) or proceed with dispatch (if the warning was a false positive).

**Pure-function tests:** `scripts/test_check_stale_hooked_bead.py` pins the decision contract (direct-bead-id-match wins, ≥2 distinctive keyword overlap warns, stopword-only overlap doesn't warn, empty-PR-list returns None, multi-match tie-break on highest PR number).

## 10. Refs

- Source pattern PR: #1339 (cf-o5j5 wave32 cfw audit)
- Source PR with reachability lesson: #1346 (cf-5dto v5) + #1349 (cf-5dto.fu1 missed-merge recovery)
- Roadmap mail: cfutons/morgott → cfutons/melania 2026-05-15 cf-roadmap proposal
- Spy-assertion dimension: cfutons/morgott ↔ cfutons/radahn mail thread on cf-o5j5 #566 follow-up
- Staleness-check origin: 7+ dispatch collisions in 2026-05-16 session → cf-4hys process bead
