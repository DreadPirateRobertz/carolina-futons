# cf-69fi.fu3 — `gh pr merge --auto` opt-in for narrow ratchet PRs (proposal)

**Bead:** cf-69fi.3 (P4)
**Parent:** cf-69fi (PR #1354 — dead-code regression guard)
**Sibling:** cf-69fi.fu2 (PR #1357 — auto-ratchet bot)
**Status:** DESIGN PROPOSAL — **requires mayor discussion before implementation**

This doc is the design artifact for cf-69fi.fu3. The bead description explicitly gates implementation on "discuss with mayor first" — this doc IS that discussion proposal. Implementation is deferred pending mayor approval of the safety-criteria + audit-trail design below.

Per mayor's 2026-05-15 5-agent standing order, every PR merge (including auto-merge) requires 5 distinct crew sign-offs. This proposal does **not** bypass that mandate — it codifies the conditions under which `gh pr merge --auto` is appropriate AFTER the 5 sign-offs land.

---

## Problem

The cf-69fi.fu2 auto-ratchet bot (PR #1357) opens PRs ratcheting `baseline.json` down when live dead-counts drop below the floor. Each such PR is:
- Mechanically generated
- Touches exactly one file
- Diff is entirely downward (per the cf-69fi.fu2 decision contract — "axis rose" → no PR)
- Provably safe by construction (the contract is pinned by 12 tests)

Even so, every ratchet PR currently requires:
1. 5-agent CR per mayor's mandate
2. Manual `gh pr merge --admin` from an operator

The operator-merge step is toil. Once 5/5 reviewers have signed off, the merge is mechanical. Auto-merge is the natural close of the loop.

## Proposal

Add `gh pr merge --auto --squash` to the auto-ratchet workflow IF AND ONLY IF the PR satisfies all 5 narrow criteria. Otherwise, behavior is unchanged (open PR, wait for operator).

### Safety criteria (ALL must hold)

1. **Single-file diff:** only `scripts/cf-dead-routes/baseline.json` changed. No other source files, tests, workflows, or docs.
2. **Downward only:** verified by re-running `decide_ratchet()` on the PR's tree state; result must be a ratchet decision (not None).
3. **Tests still pass:** the full cf-dead-routes pytest suite runs in the same workflow + passes.
4. **5 distinct crew APPROVED reviews:** queried via `gh pr view --json reviewRequests,reviews` — count distinct authors with APPROVED state.
5. **No REQUEST-CHANGES outstanding:** any open REQUEST-CHANGES blocks auto-merge regardless of approval count.

If any criterion fails, the workflow stops at "open PR" — no auto-merge.

### Implementation sketch

```yaml
- name: Auto-merge if eligible (cf-69fi.fu3)
  if: steps.decide.outputs.ratchet == 'true' && steps.eligibility.outputs.eligible == 'true'
  env:
    GH_TOKEN: ${{ github.token }}
    PR_NUMBER: ${{ steps.create_pr.outputs.number }}
  run: |
    set -euo pipefail
    gh pr merge "$PR_NUMBER" --auto --squash --delete-branch
```

A new step `eligibility` runs after `create_pr` and computes the 5-of-5 from `gh pr view`. It's a separate step so the eligibility logic is reviewable + testable in isolation (mirror the `auto_ratchet.decide_ratchet` factoring).

### TDD-pre-write

The eligibility check is the testable surface:

```python
# scripts/cf-dead-routes/test_auto_merge_eligibility.py — to be authored
def test_eligibility_requires_single_file_diff(): ...
def test_eligibility_requires_5_distinct_approvals(): ...
def test_eligibility_rejects_open_request_changes(): ...
def test_eligibility_rejects_non_ratchet_diff(): ...
def test_eligibility_rejects_failing_tests(): ...
def test_eligibility_passes_clean_ratchet_with_5_approves(): ...
```

These are TDD-pre-write — would land in the implementation PR, not this proposal.

## Why discuss with mayor first

The 5-agent CR mandate (Stilgar 2026-05-15) has a **human-eyes-on-merge** implicit assumption. Even if 5 reviewers have signed off, the merge button click is itself a gate — a moment where an operator can catch something the reviewers missed in aggregate.

Auto-merge removes that final click. The proposal argues the merge is safe-by-construction for the narrow ratchet case, but the mayor (and the audit trail going forward) should decide whether the safety argument is strong enough to compress the human gate to zero.

### Failure modes to discuss

1. **Reviewer drift:** could 5 reviewers approve a non-ratchet PR by mistake? (Mitigation: criterion #2 re-runs `decide_ratchet` on the actual tree.)
2. **Test-fixture pollution:** could the test suite false-pass? (Mitigation: criterion #3 runs the FULL suite, not a subset.)
3. **Race conditions:** what if a regression lands on main between PR open + auto-merge? (Mitigation: GitHub's `--auto` flag re-checks branch protections at merge time.)
4. **Audit trail:** can a forensic reviewer reconstruct what was auto-merged + why? (Yes — the PR description includes the live counts + the eligibility-check log line; the bot identity is in commit author.)

### Alternatives

- **Status quo:** operator clicks merge manually. Costs ~10-30 seconds of toil per ratchet PR.
- **Label-based:** require a `auto-merge-ratchet` label set by the bot at PR creation; auto-merge only fires if label is present. Adds a check + a recoverable bailout (operator can remove label to block).
- **Time-gated:** require PR to be open ≥ N hours before auto-merge fires. Lets the wave-audit ritual surface anything weird.
- **Mayor-approval:** require an explicit "auto-merge approved" label set by mayor herself. Maximally conservative.

## Recommendation

If mayor approves, ship Option A (5-criteria gate). If she's hesitant, ship Option B (label-based + time-gated). The bot is the consumer either way — operator workload drops to zero in the steady state.

## Open questions

1. Should auto-merge fire only when DEAD axis dropped, or also when UNUSED-CAN-DELETE axis dropped? (Proposal: both — the cf-69fi.fu2 contract already verifies "no axis rose".)
2. Should the workflow open the PR but NOT immediately auto-merge — instead set `--auto` so the merge happens when criteria are met later? (Proposal: yes — `gh pr merge --auto` is GitHub-native and handles the wait.)
3. Should we log the auto-merge to a separate audit channel beyond the GitHub timeline? (Proposal: no — GitHub's timeline + the wave-audit ritual catches it.)

## Implementation deferred

This is a proposal doc only. No code changes in this PR. If mayor signs off, a follow-up PR implements the eligibility check + workflow integration + tests.

## Refs

- Parent: cf-69fi (PR #1354)
- Sibling: cf-69fi.fu2 auto-ratchet bot (PR #1357)
- Mayor's standing order: 2026-05-15 5-agent CR mandate
- radahn obs#3 on PR #1357 (the source suggestion)
