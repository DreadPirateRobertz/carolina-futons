# cf-69fi Week-2 `--strict` flip plan

**Bead:** cf-69fi.1 (cf-69fi.fu1)
**Parent:** cf-69fi (CI regression guard, PR #1354)
**Codified:** 2026-05-16

The dead-code regression guard (`.github/workflows/dead-code-guard.yml`) ships in **Week-1 soft-fail mode** — it annotates the PR with `::warning::` on regression but does not block merges. This doc plans the Week-2 flip to `--strict` mode (blocking).

---

## Why a phased flip

A hard CI gate that fires on Day-1 catches problems but also disrupts legitimate work if the gate has false positives. A 14-day soft-fail observation window lets us measure the **false-positive rate** before letting the gate block.

If during Week-1:
- Zero false-positive warnings: flip on schedule, low risk.
- 1–2 false-positive warnings: investigate, decide per-case if to relax baseline / fix detector / proceed anyway.
- 3+ false-positive warnings: detector or baseline needs work BEFORE flipping; file a fast-follow.

## Gating criteria for the flip

The Week-2 flip happens when ALL of:

1. **≥ 14 days of soft-fail observation** since PR #1354 merge (target: 2026-05-30).
2. **False-positive rate ≤ 1 per 10 wave-merges** during the observation window.
3. **No outstanding false-positive analysis** (every Week-1 `::warning::` was triaged + closed).
4. **cf-69fi.fu1 skip-switch shipped** (this PR) — emergency hotfix path exists.
5. **melania PM signal** that the cleanup wave is stable enough to gate.

## The flip itself

One-line workflow change:

```yaml
# .github/workflows/dead-code-guard.yml
- name: Check regression vs baseline (strict mode, Week-2+)
  if: steps.skip.outputs.skip != 'true'
  run: |
    python3 scripts/cf-dead-routes/check-regression.py \
      --results /tmp/cf-dead-routes/results.json \
      --baseline scripts/cf-dead-routes/baseline.json \
      --strict   # ← the flip
```

That's it. `check-regression.py` already supports `--strict` (exit 1 + `::error::`). The PR opening the flip should include:
- Reference to this plan doc as the gating-criteria justification.
- The 14-day observation log (count of warnings, false-positive analysis, baseline ratchet history).
- Re-request 5-agent CR.

## The skip-switch (this PR)

When `--strict` is on, an emergency hotfix may need to ship even if the dead-code guard would block. The kill switch is:

**Put `[skip-deadcode-guard]` somewhere in the PR title.**

The marker is case-insensitive and whitespace-tolerant inside the brackets, but the brackets themselves are mandatory (explicit opt-in; not triggered by casual "skip" or "deadcode" mentions). The workflow short-circuits with a `::warning::` annotation including the PR title verbatim, so the bypass is auditable.

**Scope:** marker is read from the PR **title only**, not the PR body. The title is grep-able from the GitHub Actions UI + log; body content would require extra workflow plumbing and offers no audit-visibility win. Put the justification in the PR body, the kill-switch marker in the title.

This is **not a free pass.** The 5-agent CR mandate still applies (mayor's 2026-05-15 standing order). The bypass must be justified in the PR body. Reviewers should refuse `[skip-deadcode-guard]` PRs that don't articulate the emergency.

### When the kill switch is appropriate

- True emergency hotfixes: SSL cert expiry, security incident response, rollback of a regression that introduced un-detectable dead code as collateral.
- Detector bugs: dead-code guard false-positives a real-but-alive method; ship the hotfix with `[skip-deadcode-guard]` and file an immediate cf-69fi.fu2 follow-up.

### When the kill switch is NOT appropriate

- Convenience: "I don't want to wait for the ratchet PR."
- Avoiding work: skipping the gate because it caught a real regression.
- Unblocking a stale baseline: ratchet the baseline first; don't bypass.

## Rollback plan if the flip causes problems

If Week-2 strict mode causes >2 false-positive PR-blocks in the first 48 hours:
1. Revert the `--strict` flag (one-line PR).
2. File cf-69fi.fu2 (NEW) describing the failure mode.
3. Stay in soft-fail until detector or baseline is fixed.
4. Try the flip again only when the underlying issue is resolved.

## Refs
- Parent: cf-69fi (PR #1354)
- Sibling: cf-69fi.2 (bot-PR baseline ratchet, P4)
- Bot-PR baseline auto-ratchet (when shipped) ensures the baseline never goes stale, reducing false-positive surface.
- Pattern: `.github/workflows/coverage-ratchet.yml` (vitest coverage flip-and-ratchet history)
