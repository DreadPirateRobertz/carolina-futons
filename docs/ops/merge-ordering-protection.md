# Merge-ordering protection (cf-a5w3)

## The bug we keep losing to

After 4 consecutive incidents (cf-yvs4, cf-vtx5.fu2, cf-bkxh.fu, cf-0h9q.fu1) the pattern is clear:

1. Author opens PR at commit **A**.
2. Reviewer approves; admin queues merge (or clicks "Merge").
3. Author runs `git commit --amend` + `git push --force-with-lease` to commit **B**.
4. GitHub merges commit **A** — the amended fixes never land in `main`.

The race window is small (seconds) but persistent: every PR with a late "address review feedback" amend is exposed.

## Why force-with-lease doesn't save us

`--force-with-lease` only checks the *remote ref's tip* against what the author last fetched. It says nothing about whether GitHub has *already accepted* the merge. Once admin clicks "Merge" or queues the merge action, GitHub starts processing against the SHA it has — even if the author ships a force-push milliseconds later.

## The protection

A two-layer fix:

### Layer 1 — `merge-guard` workflow (separate PR, requires `workflow` token scope)

The workflow YAML is in this PR's branch as a draft at the bottom of this doc (§ Appendix). It **could not be committed in this PR** because the standard miquella push token lacks the `workflow` OAuth scope GitHub requires for `.github/workflows/*` mutations. Stilgar or millicent must push the file with a scoped token (or use the GitHub web UI to commit it directly).

When committed, the workflow runs on every `pull_request: synchronize` event (which fires on every push to a PR branch, including force-pushes). It emits a check called **`merge-guard / pin-head-sha`** bound to the PR head SHA at the moment the run starts.

The workflow itself does almost nothing — its job is to exist as a required check. The actual protection comes from Layer 2.

### Layer 2 — branch protection (one-time GitHub UI config)

In the GitHub repo Settings → Branches → Branch protection rule for `main`:

- ✅ **Require a pull request before merging**
  - ✅ Require approvals: 1
  - ✅ **Dismiss stale pull request approvals when new commits are pushed**
- ✅ **Require status checks to pass before merging**
  - ✅ **Require branches to be up to date before merging**
  - Required checks (search-and-add): `merge-guard / pin-head-sha`, plus existing required checks (`test (20)`, `test (22)`, `lint`, `Analyze JavaScript`, etc.)
- ✅ **Do not allow bypassing the above settings**

Together these settings enforce: **a PR can be merged only if `merge-guard` has passed on the most recent commit.** A force-push invalidates the previous `merge-guard` run (the new SHA has no check yet) → admin-merge button greys out until the new run completes → the race window closes.

## Why "Dismiss stale approvals" matters too

If a reviewer approved at SHA A and the author force-pushed to SHA B, the approval implicitly applies to A's diff. GitHub's "Dismiss stale approvals on new commits" forces re-approval on B. This catches the case where the merge isn't blocked by status checks but IS blocked by approval count.

## What this does NOT prevent

- A determined attacker who controls both the author and admin sessions could still race. Branch protection is not a bypass-resistant control against insider abuse; it's a hygiene gate against accidents.
- A genuinely-up-to-date PR that *adds* a new commit (not amend) is not blocked beyond normal CI requirements — those commits are additive, not destructive, so the race doesn't drop work.
- Bot-generated dependabot PRs that fast-forward merge: same protection applies; if dependabot rebases mid-merge, the merge-guard check catches it.

## Verifying the protection

After the workflow ships and branch protection is updated:

1. Open a draft PR with a trivial change.
2. Wait for `merge-guard / pin-head-sha` to pass.
3. Author force-pushes a tweak.
4. Confirm: the GitHub PR page shows the previous `merge-guard` check as superseded; the merge button is disabled until the new run completes.
5. Once the new run completes against the new SHA, merge unlocks.

## Owner

Author: miquella (cf-a5w3 implementation).
Branch-protection toggle ownership: Stilgar (admin) — must be flipped once the workflow ships in main.

## References

- bead: cf-a5w3
- losses: cf-yvs4, cf-vtx5.fu2, cf-bkxh.fu, cf-0h9q.fu1
- GitHub docs: [Required status checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging)

---

## Appendix — `merge-guard.yml` to commit at `.github/workflows/merge-guard.yml`

```yaml
name: merge-guard

# cf-a5w3 — see docs/ops/merge-ordering-protection.md for context.

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

permissions:
  contents: read
  pull-requests: read

concurrency:
  # One run per PR; a force-push cancels the prior run immediately so a
  # re-trigger lands a clean status against the new SHA.
  group: merge-guard-pr-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  pin-head-sha:
    name: pin-head-sha
    runs-on: ubuntu-latest
    timeout-minutes: 1
    steps:
      - name: Record PR head SHA
        env:
          # Quote-via-env so workflow-injection static analysis stays clean
          # even though all four values are GitHub-controlled (no user input).
          PR_NUMBER: ${{ github.event.pull_request.number }}
          PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}
          BASE_REF: ${{ github.event.pull_request.base.ref }}
        run: |
          # The check binds to PR_HEAD_SHA via the workflow run's commit
          # context. GitHub's "Required status checks must pass on the latest
          # commit" branch protection enforces that admin-merge is gated on
          # this run completing for the latest head SHA — not a previous one.
          echo "PR #${PR_NUMBER}"
          echo "head SHA: ${PR_HEAD_SHA}"
          echo "base ref: ${BASE_REF}"
          echo "merge-guard ✓"
```

Commit path: `.github/workflows/merge-guard.yml`. After landing, follow the §"Verifying the protection" steps above on a throwaway draft PR to confirm the check fires + branch protection blocks merge until it completes.
