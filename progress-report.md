# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-03 18:30 MT**

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
Channel A dual-write active: mobile fires both cfW `/api/cross-rig` + Wix concurrently.
**CROSS_RIG_SECRET set in Vercel Production** ✅ (2026-05-03 18:28 MT). Dallas notified — setting in mobile .env.
DNS cutover pending §1-§3 manual checks. Dallas coordinating — see hq-wisp-2rz0h.

---

## Session Merges — SHIPPED TO VERCEL ✅

| PR | What | Merged |
|----|------|--------|
| #289 | fix(cf-ml6n): doubled footer removed | 00:13 UTC |
| #315 | feat(cm-002): AR model-viewer on PDP mobile | 00:08 UTC |
| #325 | WCAG AA contrast fixes (via #315 ancestry) | CLOSED — on main |
| #327 | **fix(header): LivingSky backdrop removed** | 00:15 UTC |
| #328 | **feat(cf-shop-mascot): animated bear/deer/fox/owl category cards** | 00:15 UTC |
| #275 | fix(cf-o3bv): CartPage checkout <a> not Link | merged this session |

**Vercel deploys from main — changes now live on Vercel preview URL.**

---

## E2E CI Root Cause — FIXED ✅

**All PR `lint-typecheck-test` failures** traced to single file: `e2e/plp.spec.ts:7`
```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded
- waiting for locator('select#plp-sort') to be visible
```
Root cause: GitHub Actions runners hit Wix API on a slow path. 10s threshold too tight.
**Fix shipped to main** (c591122): timeout increased 10s → 30s.
Unit tests pass on ALL PRs. Vercel preview builds succeed on ALL PRs.
PRs needing rebase to pick up fix: #278, #290, #317–#323, #326, #329.

---

## CF Open PRs (carolina-futons / Velo)

| PR | Title | State |
|----|-------|-------|
| #1132 | fix(tests): blog post count assertions cf-phgh | ✅ green — merge ready |
| #1131 | feat(cf-r9tf): one-click email unsubscribe | ✅ green — merge ready |
| #1130 | chore(deps): dev-deps bump | **HOLD** |
| #1128 | chore(deps): postcss bump hookup-assistant | ✅ green |
| #1125 | feat(cf-9t70): sampleRequests endpoint | ❌ codecov/patch threshold |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | ❌ real test failures |

---

## CFW Open PRs (carolina-futons-web / Next.js) — Active

| PR | Title | Mergeable | CI | Notes |
|----|-------|-----------|----|----|
| #329 | feat(cf-8w86): Gift Cards page | MERGEABLE | ❌ E2E timeout | rebase on main for fix |
| #326 | fix(cf-kj8n): sitemap canonical URL | MERGEABLE | ❌ E2E timeout | rebase on main for fix |
| #323 | feat(cf-7dfv): wire PdpFinancing into PDP | MERGEABLE | ❌ E2E timeout | rebase on main for fix |
| #322 | fix(cf-j6ub): useTimeOfDay RAF + SSR flash | MERGEABLE | ❌ E2E timeout | rebase on main for fix |
| #321 | fix(cf-ac1y): replace stale ShopTheRoom slugs | MERGEABLE | ❌ E2E timeout | rebase on main for fix |
| #320 | feat(cf-kjpy): Local SEO city pages | MERGEABLE | ❌ E2E timeout | rebase on main for fix |
| #319 | feat(cf-3i8j): 2D drag-drop room planner | MERGEABLE | ❌ E2E timeout | rebase on main for fix |
| #318 | feat(cf-footer): consolidate footer illustration | MERGEABLE | ❌ E2E timeout | rebase on main for fix |
| #317 | fix(cf-m80l): Canby collection slug | MERGEABLE | ❌ E2E timeout | rebase on main for fix |
| #303 | feat(cf-u7yk): /gift-cards page (older) | MERGEABLE | ❌ E2E timeout | superseded by #329 |
| #299 | fix(cf-urbq): dark mode font contrast | CONFLICTING | ❌ stale | needs rebase |
| #296 | feat(cf-e4vd/cf-ph80): HomeQuizCta + Swatch | MERGEABLE | ❌ E2E timeout | rebase on main for fix |
| #293 | feat(cf-urfn): HomeSaleStrip | CONFLICTING | ❌ stale | needs rebase |
| #291 | feat(cf-ww8u): PdpSizeGuide (alternate) | CONFLICTING | ❌ stale | needs rebase |
| #290 | feat(cf-lqnd): PDP back-in-stock notify me | MERGEABLE | ❌ E2E timeout | rebase on main for fix |
| #282 | feat(cf-0y1e): PDP Size Guide v2 | MERGEABLE | ⏳ CI in progress | rebased this session |
| #281 | feat(cf-7axq): Add to Compare | CONFLICTING | ❌ stale | needs rebase |
| #278 | feat(cf-c7re): HTTP security headers | MERGEABLE | ❌ E2E timeout | rebase on main for fix |
| #276 | test(cf-o3bv): CartDrawer+CartPage sentinel | MERGEABLE | ⏳ CI in progress | rebased this session |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | MERGEABLE | ✅ green | draft only |

**E2E fix (c591122) is on main. All MERGEABLE PRs need `git rebase origin/main` + push to pick up timeout fix and re-trigger CI.**

---

## Crew Assignments

| Crew | Current Task | Bead |
|------|-------------|------|
| godfrey | BNPL financing UI (PR #323) | cf-7dfv |
| radahn | Local SEO city pages (PR #320) | cf-kjpy |
| rennala | useTimeOfDay RAF fix (PR #322) | cf-j6ub |
| blaidd | **cf-cfol P0 cart regression** (newly assigned) | cf-cfol |
| millicent | Image audit (84/88 done, 4 unresolvable) | cf-lxbe |
| morgott | **cf-9t70 /swatch-request page** (newly assigned) | cf-9t70 |
| miquella | ShopTheRoom slug fix (PR #321) | cf-ac1y |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **E2E timeout fix** | c591122 on main — PRs need rebase to pick it up |
| **P0 cart regression** (cf-cfol/cf-p7la) | blaidd assigned cf-cfol; cf-p7la still open |
| **contactSubmissions 404** | Velo endpoint exists; stage3-velo sync pending |
| **DNS flip** (cf-cb9s) | Stilgar manual §1-§3; §5 order-lookup 501 |
| **CROSS_RIG_SECRET** | Set in Vercel Production ✅; dallas setting mobile .env |
| **CONFLICTING PRs** | #281, #291, #293, #299 need rebase on main |
| **Velo PR #1120** | Real test failures (delivery zone) — not E2E flakiness |

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
