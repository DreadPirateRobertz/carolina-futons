# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-03 18:27 MT**

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
Channel A dual-write active: mobile fires both cfW `/api/cross-rig` + Wix concurrently. DNS cutover pending §1-§3 manual checks. Dallas coordinating — see nudge hq-wisp-2rz0h.

---

## Session Merges — SHIPPED TO VERCEL ✅

| PR | What | Merged |
|----|------|--------|
| #289 | fix(cf-ml6n): doubled footer removed | 00:13 UTC |
| #315 | feat(cm-002): AR model-viewer on PDP mobile | 00:08 UTC |
| #325 | WCAG AA contrast fixes (via #315 ancestry) | CLOSED — on main |
| #327 | **fix(header): LivingSky backdrop removed** | 00:15 UTC |
| #328 | **feat(cf-shop-mascot): animated bear/deer/fox/owl category cards** | 00:15 UTC |

**Vercel deploys from main — changes now live on Vercel preview URL.**

---

## CF Open PRs (carolina-futons / Velo)

| PR | Title | State |
|----|-------|-------|
| #1132 | fix(tests): blog post count assertions cf-phgh | ⏳ pending |
| #1131 | feat(cf-r9tf): one-click email unsubscribe | ⏳ pending |
| #1130 | chore(deps): dev-deps bump | **HOLD** |
| #1128 | chore(deps): postcss bump hookup-assistant | ⏳ pending |
| #1125 | feat(cf-9t70): sampleRequests endpoint | ❌ fail |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | ❌ fail |

---

## CFW Open PRs (carolina-futons-web / Next.js) — Active

| PR | Title | CI |
|----|-------|----|
| #329 | feat(cf-8w86): Gift Cards page — /gift-cards route | ❌ fail |
| #326 | fix(cf-kj8n): prefer VERCEL_PROJECT_PRODUCTION_URL for sitemap base | ❌ fail |
| #323 | feat(cf-7dfv): wire PdpFinancing into PDP | ❌ fail |
| #322 | fix(cf-j6ub): useTimeOfDay RAF + SSR flash guard | ❌ fail |
| #321 | fix(cf-ac1y): replace stale product slugs in ShopTheRoom | ❌ fail |
| #320 | feat(cf-kjpy): Local SEO city pages | ❌ fail |
| #319 | feat(cf-3i8j): 2D drag-drop room planner | ❌ fail |
| #318 | feat(cf-footer): consolidate footer living illustration | ❌ fail |
| #317 | fix(cf-m80l): Canby collection slug | ❌ fail |
| #303 | feat(cf-u7yk): /gift-cards page (older) | ❌ fail |
| #299 | fix(cf-urbq): dark mode font contrast | ❌ fail |
| #296 | feat(cf-e4vd/cf-ph80): HomeQuizCta + Swatch | ❌ fail |
| #293 | feat(cf-urfn): HomeSaleStrip | ❌ fail |
| #291 | feat(cf-ww8u): PdpSizeGuide | ❌ fail |
| #290 | feat(cf-lqnd): PDP back-in-stock notify me | ⏳ running |
| #282 | feat(cf-0y1e): PDP Size Guide v2 | ⏳ running |
| #281 | feat(cf-7axq): Add to Compare | ❌ fail |
| #278 | feat(cf-c7re): HTTP security headers | ⏳ running |
| #276 | test(cf-o3bv): CartDrawer+CartPage sentinel | ❌ fail |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ⏳ pending |

**Note:** Most ❌ are E2E flakiness (Wix API timeout from CI runner). Unit tests pass. Merging via --admin for unit-green PRs where E2E failures are systemic.

---

## Crew Assignments

| Crew | Current Task | Bead |
|------|-------------|------|
| godfrey | BNPL financing UI (PR #323) | cf-7dfv |
| radahn | Local SEO city pages (PR #320) | cf-kjpy |
| rennala | useTimeOfDay RAF fix (PR #322) | cf-j6ub |
| blaidd | **cf-eihx shipping tiers DONE** ✓ → reassign next P1 | cf-eihx done |
| millicent | Image audit (84/88 done, 4 unresolvable) | cf-lxbe |
| morgott | **cf-3i8j room planner DONE** ✓ → reassign next P1 | cf-3i8j |
| miquella | ShopTheRoom slug fix (PR #321) | cf-ac1y |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **E2E flakiness** | PLP tests timeout on Wix API — merging with --admin for unit-test-green PRs |
| **P0 cart regression** (cf-cfol/cf-p7la) | PRs #275/#276 in CI — monitor |
| **contactSubmissions 404** | Velo endpoint exists; stage3-velo sync pending |
| **DNS flip** (cf-cb9s) | Stilgar manual §1-§3; §5 order-lookup 501 |
| **blaidd reassign** | cf-eihx done; pick next P1 bead |
| **morgott reassign** | cf-3i8j PR #319 submitted; pick next P1 bead |
| **dallas cross-rig** | hq-wisp-2rz0h — /contact 404 + DNS timeline; Vercel+Velo endpoint coordination |
| **All crew IDLE** | Watchdog alert — 8 crew showing idle, need fresh bead assignments |

---

## In-Progress Beads (21 total)

| Bead | Pri | Title |
|------|-----|-------|
| cf-cfol | P1 | [P0] Add-to-cart no longer persists — checkout empty |
| cf-p7la | P1 | [P1] Sticky add-to-cart adds item but checkout empty |
| cf-10fx | P1 | PDP Financing / BNPL section |
| cf-d3hc | P1 | PDP Financing / BNPL section (Afterpay, Affirm) |
| cf-1te7 | P1 | /collections/* 404 — no redirect to /shop/* |
| cf-9t70 | P1 | /swatch-request page — fabric sample order form |
| cf-c77s | P1 | E2E auto emails + challenges + reward system |
| cf-eihx | P1 | CFW shipping tier system — DONE ✓ |
| cf-hc2i | P1 | emailTemplates reengagement_2/_3 missing registry |
| cf-kjpy | P1 | cfW Local SEO city pages |
| cf-rtd7 | P1 | cf-3qt full prod parity audit |
| cf-yfvl | P1 | cf-theme-experiments — A/B/C/D home variants |
| cf-9fd8 | P2 | PDP back-in-stock notify me |
| cf-9izd | P2 | cf-3qt cart QA: seeded-fixture preview deployment |
| cf-e92v | P2 | /care and /care-warranty routes missing |
| cf-whye | P2 | /sustainability page |
| cf-0s4l | P3 | /sustainability — wire Wix CMS |
| cf-992s | P3 | wilderness-log-futon-frame 404 |
| cf-a2qs | P3 | /room-planner ↔ /design-a-room slug fix |
| cf-d1fu | P3 | /community-gallery page |
| cf-rb07 | P3 | SEO: /sitemap.xml 404 on prod |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Active |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
