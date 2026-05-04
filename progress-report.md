# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-04 10:18 MT**

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
Active: `trackCustomEvent` ✅ `sampleRequests` ✅ `notifyMe` ✅ `deliveryZone` ✅ `contactSubmissions` ⚠️ (code at http-functions.js:2641 — live Wix site PUBLISH needed by Stilgar) `crossRigEventReceiver` ✅

### Cross-Rig (Mobile ↔ cfW)
Channel A dual-write active. CROSS_RIG_SECRET: **Vercel Prod ✅ + EAS ✅ + Wix Staging ✅**. CFW_API_URL in EAS = `https://carolina-futons-web.vercel.app` (update to carolinafutons.com at DNS cutover). DNS cutover pending cf-cb9s.

---

## 🔍 P0 PRODUCTS — CONFIRMED BROKEN

**Root cause:** Wix headless OAuth app `cb591c8e` returns `"No Metasite Context in identity"` — not installed on any Wix site with Stores.

**STILGAR MUST FIX (wix.com/developers):** Manage Apps → find `cb591c8e-2147-4ca2-88f0-89b7e0f2b25a` → install on carolinafutons.com. No code change can resolve this.

---

## 🧪 TEST RESULTS

| Suite | Result |
|-------|--------|
| Gamification / reward (5 files) | ✅ 139/139 PASS |
| Checkout route (cfW) | ✅ 3/3 PASS |
| Full cfutons vitest suite | ✅ **40,158/40,158 PASS** |
| E2E checkout (real payment) | ⛔ BLOCKED — P0 must resolve first; Stilgar enable Wix sandbox payment |
| E2E fixture-mode smoke test | ✅ PRs merged |

---

## 🎨 DESIGN MIGRATION STATUS

**Stilgar direct order 2026-05-04.** Plan: `crew/melania/design-migration-plan.md`

| Phase | Scope | PR | Status |
|-------|-------|----|--------|
| Quick wins | Delete orphaned botanical components | — | 🔧 radahn |
| Phase 0 | MascotFooterDivider wired into layout | #400 | ✅ MERGED |
| Phase 1 | PLP category cards verify | — | 🔧 godfrey (after #390) |
| Phase 2 — /about | BotanicalMountainSkyline + Timeline + TeamPortrait → v3 | #401 | ✅ MERGED (87/100) |
| Phase 2 — /contact + /press | ContactHero → FogScene | #402 | ⚠️ BLOCK — aria fix needed (blaidd) |
| Phase 2 — /visit + /design-a-room | BotanicalVisitUs + DesignARoom → v3 scenes | — | 🔧 miquella |
| Phase 2 — /guides + /reviews | BotanicalGuides + Reviews → ReadingScene + FallsScene | #407 | ⏳ CI running |
| Phase 2 — /spring-sale | LivingSky → VintageSunRays | — | 🆕 rennala |
| Phase 3 | Empty states + 404 → v3 mascot spots | #405 | ✅ MERGED (74/100) |
| Cleanup | Final illustrations/ audit | — | ⏳ radahn (last) |

---

## CFW Open PRs (carolina-futons-web / Next.js)

| PR | Title | CI | Note |
|----|-------|----|----|
| #407 | feat(design-migration): /guides + /reviews ReadingScene+FallsScene | ⏳ RUNNING | morgott |
| #402 | feat(design-migration): FogScene /contact+/press | ✅ CLEAN | **BLOCK** 91/100 — aria-hidden conflict (blaidd fix pending) |
| #399 | fix(cf-2idp): Mesa sale fixture | ✅ CLEAN | morgott — needs refinery + merge |
| #392 | chore(deps): bump eslint 9→10 | ❌ FAIL | **HOLD** — major version |
| #391 | chore(deps): bump wix-sdk group | ✅ CLEAN | **HOLD** |
| #390 | test(cf-3qt.14): /search page E2E smoke | ✅ CLEAN | **BLOCK** 58/100 — form submit + data-slot fixes missing (godfrey) |
| #389 | feat(cf-3qt.12): /shop/sale PLP | ✅ CLEAN | **CONFLICT** — blaidd rebase needed after #394 |
| #376 | docs(cf-3qt.7): analytics env vars | ✅ CLEAN | **BLOCK**: Stilgar replace GA4/Meta IDs |
| #356 | fix(cf-okwz): copy BEAR10 to clipboard | ✅ CLEAN | Stilgar approval needed |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ pass | draft |

## CF Open PRs (carolina-futons / Velo)

| PR | Title | CI | Note |
|----|-------|----|----|
| #1136 | chore(deps): bump dawidd6/action-send-mail | **HOLD** ✅ | |
| #1130 | chore(deps): dev-deps bump | **HOLD** ✅ | |

---

## Crew Assignments

| Crew | Current Task | Status |
|------|-------------|--------|
| radahn | Design migration quick wins — delete orphaned botanical components | 🔧 |
| rennala | Design migration /spring-sale — LivingSky → VintageSunRays | 🆕 |
| blaidd | PR #402 aria fix (outer aria-hidden conflicts inner role/aria-label) + then /spring-sale support | ⚠️ |
| godfrey | PR #390 fix — form submit test + data-slot="product-card" selector (BLOCK 58/100) | ⚠️ |
| miquella | Design migration /visit + /design-a-room | 🔧 |
| morgott | PR #407 CI running (/guides+/reviews) → then Phase 1 PLP audit | 🔧 |
| millicent | Follow-on: NotFoundIllustration V3_NIGHT palette fix + Bear pose verification | 🆕 |

---

## Open Blockers (Stilgar actions)

| Issue | Status |
|-------|--------|
| **P0: 0 products** | wix.com/developers: install OAuth app cb591c8e on carolinafutons.com |
| **E2E checkout** | Wix Dashboard: enable sandbox payment + P0 fix |
| **cf-0s4l** | Create WIX_API_KEY under account ed8a7220 |
| **contactSubmissions** | Publish live Wix site |
| **PR #356** | Approve clipboard approach |
| **PR #376** | Replace real GA4/Meta Pixel IDs with placeholder strings |
| **GSC sitemap** | Deferred Phase 8 |
| **SwatchRequests CMS** | Create collection in Wix Dashboard |
| **SENTRY_AUTH_TOKEN** | Set in EAS |
| **Theme pick** | Choose /theme-a–d |
| **DNS flip** (cf-cb9s) | §1-§3 pending |

---

## In-Progress Beads

| Bead | Pri | Title | Status |
|------|-----|-------|--------|
| cf-3qt.7 | P1 | SEO + analytics — code COMPLETE | PR #376 blocked Stilgar |
| cf-okwz | P3 | EasterEggBear clipboard | PR #356 pending Stilgar |

---

## Shipping Test Report ✅

56/56 PASS · Parcel <70 lbs · LTL 70–499 lbs · Freight ≥500 lbs or palletized · White-glove NC only

---

## Session Merges (this session)

| PR | Title | Score | When |
|----|-------|-------|------|
| #405 | feat(design-migration-p3): Phase 3 empty states | 74/100 | 10:17 UTC |
| #401 | feat(design-migration): /about botanical → v3 | 87/100 | 10:12 UTC |
| #400 | feat(design-migration-p0): MascotFooterDivider in layout | 95/100 | 10:12 UTC |
| #397 | feat(cf-nujp): email routes + verify spec | 87/100 | 10:05 UTC |
| #396 | test(cf-gjhu): rewards E2E scaffold | — | 10:05 UTC |
| #395 | feat(cf-8xw1): data-slot=category-card | 97/100 | 10:05 UTC |
| #394 | fix(cf-3qt.12): Mesa discountedPrice hotfix | — | ~09:55 UTC |
| #393 | fix(cf-m07g): checkout real-payment E2E (gated) | 97/100 | 15:49 UTC |
| #389 | feat(cf-3qt.12): /shop/sale PLP | 100/100 | ~09:50 UTC |
| Earlier PRs | #383–#388, #369–#382, #352–#368 | — | 05:41–09:2x UTC |

---

## Nightly CI
| Repo | Schedule | State |
|------|---------|-------|
| carolina-futons | `0 6 * * *` | ✅ Running |
| carolina-futons-web | `0 6 * * *` | ✅ Running |
| carolina-futons-stage3-velo | `0 6 * * *` | ✅ Running |

---

## Auto-Push Cron
Progress report auto-pushed every 10 min via cron `de1e2247` (session-only, 7-day TTL).

---
*Cron: 353ab5c0 (progress refresh) + de1e2247 (auto-push) · Design migration 60% complete — Phase 0+2/about+Phase 3 MERGED · #390 BLOCK 58/100 · #402 BLOCK aria fix · #389 CONFLICT needs rebase*
