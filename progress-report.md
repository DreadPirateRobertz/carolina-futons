# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-03 21:30 MT**

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

## 🔍 STILGAR SITE AUDIT — Vercel URL (audited 20:15 MT)

**URL:** https://carolina-futons-web-git-main-dreadpiraterobertzs-projects.vercel.app/

| Feature | Status |
|---------|--------|
| LivingSky header | ✅ LIVE + height fix merged (#341) |
| Footer illustration | ✅ LIVE — night mountain scene |
| About page illustration | ✅ LIVE — v2 botanical ink art |
| Gift Cards /gift-cards | ✅ LIVE — "coming soon" placeholder |
| PLP /shop/futon-frames | ✅ LIVE — 17 products |
| Home scroll crash | ⏳ Fix PR #345 CI running (millicent) |
| Design a Room | ❌ PR #343 CI+Vercel FAILED — rennala fixing |
| Sale lightbox | ⏳ Velo PR #1134 CI running (godfrey) |
| Theme A/B/C/D previews | ✅ PR #344 GREEN — awaiting Stilgar pick |

**carolinafutons.com still = Wix.** cfW visible on Vercel URL only until DNS flip (cf-3qt.8).

---

## CF Open PRs (carolina-futons / Velo)

| PR | Title | CI |
|----|-------|----|
| #1134 | fix(cf-nbu4): promo lightbox session gate | ⏳ running |
| #1133 | feat(cf-y2l3): trade-in / trade-up program | ❌ fail (test 20+22) |
| #1130 | chore(deps): dev-deps bump | **HOLD** ✅ pass |
| #1125 | feat(cf-9t70): sampleRequests endpoint | ⚠️ codecov only |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | ❌ fail (test 20+22) |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI |
|----|-------|----|
| #345 | fix(cf-d3ho): VintageSunRays hydration mismatch | ⏳ running (Vercel ✅) |
| #344 | feat(cf-yfvl): /theme-d Fontshare Minimal | ✅ GREEN — Stilgar pick pending |
| #343 | feat(cf-c0dh): Design a Room scene viewer | ❌ FAIL — rennala fixing |
| #331 | feat(cf-4bhw): Gift Registry | ❌ fail |
| #319 | feat(cf-3i8j): 2D drag-drop room planner | ❌ fail |
| #299 | fix(cf-urbq): dark mode font contrast | ❌ fail |
| #291 | feat(cf-ww8u): PdpSizeGuide | ❌ fail |
| #281 | feat(cf-7axq): Add to Compare | ❌ fail |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass |

---

## Crew Assignments

| Crew | Current Task | Bead |
|------|-------------|------|
| blaidd | Phase 5 marketing + utility pages | cf-3qt.5 |
| blaidd | E2E auto emails + rewards (convoy) | cf-c77s |
| godfrey | Sale lightbox session gate | cf-nbu4 |
| radahn | /sustainability CMS wiring | cf-0s4l |
| rennala | Design a Room fix (CI failing) | cf-c0dh |
| rennala | BNPL Afterpay/Affirm (convoy) | cf-d3hc |
| millicent | PDP back-in-stock notify me | cf-9fd8 |
| miquella | CFW shipping tier system | cf-eihx |
| miquella | Parity audit | cf-rtd7 |
| morgott | Theme A/B/C/D experiments | cf-yfvl |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **cf-c0dh Design a Room** | PR #343 CI+Vercel FAIL — rennala fixing |
| **Sale lightbox** | cf-nbu4 P2 — Velo PR #1134 CI running |
| **Home scroll crash** | cf-d3ho — PR #345 CI running |
| **Velo #1125** | Codecov-only fail — admin merge eligible? |
| **cf-9t70 swatch CMS** | Wix Dashboard: SwatchRequests collection + email templates |
| **contactSubmissions 404** | Awaiting Stilgar §1-§3 DNS clearance |
| **DNS flip** (cf-cb9s) | Stilgar §1-§3 pending; §5 order-lookup 501. Dallas holding. |
| **Theme pick** | PR #344 green — Stilgar needs to choose A/B/C/D |

---

## In-Progress Beads (10 total)

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-10fx | P1 | PDP Financing / BNPL | godfrey |
| cf-9t70 | P1 | /swatch-request — code done, Wix CMS pending | morgott |
| cf-c0dh | P1 | Design a Room — futon-in-room visual | rennala |
| cf-eihx | P1 | CFW shipping tier system | miquella |
| cf-rtd7 | P1 | cf-3qt full prod parity audit | miquella |
| cf-yfvl | P1 | cf-theme-experiments A/B/C/D variants | morgott |
| cf-9fd8 | P2 | PDP back-in-stock notify me | millicent |
| cf-9izd | P2 | Cart QA seeded-fixture preview deploy | millicent |
| cf-nbu4 | P2 | Sale lightbox session gate | godfrey |
| cf-0s4l | P3 | /sustainability — wire Wix CMS | radahn |

**Outside bd:** cf-3qt.5/blaidd · cf-d3hc/rennala · cf-c77s/blaidd

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Fixed — E2E 30s timeout + skip on PRs |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
