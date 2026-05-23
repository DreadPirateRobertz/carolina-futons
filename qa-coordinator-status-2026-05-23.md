# QA Mandate Coordinator Status — 2026-05-23

**Coordinator:** miquella
**Mandate:** crew/melania/qa-mandate-2026-05-23.md
**Started:** 2026-05-22 18:50 MT (Stilgar via mayor)

---

## Critical-path gates (must land before broad QA can complete)

| Bead | Owner | Status | Blocks |
|---|---|---|---|
| cfw-o45 | opal (Linux) | OPEN | ALL sign-in QA |
| cf-csxt | quartz (Linux) — godfrey writing spec, miquella reviewing | OPEN | purchase-flow QA |
| cf-lsv4 | obsidian (Linux) | OPEN | reduces QA friction |
| cf-zq3m | rennala (Mac) | OPEN | newsletter signup QA |

---

## Crew route-family assignments

### Mac
| Crew | Family | Status |
|---|---|---|
| godfrey | PDP × 10 products × Full/Queen × Finish × ATC | unstarted (per coordinator visibility) |
| blaidd | Account flow (post-cfw-o45) | BLOCKED on cfw-o45 |
| **miquella** | /shop indexes + 6 PLPs + COORDINATOR | **IN PROGRESS** — see below |
| morgott | /design-a-room | ✅ COMPLETE — 4 beads filed (jasper), see below |
| rennala | Forms (contact / newsletter / swatch) + /search | unstarted |
| millicent | SEO + nav + footer | unstarted |
| radahn | Search/filter UX deep dive | unstarted |
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

## Coordinator next moves

1. **Watch for crew reports** — incoming nudges from godfrey/blaidd/morgott/rennala/millicent/radahn/melania. Aggregate findings into this doc.
2. **Watch for godfrey cf-csxt spec** — apply the 6-point review checklist (see this session's earlier prep).
3. **Mobile pass on remaining 5 PLPs** — after critical-path gates clear.
4. **Escalation triggers** — any P0/P1 surfaced by crew goes immediately to melania + Stilgar.

## Notes on conservation discipline

Per cf-ukc6: NO Vercel pushes from QA work, only fix PRs. Tour artifacts (this doc, qa-tour-shop-sale-mattresses-2026-05-22.md, screenshots) go to cfutons repo (Velo workspace) which is NOT the Vercel target — safe.
