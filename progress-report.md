# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-03 20:50 MT**

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
| LivingSky header | ✅ LIVE — pink/blue/teal sky gradient on all pages |
| Footer illustration | ✅ LIVE — night mountain scene |
| About page illustration | ✅ LIVE — v2 botanical ink art |
| Gift Cards /gift-cards | ✅ LIVE — "coming soon" placeholder |
| PLP /shop/futon-frames | ✅ LIVE — 17 products |
| Design a Room | ⚠️ TEXT ONLY — miquella building room scene (cf-c0dh) |
| Home scroll crash | ❌ BUG — crashes at page bottom, 3 errors (cf-d3ho) |
| Sale lightbox | ⚠️ Fires every page nav (cf-nbu4) |
| LivingSky height fix | ⏳ PR #341 CI running — Vercel preview ✅ green |

**carolinafutons.com still = Wix.** cfW visible on Vercel URL only until DNS flip (cf-3qt.8).

---

## CF Open PRs (carolina-futons / Velo)

| PR | Title | CI |
|----|-------|----|
| #1133 | feat(cf-y2l3): trade-in / trade-up program | ❌ fail (test 20+22) |
| #1130 | chore(deps): dev-deps bump | **HOLD** ✅ pass |
| #1125 | feat(cf-9t70): sampleRequests endpoint | ⚠️ codecov only |
| #1120 | feat(cf-3qt.4.4): delivery zone distance calc | ❌ fail (test 20+22) |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI |
|----|-------|----|
| #341 | fix(cf-d3ho): LivingSky full height restore | ⏳ running (Vercel ✅) |
| #331 | feat(cf-4bhw): Gift Registry | ❌ fail |
| #319 | feat(cf-3i8j): 2D drag-drop room planner | ❌ fail |
| #299 | fix(cf-urbq): dark mode font contrast | ❌ fail |
| #291 | feat(cf-ww8u): PdpSizeGuide | ❌ fail |
| #281 | feat(cf-7axq): Add to Compare | ❌ fail |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass |

**#331/#319/#299/#291/#281 all failing = lint/typecheck errors. E2E skipped on PR builds.**

---

## Crew Assignments

| Crew | Current Task | Bead |
|------|-------------|------|
| blaidd | Cart QA seeded fixtures | cf-9izd |
| godfrey | PDP Financing BNPL | cf-10fx |
| radahn | /sustainability CMS wiring | cf-0s4l |
| rennala | Sitemap 404 fix | cf-rb07 |
| millicent | Illustration wiring — v1/v2/v3 sub-pages | cf-tyuk |
| morgott | Home page scroll crash investigation | cf-d3ho |
| miquella | Design a Room — futon-in-room visual | cf-c0dh |

**Queued:** cf-nbu4 (sale lightbox session gate) → radahn after cf-0s4l

**Convoy candidates:** cf-rtd7 parity audit (no crew), cf-eihx shipping tier (no crew) — flag to mayor for dallas cross-rig convoy

---

## Open Blockers

| Issue | Status |
|-------|--------|
| **LivingSky height collapse** | P0 — PR #341 CI running, Vercel preview green |
| **Home scroll crash** | cf-d3ho P1 — morgott investigating |
| **Sale lightbox fires everywhere** | cf-nbu4 P2 — radahn queued |
| **Design a Room plain** | cf-c0dh P1 — miquella in progress |
| **Velo #1125** | Codecov-only fail — admin merge eligible? |
| **cf-9t70 swatch CMS** | Wix Dashboard: SwatchRequests collection + email templates |
| **contactSubmissions 404** | Awaiting Stilgar §1-§3 DNS clearance |
| **DNS flip** (cf-cb9s) | Stilgar §1-§3 pending; §5 order-lookup 501. Dallas holding. |

---

## In-Progress Beads (12 total)

| Bead | Pri | Title | Crew |
|------|-----|-------|------|
| cf-10fx | P1 | PDP Financing / BNPL | godfrey |
| cf-d3hc | P1 | PDP Financing / BNPL (Afterpay, Affirm) | — |
| cf-9t70 | P1 | /swatch-request — code done, Wix CMS pending | — |
| cf-c0dh | P1 | Design a Room — futon-in-room visual | miquella |
| cf-d3ho | P1 | Home page scroll crash | morgott |
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
