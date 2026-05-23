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
| morgott | /design-a-room | unstarted |
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

## Coordinator next moves

1. **Watch for crew reports** — incoming nudges from godfrey/blaidd/morgott/rennala/millicent/radahn/melania. Aggregate findings into this doc.
2. **Watch for godfrey cf-csxt spec** — apply the 6-point review checklist (see this session's earlier prep).
3. **Mobile pass on remaining 5 PLPs** — after critical-path gates clear.
4. **Escalation triggers** — any P0/P1 surfaced by crew goes immediately to melania + Stilgar.

## Notes on conservation discipline

Per cf-ukc6: NO Vercel pushes from QA work, only fix PRs. Tour artifacts (this doc, qa-tour-shop-sale-mattresses-2026-05-22.md, screenshots) go to cfutons repo (Velo workspace) which is NOT the Vercel target — safe.
