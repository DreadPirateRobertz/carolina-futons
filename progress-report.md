# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-03 17:45 MT**

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

## CF Open PRs (carolina-futons / Velo)

| PR | Title | State |
|----|-------|-------|
| #1132 | fix(tests): blog post count assertions cf-phgh | Open — needs CI |
| #1131 | feat(cf-r9tf): one-click email unsubscribe | Open — needs CI |
| #1130 | chore(deps): dev-deps bump | **HOLD** (CI regression risk) |
| #1128 | chore(deps): postcss bump hookup-assistant | Open — deps only |
| #1125 | feat(cf-9t70): sampleRequests endpoint | Open — CI pending |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | Open — needs rebase |

---

## CFW Open PRs (carolina-futons-web / Next.js) — 25 open

| PR | Title | CI |
|----|-------|----|
| #328 | feat(cf-shop-mascot): animated mascot category cards | ⏳ pending |
| #327 | fix(header): remove LivingSky backdrop | ⏳ pending |
| #326 | fix(cf-kj8n): sitemap canonical URL | ❌ fail |
| #325 | fix(a11y): WCAG AA contrast audit | ❌ fail |
| #323 | feat(cf-7dfv): BNPL financing PDP | ❌ fail |
| #322 | fix(cf-j6ub): useTimeOfDay RAF + SSR guard | ❌ fail |
| #321 | fix(cf-ac1y): stale product slugs in ShopTheRoom | ❌ fail |
| #320 | feat(cf-kjpy): Local SEO city pages | ⏳ pending |
| #319 | feat(cf-3i8j): 2D drag-drop room planner | ❌ fail |
| #318 | feat(cf-footer): living illustration footer consolidation | ⏳ pending |
| #317 | fix(cf-m80l): Canby futon frame slug rename | ❌ fail |
| #315 | feat(cm-002): AR model-viewer PDP mobile | ❌ fail |
| #303 | feat(cf-u7yk): /gift-cards page | ❌ fail |
| #299 | fix(cf-urbq): dark mode font contrast WCAG AA | ❌ fail |
| #296 | feat(cf-e4vd/cf-ph80): HomeQuizCta + HomeSwatchPromo | ⏳ pending |
| #293 | feat(cf-urfn): HomeSaleStrip home section | ❌ fail |
| #291 | feat(cf-ww8u): PdpSizeGuide dimensions table | ❌ fail |
| #290 | feat(cf-lqnd): PDP back-in-stock notify me | ⏳ pending |
| #289 | fix(cf-ml6n): doubled footer removal | ⏳ pending |
| #282 | feat(cf-0y1e): PDP Size Guide + Room Fit checker | ⏳ pending |
| #281 | feat(cf-7axq): Add to Compare PDP/PLP | ❌ fail |
| #278 | feat(cf-c7re): HTTP security headers | ⏳ pending |
| #276 | test(cf-o3bv): CartDrawer sentinel guard | ⏳ pending |
| #275 | fix(cf-o3bv): cart checkout link `<a>` | ⏳ pending |
| #136 | docs(cf-93rb-B): design-tokens delta matrix [DRAFT] | ⏳ pending |

**Priority merges needed:** #327 (header fix), #328 (mascot cards) — site looks unchanged to Stilgar. Both pending CI.

---

## Crew Assignments

| Crew | Current Task | Bead |
|------|-------------|------|
| godfrey | BNPL financing UI (PR #323) | cf-7dfv |
| radahn | WCAG AA contrast (PR #325) | cf-urbq |
| rennala | useTimeOfDay RAF fix (PR #322) | cf-j6ub |
| blaidd | **cf-eihx shipping tiers DONE** ✓ → PR ready, needs reassign | cf-eihx |
| millicent | Image audit (84/88 done, 4 unresolvable) | cf-lxbe |
| morgott | Room planner 2D drag-drop (PR #319) | cf-3i8j |
| miquella | Local SEO city pages (PR #320) | cf-kjpy |

**New nudge — blaidd:** cf-eihx shipping tiers complete (54 tests). feat/cf-eihx-shipping-tiers pushed. Ready for PR creation.
**New nudge — dallas:** Vercel/Velo coordination needed — /contact 404, DNS flip timeline, env vars for mobile.

---

## In-Progress Beads (21 total)

**P1 (12):** cf-10fx (BNPL), cf-1te7 (404 collections redirect), cf-9t70 (swatch-request), cf-c77s (email challenges epic), cf-cfol (cart P0 regression), cf-d3hc (PDP financing), cf-eihx (shipping tiers ✓), cf-hc2i (email templates registry), cf-kjpy (city SEO pages), cf-p7la (sticky add-to-cart), cf-rtd7 (parity audit epic), cf-yfvl (theme experiments)

**P2 (4):** cf-9fd8 (notify me), cf-9izd (cart QA), cf-e92v (/care 404), cf-whye (sustainability)

**P3 (5):** cf-0s4l (sustainability CMS), cf-992s (wilderness-log 404), cf-a2qs (room-planner slug), cf-d1fu (community gallery), cf-rb07 (sitemap 404)

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **UI changes not visible** | #327/#328 still pending CI — must merge to main for Vercel deploy |
| **P0 cart regression** (cf-cfol/cf-p7la) | PRs #275-#277 pending — merge ASAP |
| **contactSubmissions 404** | Velo endpoint exists; stage3-velo sync pending |
| **DNS flip** (cf-cb9s) | §1-§3 Stilgar manual; §5 order-lookup 501 |
| **CF #1120/#1126** | http-functions.js conflicts — need rebase |
| **CFW 10+ PRs failing CI** | Likely need rebases after recent main commits |
| **blaidd reassign** | cf-eihx done; pick next P1 bead |
| **dallas cross-rig sync** | /contact 404 question + DNS timeline pending reply |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Active |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
