# cfutons (Carolina Futons) — Report to Human

**Last Updated:** 2026-02-23 13:00 MST (radahn, Code Quality Engineer)
**Repo:** git@github.com:DreadPirateRobertz/carolina-futons.git

---

## Health: GREEN — LAUNCH READY, CREW PRODUCING

| Metric | Value |
|--------|-------|
| Tests | 4,099 vitest tests across 110 files (all green) |
| Backend Modules | 67+ `.web.js` modules |
| Page Code | 28 page JS files (new: Returns, Admin Returns, Style Quiz) |
| Frontend Utils | 26+ public JS modules |
| CMS Collections | 16 priority + 50 auto-created |
| Product Catalog | 88 products enriched (74 priced, 14 contact-for-price) |

---

## CHANGES SINCE LAST REPORT (2026-02-22)

### New Code on Main
- Self-service returns portal (returnsService extended, Returns.js, Admin Returns.js)
- Financing calculator with NaN guards (financingCalc.web.js)
- Accessibility audit module (accessibility.web.js)
- Social proof toasts (socialProof.web.js)
- Style Quiz page
- Content import pipeline (contentImport.web.js, 576 lines)
- safeParse utility for JSON.parse hardening
- Promise.allSettled patterns + tests
- 5 stale MD files removed (consolidated into MASTER-HOOKUP.md)
- Analytics dashboard (analyticsDashboard.web.js)
- Email templates module (emailTemplates.web.js)
- Social media kit (socialMediaKit.web.js)
- A11y helpers expanded (makeClickable, announce)

### In PR (pending merge)
- **PR #22** (cf-cz3s): Category review summaries — `getCategoryReviewSummaries` bulk method + star ratings on category product grid cards. Reviews tests rewritten with shared mock pattern (62 tests).

### Checkout E2E Testing (CF-q5b)
- Extended checkout flow E2E from 27 → 35 tests across 14 flows
- New coverage: cart abandonment→recovery lifecycle, batch payment badges, active promotions at checkout, promotion discount application
- All cross-module checkout pathways now exercised: checkoutOptimization, paymentOptions, cartRecovery, promotions

### Radahn's Stability Audit (report_from_radahn.md)
- Found 1,426 silent catch blocks (zero error visibility)
- 11 new bead proposals filed (5 stability, 6 feature)
- Site assessed at 85-90% feature-complete
- cf-2lm (safeParse utility) already landed

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
| melania | ACTIVE | Production management, beads coordination |
| godfrey | cf-5js | WCAG 2.1 AA accessibility |
| rennala | ACTIVE | Customer reviews + photo upload |
| radahn | cf-cz3s, CF-q5b | Category review summaries (PR #22), checkout E2E testing |
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
