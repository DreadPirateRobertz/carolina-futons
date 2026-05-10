# cf-qmxf — GH Actions e2e runner investigation

**Bead**: cf-qmxf · **Investigated by**: cfutons/crew/morgott · **Date**: 2026-05-10

## TL;DR

**Bead's hypothesis is wrong.** The e2e jobs on PRs #546, #547, #548 (carolina-futons-web) were not stuck queued, runner-exhausted, or capacity-throttled. They were **manually canceled by `@DreadPirateRobertz`** mid-run, on all three PRs. The "0s elapsed" the bead author observed was the visible state in the brief window between cancel-issued and runner-acknowledged.

No GH Actions configuration change is recommended. The real signal underneath the cancellations is **e2e job duration on PRs (9–14m for a clean run)** combined with a velocity push to admin-merge low-risk PRs.

---

## Evidence

`gh run view` annotations on each of the 3 runs show identical pattern:

| PR | Run ID | e2e duration | Annotation |
|---|---|---:|---|
| #546 | 25622050326 | 14m29s | `The run was canceled by @DreadPirateRobertz.` + `The operation was canceled.` |
| #547 | 25622165580 | 9m20s | `The run was canceled by @DreadPirateRobertz.` + `The operation was canceled.` |
| #548 | 25622361908 | 1m45s | `The run was canceled by @DreadPirateRobertz.` (twice) + `The operation was canceled.` |

PR #548 also shows `lint-typecheck-test` failing at 1m51s — also a cancellation, since the cancel command terminates all jobs in the run group together.

Sentinel artifacts: every run logged `No files were found with the provided path: playwright-report/. No artifacts will be uploaded.` — Playwright never reached the report-emit step because the runner was killed.

## What's actually NOT the problem

The bead's enumerated investigation steps:

1. **"Concurrent job limit on the public repo's free Actions tier"** — not the issue. The 3 jobs ran for non-trivial durations (1m45s, 9m20s, 14m29s) before cancellation. If the tier were saturated, they'd never start.

2. **"Runner group exhausted / no available runners for the e2e job matrix"** — not the issue. Both jobs used the standard `ubuntu-latest` runner pool, which is auto-scaled by GitHub. Same evidence as #1: jobs started.

3. **"Job dependency or concurrency group locking"** — not the issue. The current `ci.yml` has no `concurrency:` declaration at the workflow or job level, so multiple PR runs can execute in parallel without serialization.

## What IS the underlying signal

The user canceled because they wanted to admin-merge despite e2e not being green. The bead notes "all changes were additive CSS or docs — low risk" — that's the rationale for the admin-merge, not for a capacity hypothesis.

If users are routinely canceling e2e to land low-risk PRs faster, the velocity drag has two latent causes:

1. **e2e takes 9–14m on a clean PR run** — slow enough that waiting for it on a 1-line CSS change feels disproportionate.
2. **e2e is a required check on `main`** (per the admin-merge requirement that triggered cancellation in the first place) — so even when it's irrelevant to the change, you can't merge without canceling it.

## Recommended actions (none require touching the workflow file)

These are repo-settings / process changes, not code changes. They are listed in increasing order of behavioral impact.

### 1. Make e2e a non-required check on `main`

**Where**: GitHub repo settings → Branches → `main` branch protection → "Require status checks" list. Remove `e2e` from the required-checks list while keeping `lint-typecheck-test` and `Vercel`.

**Effect**: PRs can merge with e2e green OR pending; admin-merging without canceling becomes unnecessary; nightly + scheduled runs still execute it for coverage. **The path-filter logic in ci.yml (cf-s5cs) already skips e2e for doc/config-only PRs**, so the only PRs that would actually run e2e are commerce-critical edits — the ones where e2e mattering is most likely.

**Trade-off**: a regression in commerce flow could merge with e2e red. Mitigated by Vercel preview deployments still running the suite manually-reachable, and by nightly cron catching it within 24h.

**Recommendation**: ship this. Lowest blast radius; matches the actual usage pattern.

### 2. Reduce e2e PR-run duration

**Where**: `.github/workflows/ci.yml` lines 113–115 (the `Run E2E tests` step).

**Effect**: faster feedback on PRs where e2e is path-relevant. Concrete options (from cheapest to most invasive):
- `npx playwright test --project=chromium --reporter=line` (drop the HTML reporter on PRs; keep on nightly)
- `npx playwright test --workers=4` if the suite is currently single-worker
- Shard via Playwright's `--shard=1/N`/`--shard=2/N` matrix strategy and parallel jobs

**Trade-off**: workflow YAML edit → one Vercel build per push (cf-ukc6 sensitive). Defer until cf-ukc6 standing order is lifted, OR batch with the next cfw merge window.

### 3. Add a `skip-e2e` PR label

**Where**: `.github/workflows/ci.yml` `e2e` job's `if:` condition — extend with `&& !contains(github.event.pull_request.labels.*.name, 'skip-e2e')`.

**Effect**: low-risk authors apply the label and the e2e job never starts; no need to admin-merge or cancel.

**Trade-off**: workflow YAML edit (cf-ukc6 sensitive). Also creates a label-discipline burden — easy to over-apply.

**Recommendation**: defer until #1 has been observed for ≥1 week. If users still feel friction, then add the label as a finer-grained tool.

## Out of scope

- **Actions billing / minutes**: not investigated here. The `ubuntu-latest` runner usage is not the bottleneck; the cancellation pattern would not be solved by more minutes. If billing is the concern, it is orthogonal to cf-qmxf.
- **Codecov upload failure** (`Token required because branch is protected`) seen in the same logs is a separate bug and out of scope; flagged for a follow-on bead.

## Implementation plan

1. **Now**: this report lands in `docs/ops/` of the cfutons monorepo as a doc-only PR (no cfw push, no Vercel build cost).
2. **Next**: melania confirms recommendation #1, then either (a) Stilgar removes `e2e` from `main`'s required-checks list via GitHub UI, or (b) opens a follow-on bead delegating that one-click change.
3. **Optional later**: if recommendations #2 or #3 are pursued, batch the YAML edit into a cfw merge window per cf-ukc6.

## Refs

- Original bead: cf-qmxf
- Related: cf-ukc6 (Vercel build credit standing order — informs why this report is doc-only and stays in cfutons monorepo)
- Workflow: `.github/workflows/ci.yml` in `DreadPirateRobertz/carolina-futons-web` (no edit recommended in this chunk)
- PRs cited: carolina-futons-web#546, #547, #548 (all admin-merged)
