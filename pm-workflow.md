# PM Workflow — cfutons/crew/melania

## Pre-Dispatch Staleness Check (cf-4hys)

**Mandatory before dispatching crew to any HOOKED or OPEN bead.**

Root cause: 8+ dispatch collisions on 2026-05-16 where beads remained HOOKED after work shipped under a different PR or bead ID. Each collision wastes one crew cycle.

### Quick check (one bead)

```bash
cd ~/gt/cfutons
gh pr list --repo DreadPirateRobertz/carolina-futons --state merged --json number,title --limit 50 \
  | python3 -c "import sys,json;[print(f'#{p[\"number\"]}: {p[\"title\"]}') for p in json.load(sys.stdin) if 'cf-XXXX' in p['title'].lower()]"
```

Replace `cf-XXXX` with the bead ID. If a merged PR title matches → verify and `bd close` before dispatching.

### Full sweep (all in-progress beads)

```bash
cd ~/gt/cfutons
bash scripts/check-stale-beads.sh --repo DreadPirateRobertz/carolina-futons-web
```

Exit 0 = all clean. Exit 1 = stale beads found (STALE lines printed with matching PR).

**When to run:**
- Every session start (before dispatching any crew)
- Before every cutover-prep gate
- After a watchdog IDLE flood (8+ idle alerts = stale state likely)

### Decision table

| bd state | PR title grep | Action |
|---|---|---|
| HOOKED/OPEN | No merged PR match | Dispatch normally |
| HOOKED/OPEN | Merged PR match | Verify PR content → `bd close` → skip dispatch |
| IN_PROGRESS | No merged PR match | Check bead comments for blocker note → leave alone |
| IN_PROGRESS | Merged PR match | Verify → `bd close` → reassign if sub-bead follow-on needed |

---

## 5-Crew Review Mandate

All PRs require a 5-crew confidence-scored review before merge. Post via:

```bash
gh pr review <NUM> --repo DreadPirateRobertz/carolina-futons --comment --body "..."
gh pr review <NUM> --repo DreadPirateRobertz/carolina-futons-web --comment --body "..."
```

Filter issues ≥80 confidence. PM is final arbiter.

---

## Admin-Merge Protocol (cfutons only)

cfutons has `enforce_admins` protection. Bypass pattern:

```bash
gh api repos/DreadPirateRobertz/carolina-futons/branches/main/protection/enforce_admins -X DELETE
gh pr merge <NUM> --repo DreadPirateRobertz/carolina-futons --squash --admin
gh api repos/DreadPirateRobertz/carolina-futons/branches/main/protection/enforce_admins -X POST
```

Always re-enable after merge.

---

## Vercel Build Credit Conservation (cf-ukc6)

Batch cfw merges 3-5 at a time. Each push to carolina-futons-web main = 1 Vercel deploy. Override for P0 cutover gates or Stilgar live-watch only.

---

## e2e Cancelled ≠ Failure (cfw)

For carolina-futons-web PRs: `e2e fail` with `conclusion: cancelled` = Stilgar manual cancel, NOT a real failure. Admin-merge is correct if lint ✅ + Vercel ✅. Verify with:

```bash
gh run view <RUN_ID> --repo DreadPirateRobertz/carolina-futons-web --json status,conclusion
```
