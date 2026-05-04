# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-03 19:35 MT**

---

## Vercel ↔ Wix Integration — How It Works

### Product Updates (Live — No Manual Import Needed)
- **cfW queries Wix Stores live** via `@wix/sdk` — new products in Wix Dashboard appear in cfW **immediately**
- PDP: two-step fetch (slug→ID→full product with variants). PLP: paginated by collection (≤48). Search: full-catalog scan ≤500.
- **Wix Dashboard → Wix Stores** is the single source of truth for inventory, pricing, images, variants

### Velo Backend → cfW (Vercel)
```
cfW Server Action → POST https://www.carolinafutons.com/_functions/<endpoint>
                          ↓ Wix Velo HTTP function (http-functions.js) ↓ wixData/webMethod
```
Active: `trackCustomEvent` ✅ `sampleRequests` ✅ `notifyMe` ✅ `deliveryZone` ✅ `contactSubmissions` ⚠️ (prod sync pending) `crossRigEventReceiver` ✅

### Cross-Rig (Mobile ↔ cfW)
Channel A dual-write active: mobile fires both cfW `/api/cross-rig` + Wix concurrently. CROSS_RIG_SECRET: **Vercel Production ✅ + Wix Staging ✅ + Mobile ✅** (dallas confirmed). DNS cutover pending cf-cb9s — §5 order-lookup 501 still open.

---

## Session Merges — SHIPPED TO VERCEL ✅

### This Turn (19 CFW + 2 Velo merged)
| PR | What |
|----|------|
| #335 | fix(cf-cfol): guard checkout against cart-write race [P0] |
| #337 | fix(cf-p7la): prevent hydrateCartAction racing addItemAction [P1] |
| #336 | feat(cf-9cgu): LivingSkyErrorBoundary — sky crash isolation |
| #332 | feat(cf-xmpb): commerce dark mode — PDP + account |
| #330 | feat(cf-wzl3): LivingSky forced night state in dark mode |
| #329 | feat(cf-8w86): Gift Cards page — /gift-cards route |
| #326 | fix(cf-kj8n): VERCEL_PROJECT_PRODUCTION_URL for sitemap |
| #323 | feat(cf-7dfv): wire PdpFinancing into PDP |
| #322 | fix(cf-j6ub): useTimeOfDay RAF + SSR flash guard |
| #320 | feat(cf-kjpy): Local SEO city pages /near/[city-slug] |
| #318 | feat(cf-footer): consolidate footer living illustration |
| #338 | test(cf-jegx): harden swatch-request coverage |
| #296 | feat(cf-e4vd/cf-ph80): HomeQuizCta + Swatch |
| #293 | feat(cf-urfn): HomeSaleStrip |
| #290 | feat(cf-lqnd): PDP back-in-stock notify me |
| #282 | feat(cf-0y1e): PDP Size Guide v2 |
| #278 | feat(cf-c7re): HTTP security headers |
| #276 | test(cf-o3bv): CartDrawer+CartPage sentinel |
| #334 | fix(cf-o8s9): restore LivingSky backdrop |
| #321 | fix(cf-ac1y): replace stale ShopTheRoom slugs |
| Velo #1128 | chore: postcss bump |
| Velo #1132 | fix: blog post count |
| Velo #1131 | feat: one-click unsubscribe |

---

## CF Open PRs (carolina-futons / Velo)

| PR | Title | CI |
|----|-------|----|
| #1133 | feat(cf-y2l3): trade-in / trade-up program | ❌ fail |
| #1130 | chore(deps): dev-deps bump | **HOLD** |
| #1125 | feat(cf-9t70): sampleRequests endpoint | ❌ fail (codecov only) |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | ❌ fail |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI |
|----|-------|----|
| #331 | feat(cf-4bhw): Gift Registry — /registry + /registry/[slug] | ❌ fail |
| #319 | feat(cf-3i8j): 2D drag-drop room planner | ❌ fail |
| #299 | fix(cf-urbq): dark mode font contrast | ❌ fail |
| #291 | feat(cf-ww8u): PdpSizeGuide (rebased needed) | ❌ fail |
| #281 | feat(cf-7axq): Add to Compare (rebased needed) | ❌ fail |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass |

**❌ fail = lint/typecheck failures. E2E skipped on PR builds (721ca82).**

---

## Crew Assignments

| Crew | Current Task | Bead |
|------|-------------|------|
| blaidd | Cart QA seeded fixtures — dispatched this turn | cf-9izd |
| godfrey | PDP Financing BNPL — PR #323 merged ✅, continue cf-10fx/cf-d3hc | cf-10fx |
| radahn | Local SEO — PR #320 merged ✅, pick up cf-0s4l | cf-0s4l |
| rennala | Sitemap 404 investigation — cf-rb07 | cf-rb07 |
| millicent | Illustration wiring — v1/v2/v3 into sub-pages | cf-tyuk |
| morgott | Dark mode — PRs #330/#332 merged ✅, continue cf-rymw | cf-rymw |
| miquella | Cart PRs #335/#337 merged ✅, #336 merged ✅, next bead | — |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **P0/P1 cart race** | ✅ RESOLVED — PRs #335 + #337 merged |
| **LivingSky ErrorBoundary** | ✅ RESOLVED — PR #336 merged |
| **Illustration wiring** (cf-tyuk) | millicent dispatched — v1/v2/v3 into sub-pages |
| **contactSubmissions 404** | Velo endpoint exists; awaiting Stilgar §1-§3 DNS clearance |
| **DNS flip** (cf-cb9s) | Stilgar manual §1-§3 pending; §5 order-lookup 501. Dallas holding. |
| **CROSS_RIG_SECRET** | ✅ COMPLETE: Vercel ✅ Wix ✅ Mobile ✅ |
| **LivingSky header** | ✅ PR #334 merged |

---

## In-Progress Beads (13 total)

| Bead | Pri | Title |
|------|-----|-------|
| cf-10fx | P1 | PDP Financing / BNPL — PR #323 merged, godfrey continues |
| cf-d3hc | P1 | PDP Financing / BNPL section (Afterpay, Affirm) |
| cf-9t70 | P1 | /swatch-request page — fabric sample order form |
| cf-c77s | P1 | E2E auto emails + challenges + reward system |
| cf-rtd7 | P1 | cf-3qt full prod parity audit |
| cf-yfvl | P1 | cf-theme-experiments — A/B/C/D home variants |
| cf-tyuk | P1 | Wire v1/v2/v3 illustrations into sub-pages — millicent |
| cf-9fd8 | P2 | PDP back-in-stock notify me |
| cf-9izd | P2 | cf-3qt cart QA: seeded-fixture preview deployment |
| cf-rymw | P2 | cf-dark-mode — site-wide dark mode — morgott |
| cf-eihx | P1 | CFW shipping tier system — parcel/LTL/freight |
| cf-0s4l | P3 | /sustainability — wire Wix CMS — radahn |
| cf-rb07 | P3 | SEO: /sitemap.xml 404 on prod — rennala |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Fixed — E2E 30s timeout + skip on PRs both live |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
