# cfutons Rig Report — Carolina Futons (Web)

**Last Updated:** 2026-02-28 21:35 MST (melania)

---

## Session Update — 2026-02-28 21:35 MST

### Hookup Readiness: GO

Everything is on main and ready for Wix Studio hookup tomorrow morning. 28 pages, 43+ frontend modules, 5,600+ passing tests.

### PRs Merged This Session

**cfutons (web):**
- PR #88 (miquella): CF-p03z ProductSizeGuide extraction + fixed 2 pre-existing notification test failures. Peer reviewed by radahn.
- PR #90 (godfrey): cf-2epn Performance optimization — lazy loading, CLS prevention, Core Web Vitals. Peer reviewed by rennala.
- PRs #83-87 (from earlier session): Footer redesign, swatch promo, wishlist buttons, size guide, ESP sync — all applied to main.

**cfutons_mobile:**
- PR #28 (dallas): Onboarding 3-slide carousel
- PR #29 (dallas): Offline mode — order cache + OfflineBanner
- PR #30 (dallas): Screen refactor — hook re-exports
- PR #31 (dallas): Wix Members auth client
- PR #32: Merge conflict after #30 — dallas rebasing

### Crew Status

| Member | Bead | Story | Status | Peer Reviewer |
|--------|------|-------|--------|---------------|
| **miquella** | CF-z5tk (P1) | Search Results page polish | Assigned | radahn |
| **rennala** | CF-l9fw (P1) | Blog + Blog Post page design | Assigned | godfrey |
| **radahn** | CF-f8of (P1) | About + Contact page brand polish | Assigned | miquella |
| **godfrey** | CF-5ggk (P2) | Live chat widget — Gorgias/Tidio | In progress | rennala |

All crew have peer reviewers assigned. No more solo melania reviews.

### Mobile (cfutons_mobile)

| Member | Status | Notes |
|--------|--------|-------|
| **dallas** | Active | 4/5 PRs merged. PR #32 needs rebase. AR patterns documented for web reuse. |

### AR for Web (CF-5rfj)

Dallas audited mobile AR architecture. **80% of AR value achievable without WebXR:**
- Shared from mobile: model catalog, eligibility service, URL resolution
- Web component: `<model-viewer>` (already exists in mobile codebase)
- iOS gets AR Quick Look automatically via USDZ fallback
- Optional future: WebXR hit-test for Chrome room placement

---

## Competitive Gap Analysis — Updated

| Feature | Competitors | Us | Status |
|---------|-------------|-----|--------|
| Announcement bar | 9/10 | YES (PR #75) | Shipped |
| Full-bleed lifestyle hero | 10/10 | YES (PR #80) | Shipped |
| Product cards with swatches | 10/10 | YES (PR #79) | Shipped |
| Brand palette consistency | All | YES (PRs #73, #78) | Shipped |
| Trust bar / icons | 6/10 | YES (PR #75) — 5 icons | Shipped |
| Category showcase cards | 7/10 | YES (PR #77) | Shipped |
| Delivery estimate | 8/10 | YES (PR #81) — zip-based | Shipped |
| Free swatch CTA | 4/10 | YES (PR #81, #84) | Shipped |
| Email capture popup | 6/10 | YES (PR #82) — exit-intent | Shipped |
| Newsletter footer | 8/10 | YES (PR #83) — 4-column + signup | Shipped |
| Financing display | 5/10 | YES (cf-ist closed) | Shipped |
| Product size guide | 4/10 | YES (PR #88) | Shipped |
| Wishlist buttons | 5/10 | YES (PR #85) | Shipped |
| Performance/CWV | All | YES (PR #90) — lazy load, CLS fix | Shipped |
| Checkout flow polish | 8/10 | YES (cf-7nky) | Shipped |
| SEO/metadata | All | YES (cf-k9ot) | Shipped |
| Star ratings / reviews | 7/10 | Backend ready, needs content | Ready for hookup |
| Live chat widget | 4/10 | CF-5ggk — godfrey active | In progress |
| AR / 3D visualization | 5/10 | CF-5rfj — plan ready, P2 | Planned |
| Search results polish | 6/10 | CF-z5tk — miquella assigned | In progress |
| Blog/content pages | 8/10 | CF-l9fw — rennala assigned | In progress |
| About/Contact polish | 9/10 | CF-f8of — radahn assigned | In progress |

### The "Boutique Formula" — Our Differentiation

Every competitor looks interchangeable — clean minimalism, neutral palettes, stock photography. CF is the **only** one with regional character: Blue Ridge aesthetic, hand-drawn mountain illustrations, two-tone coral + mountain blue accent system. This is the moat.

---

## Sprint Summary

### P0 Frontend Sprint: COMPLETE (6/6)
All merged: brand palette, announcement bar, category showcase, hero overhaul, product cards, product page modernization.

### P1 Design Sprint: COMPLETE (8/8)
All merged: footer redesign, email capture, swatch promo, wishlist buttons, size guide, ESP sync, checkout polish, SEO.

### Active Sprint: P1 Page Polish (4 stories)
| Bead | Story | Owner | Reviewer | Status |
|------|-------|-------|----------|--------|
| CF-z5tk | Search Results polish | miquella | radahn | Assigned |
| CF-l9fw | Blog + Blog Post design | rennala | godfrey | Assigned |
| CF-f8of | About + Contact polish | radahn | miquella | Assigned |
| CF-5ggk | Live chat widget | godfrey | rennala | In progress |

---

## Test Suite

| Checkpoint | Tests | Files |
|------------|-------|-------|
| Feb 21 start | 2,394 | 70 |
| Feb 28 current | **5,600+** | **140+** |

---

## PR Review Process (New)

Peer reviewer pairings rotate per sprint:
- miquella ↔ radahn (cross-review)
- rennala ↔ godfrey (cross-review)
- Melania gives final approval after peer review passes

---

*PM: melania | cfutons GREEN | Hookup ready | 14+ PRs merged today | 5,600+ tests | 4 crew active with peer reviewers | Mobile: 4 PRs merged, AR patterns documented*
