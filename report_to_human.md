# cfutons Rig Report — Carolina Futons (Web)

**Last Updated:** 2026-02-28 06:15 UTC (melania)

---

## PRIORITY: Frontend Visual Design Sprint (Phase 2)

**Goal:** Brand-defining visual pages that match the design.jpeg mockup. "Most kickass boutique furniture site ever." Every page feels like walking into a Blue Ridge Mountain showroom.

### Sprint Status: PR #67 Merged, 8 New Design Beads from Visual Audit

**This session (melania):**
- Merged PR #67 (godfrey CF-edk1 homepage hero) — newsletter, ridgeline header, trust bar, category cards
- Approved PR #66 (radahn CF-jl8u product page UX) — 105 tests, merge conflicts need rebase
- Reviewed PR #69 (miquella CF-ynwm category page) — 2 blockers: unauthorized CLAUDE.md edit + merge conflicts
- Closed PR #70 as redundant (superseded by #67)
- Nudged rennala on PR #65 (CF-xai7 live chat) — no updates since last review
- **Visual audit of 10 competitor sites** via Puppeteer screenshots: Castlery, Article, Floyd, Joybird, West Elm, Room & Board, Burrow, Interior Define, The Futon Shop, Futonland
- **Created 8 new design beads** from visual audit findings (see below)
- Mailed Dallas (cfutons_mobile) with 8-point design alignment guide for mobile app
- All crew notified for handoff

### Visual Audit Key Findings

**Our site's biggest gaps vs competitors:**
1. Pink-lavender gradient backgrounds — NO competitor uses this. Must die immediately.
2. No lifestyle hero — every competitor uses full-bleed room-staged photography
3. Product image dump — no names, prices, or cards on homepage. Just bare images stacked
4. No announcement bar or trust signals — competitors all have top-of-page promo + trust icons
5. Product page wall-of-text — needs accordion, reviews tab, related products, delivery estimate

**Best-in-class patterns to adopt:**
- Castlery: Warm palette, sidebar filters, product badges, color swatches on cards
- Joybird: 5-icon trust bar, countdown timer, swatch dots on product cards
- Floyd: Full-bleed lifestyle hero, "Designed in Detroit" regional storytelling
- Article: Dramatic lifestyle photography, financing bar, "Shop By Room" cards
- Futonland: Trust bar with 5 icons (Delivery, Assembly, Personal Approach, Price Match, No Tax)

**Target aesthetic: "Castlery meets Blue Ridge Mountain craftsmanship"**

### New Design Beads (from Visual Audit)

| Bead | Story | Priority |
|------|-------|----------|
| CF-bbms | **Homepage hero overhaul** — kill heart bubbles, full-bleed lifestyle hero | P0 |
| CF-c94m | **Announcement bar + trust bar** — top-of-page social proof strip | P0 |
| CF-a1ps | **Kill pink-lavender background** — apply brand palette sitewide | P0 |
| CF-dgiy | **Product card grid** — image + name + price + swatches + badges | P1 |
| CF-b0sr | **Category showcase** — lifestyle cards for Shop by Category | P1 |
| CF-isru | **Product page modernization** — accordion, reviews, related, delivery | P1 |
| CF-x8pd | **Lifestyle product photography** — room-staged shots needed | P1 |
| CF-y8je | **Swatch kit CTA** — free swatches promotion (Floyd/Burrow pattern) | P2 |
| CF-8gzd | **Footer redesign** — columns, newsletter, social proof | P2 |

### Active PRs

| PR | Bead | Crew | Status |
|----|------|------|--------|
| #67 | CF-edk1 | godfrey | **MERGED** |
| #66 | CF-jl8u | radahn | **APPROVED — needs rebase** (merge conflicts) |
| #69 | CF-ynwm | miquella | **REQUEST CHANGES** (CLAUDE.md edit + conflicts) |
| #65 | CF-xai7 | rennala | **REQUEST CHANGES** (no updates since last review) |
| #68 | CF-v6q3 | refinery | **REQUEST CHANGES** (backup files only, no hooks code) |

### Active Frontend Design Beads — Original Sprint

| Bead | Story | Crew | Status |
|------|-------|------|--------|
| CF-edk1 | Homepage Hero & Visual Polish | godfrey | **MERGED PR #67** |
| CF-jl8u | Product Page UX | radahn | PR #66 approved, needs rebase |
| CF-ynwm | Category Page Filtering | miquella | PR #69, 2 blockers |
| CF-xai7 | Live Chat Widget | rennala | PR #65, awaiting updates |

### Ready Queue — Next Wave

| Bead | Story | Priority |
|------|-------|----------|
| CF-bbms | Homepage hero overhaul (from visual audit) | P0 |
| CF-c94m | Announcement bar + trust bar | P0 |
| CF-a1ps | Kill pink-lavender background | P0 |
| CF-78g2 | Recently viewed products + personalized recommendations | P2 |
| CF-p03z | Product size/dimension guide with room fit visualization | P2 |
| CF-pmkr | Customer reviews with photo upload + verified badges | P2 |

### Design Principles (from Competitive Analysis + Visual Audit)
- **Boutique > Generic**: Hand-drawn mountain aesthetic, illustrated borders, regional personality
- **Two-tone accent**: Coral #E8845C (CTAs) + Mountain Blue #5B8FA8 (secondary) — unique in market
- **Conversion-first**: Every page drives to cart. Urgency, social proof, shipping progress
- **"Can't touch it" solved**: Swatch flow + comfort cards (MERGED in PR #60)
- **Mobile-first**: 60% of furniture traffic. Every feature mobile-optimized
- **Lifestyle photography**: Full-bleed room scenes, not product-on-white. Every competitor does this.
- **Trust signals everywhere**: Announcement bar, trust icon strip, review counts, delivery estimates

---

## Current Metrics

| Metric | Value |
|--------|-------|
| Tests | **5,080 passing** / 136 files / 0 failures |
| PRs merged total | 65 (PR #67 merged this session) |
| PRs open | **4** (#65, #66, #68, #69) |
| Frontend P0 beads | 3 new (from visual audit) |
| Frontend P1 beads | 4 (1 merged, 3 in progress + 4 new) |
| Frontend P2 beads | 5 ready |
| Codebase | **GREEN** |

---

## Crew Status (all handoff imminent)

| Crew | Rig | Status | Next |
|------|-----|--------|------|
| godfrey | cfutons | PR #67 MERGED, handoff | CF-78g2 or P0 design bead |
| radahn | cfutons | PR #66 approved, needs rebase | Rebase onto main, re-push |
| miquella | cfutons | PR #69 has 2 blockers | Fix CLAUDE.md edit + conflicts |
| rennala | cfutons | PR #65 stale | Address review comments |
| dallas | cfutons_mobile | Wix REST API client | Received 8-point design alignment |
| bishop | cfutons_mobile | Auth integration | — |
| ripley | cfutons_mobile | Replace mock data | — |

---

## Key Reference Docs

| Document | Purpose |
|----------|---------|
| `design.jpeg` | Approved visual mockup — the target aesthetic |
| `WIX-STUDIO-BUILD-SPEC.md` | Element IDs, Wix Studio setup, page-by-page spec (67KB) |
| `FRONTEND-COMPETITIVE-ANALYSIS.md` | 8 competitor analysis, design recommendations, priorities |
| `ILLUSTRATION-ASSET-SPEC.md` | Mountain illustration assets needed (7 asset categories) |
| `MASTER-HOOKUP.md` | Wix Studio connection procedure |

---

## What Human Needs

1. **Illustration assets** — design.jpeg shows hand-drawn mountain illustrations. Code can wire them up, but someone needs to create/source: mountain ridgeline header, hero cabin scene, category card illustrations, decorative dividers, icon set (see ILLUSTRATION-ASSET-SPEC.md)
2. **Lifestyle product photography** — room-staged shots for hero, category cards, product pages. EVERY competitor has this. Critical gap.
3. **Domain connection** — carolinafutons.com
4. **GA4, Meta Pixel, Pinterest Tag** installation in Wix Dashboard
5. **Wix Chat or Tidio account setup** for CF-xai7 live chat integration

---

## Test Suite Growth

| Checkpoint | Tests | Files |
|------------|-------|-------|
| Feb 21 start | 2,394 | 70 |
| Feb 23 | 3,526 | 96 |
| Feb 27 sprint | 4,437 | 121 |
| Feb 28 (now) | **5,080** | **136** |

*PM: melania | cfutons GREEN | 4 PRs open | 5,080 tests | 8 new design beads from visual audit | Frontend design sprint Phase 2 active*
