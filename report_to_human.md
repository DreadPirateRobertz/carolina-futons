# cfutons (Carolina Futons) — Report to Human

**Last Updated:** 2026-02-23 12:55 MST (rennala, Crew Worker)
**Repo:** git@github.com:DreadPirateRobertz/carolina-futons.git

---

## Health: GREEN — LAUNCH READY, CREW PRODUCING

| Metric | Value |
|--------|-------|
| Tests | 4,178 vitest tests across 112 files (all green) |
| Backend Modules | 71 `.web.js` modules |
| Page Code | 28 page JS files |
| Frontend Utils | 26+ public JS modules |
| CMS Collections | 16 priority + 50 auto-created |
| Product Catalog | 88 products enriched (74 priced, 14 contact-for-price) |

---

## CHANGES SINCE LAST REPORT (2026-02-23 12:30)

### New Code on Main (rennala)

**Marketing Launch Toolkit (CF-74x) — COMPLETE**
- `emailTemplates.web.js` — 13-template registry across 5 sequences (welcome, cart recovery, promotional, post-purchase, re-engagement). Subject line resolver, variable validation, promotional queue.
- `socialMediaKit.web.js` — Share URL generators (Facebook, Twitter, Pinterest, LinkedIn, email), social meta validator with per-platform scoring (OG/Twitter/Pinterest), product readiness checker, feed status dashboard.
- `analyticsDashboard.web.js` — Conversion funnel (views→cart→purchase), top converters, category performance, email metrics, revenue attribution, unified dashboard summary.
- 102 new tests across 3 test files.

**Customer Reviews Unified API (CF-gp3) — COMPLETE**
- `productReviews.web.js` — Unified facade over reviewsService + photoReviews. Combined review summary (star + photo), unified review feed with 5 sort modes + star filter + pagination, review highlights for product cards, batch summaries for listing pages, combined moderation queue.
- 38 new tests.

### Other Crew Work Landed
- a11yHelpers.js improvements (godfrey)
- Page code updates across 12 pages (godfrey)
- LiveChat + ProductDetails + ProductFinancing enhancements

### Previous Session (2026-02-22)
- Self-service returns portal, financing calc, accessibility audit, social proof, Style Quiz, content import pipeline, safeParse, Promise.allSettled, MD consolidation
- Radahn stability audit: 1,426 silent catch blocks identified, 11 beads filed

---

## WHAT YOU NEED TO DO

### 15-Minute Quick Wins (free)
1. Install GA4 — Dashboard > Marketing Integrations > paste Measurement ID
2. Install Meta Pixel — Dashboard > Tracking & Analytics > paste Pixel ID
3. Install Pinterest Tag — same location > paste Tag ID
4. Connect Google Merchant feed: `/_functions/googleMerchantFeed`
5. Enable Wix Chat — one toggle

### Social Media Hookup (MASTER-HOOKUP.md has full step-by-step)

| Platform | What You Need | Feed URL |
|----------|--------------|----------|
| **Pinterest** | Business account, claim site, connect catalog | `/_functions/pinterestProductFeed` |
| **Google Shopping** | Merchant Center, connect feed, link GA4 | `/_functions/googleMerchantFeed` |
| **Facebook/Instagram** | Business page, Commerce Manager, catalog | `/_functions/facebookCatalogFeed` |
| **TikTok** | Business account, install pixel | (custom pixel, no feed needed) |

All feeds are LIVE — code generates them automatically from your product catalog.

### This Week
6. Create 16 CMS Collections (schema in CMS-SETUP-GUIDE.md)
7. Enable Wix Loyalty + Automations + Bookings
8. Verify 8 Secrets in Secrets Manager
9. Create email templates (17 total, see EMAIL-TEMPLATES.md)

### Critical Blockers
- **Product photography** — #1 blocker. No real photos = no sales.
- **Domain connection** — carolinafutons.com must point to Wix site

---

## Crew Status

### cfutons
| Member | Status | Current/Last Work |
|--------|--------|-------------------|
| melania | ACTIVE | Production management, bead coordination |
| godfrey | ACTIVE | WCAG 2.1 AA accessibility, page code updates |
| rennala | ACTIVE | Marketing launch toolkit (DONE), customer reviews (DONE) |
| radahn | ACTIVE | Stability audit, reviews work |
| miquella | cf-utqo | Product image pipeline |

### cfutons_mobile (AR Camera)
| Member | Last Commit | Work |
|--------|-------------|------|
| dallas | `c1acc46` | Reviews flow, search autocomplete |
| bishop | `6967bb8` | Deep link routing, notification tests |
| ripley | `0eb5180` | **AR camera** (Quick Look iOS + Scene Viewer Android), offline queue |

**AR Camera (cm-88d): PROGRESSING** — Ripley has 5 commits building the AR foundation: 3D model catalog, platform detection, viewer integration, offline support. Well underway.

**Note:** cfutons_mobile beads DB is down (table not found). Not blocking dev.

---

## Stale Branches to Clean

| Branch | Action |
|--------|--------|
| `feature/cf-7pp-social-proof` | DELETE — merged to main |
| `polecat/chrome/cf-f1d@mlufumtt` | DELETE — stale |
| `polecat/rust/cf-v00@mlufu4ug` | DELETE — stale |
| `polecat/guzzle/cf-utqo-recovered` | REVIEW then delete |
| `polecat/shiny/cf-qnsf-recovered` | REVIEW then delete |

---

## MD File Status

18 MD files in repo (excluding CLAUDE.md). All serve unique purposes after consolidation. Key reference:

| Need To... | Read This |
|------------|-----------|
| Deploy the site | `MASTER-HOOKUP.md` (now includes social media hookup) |
| Create CMS tables | `CMS-SETUP-GUIDE.md` |
| Set up emails | `EMAIL-TEMPLATES.md` |
| Build pages in Wix Editor | `WIX-STUDIO-BUILD-SPEC.md` |
| Connect social platforms | `MASTER-HOOKUP.md` > Social Media Platform Hookup |
| Plan marketing | `MARKETING-STRATEGY.md` |
| Plan social content | `SOCIAL-MEDIA-STRATEGY.md` |
| Commission artwork | `ILLUSTRATION-ASSET-SPEC.md` |

---

*Production Manager: melania | cfutons GREEN*
*Next update: ~12:45 MST*
