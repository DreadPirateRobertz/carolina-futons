# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-03 20:20 MT**

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

## 🔍 STILGAR SITE AUDIT — Vercel URL (2026-05-03 20:15 MT)

**Audited:** https://carolina-futons-web-git-main-dreadpiraterobertzs-projects.vercel.app/

| Feature | Status | Notes |
|---------|--------|-------|
| LivingSky header | ✅ LIVE | Pink/blue/teal sky gradient visible all pages |
| Footer illustration | ✅ LIVE | Dark blue-green night mountain scene |
| About page illustration | ✅ LIVE | v2 botanical ink mountain art in hero bg |
| Gift Cards /gift-cards | ✅ LIVE | "Coming soon" placeholder with proper layout |
| PLP /shop/futon-frames | ✅ LIVE | 17 products, header + sub-nav correct |
| Design a Room | ⚠️ TEXT ONLY | No room visualization — cf-c0dh in progress |
| Home page scroll crash | ❌ BUG | Page crashes at bottom — 3 console errors — cf-d3ho |
| Sale lightbox | ⚠️ UX ISSUE | Fires on every page navigation — cf-nbu4 |

**Root cause Stilgar couldn't see:** carolinafutons.com still serves Wix. cfW features only on Vercel URL above. DNS flip (cf-3qt.8) required for public visibility.

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
| blaidd | Cart QA seeded fixtures | cf-9izd |
| godfrey | PDP Financing BNPL | cf-10fx |
| radahn | /sustainability CMS wiring | cf-0s4l |
| rennala | Sitemap 404 fix | cf-rb07 |
| millicent | Illustration wiring — v1/v2/v3 into sub-pages | cf-tyuk |
| morgott | **Home page scroll crash investigation** ← NEW | cf-d3ho |
| miquella | Design a Room — futon-in-room visual | cf-c0dh |

**Queued:** cf-nbu4 (sale lightbox session gate) → radahn after cf-0s4l

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **Home scroll crash** | cf-d3ho P1 — morgott investigating |
| **Sale lightbox fires everywhere** | cf-nbu4 P2 — radahn queued |
| **Design a Room plain** | cf-c0dh P1 — miquella building room scene |
| **Vercel URL** | Stilgar must use Vercel URL; DNS flip (cf-3qt.8) pending |
| **Velo #1125** | Codecov-only fail — admin merge eligible? |
| **cf-9t70 swatch CMS** | Wix Dashboard: SwatchRequests collection + email templates needed |
| **contactSubmissions 404** | Awaiting Stilgar §1-§3 DNS clearance |
| **DNS flip** (cf-cb9s) | Stilgar manual §1-§3 pending; §5 order-lookup 501 |

---

## In-Progress Beads (12 total)

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-10fx | P1 | PDP Financing / BNPL | godfrey |
| cf-d3hc | P1 | PDP Financing / BNPL (Afterpay, Affirm) | — |
| cf-9t70 | P1 | /swatch-request — code done, Wix CMS pending | — |
| cf-c0dh | P1 | Design a Room — futon-in-room visual | miquella |
| cf-d3ho | P1 | Home page scroll crash ← NEW | morgott |
| cf-c77s | P1 | E2E auto emails + challenges + rewards | — |
| cf-eihx | P1 | CFW shipping tier system | — |
| cf-rtd7 | P1 | cf-3qt full prod parity audit | — |
| cf-yfvl | P1 | cf-theme-experiments A/B/C/D variants | — |
| cf-9fd8 | P2 | PDP back-in-stock notify me | — |
| cf-9izd | P2 | Cart QA seeded-fixture preview deploy | blaidd |
| cf-0s4l | P3 | /sustainability — wire Wix CMS | radahn |

**Outside bd:** cf-rb07/rennala · cf-tyuk/millicent

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Fixed — E2E 30s timeout + skip on PRs |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---
*Cron: 1709bbed · Next refresh ~10 min*
