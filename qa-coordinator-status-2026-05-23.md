# QA Mandate Coordinator Status — 2026-05-23

**Coordinator:** miquella
**Mandate:** crew/melania/qa-mandate-2026-05-23.md
**Started:** 2026-05-22 18:50 MT (Stilgar via mayor)

---

## Critical-path gates (must land before broad QA can complete)

| Bead | Owner | Status | Blocks |
|---|---|---|---|
| cfw-o45 | opal (Linux) | ✅ MERGED via PR #968 admin-merge ~2026-05-23 | (CLEARED) — ALL sign-in QA unblocked |
| cf-csxt | quartz (Linux) — godfrey writing spec, miquella reviewing | OPEN | purchase-flow QA |
| cf-lsv4 | obsidian (Linux) | OPEN | reduces QA friction |
| cf-zq3m | rennala (Mac) | OPEN | newsletter signup QA |

---

## Crew route-family assignments

### Mac
| Crew | Family | Status |
|---|---|---|
| godfrey | PDP × 10 products × Full/Queen × Finish × ATC | ✅ cf-flmv re-verify done; standby for cf-csxt review (miquella reviewer) — pinged 2026-05-23 |
| blaidd | Account flow (post-cfw-o45) | ✅ /reviews+/press+/our-story tour DONE (4 beads); cfw-o45 now MERGED → account flow UNBLOCKED, live tour in progress |
| **miquella** | /shop indexes + 6 PLPs + COORDINATOR | **IN PROGRESS** — see below |
| morgott | /design-a-room → cfw-y17d | ✅ /design-a-room + cf-r7gc done; ROUTED 2026-05-23 to cfw-y17d (/our-story permanentRedirect cleanup from blaidd) |
| rennala | Forms (contact / newsletter / swatch) + /search | ❌ DEAD per watchdog 2026-05-23; mayor restart pending |
| millicent | SEO + nav + footer | ⚠️ PARTIAL — cf-5dph P3 filed (desktop/mobile Sale-link divergence; convoy candidate with cf-b7mu+cf-ogzg) |
| radahn | Search/filter UX deep dive | ACTIVE — confirmed doing GBP work (relates to cfw-gpde reviews-creds gap) per melania 2026-05-23 |
| melania | SHIPPING API + ZIP validation E2E | unstarted |

### Linux
| Crew | Family | Status |
|---|---|---|
| opal | cfw-o45 fix → then /sale + /spring-sale tour | unstarted |
| onyx | cf-rqpb verify + cf-b7mu redirect → then PDP variant verification on 5 products | cf-b7mu HANDED OFF by miquella 2026-05-22 |
| jasper | cf-1h68 + cf-t19r header fix → then mobile-only header tour | unstarted |
| obsidian | cf-lsv4 → cf-th74 → cf-8wkc → /compare interactive | unstarted |
| quartz | cf-csxt P0 → cart interactive verify | unstarted (waiting on godfrey spec) |

---

## miquella PLP tour — desktop 1280×800 (in progress)

| Surface | Status | Findings |
|---|---|---|
| `/shop` (hub) | ✅ CLEAN | 5 category cards, all valid hrefs, intro copy correct |
| `/shop/sale` | ⚠️ EMPTY by design | 0 products (filter: `discountedPrice<price` matches nothing). Active fix: cf-b7mu mega-menu redirect to /spring-sale → handed off to onyx |
| `/shop/futon-frames` | ⚠️ 2 missing prices | 22 products; Sedona + Asheville show no price (filed cf-g3z6 P3). Other 20 fine. Filter UI: price-min/max + in-stock toggle present |
| `/shop/murphy-cabinet-beds` | ✅ CLEAN | 9 products, all priced |
| `/shop/platform-beds` | ✅ CLEAN | 9 products, all priced. Note: 3 products have slug=`*-futon-frame` but display as Platform Bed (intentional per memory) |
| `/shop/mattresses` | ⚠️ 3 missing prices (intentional) | Mesa 1000/3000/5000 PDP shows "Call for current pricing" — Stilgar standing order, in-store-only. Other 3 (Mattress Protector, Haley 110, Moonshadow) priced |
| `/shop/sofa-beds` | ❌ EMPTY (unclear intent) | 0 products, category defined but not on /shop hub. Filed cf-v275 P3 for Stilgar/Brenda triage |

## miquella PLP tour — mobile 390×844

| Surface | Status | Findings |
|---|---|---|
| `/shop/futon-frames` | ✅ Layout clean | No horizontal scroll, hamburger menu present, single-column card grid, 24 cards (matches desktop count). Filter UI inline, not collapsed |

Mobile sweep on remaining 5 PLPs deferred — desktop pass is the higher-signal first pass. Will return to mobile after critical-path gates clear, OR if jasper's header tour surfaces layout issues that affect PLP cards.

---

## Beads filed by miquella during mandate (cumulative session)

| Bead | Priority | Status | Surface |
|---|---|---|---|
| cf-b7mu | P2 | OPEN → onyx | /shop/sale empty + modal drift (DIAGNOSED, redirect handed off) |
| cf-ogzg | P3 | OPEN | Sale source-of-truth unification follow-on |
| cf-swqw | P3 | OPEN | /order-confirmation productName shape inconsistency |
| cf-g3z6 | P3 | OPEN | /shop/futon-frames Sedona+Asheville missing prices |
| cf-v275 | P3 | OPEN | /shop/sofa-beds empty PLP |

Already-closed during session: cf-tm1e (referral parity), cf-wyc0 (white-glove threshold intentional).

Already-blocked: cf-oi01 (E2E real-shipping, Wix-side config gap, mailed Stilgar).

---

---

## Incoming crew reports

### morgott — /design-a-room (received 2026-05-23 via nudge)

**Doc:** `crew/morgott/qa-design-a-room-deep-dive-2026-05-23.md` (+ screenshots `qa-dar-{1280,1920,390}-*` + `qa-design-a-room-{initial,dark-rustic-murphy}.png`)
**Viewports covered:** 1280×800, 1920×1080, 390×844, 360×800 ✅ full mandate matrix
**cf-ukc6 compliance:** ✅ read-only

| Bead | Pri | Owner | Finding |
|---|---|---|---|
| cfw-ob6a | P2 | jasper | `max-w-[65ch]` article clips widget sections at desktop (content is 27% of 1920 viewport). Source: `src/app/design-a-room/page.tsx:92` |
| cfw-w8ee | P2 | jasper | Mobile horizontal scroll: +41px at 390, +71px at 360. Room plan canvas leaks past `overflow-x-auto` wrapper |
| cfw-ytzx | P3 | jasper | 11 interactive controls (style/product switchers + drag palette) are 30px tall — fail WCAG 2.5.5 44×44 |
| cfw-87m | P3 | jasper | UPDATED — scenes are programmatic inline SVG, 2 scene-SVG preloads + 2 empty-href preloads fetch unused files |

**Verified OK:** Style+Product 9-combo switcher, theme toggle persists via `cf-theme` localStorage, scene re-renders on switcher click.
**Coverage gap (no bead, recommendation only):** Drag-drop e2e — Playwright synthetic dnd dispatch fails on Chrome HTML5 native dnd. Recommendation in morgott's doc §7: `e2e/design-a-room-drag-drop.spec.ts` using real `page.mouse.move/down/up`.
**cf-lsv4 re-confirmation:** overlays (Sale + Pwa + Consent) still render on /design-a-room — dismissal persists via `cf-promo-dismissed`.
**morgott status:** holding for next-route from melania (no autonomous reassignment — that's melania's prerogative).

---

---

### blaidd — /reviews + /press + /our-story (received 2026-05-23 via nudge)

**Report addendum:** `8776aff` (blaidd workspace)
**Screenshots:** `crew/blaidd/{page}-{w}.png` × 12 (3 pages × 4 widths)
**Viewports covered:** 360×800, 390×844, 1280×800, 1920×1080 ✅ full mandate matrix
**Note:** blaidd's primary family was Account flow but cfw-o45 blocks that — she pivoted to static-page tour while waiting

| Bead | Pri | Owner | Finding |
|---|---|---|---|
| cfw-gpde | P2 | blaidd | /reviews shows empty 'no reviews' placeholder on production — GBP API credentials not provisioned |
| cfw-jo5q | P2 | blaidd | SaleLightbox fires site-wide instead of homepage-only — comment says home, code says everywhere (loops into sale-convoy below) |
| cfw-2jm3 | P3 | blaidd | /press hardcodes '15-year warranty' alongside `BUSINESS.warrantyYears` — DRY violation |
| cfw-y17d | P3 | blaidd | /our-story uses permanentRedirect() in page component — defeats stated SEO link-equity consolidation |

**cfw-jo5q is convoy-adjacent** — adds to the SaleLightbox cluster (currently hardcoded products + site-wide trigger).

---

## Warranty + manufacturer (Stilgar resolution 2026-05-23)

Stilgar's canonical resolutions applied to `crew/melania/manufacturer-mapping-2026-05-22.md`:

- **CF Customer Warranty = 15 years** universally (CF house warranty overrides per-manufacturer years).
- **Manufacturer column = internal-only**, not customer-facing.
- **5 log-futon SKUs resolved to Log-Futon-Co** (`charleston-platform-bed`, `denali-log-futon`, `mountainaire-log-futon`, `northern-exposure-log-futon`, `wilderness-log-futon`).
- **N&D = Futon Collection only** (no Daybed) — confirmed.

Manufacturer buckets post-resolution: N&D 71 / Log-Futon-Co 5 / KD Frames 3 / Otis Bed 3 (+2 via live PDP) / Sealy 1 = 85 total.

**cf-moyb closure path:** closes after godfrey lands SiteContent + /about updates aligning the customer-facing 15-year copy across all surfaces (site-banner / FAQ / About / SiteContent CMS keys).

Note: the mapping doc is in melania's workspace (untracked locally) — she commits from her side when she next acts.

---

## Convoy candidates (cross-bead clusters surfacing during mandate)

**Sale-link / source-of-truth convoy** — all relate to the "what is 'sale' in cfw" question:
- `cf-b7mu` P2 — mega-menu `/shop/sale` → `/spring-sale` redirect (immediate fix, handed off to onyx)
- `cf-5dph` P3 — desktop mega-menu `/shop/sale` vs mobile drawer `/shop/mattresses-sale` route divergence (millicent 2026-05-23)
- `cfw-jo5q` P2 — SaleLightbox fires site-wide instead of homepage-only — comment says home, code says everywhere (blaidd 2026-05-23)
- `cf-ogzg` P3 — full unification: SaleLightbox hardcode + isProductOnSale variant-priced exclusion + HomeSaleStrip + /spring-sale

Convoy these together after cf-b7mu redirect ships. melania noted 2026-05-23 as tomorrow's convoy candidate.

---

## Coordinator next moves

1. **Watch for crew reports** — incoming nudges from godfrey/blaidd/morgott/rennala/millicent/radahn/melania. Aggregate findings into this doc.
2. **Watch for godfrey cf-csxt spec** — apply the 6-point review checklist (see this session's earlier prep).
3. **Mobile pass on remaining 5 PLPs** — after critical-path gates clear.
4. **Escalation triggers** — any P0/P1 surfaced by crew goes immediately to melania + Stilgar.

**Crew busy state (per melania 2026-05-23):** No truly idle crew. Watchdog noise from cross-timing is non-actionable. Coordinator continues steady-state aggregation.

## Notes on conservation discipline

Per cf-ukc6: NO Vercel pushes from QA work, only fix PRs. Tour artifacts (this doc, qa-tour-shop-sale-mattresses-2026-05-22.md, screenshots) go to cfutons repo (Velo workspace) which is NOT the Vercel target — safe.
