# PM Update — cfutons (melania) — 2026-05-21 ~08:05 MT

## cfw-66o Epic Status — Owner-friendly Admin UI

| Bead | PR | Assignee | Status |
|------|-----|----------|--------|
| cfw-66o.3 | #896 | radahn | MERGED ✓ |
| cfw-66o.4 | #902 | miquella | MERGED ✓ |
| cfw-66o.5 | #900 | blaidd | MERGED ✓ |
| cfw-66o.6 | #899 | godfrey | MERGED ✓ |
| cfw-66o.7 | #904 | rennala | MERGED ✓ |
| cfw-66o.11 | #907 | morgott | MERGED ✓ |
| cfw-66o.12 | #909 | miquella | MERGED ✓ |
| cfw-66o.13 | #911 | morgott | MERGED ✓ |
| cfw-66o.14 | #918 | radahn | CI in_progress (lint running) |
| cfw-sej | #917 | godfrey | CI in_progress (lint running) |
| cfw-e90 | #915 | morgott | MERGED ✓ (audit §2 LIVE status updated) |
| cfw-nlv | #916 | rennala | MERGED ✓ (og-metadata CMS override test) |
| cfw-cpn | #919 | rennala | MERGED ✓ (audit §1 home/about/contact keys added) |

## seed-data.json state (post-all-merges)
- main: 55 rows (45 cfw-66o.11 + 7 cfw-66o.3 descriptions + 3 cfw-66o.5 featured)

## cfw-66o Epic Closure Gate
Open blockers:
1. cfw-66o.14 (PR #918) — seed key coverage meta-test — radahn
2. cfw-sej (PR #917) — getSiteContent cache tag opt-in — godfrey

Both PRs have e2e ✓, lint in_progress. Admin-merge eligible once lint passes (pre-existing e2e pattern applies).

## Crew Health
- radahn: cfw-66o.14 (PR #918 open, CI running)
- godfrey: cfw-sej (PR #917 open, CI running)
- blaidd: cfw-36d (CategoryPills E2E) — needs LOW_CTX restart first
- morgott: FREE (cfw-e90 DONE, PR #915 merged)
- rennala: cfw-cpn DONE; now idle
- miquella: cfw-lz3 (5-agent review PRs #916 + #915)
- millicent: cfw-eer (getSiteContent cache tag opt-in — separate from cfw-sej)

## Pending Tasks
- Monitor #917 + #918 lint → admin-merge when green
- cfw-66o epic close: wait for #917 + #918 merge, then close parent bead
- miquella cfw-lz3: post-merge review of #916 + #915
- blaidd cfw-36d: after restart
- millicent cfw-eer: in_progress
- Assign morgott + rennala new beads (both free)

## Pre-existing e2e failures (not blocking)
- about-page strict mode /1991/ (4 elements matching)
- api-newsletter mailingListSignups HTTP 404
- Various console-errors tests
→ Admin-merge pattern applies for all PRs with only these failures
