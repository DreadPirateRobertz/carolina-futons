# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-03 21:40 MT**

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

## 🔍 STILGAR SITE AUDIT — Vercel URL

**URL:** https://carolina-futons-web-git-main-dreadpiraterobertzs-projects.vercel.app/

| Feature | Status |
|---------|--------|
| LivingHero header | ⏳ cf-etv3 in progress — morgott replacing LivingSkyClient |
| Theme previews A/B/C/D | ✅ LIVE on main — /theme-a /theme-b /theme-c /theme-d |
| Design a Room | ✅ MERGED #343 — futon-in-room scene viewer live |
| Home scroll crash | ✅ MERGED #345 — hydration mismatch fixed |
| PDP duplicate financing | ✅ MERGED #346 — duplicate render removed |
| Footer illustration | ✅ LIVE — night mountain scene |
| Sale lightbox session gate | ⏳ Velo #1134 CI running |

**carolinafutons.com still = Wix.** cfW visible on Vercel URL only until DNS flip (cf-3qt.8).

---

## CF Open PRs (carolina-futons / Velo)

| PR | Title | CI |
|----|-------|----|
| #1134 | fix(cf-nbu4): promo lightbox session gate | ⏳ test(22) running |
| #1133 | feat(cf-y2l3): trade-in / trade-up program | ❌ fail (test 20+22) |
| #1130 | chore(deps): dev-deps bump | **HOLD** ✅ pass |
| #1125 | feat(cf-9t70): sampleRequests endpoint | ⚠️ codecov only |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | ❌ fail (test 20+22) |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI |
|----|-------|----|
| #331 | feat(cf-4bhw): Gift Registry | ❌ fail |
| #319 | feat(cf-3i8j): 2D drag-drop room planner | ❌ fail |
| #299 | fix(cf-urbq): dark mode font contrast | ❌ fail |
| #291 | feat(cf-ww8u): PdpSizeGuide | ❌ fail |
| #281 | feat(cf-7axq): Add to Compare | ❌ fail |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass |

**#331/#319/#299/#291/#281 all failing = lint/typecheck errors.**

---

## Crew Assignments

| Crew | Current Task | Bead |
|------|-------------|------|
| blaidd | Phase 5 marketing + utility pages | cf-3qt.5 |
| blaidd | E2E auto emails + rewards (convoy) | cf-c77s |
| godfrey | Sale lightbox session gate | cf-nbu4 |
| radahn | /sustainability CMS wiring | cf-0s4l |
| rennala | BNPL Afterpay/Affirm | cf-d3hc |
| millicent | Cart QA seeded-fixture preview | cf-9izd |
| miquella | CFW shipping tier system | cf-eihx |
| miquella | Parity audit | cf-rtd7 |
| morgott | LivingHero header wiring | cf-etv3 |

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **LivingHero header** | cf-etv3 P1 — morgott in progress (Stilgar directive) |
| **cf-nbu4 sale lightbox** | Velo #1134 test(22) running |
| **Theme pick** | /theme-a /theme-b /theme-c /theme-d live — Stilgar to choose |
| **Auth redirect bug** | cf-w5ks P2 — GAP-AUTH-1 dead-end redirect, uncrewed |
| **Velo #1125** | Codecov-only fail — admin merge eligible? |
| **cf-9t70 swatch CMS** | Wix Dashboard: SwatchRequests collection pending |
| **contactSubmissions 404** | Awaiting Stilgar §1-§3 DNS clearance |
| **DNS flip** (cf-cb9s) | Stilgar §1-§3 pending; §5 order-lookup 501. Dallas holding. |

---

## In-Progress Beads (8 total)

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-10fx | P1 | PDP Financing / BNPL | godfrey |
| cf-9t70 | P1 | /swatch-request — code done, Wix CMS pending | morgott |
| cf-c0dh | P1 | Design a Room — MERGED #343 | rennala |
| cf-etv3 | P1 | LivingHero header wiring | morgott |
| cf-yfvl | P1 | cf-theme-experiments A/B/C/D — MERGED #344 | morgott |
| cf-9izd | P2 | Cart QA seeded-fixture preview deploy | millicent |
| cf-w5ks | P2 | GAP-AUTH-1 dead-end auth redirect | — |
| cf-0s4l | P3 | /sustainability — wire Wix CMS | radahn |

**Outside bd:** cf-3qt.5/blaidd · cf-d3hc/rennala · cf-c77s/blaidd · cf-eihx/miquella · cf-rtd7/miquella

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Fixed — E2E 30s timeout + skip on PRs |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
