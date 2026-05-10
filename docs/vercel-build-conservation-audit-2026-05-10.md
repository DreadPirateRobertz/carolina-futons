# Vercel Build Conservation Audit — 2026-05-10 follow-up

**Bead context:** Follow-up to `docs/vercel-build-conservation-audit-2026-05-09.md` (PR #1169). The original audit captured ~1 hour of post-rule data; this one covers the full 24h+ post-rule window the user asked for.
**Memory pin:** `project_pending_vercel_audit_followup.md` (now removable).
**Author:** millicent
**Window analyzed:** 2026-04-29 → 2026-05-10 09:00 UTC (1100 deploys total)
**Method:** `GET https://api.vercel.com/v6/deployments?projectId=...&teamId=...` paginated, 11 pages × 100 deploys each, deduplicated by `uid`.

## Headline

**The cf-ukc6 "push complete PRs only" rule is working — for humans and crew agents.** Pre-rule (2026-05-04), the top 8 agents averaged 31 preview deploys/day. Post-rule (2026-05-10 thus far), the same 8 agents averaged **5 preview deploys/day** — a **6× drop**, very close to the 8× signal flagged in PR #1169.

**However, a new dominant burner has emerged: the auto-PR coverage-ratchet workflow.** It accounts for **56 of 145 preview deploys (39%)** in the 2026-05-10 window — all on a single branch (`chore/coverage-ratchet-bump`) that gets force-amended every time main moves.

## Per-day deploy totals

| UTC day | Total | Note |
|---|---|---|
| 2026-04-29 | 19 | quiet weekday |
| 2026-04-30 | 3 | very quiet |
| 2026-05-01 | 1 | — |
| 2026-05-03 | 55 | weekend |
| **2026-05-04** | **434** | pre-rule burn day (`millicent` + `morgott` + `rennala` cluster) |
| 2026-05-05 | 121 | tail of the burn |
| 2026-05-09 | 256 | rule landed mid-day at 14:46 UTC |
| **2026-05-10** | **211 (so far, 09:00 UTC)** | **post-rule, full window** |

### 2026-05-09 split (rule landed 14:46 UTC)

| Window | Deploys |
|---|---|
| 00:00 → 14:46 (pre-rule) | 16 |
| 14:46 → 23:59 (post-rule) | 240 |

The 14:46 cutoff actually shows a deploy SPIKE post-rule, but that's misleading — most of the post-14:46 spike came from the start of the morgott coverage-recovery push and the auto-PR loop, not WIP iteration. See the per-author table for the truth.

## Per-author breakdown — pre-rule vs post-rule

Same 8 most-active agents, comparing 2026-05-04 (pre-rule burn day) to 2026-05-10 (post-rule full window so far):

| Author | 2026-05-04 (pre-rule) | 2026-05-10 (post-rule) | Δ |
|---|---:|---:|---|
| rennala | 47 | 2 | **−45 (−96%)** |
| morgott | 46 | 0 | **−46 (−100%)** |
| Chris Deal | 38 | 5 | **−33 (−87%)** |
| millicent (me) | 34 | 0 | **−34 (−100%)** |
| blaidd | 32 | 23 | −9 (−28%) ⚠ |
| miquella | 31 | 8 | −23 (−74%) |
| godfrey | 26 | 2 | −24 (−92%) |
| melania | 21 | 1 | −20 (−95%) |
| **8-agent total** | **275** | **41** | **−234 (−85% drop)** |

The rule is genuinely effective. Of the 8 agents who burned the 2026-05-04 day, six dropped by 74% or more. Two notes:

- **blaidd** dropped only 28% and her worst branch had 6 shas — the most WIP-on-single-branch behavior I see today. Worth a polite ping; she may not be aware of cf-ukc6 or may have a flow that genuinely needs iteration on a draft. Not pinging here, but flagging for melania to decide.
- **morgott** and **millicent** went to zero, showing the rule + the local-verify habit landed cleanly for those two lanes.

## New finding: github-actions[bot] is now the dominant burner

| Author | 2026-05-10 preview deploys | Branches | Max shas / branch |
|---|---:|---:|---:|
| **github-actions[bot]** | **56** | **1** | **56** |
| blaidd | 23 | 12 | 6 |
| quartz | 20 | 20 | 1 |
| obsidian | 18 | 18 | 1 |
| miquella | 8 | 7 | 2 |
| Chris Deal | 5 | 5 | 1 |

**56 deploys × 1 branch × 56 unique shas = the auto-PR coverage-ratchet workflow force-amending `chore/coverage-ratchet-bump` every time main moves.**

This is a self-inflicted wound from my own earlier work — I shipped the auto-PR loop in `coverage-ratchet.yml` and it's now the largest single source of preview burn on the project. Each main push triggers a workflow run that:

1. Re-computes the coverage thresholds from coverage-summary.json
2. Force-pushes the new ratchet bump onto `chore/coverage-ratchet-bump`
3. Vercel sees the new sha on the watched branch and starts a fresh preview deploy

The `concurrency: { group: coverage-ratchet, cancel-in-progress: true }` block on the workflow stops duplicate WORKFLOW runs but does not stop the post-push DEPLOY. Vercel deploys what it sees in git, regardless of workflow state.

## Recommended fix

The coverage-ratchet branch is **machine-managed and never deserves a preview deploy** — it never gets human-merged from a preview-link review. The auto-PR is read by humans on github.com (file diff), then merged.

**Action:** in `vercel.json`, exclude the `chore/coverage-ratchet-bump` branch from preview deploys:

```jsonc
{
  "git": {
    "deploymentEnabled": {
      "main": true,
      "chore/coverage-ratchet-bump": false
    }
  }
}
```

Reference: <https://vercel.com/docs/git/vercel-for-github#ignore-builds-for-a-branch>

Estimated saving: **56 preview deploys/day** (39% reduction in current daily burn). Over a month: ≈ 1700 fewer preview deploys.

Alternative (lighter-touch): set an `Ignored Build Step` in the Vercel dashboard that runs:

```sh
if [[ "$VERCEL_GIT_COMMIT_REF" == "chore/coverage-ratchet-bump" ]]; then
  echo "skipping preview build for coverage-ratchet branch"
  exit 0  # exit 0 = skip build
fi
exit 1  # exit 1 = proceed with build
```

Same effect; configurable in the dashboard at `Settings → Git → Ignored Build Step` without a code change.

**Recommend the `vercel.json` approach** — it's version-controlled, gets reviewed in PR, and won't drift if Stilgar re-clicks the dashboard later.

## Recommendation: file as a P1 sub-bead under cf-ukc6

This is the one remaining high-leverage knob to turn for build conservation. After this lands, the daily burn should drop from 145 preview deploys → ~85, putting the project comfortably within free-tier-ish territory even before considering the Pro Plus 1 TB bandwidth cap.

I'll file the bead as cf-ukc6-followup if melania doesn't sling something specific.

## Memory file disposition

`project_pending_vercel_audit_followup.md` can be removed — this audit ships the deliverable it pinned. The findings supersede it.

## References

- Original audit: PR #1169 (2026-05-09, 1-hour post-rule window)
- Standing order: cf-ukc6 (Vercel build credit conservation)
- Prior coverage-ratchet workflow: `.github/workflows/coverage-ratchet.yml` (auto-PR loop, my prior work)
- Plan confirmation: `docs/cf-3qt.8/vercel-pro-upgrade-checklist.md` (PR #1282) — Pro Plus already active, $20-30/month steady-state
- Vercel docs: <https://vercel.com/docs/git/vercel-for-github#ignore-builds-for-a-branch>
