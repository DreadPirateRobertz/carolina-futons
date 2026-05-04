# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-03 19:45 MT**

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

### This Session (21 CFW + 3 Velo merged)
| PR | What |
|----|------|
| #334 | fix(cf-o8s9): restore LivingSky backdrop — Stilgar directive ✅ |
| #335 | fix(cf-cfol): guard checkout against cart-write race [P0] ✅ |
| #337 | fix(cf-p7la): prevent hydrateCartAction racing addItemAction [P1] ✅ |
| #336 | feat(cf-9cgu): LivingSkyErrorBoundary — sky crash isolation ✅ |
| #332 | feat(cf-xmpb): commerce dark mode — PDP + account ✅ |
| #330 | feat(cf-wzl3): LivingSky forced night state in dark mode ✅ |
| #329 | feat(cf-8w86): Gift Cards page — /gift-cards route ✅ |
| #326 | fix(cf-kj8n): VERCEL_PROJECT_PRODUCTION_URL for stable sitemap ✅ |
| #323 | feat(cf-7dfv): wire PdpFinancing into PDP ✅ |
| #322 | fix(cf-j6ub): useTimeOfDay RAF + SSR flash guard ✅ |
| #321 | fix(cf-ac1y): replace stale ShopTheRoom slugs ✅ |
| #320 | feat(cf-kjpy): Local SEO city pages /near/[city-slug] ✅ |
| #318 | feat(cf-footer): consolidate footer living illustration ✅ |
| #338 | test(cf-jegx): harden swatch-request coverage ✅ |
| #296 | feat(cf-e4vd/cf-ph80): HomeQuizCta + Swatch ✅ |
| #293 | feat(cf-urfn): HomeSaleStrip ✅ |
| #290 | feat(cf-lqnd): PDP back-in-stock notify me ✅ |
| #282 | feat(cf-0y1e): PDP Size Guide v2 ✅ |
| #278 | feat(cf-c7re): HTTP security headers ✅ |
| #276 | test(cf-o3bv): CartDrawer+CartPage sentinel ✅ |
| Velo #1128 | chore: postcss bump ✅ |
| Velo #1132 | fix: blog post count ✅ |
| Velo #1131 | feat: one-click unsubscribe ✅ |

---

## CF Open PRs (carolina-futons / Velo)

| PR | Title | CI |
|----|-------|----|
| #1133 | feat(cf-y2l3): trade-in / trade-up program | ❌ fail |
| #1130 | chore(deps): dev-deps bump | **HOLD** |
| #1125 | feat(cf-9t70): sampleRequests endpoint | ❌ fail (codecov only — admin merge?) |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | ❌ fail |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI |
|----|-------|----|
| #331 | feat(cf-4bhw): Gift Registry — /registry + /registry/[slug] | ❌ fail |
| #319 | feat(cf-3i8j): 2D drag-drop room planner | ❌ fail |
| #299 | fix(cf-urbq): dark mode font contrast | ❌ fail |
| #291 | feat(cf-ww8u): PdpSizeGuide | ❌ fail |
| #281 | feat(cf-7axq): Add to Compare | ❌ fail |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass |

**All 5 failing = lint/typecheck errors. E2E skipped on PR builds (721ca82).**

---

## Crew Assignments

| Crew | Current Task | Bead |
|------|-------------|------|
| blaidd | Cart QA seeded fixtures | cf-9izd |
| godfrey | PDP Financing BNPL | cf-10fx |
| radahn | /sustainability CMS wiring | cf-0s4l |
| rennala | Sitemap 404 fix — /sitemap.xml 404 on prod | cf-rb07 |
| millicent | Illustration wiring — v1/v2/v3 into sub-pages | cf-tyuk |
| morgott | cf-9t70 swatch follow-on hardening | cf-jegx |
| miquella | Next bead (cart PRs all merged) | — |

**Bead closures this turn:** cf-kjpy ✅ (#320 merged) · cf-p7la ✅ (#337 merged) · cf-cfol ✅ (#335 merged) · cf-rymw ✅ (dark mode PRs shipped) · cf-992s ✅ (pre-resolved) · cf-d1fu ✅ (pre-resolved)

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **Velo #1125** (sampleRequests) | Only codecov failing — all tests pass. Admin merge eligible? |
| **contactSubmissions 404** | Velo endpoint exists; awaiting Stilgar §1-§3 DNS clearance |
| **DNS flip** (cf-cb9s) | Stilgar manual §1-§3 pending; §5 order-lookup 501. Dallas holding. |
| **CROSS_RIG_SECRET** | ✅ COMPLETE |
| **LivingSky header** | ✅ PR #334 merged |
| **P0/P1 cart race** | ✅ PRs #335 + #337 merged |
| **cf-9t70 swatch CMS** | Wix Dashboard: SwatchRequests collection + email templates needed (morgott) |

---

## In-Progress Beads (11 total)

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-10fx | P1 | PDP Financing / BNPL — godfrey | godfrey |
| cf-d3hc | P1 | PDP Financing / BNPL (Afterpay, Affirm) | — |
| cf-9t70 | P1 | /swatch-request — code done, Wix CMS pending | morgott |
| cf-c77s | P1 | E2E auto emails + challenges + rewards | — |
| cf-eihx | P1 | CFW shipping tier system | — |
| cf-rtd7 | P1 | cf-3qt full prod parity audit | — |
| cf-yfvl | P1 | cf-theme-experiments A/B/C/D variants | — |
| cf-9fd8 | P2 | PDP back-in-stock notify me | — |
| cf-9izd | P2 | Cart QA seeded-fixture preview deploy | blaidd |
| cf-jegx | P3 | cf-9t70 swatch follow-on hardening | morgott |
| cf-0s4l | P3 | /sustainability — wire Wix CMS | radahn |

**Not in bd yet (new):** cf-rb07 (rennala), cf-tyuk (millicent)

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Fixed — E2E 30s timeout + skip on PRs both live |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
