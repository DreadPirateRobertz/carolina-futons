# cf-sp4f — S-Complexity Triage from cf-l6aj

**Bead:** cf-sp4f
**Author:** radahn
**Date:** 2026-05-04
**Scope:** 8 S-complexity beads filed under cf-l6aj.1–.23

---

## Triage rubric

- **P1** — launch-blocking or direct conversion lift
- **P2** — meaningful UX improvement, doesn't gate launch
- **P3** — optional polish, low impact, blocked, or duplicative

No S-complexity bead is launch-blocking, so the P1 row is empty. The
heavier conversion-impacting work (PDP financing, fabric-photo swatches,
size guide, etc.) lives in the M/L-complexity beads.

---

## Triage results

| Bead | Title | Priority | Why |
|------|-------|----------|-----|
| **cf-l6aj.7** | Home — Continue Shopping strip | **P2** | Returning-visitor conversion is a proven home-page lift. The LRU library (`src/lib/product/recently-viewed.ts`) already exists; this bead is pure wiring. Cheapest revenue lever in the S-bucket. |
| **cf-l6aj.6** | Home — Video showcase section | **P2** | Furniture buyers convert better after seeing product motion. `/videos` page + `src/lib/videos/catalog.ts` exist; this surfaces 3 thumbs on home + a CTA. Conversion-adjacent, low effort. |
| **cf-l6aj.13** | Sitewide — PWA Install Banner | **P2** (was P3) | Re-engagement → repeat sessions → conversion. Trivial client component. **Caveat:** the canonical mobile experience is `cfutons_mobile` (native via dallas's rig), so PWA is the secondary mobile channel. Worth shipping anyway since it's nearly free. |
| **cf-l6aj.4** | Home — Blog teasers section | **P3** (was P2) | Drives content engagement / SEO, not direct conversion. `/blog` already exists; teasers are nice but not lever-pulling. Demoted from P2 because two other S beads outrank it. |
| **cf-l6aj.8** | Home — Recently Viewed (home) | **P3** | **Overlaps with cf-l6aj.7** (same `recently-viewed.ts` source). Probably should merge into the cf-l6aj.7 design review rather than ship as a separate strip. Recommend melania mark this **blocked-by cf-l6aj.7** and reconsider after .7 ships. |
| **cf-l6aj.9** | Home — Inline newsletter section | **P3** | cfw already has TWO email-capture surfaces: `EmailCapturePopup` (exit-intent) + `NewsletterSignup` in footer. A third surface on home is diminishing returns. Defer until A/B data justifies it. |
| **cf-l6aj.10** | Home — Gift Card CTA section | **P3** | **Blocked by cf-u7yk** (Gift Cards page). Can't promote a route that doesn't exist. Auto-unblocks once cf-u7yk lands. |
| **cf-l6aj.23** | Audit doc errata — refresh `cfw-parity-audit.md` | **P3** | Doc-only fix. No direct user impact. Worth doing soon for crew-dispatch hygiene (current doc routes effort to ProductInfoModal + AddToCompareButton work that's already shipped), but not P2 because impact is meta, not user-facing. |

---

## Dispatch order recommendation (P2 batch — ready now)

1. **cf-l6aj.7** (Continue Shopping) — kick off first; ship before .6 and .13 because `cf-l6aj.8` is gated on it.
2. **cf-l6aj.6** (Video showcase) — independent, can run in parallel with .7.
3. **cf-l6aj.13** (PWA banner) — independent, can run in parallel.

Once cf-l6aj.7 lands, re-evaluate cf-l6aj.8: if Continue Shopping covers the
"surface recently-viewed on home" use-case, close cf-l6aj.8 as duplicate.

---

## P3 batch — file when capacity opens

- **cf-l6aj.4** (Blog teasers) — ship anytime; small but low priority.
- **cf-l6aj.23** (Audit doc errata) — recommend bumping to **P2** if any crew member is currently picking work from the parity audit, since stale rows mislead dispatch. Otherwise P3 is fine.
- **cf-l6aj.9** (Inline newsletter) — defer until email A/B testing identifies a gap.
- **cf-l6aj.10** (Gift Card CTA) — auto-unblocked when cf-u7yk lands; can be picked up in the same sprint as cf-u7yk's PR review pass.
- **cf-l6aj.8** (Recently Viewed home) — re-evaluate after cf-l6aj.7.

---

## Summary counts

| Priority | Count | Beads |
|----------|-------|-------|
| **P1** | 0 | — |
| **P2** | 3 | cf-l6aj.6, cf-l6aj.7, cf-l6aj.13 |
| **P3** | 5 | cf-l6aj.4, cf-l6aj.8, cf-l6aj.9, cf-l6aj.10, cf-l6aj.23 |

Priority updates applied via `bd update`:
- cf-l6aj.4: P2 → P3
- cf-l6aj.13: P3 → P2

All other beads' priorities already match this triage from initial filing.
