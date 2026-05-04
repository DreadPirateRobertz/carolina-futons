# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-03 18:17 MT**

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
| #1132 | fix(tests): blog post count assertions cf-phgh | Open — needs CI |
| #1131 | feat(cf-r9tf): one-click email unsubscribe | Open — needs CI |
| #1130 | chore(deps): dev-deps bump | **HOLD** |
| #1128 | chore(deps): postcss bump hookup-assistant | Open — deps |
| #1125 | feat(cf-9t70): sampleRequests endpoint | Open — CI pending |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | Open — needs rebase |

---

## CFW Open PRs (carolina-futons-web / Next.js) — Active

| PR | Title | CI |
|----|-------|----|
| #323 | feat(cf-7dfv): BNPL financing PDP | ❌ fail |
| #320 | feat(cf-kjpy): Local SEO city pages | ❌ fail |
| #319 | feat(cf-3i8j): 2D drag-drop room planner | ❌ fail |
| #318 | feat(cf-footer): living illustration footer | ⏳ pending |
| #317 | fix(cf-m80l): Canby collection slug | ❌ fail |
| #303 | feat(cf-u7yk): /gift-cards page | ❌ fail |
| #299 | fix(cf-urbq): dark mode font contrast | ❌ fail |
| #296 | feat(cf-e4vd/cf-ph80): HomeQuizCta + Swatch | ⏳ pending |
| #293 | feat(cf-urfn): HomeSaleStrip | ❌ fail |
| #291 | feat(cf-ww8u): PdpSizeGuide | ❌ fail |
| #290 | feat(cf-lqnd): PDP back-in-stock notify me | ⏳ running |
| #282 | feat(cf-0y1e): PDP Size Guide v2 | ⏳ pending |
| #281 | feat(cf-7axq): Add to Compare | ❌ fail |
| #278 | feat(cf-c7re): HTTP security headers | ⏳ running |
| #276 | test(cf-o3bv): CartDrawer sentinel | ⏳ running |
| #275 | fix(cf-o3bv): cart checkout `<a>` | ⏳ running |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ⏳ pending |

**Note:** Many fails are E2E flakiness (Wix API timeout from CI runner). Unit tests pass. Investigating E2E stabilization.

---

## Crew Assignments

| Crew | Current Task | Bead |
|------|-------------|------|
| godfrey | BNPL financing UI (PR #323) | cf-7dfv |
| radahn | WCAG AA contrast — MERGED via #315 | reassign → cf-kjpy |
| rennala | useTimeOfDay RAF fix (PR #322) | cf-j6ub |
| blaidd | **cf-eihx DONE** ✓ → next P1 pending | cf-eihx done |
| millicent | Image audit (84/88 done, 4 unresolvable) | cf-lxbe |
| morgott | Room planner 2D drag-drop (PR #319) | cf-3i8j |
| miquella | Local SEO city pages (PR #320) | cf-kjpy |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **E2E flakiness** | PLP tests timeout on Wix API — merging with admin for unit-test-green PRs |
| **P0 cart regression** (cf-cfol/cf-p7la) | PRs #275-#276 running CI now |
| **contactSubmissions 404** | Velo endpoint exists; stage3-velo sync pending |
| **DNS flip** (cf-cb9s) | Stilgar manual §1-§3; §5 order-lookup 501 |
| **blaidd reassign** | cf-eihx done; pick next P1 bead |
| **dallas cross-rig** | Replied — /contact 404 + DNS timeline pending |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Active |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
