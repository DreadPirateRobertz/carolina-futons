# Policy pages parity — cfw vs Wix Studio (2026-05-15)

**Bead:** cf-4i44 (P1)
**Parent:** cf-3qt.6 (cart + content parity for the cutover)
**Convoy:** hq-cv-d7osk

## TL;DR

| Page | cfw | Wix Studio | Parity verdict |
|---|---|---|---|
| `/faq` | 200, 6 expandable Q/A items | 200, ~20+ Q/A items across categories | ⚠️ **cfw lags content** — the live deployment is reading the Wix `FAQ` CMS collection and only 6 records have been populated. cf-3qt.4.1 ships an 18-entry static `FALLBACK_FAQS` in `src/lib/cms/faq.ts` that would surface IF the CMS call failed, but the live call succeeds (returning 6). **Action: populate the Wix CMS FAQ collection to ≥18 entries** (use the FALLBACK_FAQS as the minimum seed). |
| `/shipping` | 200, dense long-form page (207 LOC, 6 anchored sections) | **404** | ✅ **cfw-only — net-new** authored content |
| `/returns` | 200, dense long-form page (207 LOC, 6 anchored sections) | **404** | ✅ **cfw-only — net-new** authored content |
| `/warranty` | 200, dense long-form page (199 LOC, 6 anchored sections) | **404** | ✅ **cfw-only — net-new** authored content |

For 3 of the 4 policy pages, there is **nothing to migrate** — Wix Studio never had `/shipping`, `/returns`, or `/warranty`. cfw is a content win, not a content lift. The only true parity work is on `/faq`, and the gap there is a CMS population issue, not a code issue.

## Evidence

### Wix Studio policy-page coverage

Pulled the Wix `/pages-sitemap.xml` (the Wix-emitted user-pages sitemap, distinct from store-products-sitemap.xml). 25 pages total. Filtered for any slug containing `ship|return|warrant|polic|guarant|exchange`:

```
(none)
```

Direct probe confirms:

| URL | Status |
|---|---|
| https://www.carolinafutons.com/faq | 200 |
| https://www.carolinafutons.com/shipping | 404 |
| https://www.carolinafutons.com/returns | 404 |
| https://www.carolinafutons.com/warranty | 404 |

### cfw policy-page coverage

```
src/app/faq/page.tsx       — 118 LOC, Wix CMS reader + 18-item fallback
src/app/shipping/page.tsx  — 207 LOC, hand-authored sections (lead-times, carriers, in-home, local, faq, questions)
src/app/returns/page.tsx   — 207 LOC, hand-authored sections (window, restocking, custom, damaged, faq, start)
src/app/warranty/page.tsx  — 199 LOC, hand-authored sections (covers, mattresses, excludes, transfer, faq, claim)
```

Direct probe:

| URL | Status |
|---|---|
| https://carolina-futons-web.vercel.app/faq | 200 |
| https://carolina-futons-web.vercel.app/shipping | 200 |
| https://carolina-futons-web.vercel.app/returns | 200 |
| https://carolina-futons-web.vercel.app/warranty | 200 |

### `/faq` content delta

**cfw live** — 6 expandable Q/A items (counted via `aria-expanded` button instances in the rendered HTML).

**Wix Studio live** — ~26 heading tags (`<h1>`/`<h2>`/`<h3>`), ~20+ Q/A items spread across category sections.

The cfw fallback (`FALLBACK_FAQS` in `src/lib/cms/faq.ts`) carries 18 entries across these categories:
- Mattresses
- Payment
- Products
- Returns
- Shipping
- Showroom
- Warranty

That's the **minimum seed** for the Wix CMS `FAQ` collection. Adding any entries beyond 18 is incremental gain.

## Findings

### F1 (P2) — `/faq` Wix CMS collection underpopulated

**Symptom:** cfw `/faq` shows 6 questions; Wix Studio shows ~20+.
**Cause:** cf-3qt.4.1 reader is succeeding (not falling back), and the CMS collection has only 6 records.
**Owner:** content (Stilgar / melania to coordinate with whoever curates Wix `FAQ` collection — likely Brenda).
**Fix scope:** Wix-only data-entry; no code change required. Use `src/lib/cms/faq.ts` `FALLBACK_FAQS` as the seed list.
**Acceptance:** cfw `/faq` live count ≥ 18 expandable items.

### F2 (NOT a finding — informational) — `/shipping`, `/returns`, `/warranty` are cfw-net-new

**Observation:** these pages do not exist on Wix Studio. Migration cutover does NOT need a content move; existing Wix Studio customers who hit these routes today get 404. Post-cutover, all three will serve 200.

This is a UX *gain* at cutover, not a regression. Recommend Stilgar / Brenda copy-review the cfw content for tone + accuracy before cutover, since these go live to existing customers who haven't seen them. Each page has 6 anchored sections — content review should be ~30 minutes per page.

### F3 (P3) — anchor stability for any inbound deep links

The cfw pages use stable section anchor ids (`shipping-lead-times`, `returns-window`, `warranty-covers`, etc.). If we ever discover external sites (Reddit posts, Google snippets, etc.) deep-linking to these anchors, we need to preserve them across rewrites. Pin via a smoke or contract test if a P3 follow-up is warranted post-cutover.

## What this DOESN'T cover

- **Content quality** of cfw `/shipping`, `/returns`, `/warranty` — a copy review against business reality (current carrier list, current return window, actual warranty years) is a separate beadlet for the content owner. Code-wise the pages render correctly; whether the words are right is a domain-expert call, not a code-parity call.
- **SEO meta on /faq** — `cf-bbo8` covered PDP + PLP canonical; cf-89fb covered the 8 static routes (including `/faq`, `/shipping`, `/returns`, `/warranty` via PR #569). Verified canonical present on all 4 in the cf-oj8u meta-tag smoke.
- **Schema.org FAQPage JSON-LD** — out of scope for this bead. Cf-o9f6 JSON-LD smoke documented it as a follow-up; if cfw `/faq` adds `FAQPage` schema, Google rich-result eligibility improves and we should add a JSON-LD parity assert.
- **/getting-it-home parity** — separate page, separate bead, not in cf-4i44 scope (Wix has it, cfw has it, content overlap is a content-team review).

## Recommended next steps

1. **Brenda / Stilgar / melania**: populate Wix CMS `FAQ` collection to ≥18 entries (use `FALLBACK_FAQS` as the canonical seed). Then re-run this audit's count probe — cfw `/faq` should jump from 6 → 18+ live items without any code change.
2. **Copy review** (Stilgar): the net-new `/shipping`, `/returns`, `/warranty` pages, 30 min each.
3. **No cfw code change required** for this bead — credit-freeze-friendly. Doc-only deliverable.

## Refs

- Bead: cf-4i44
- Parent: cf-3qt.6 (cart + content parity)
- Convoy: hq-cv-d7osk
- Related: cf-89fb (canonical extension covering these 4 routes, PR #569)
- Sibling parity bead: cf-wsrr (cart-ops parity) — in progress, deferred while this took priority
- Standing order: cf-ukc6 (credit freeze respected — no cfw branch push needed for this bead)
