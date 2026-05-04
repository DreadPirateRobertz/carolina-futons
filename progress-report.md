# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-03 19:00 MT**

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

| PR | What | Merged |
|----|------|--------|
| #289 | fix(cf-ml6n): doubled footer removed | earlier session |
| #315 | feat(cm-002): AR model-viewer on PDP mobile | earlier session |
| #327 | fix(header): LivingSky backdrop removed (**BEING RESTORED** via #334) | earlier session |
| #328 | feat(cf-shop-mascot): animated bear/deer/fox/owl category cards | earlier session |
| #275 | fix(cf-p7la): sticky add-to-cart cart persistence | earlier session |
| #321 | fix(cf-ac1y): replace stale ShopTheRoom product slugs ← **merged this turn** | 18:57 MT |

**Velo also merged:** #1132 (blog post count fix) ✅ · #1131 (one-click unsubscribe) ✅

**Main:** Pine lint fix, E2E Option A (30s timeout, 881708c) + Option B (721ca82, E2E skipped on PRs) both live.

**Vercel deploys from main — changes live on Vercel preview URL.**

---

## CF Open PRs (carolina-futons / Velo)

| PR | Title | State |
|----|-------|-------|
| #1130 | chore(deps): dev-deps bump | **HOLD** |
| #1128 | chore(deps): postcss bump hookup-assistant | ✅ pass — merge eligible |
| #1125 | feat(cf-9t70): sampleRequests endpoint | ⏳ running |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | ❌ fail |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | Mergeable | CI |
|----|-------|-----------|-----|
| #334 | **fix(cf-o8s9): restore LivingSky backdrop ← NEW Stilgar directive** | ✅ | ⏳ running |
| #332 | feat(cf-xmpb): commerce dark mode — PDP + account | ✅ | ⏳ running |
| #331 | feat(cf-4bhw): Gift Registry — /registry + /registry/[slug] | ✅ | ❌ fail |
| #330 | feat(cf-wzl3): LivingSky dark mode night state | ✅ | ⏳ running |
| #329 | feat(cf-8w86): Gift Cards page — /gift-cards route | ✅ | ⏳ CI |
| #326 | fix(cf-kj8n): VERCEL_PROJECT_PRODUCTION_URL sitemap | ✅ | ⏳ CI |
| #323 | feat(cf-7dfv): wire PdpFinancing into PDP | ✅ | ⏳ CI |
| #322 | fix(cf-j6ub): useTimeOfDay RAF + SSR flash guard | ✅ | ⏳ running |
| #320 | feat(cf-kjpy): Local SEO city pages | ✅ | ⏳ CI |
| #319 | feat(cf-3i8j): 2D drag-drop room planner | ✅ | ❌ fail |
| #318 | feat(cf-footer): consolidate footer living illustration | ✅ | ⏳ CI |
| #317 | fix(cf-m80l): Canby collection slug | ✅ | ⏳ CI |
| #303 | feat(cf-u7yk): /gift-cards page (older, dupes #329) | ✅ | ❌ fail |
| #299 | fix(cf-urbq): dark mode font contrast ← REBASED | ✅ | ❌ fail |
| #296 | feat(cf-e4vd/cf-ph80): HomeQuizCta + Swatch | ✅ | ⏳ CI |
| #293 | feat(cf-urfn): HomeSaleStrip ← REBASED | ✅ | ⏳ CI |
| #291 | feat(cf-ww8u): PdpSizeGuide ← REBASED | ✅ | ❌ fail |
| #290 | feat(cf-lqnd): PDP back-in-stock notify me | ✅ | ⏳ CI |
| #282 | feat(cf-0y1e): PDP Size Guide v2 | ✅ | ⏳ CI |
| #281 | feat(cf-7axq): Add to Compare ← REBASED | ✅ | ❌ fail |
| #278 | feat(cf-c7re): HTTP security headers | ✅ | ⏳ CI |
| #276 | test(cf-o3bv): CartDrawer+CartPage sentinel | ✅ | ⏳ CI |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ | ✅ pass |

**No CONFLICTING PRs.** ❌ fail = lint/typecheck failure (not E2E — E2E skipped on PR builds). ⏳ CI = awaiting run after rebase.

---

## Crew Assignments

| Crew | Current Task | Bead |
|------|-------------|------|
| godfrey | BNPL financing UI (PR #323) — status check sent | cf-7dfv |
| radahn | Local SEO city pages (PR #320) — status check sent | cf-kjpy |
| rennala | /collections/* → /shop/* redirect fix | cf-1te7 |
| blaidd | Cart P0 convoy — checkout empty regression | cf-cfol |
| millicent | /care + /care-warranty routes 404 | cf-e92v |
| morgott | Cart P1 convoy — sticky add-to-cart persistence | cf-p7la |
| miquella | Review PR #334 (LivingSky header restoration) | cf-o8s9 |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **LivingSky header** | PR #334 open — restores what #327 removed. Stilgar directive. |
| **P0 cart regression** (cf-cfol) | blaidd on it; morgott on cf-p7la (sticky cart) |
| **Mascot visibility** | PR #328 merged, Stilgar not seeing bear/deer/fox/owl. Likely Vercel cache — needs Vercel preview URL check |
| **contactSubmissions 404** | Velo endpoint exists; awaiting Stilgar §1-§3 DNS clearance |
| **DNS flip** (cf-cb9s) | Stilgar manual §1-§3 pending; §5 order-lookup 501. Dallas holding. |
| **CROSS_RIG_SECRET** | ✅ COMPLETE: Vercel ✅ Wix ✅ Mobile ✅ |
| **cf-hc2i** | Closed — PR #1123 was already merged; rennala confirmed. |
| **cf-lxbe** | Closed — 84/88 done, 4 unresolvable accepted. |

---

## In-Progress Beads (19 total)

| Bead | Pri | Title |
|------|-----|-------|
| cf-o8s9 | P1 | Restore LivingSky backdrop — PR #334 open |
| cf-cfol | P1 | [P0] Add-to-cart no longer persists — checkout empty |
| cf-p7la | P1 | [P1] Sticky add-to-cart adds item but checkout empty |
| cf-10fx | P1 | PDP Financing / BNPL section |
| cf-d3hc | P1 | PDP Financing / BNPL section (Afterpay, Affirm) |
| cf-1te7 | P1 | /collections/* 404 — no redirect to /shop/* |
| cf-9t70 | P1 | /swatch-request page — fabric sample order form |
| cf-c77s | P1 | E2E auto emails + challenges + reward system |
| cf-kjpy | P1 | cfW Local SEO city pages |
| cf-rtd7 | P1 | cf-3qt full prod parity audit |
| cf-yfvl | P1 | cf-theme-experiments — A/B/C/D home variants |
| cf-9fd8 | P2 | PDP back-in-stock notify me |
| cf-9izd | P2 | cf-3qt cart QA: seeded-fixture preview deployment |
| cf-e92v | P2 | /care and /care-warranty routes missing |
| cf-4bhw | P2 | cfW Gift Registry page — PR #331 submitted |
| cf-rymw | P2 | cf-dark-mode — site-wide dark mode option |
| cf-0s4l | P3 | /sustainability — wire Wix CMS |
| cf-992s | P3 | wilderness-log-futon-frame 404 |
| cf-rb07 | P3 | SEO: /sitemap.xml 404 on prod |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ⚠️ Was failing 3 days — E2E 30s timeout (Option A, 881708c) + skip on PRs (Option B, 721ca82) now both live. |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
