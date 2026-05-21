# PM Update — cfutons (melania) — 2026-05-21 ~08:30 MT

## cfw-66o Epic — COMPLETE ✓
## PR #920 (cfw-sej revalidate module) — MERGED ✓

| PR | Branch | Status |
|----|--------|--------|
| #896 cfw-66o.3 | descriptions | MERGED ✓ |
| #900 cfw-66o.5 | featured-row | MERGED ✓ |
| #902 cfw-66o.4 | shop copy | MERGED ✓ |
| #904 cfw-66o.7 | social URLs | MERGED ✓ |
| #907 cfw-66o.11 | about seeds | MERGED ✓ |
| #909 cfw-66o.12 | brenda guide announcement | MERGED ✓ |
| #911 cfw-66o.13 | SITE-OWNER-GUIDE | MERGED ✓ |
| #915 cfw-e90 | audit LIVE status | MERGED ✓ |
| #916 cfw-nlv | og-metadata test | MERGED ✓ |
| #917 cfw-sej-prep | cache tag opt-in | MERGED ✓ |
| #918 cfw-66o.14 | seed coverage test | MERGED ✓ |
| #919 cfw-cpn | audit §1 full keys | MERGED ✓ |
| #920 cfw-sej | revalidate.ts module | MERGED ✓ |

seed-data.json: 55 rows on main ✓

## Current Crew

| Crew | Bead | Status |
|------|------|--------|
| morgott | cfw-4ul | IN_PROGRESS — contact/about getSiteContent tests |
| rennala | cfw-hjp | OPEN — brenda-admin-guide §4/§5/§6 |
| godfrey | cfw-8j2 | OPEN — Wix CMS webhook for revalidateTag |
| radahn | cfw-x0s | OPEN — 5-agent review on cfw-4ul + cfw-hjp PRs |
| blaidd | cfw-36d | OPEN — CategoryPills e2e (needs LOW_CTX restart) |
| miquella | cf-q0kr + cf-47dm | IN_PROGRESS — og-metadata.test.ts fixes (P3) |
| millicent | cfw-dp2 | OPEN — getSiteContent cache tag regression test |

## Follow-on Beads (miquella, P3)
- cf-q0kr: restore getSiteContent mock default afterEach in og-metadata.test.ts
- cf-47dm: add empty-string getSiteContent coverage for rawDescription guard

## Pre-existing e2e failures (not blocking)
- about-page strict mode /1991/ (4 elements matching)
- api-newsletter mailingListSignups HTTP 404
→ Admin-merge pattern applies
