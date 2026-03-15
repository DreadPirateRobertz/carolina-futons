# Release v0.7.0

**Date:** 2026-03-14
**Since:** v0.6.0 (2026-03-14)
**PRs merged:** 4

## Highlights

- WCAG AA contrast fix: cf-blue (#5B8FA8) swapped to cf-blue-dark (#3D6B80) for all text uses — passes 5.81:1 ratio (hq-lw2i)
- Accessibility: 44px touch targets at mobile breakpoint, prefers-reduced-motion support, 14px min font (hq-hnzj)
- Performance: critical/deferred section splits for LCP, removed blocking masterPage schema await (hq-r3ie)
- Product Page polish: empty catches replaced with console.warn for debuggability (hq-nrf3)
- Test suite: 354 files, 13,426 tests passing (up from 13,380)

---

## Fixes (3)

| PR | Title |
|----|-------|
| #336 | WCAG AA contrast — swap cf-blue text to cf-blue-dark + focus-visible (hq-lw2i) |
| #337 | Product Page polish — replace empty catches with console.warn (hq-nrf3) |
| #339 | WCAG touch targets + prefers-reduced-motion + min font size (hq-hnzj) |

## Performance (1)

| PR | Title |
|----|-------|
| #338 | Optimize critical/deferred section splits and remove blocking await (hq-r3ie) |

---

## Stats

| Metric | v0.6.0 | v0.7.0 |
|--------|--------|--------|
| Test files | 351 | 354 |
| Tests | 13,380 | 13,426 |
| PRs | 25 | 4 |

## Contributors

- Dallas crew (bishop, burke, ripley, hicks) — accessibility, performance, polish
- miquella — coordination, release management
