# Carolina Futons — QA Readiness Dashboard
## Stilgar morning brief · 2026-05-23

**Coordinator:** miquella (cfutons crew)
**Mandate doc:** `crew/melania/qa-mandate-2026-05-23.md`
**Target site:** https://carolina-futons-web.vercel.app/ (Vercel production target)

---

## STILGAR FULL-SITE TOUR (issued 2026-05-23 evening)

Proactive exhaustive sweep before tomorrow's stress test. Every page, every button, mobile+desktop, screenshot every key state.

| Crew | Scope | Status |
|---|---|---|
| blaidd | /, /shop hub, 5 PLPs, /search empty+query, /compare 0/1/2/4-product states | DISPATCHED 2026-05-23 |
| godfrey | 8+ PDPs (Kingston/Albany/Sunrise/Mesa/Murphy/Solstice/Wilderness/Charleston) × Full/Queen × Cherry/Chocolate × mobile+desktop | DISPATCHED 2026-05-23 (parallel with cf-csxt spec) |
| morgott | /account anon, /signup, post-disposable-register flow, sign-in success+fail | DISPATCHED 2026-05-23 |
| rennala | /faq, /about, /press, /contact, /our-story, footer links every entry | ⚠️ DEAD — gap flagged to melania (blaidd already covered /press + /our-story) |
| millicent | /reviews (gated on radahn GBP creds), /sitemap.xml, /robots.txt | DISPATCHED 2026-05-23 |

**Coordinator (miquella):** synthesize incoming findings into this dashboard. File every defect via bead pattern (route+viewport+repro+screenshot+priority). Screenshots required at `crew/<name>/qa-tour-<route>-<viewport>.png`.

**Viewport matrix:** mobile 390×844 (iPhone) + 360×800 (Android); desktop 1280×800 + 1920×1080.

---

## Headline metrics

| Metric | Count |
|---|---|
| **PRs merged today** | **16** (per melania) — incl. PR #968 cfw-o45 admin-merge |
| **Beads filed today (cfutons)** | 11 (cf-b7mu, cf-ogzg, cf-swqw, cf-g3z6, cf-v275, cf-csxt, cf-qyaf, cf-5dph, cf-8wkc, cf-1h68, cf-t19r) |
| **Beads filed today (cfutons_web)** | 12 (cfw-o45, cfw-hl4, cfw-pe7, cfw-bgb, cfw-ob6a, cfw-w8ee, cfw-ytzx, cfw-87m, cfw-gpde, cfw-jo5q, cfw-2jm3, cfw-y17d) |
| **Beads closed today** | 6 (cf-tm1e, cf-wyc0, cf-r7gc, cfw-o45, cfw-hl4, cfw-jo5q, cfw-2jm3) |
| **Open P0** | 3 (cf-csxt, cf-qyaf, cf-zq3m) |
| **Open P1** | 4 (cf-1h68, cf-8wkc, cf-3qt.8, cf-3qt.8.31) |
| **Open P2** | 8 |
| **Open P3+** | 11 |

---

## Critical-path gates (must clear before broad QA can complete)

| Bead | Owner | State | Notes |
|---|---|---|---|
| **cfw-o45** | opal (Linux) | ✅ MERGED (PR #968) | account flow UNBLOCKED — blaidd live tour in progress |
| **cf-csxt** | quartz (Linux) — godfrey writing spec, miquella reviewing | OPEN P0 | spec-handoff pending godfrey delivery |
| **cf-lsv4** | obsidian (Linux) | OPEN P0 | overlay suppression — confirmed still live by morgott + blaidd |
| **cf-zq3m** | rennala (Mac) | ⚠️ OWNER DEAD per watchdog | mayor restart pending — Stilgar may need to reassign or authorize Velo-side fix |
| **cf-qyaf** | unassigned | OPEN P0 | Mesa 5000 PDP unbuyable — likely intentional in-store-only (Stilgar standing order); Stilgar to confirm |

---

## Stilgar action queue (7 decisions for tomorrow morning)

These items need Stilgar's call before the corresponding work can ship/close:

1. **cf-g3z6 P3** — Sedona + Asheville futon frames missing prices on PLP. Per Mesa precedent, likely intentional in-store-only — Stilgar canonical confirm (mayor relaying).
2. **cf-v275 P3** — /shop/sofa-beds renders 0 products + not on /shop hub. Three paths: intentional empty / Wix collection seed / SHOP_CATEGORIES entry removal. Stilgar picks.
3. **cf-oi01 P1 (BLOCKED)** — E2E real-shipping + payments. cfw `/checkout` correctly redirects, but Wix headless checkout has no payment provider + no UPS connector. Decision: configure Wix dashboard OR switch to Path B (wire UPS + Stripe directly in cfw, skip Wix redirect).
4. **cf-qyaf P0** — Mesa 5000 PDP unbuyable. Verify: covered by in-store-only standing order (then close as intentional) OR genuine bug (Brenda backfills price + size picker).
5. **cf-zq3m P0** — Newsletter prod 502 + rennala session DEAD. Authorize restart OR designate alternate owner.
6. **cf-3qt.8 P1** — DNS cutover go-decision: Vercel Pro upgrade timing + cutover-night window.
7. **cf-3qt.8.31 P1** — UptimeRobot API key to enable post-cutover monitoring.

---

## Blockers

| Blocker | Affected beads | Mitigation |
|---|---|---|
| rennala session DEAD | cf-zq3m (P0 newsletter prod 502) + rennala's mandate scope (Forms + /search) | Mayor restart pending; coordinator marked DEAD in mandate matrix |
| Wix-side checkout config | cf-oi01 (E2E real-shipping + payments) | Awaiting Stilgar Path A vs Path B decision |
| Stilgar canonical (in-store-only) intent | cf-g3z6 + cf-v275 + cf-qyaf | Awaiting mayor-relayed Stilgar confirms |
| godfrey cf-csxt failing-test spec | cf-csxt P0 implementation | godfrey writes → miquella reviews → quartz implements |

---

## Convoy candidates (cluster for batched merges)

**Sale source-of-truth convoy** — 4 beads, one theme: "what does 'sale' mean in cfw":
- `cf-b7mu` P2 — mega-menu `/shop/sale` → `/spring-sale` redirect (1-line nav fix, handed off to onyx)
- `cf-5dph` P3 — desktop mega-menu vs mobile drawer Sale-link route divergence (millicent)
- ~~`cfw-jo5q`~~ P2 ✅ **CLOSED** — SaleLightbox fires site-wide vs home-only (blaidd → resolved during session)
- `cf-ogzg` P3 — full unification refactor (SaleLightbox hardcode + isProductOnSale variant-priced exclusion + HomeSaleStrip + /spring-sale)

**Dashboard skeleton convoy** — 2 beads on dashboard polish:
- `cfw-pe7` P3 — /dashboard/* tabs render home-loading skeleton instead of dashboard skeleton
- `cfw-bgb` P3 — /dashboard/* anonymous SSR responses share generic site title

---

## Crew assignment + status snapshot (13 crew)

### Mac (8)
| Crew | Family | Status |
|---|---|---|
| godfrey | PDP × 10 products × Full/Queen × Finish × ATC | ✅ cf-flmv re-verify done; PR #971 in flight (cf-moyb 15yr fix); standby for cf-csxt review |
| blaidd | Account flow (post-cfw-o45) | ✅ /reviews+/press+/our-story 4 beads filed; account flow UNBLOCKED, live tour in progress |
| **miquella** | /shop indexes + 6 PLPs + **COORDINATOR** | ✅ Desktop sweep complete; mobile spot-check clean; coordinator doc current |
| morgott | /design-a-room → cfw-y17d | ✅ /design-a-room 4 beads filed; routed to cfw-y17d /our-story redirect cleanup |
| rennala | Forms (contact / newsletter / swatch) + /search | ❌ DEAD per watchdog; mayor restart pending |
| millicent | SEO + nav + footer | ⚠️ PARTIAL — cf-5dph P3 filed; rest unreported |
| radahn | Search/filter UX deep dive | ACTIVE — GBP work in progress (relates to cfw-gpde) |
| melania | SHIPPING API + ZIP validation E2E | unreported (own coordination work) |

### Linux (5)
| Crew | Family | Status |
|---|---|---|
| opal | cfw-o45 fix → /sale + /spring-sale tour | ✅ cfw-o45 MERGED; standby for next |
| onyx | cf-rqpb verify + cf-b7mu redirect → PDP variant verification | cf-b7mu redirect handed off; verification status unreported |
| jasper | cf-1h68 + cf-t19r header fix → mobile-only header tour | unreported |
| obsidian | cf-lsv4 → cf-th74 → cf-8wkc → /compare interactive | unreported |
| quartz | cf-csxt P0 → cart interactive verify | waiting on godfrey failing-test spec |

---

## Stilgar resolutions APPLIED today

1. **Warranty canonical**: CF Customer Warranty = 15 years universally. Manufacturer column = internal-only. Applied to `crew/melania/manufacturer-mapping-2026-05-22.md` (CANONICAL block + bucket counts + table). Awaiting godfrey PR #971 to land SiteContent + /about updates → cf-moyb closes.
2. **5 log-futon SKU manufacturer**: All → Log-Futon-Co (charleston-platform-bed, denali-log-futon, mountainaire-log-futon, northern-exposure-log-futon, wilderness-log-futon).
3. **Spring Sale modal redirect**: melania GO → cf-b7mu 1-line nav redirect handed off to onyx (file ships via Linux).
4. **Intentional catalog quirks confirmed in memory** (no-refile): /products/pulsar → "Moonshadow" slug-name divergence; Mesa 1000/3000/5000 no-price in-store-only.

---

## Conservation discipline (cf-ukc6 standing order)

- ✅ NO QA-tour Vercel preview pushes this session — all QA artifacts went to cfutons repo (Velo workspace, separate from Vercel target).
- ✅ Fix PRs (#968 cfw-o45) are batched not dripped.
- ✅ Read-only Vercel preview navigation across all crew tours.

---

## Coordinator artifacts (cfutons main)

- `qa-tour-shop-sale-mattresses-2026-05-22.md` (commit `dead4522`)
- `qa-coordinator-status-2026-05-23.md` (latest commit `2e6262c4`)
- `qa-readiness-2026-05-23.md` (this file)
- `cf-oi01-triage-report.md` + `cf-oi01-working-checkout.png` (commit `39c283c0`)

morgott + blaidd report docs live in their workspaces — paths listed in coordinator status doc.
