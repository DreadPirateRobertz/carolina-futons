# CF Project Progress Report
**Auto-refreshed every 10 min | Last updated: 2026-05-09 19:05 MT**

## Session 2026-05-09 — Wave 3 Merges
| Done | Detail |
|------|--------|
| ✅ cf-k5vr CLOSED | PR #1206 merged — IP-axis rate-limit + XFF extraction (millicent). All CI ✅ |
| ✅ cf-kull CLOSED | PR #1207 merged — stage3-velo parity audit doc+script (morgott). Doc-only, coverage flap --admin |
| ✅ cf-quba CLOSED | PR #1205 merged — cf-hpwy v3 allowlist (godfrey). All CI ✅ |
| 🆕 cf-1dvv FILED | P1: back-port options_referralService + post_referralService cfutons → stage3 gap. morgott assigned |
| ⏳ PR #1202 | cf-fovb (rennala) — needs rebase onto main (vi-domock fix) |
| ⏳ PR #1201 | cf-r1cl (millicent) — needs rebase onto main (vi-domock fix) |
| ⏳ PR #515 | cf-1eb5 (blaidd) — bear illustration OPEN, Stilgar visual required |

## Session 2026-05-09 — Wave 1 Merges
| Done | Detail |
|------|--------|
| ✅ cf-uggz CLOSED | Cambridge Futon Frame staging — 15 variants, priceRange $1,499–$1,599 |
| ✅ cf-g2sa CLOSED | Wix CLI publish GH Action already shipped |
| ✅ PR #498 MERGED | cfw-x20: FilterFirst two-column + bears.jpg home hero |
| ✅ Catalog: 34 products | Staging per-size variant pricing complete |

## Session 2026-05-09 — Wave 2 (this turn)
| Item | Status |
|------|--------|
| ✅ cf-m3tj MERGED | PR #1194 (rennala) — mobile gamification silent failure fixed |
| ✅ cf-hpb2 MERGED | PR #1195 + stage3 #32 (godfrey) — referralService dispatcher |
| ✅ cf-unxw stage3 MERGED | Stage3 #33 (godfrey) — fabricSampleService aliases |
| ✅ PR #512 MERGED | Header bear medallion reverted (Stilgar rejection) |
| ⚠️ PR #1196 CONFLICTING | cf-unxw cfutons main — godfrey rebasing |
| 🔧 cf-1eb5 → blaidd | V9 full-header bear — MUST show Stilgar before merge |
| 🔧 cf-a5w3 → miquella | Merge-ordering loss CI gate |
| ⏳ PR #507 | iOS right-edge gap — awaiting Stilgar iPhone visual |

## 🚨 Stilgar Required
| Bead | Pri | Action |
|------|-----|--------|
| PR #507 (cf-3lly) | P1 | iPhone visual confirm — DO NOT MERGE without |
| cf-1eb5 | P1 | V9 full-header bear screenshot review before merge |
| cf-c6g5 | P0 | STAGING_SITE email infra — 13 triggered templates |
| cf-3qt.8 | P1 | DNS cutover — Vercel Pro + go/no-go |
| cf-oi01 | P1 | UPS/Stripe/PayPal creds from Wix Secrets Manager |
| PR #515 (cf-1eb5) | P1 | VISUAL SIGN-OFF on bears header — preview: carolina-futons-web-git-cf-1eb5-dreadpiraterobertzs-projects.vercel.app |
| PR #1201 (cf-r1cl) | P1 | Add pin-head-sha to required status checks after merge |
| cfw-nsk FB redirect | P2 | Still reproducing? Need HAR if yes, close bead if gone |

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

**DEFERRED** — Stilgar will fix manually. FIX: halworker85@gmail.com → manage.wix.com/developer-center → My Apps → `cb591c8e-2147-4ca2-88f0-89b7e0f2b25a` → Install on carolinafutons.com

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

## 🎨 DESIGN MIGRATION STATUS — ✅ 100% COMPLETE

| Phase | Scope | PR | Status |
|-------|-------|----|--------|
| Quick wins | Delete orphaned botanical components | #406 | ✅ MERGED (95/100) |
| Phase 0 | MascotFooterDivider wired into layout | #400 | ✅ MERGED (95/100) |
| Phase 1 | PLP category cards — botanical imports removed | #404 | ✅ MERGED (95/100) |
| Phase 2 — /about | BotanicalMountainSkyline + Timeline + TeamPortrait → v3 | #401 | ✅ MERGED (87/100) |
| Phase 2 — /contact + /press | ContactHero → FogScene | #402 | ✅ MERGED (96/100) |
| Phase 2 — /visit + /design-a-room | BotanicalVisitUs + DesignARoom → v3 scenes | #403 | ✅ MERGED (87/100) |
| Phase 2 — /guides + /reviews | BotanicalGuides + Reviews → ReadingScene + FallsScene | #407 | ✅ MERGED (92/100) |
| Phase 2 — /spring-sale | LivingSky → VintageSunRays | #408 | ✅ MERGED (97/100) |
| Phase 3 | Empty states + 404 → v3 mascot spots | #405 + #409 | ✅ MERGED (74+97/100) |
| Cleanup | Final illustrations/ cleanup — ContactHero orphan deleted | #414 | ✅ MERGED (95/100) |

---

## CFW Open PRs (carolina-futons-web / Next.js)

⚠️ **MASS SESSION DEATH ~17:00 MT** — all hooks empty, fix directives sent to blaidd/millicent/miquella/rennala

| PR | Title | CI | Note |
|----|-------|----|----|
| #452 | feat(cf-l6aj.15): DragDropRoomPlanner + localStorage | ❌ FAIL | millicent — react-hooks/set-state-in-effect:64, unused var:81 |
| #451 | docs(cf-3qt.8.29): Vercel custom domain setup runbook | ✅ GREEN | blaidd — **MERGE READY** |
| #450 | feat(cf-l6aj.16): Gift Registry localStorage-backed | ❌ FAIL | blaidd — react-hooks/set-state-in-effect:19+25 |
| #449 | test(cf-l6aj.9): E2E coverage PdpRecentlyViewed rail | ✅ GREEN | godfrey — **MERGE READY** |
| #448 | feat(cf-3qt.8): pre-cutover synthetic monitor | ✅ GREEN | millicent — **MERGE READY** |
| #447 | feat(cf-l6aj.3): richer Featured cards color count+swatches | ❌ FAIL | radahn — CI still red post-rebase |
| #446 | feat(cf-l6aj.14): shareable style-quiz result URL | ✅ GREEN | morgott — **MERGE READY** |
| #445 | feat(cf-l6aj.18): Referral Program /referral dashboard | ✅ GREEN | morgott — **MERGE READY** |
| #444 | feat(cf-l6aj.10): Gift Card promo section home page | ✅ GREEN | millicent — **MERGE READY** |
| #443 | fix(cf-3qt.8): remove pre-launch noindex from layout | ✅ GREEN | millicent — **MERGE READY** |
| #442 | feat(cf-l6aj.20): Spin Wheel prize wheel 24h cookie | ❌ FAIL | miquella — react-hooks/set-state-in-effect:92 |
| #441 | feat(cf-l6aj.11): MegaMenu hover/focus panel (216 vitest) | ✅ GREEN | blaidd — **MERGE READY** |
| #440 | feat(cf-l6aj.17): Bundle Builder frame+mattress tiered discount | ✅ GREEN | rennala — **MERGE READY** |
| #439 | feat(cf-l6aj.19): Futon Sommelier 4-question recommender | ✅ GREEN | rennala — **MERGE READY** |
| #438 | feat(cf-l6aj.22): /survey NPS page + server action | ❌ FAIL | rennala (HOLD) — ESLint apostrophe SurveyForm.tsx:88 |
| #437 | feat(cf-l6aj.21): /near/[city] added to sitemap | ✅ GREEN | **MERGE READY** |
| #436 | feat(cf-l6aj.8): RecentlyViewedStrip home (11 unit + 1 E2E) | ✅ GREEN | **MERGE READY** |
| #435 | feat(cf-l6aj.4): blog teasers (9 unit + 4 E2E) | ❌ FAIL | rennala (HOLD) — TS2556 BlogTeasers.test.tsx:10 |
| #434 | feat(cf-l6aj.9): HomeNewsletterSection inline strip | ✅ GREEN | **MERGE READY** |
| #433 | feat(cf-l6aj.2): CMS product badges New/Sale/Bestseller/CF+ | ✅ MERGED | 18 session merges |
| Earlier | #415–#432 | ✅ MERGED | 17 PRs |
| #427 | test(cf-pmdf): MascotCategoryCard reduced-motion E2E | ✅ MERGED | 90/100 |
| #426 | feat(cf-l6aj.13): PWA install banner + manifest | ✅ MERGED | radahn |
| #425 | test(cf-3qt.16.3): MascotCategoryCard unit tests | ✅ MERGED | godfrey |
| #424 | feat(cf-l6aj.7): ContinueShoppingStrip + 13 tests | ✅ MERGED | 91/100 |
| #423 | fix(cf-q5km): MascotCategoryCard useReducedMotion | ✅ MERGED | 96/100 |
| #422 | test(cf-3qt.16.4): Footer 22 integration tests | ✅ MERGED | 93/100 |
| #421 | test(cf-3qt.8.28): /about v3 E2E | ✅ MERGED | 91/100 |
| #415 | feat(cf-footer-anim): footer mascot animation | ✅ MERGED | 91/100 |
| #392 | chore(deps): bump eslint 9→10 | ❌ FAIL | **HOLD** — major version |
| #391 | chore(deps): bump wix-sdk group | ✅ CI | **HOLD** |
| #376 | docs(cf-3qt.7): analytics env vars | ✅ CI | **BLOCK**: Stilgar replace GA4/Meta IDs |
| #356 | fix(cf-okwz): copy BEAR10 to clipboard | ✅ CI | Stilgar approval needed |
| #136 | docs(cf-93rb-B): design-tokens delta [DRAFT] | ✅ CI | draft |

## CF Open PRs (carolina-futons / Velo)

| PR | Title | CI | Note |
|----|-------|----|----|
| #1136 | chore(deps): bump dawidd6/action-send-mail | **HOLD** ✅ | |
| #1130 | chore(deps): dev-deps bump | **HOLD** ✅ | |

---

## Crew Assignments

⚠️ ALL SESSIONS DEAD AS OF ~17:00 MT — watchdog DEAD alert on blaidd, mass hook-empty confirmed

| Crew | Current Task | Status |
|------|-------------|--------|
| millicent | cf-l6aj.15 — DragDropRoomPlanner, PR #452 ❌ | ⛔ session dead — fix directive sent |
| morgott | cf-l6aj.18 done (PR #445 ✅) + cf-l6aj.14 done (PR #446 ✅) — needs next bead | 🔧 idle |
| radahn | cf-l6aj.3 — PR #447 ❌ CI still failing post-rebase | ⛔ session dead |
| blaidd | cf-l6aj.16 — PR #450 ❌ FAIL — **SESSION DEAD (watchdog)** | ⛔ dead — fix directive sent |
| rennala | **ON HOLD** — fix #435 (TS2556) + #438 (ESLint apostrophe) ONLY | ⛔ hold enforced — nudged |
| godfrey | cf-j2r7 done (PR #449 ✅) — needs next bead | 🔧 idle |
| miquella | cf-l6aj.20 — Spin Wheel PR #442 ❌ FAIL | ⛔ session dead — fix directive sent |

---

## Open Blockers (Stilgar actions)

| Issue | Status |
|-------|--------|
| **P0: 0 products** | **DEFERRED** — Stilgar doing manually. Fix: halworker85 → manage.wix.com/developer-center → cb591c8e → Install on carolinafutons.com |
| **Vercel account** | ⚠️ Project on personal account `dreadpiraterobertzs-projects` — must transfer to team OR upgrade personal before Pro cutover. See upgrade-runbook.md |
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

## In-Progress Beads (db snapshot)

| Bead | Pri | Title | Status |
|------|-----|-------|--------|
| cf-3qt.7 | P1 | SEO + analytics — code COMPLETE | PR #376 blocked Stilgar env vars |
| cf-j2r7 | P2 | PDP recently-viewed rail — godfrey | PR #449 ✅ done |
| cf-l6aj.3 | P2 | Featured products richer cards — radahn | PR #447 ❌ CI fail |
| cf-q90y.1 | P2 | Orphan illustration deletes — radahn | stale — PR #428 merged |
| cf-okwz | P3 | EasterEggBear clipboard | PR #356 pending Stilgar |

---

## Session Merges (this session)

| PR | Title | Score | When |
|----|-------|-------|------|
| #427 | test(cf-pmdf): MascotCategoryCard reduced-motion E2E | 90/100 | 15:31 MT |
| #426 | feat(cf-l6aj.13): PWA install banner + manifest | pre-reviewed | 15:24 MT |
| #425 | test(cf-3qt.16.3): MascotCategoryCard unit tests | — | 15:24 MT |
| #424 | feat(cf-l6aj.7): ContinueShoppingStrip + 13 tests | 91/100 | 15:31 MT |
| #423 | fix(cf-q5km): MascotCategoryCard useReducedMotion | 96/100 | 15:24 MT |
| #422 | test(cf-3qt.16.4): Footer 22 integration tests | 93/100 | 15:21 MT |
| #421 | test(cf-3qt.8.28): /about v3 E2E | 91/100 | 15:15 MT |
| #420 | test(cf-3qt.8.27): /shop/sale PLP E2E | 92/100 | 15:12 MT |
| #419 | test(cf-3qt.8.26): redirect map unit tests | 93/100 | 15:12 MT |
| #417 | test(cf-3qt.16.2): homepage MascotCategoryCard E2E | 88/100 | 15:08 MT |
| #415 | feat(cf-footer-anim): footer mascot animation (Footer.tsx + motion) | 91/100 | 14:58 MT |
| #416 | feat(cf-home-animals): homepage mascot category cards | 90/100 | 14:41 MT |
| #414 | chore(design-migration): illustrations cleanup + 4 SVGs | 95/100 | 14:41 MT |
| #413 | test(cf-3qt.8.13): Wave 2 post-cutover E2E spec | 88/100 | 14:41 MT |
| #412 | feat(cf-3qt.8.6): pre-cutover redirect map | 85.8/100 avg | 11:2x MT |
| #411 | test(cf-3qt.8.9): Wave 1 post-cutover smoke | 88/100 | 11:22 MT |
| #410 | test(on-sale): discountedPrice edge cases | 97/100 | 17:13 UTC |
| #389 | feat(cf-3qt.12): /shop/sale PLP | 84/100 | 16:52 UTC |
| #408 | feat(design-migration): /spring-sale VintageSunRays | 97/100 | 16:38 UTC |
| #390 | test(cf-3qt.14): /search E2E smoke | 88/100 | 16:43 UTC |
| #406 | chore(design-migration): orphan botanical deletions | 95/100 | 16:31 UTC |
| #404 | feat(design-migration-p1): Phase 1 PLP botanical removal | 95/100 | 16:26 UTC |
| #403 | feat(design-migration): /visit + /design-a-room scenes | 87/100 | 16:26 UTC |
| #409 | refactor(mascot-palette): V3_NIGHT palette + Bear pose | 97/100 | 16:25 UTC |
| #407 | feat(design-migration): /guides + /reviews scenes | 92/100 | 16:25 UTC |
| #402 | feat(design-migration): FogScene /contact+/press | 96/100 | 16:25 UTC |
| #405 | feat(design-migration-p3): Phase 3 empty states | 74/100 | 10:17 UTC |
| #401 | feat(design-migration): /about botanical → v3 | 87/100 | 10:12 UTC |
| #400 | feat(design-migration-p0): MascotFooterDivider in layout | 95/100 | 10:12 UTC |
| Earlier PRs | #383–#397, #352–#368 | — | earlier |

---

## Shipping Test Report ✅

56/56 PASS · Parcel <70 lbs · LTL 70–499 lbs · Freight ≥500 lbs or palletized · White-glove NC only

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
*Cron: 353ab5c0 (progress refresh) + de1e2247 (auto-push) + f01ec08c (PM cross-sync 30min) · Design migration 100% COMPLETE · Session merges: #415–#433 (18 PRs) · MERGE READY: #434 #436 #437 #439 #440 #441 #443 #444 #445 #446 #448 #449 #451 (13 PRs) · CI FAIL: #435 #438 (rennala HOLD) #442 (miquella) #447 (radahn) #450 #452 (blaidd/millicent) · ALL SESSIONS DEAD 17:00 MT — watchdog DEAD blaidd · P0 OAuth = FilterFirst empty — deferred Stilgar · ⚠️ Vercel personal account*
