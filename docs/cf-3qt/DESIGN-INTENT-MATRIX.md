# cf-3qt.6.1 Design-Intent Traceability Matrix

Connects brand goals from `design-vision/DESIGN-VISION.html` and the
competitive analysis in `competitor-research/` to concrete acceptance
criteria on every page of the Next.js port. Prevents "it renders fine" from
masking a missed brand goal.

## Sources

| Source | Role |
|--------|------|
| `design-vision/DESIGN-VISION.html` | Brand voice, color system, typography, hero patterns |
| `design-vision/HOMOGENIZATION-ANALYSIS.md` | What *not* to do — flattening the NC voice into generic DTC |
| `design-vision/design-system.html` | Token reference for Tailwind theme |
| `competitor-research/COMPETITIVE-DESIGN-REFERENCE.md` | Positioning targets (e.g. Strong Futons, Gold Bond, Haiku Designs) |
| `competitor-research/screenshots/` | Visual references for hero/PDP patterns |

## How to use

1. For each intent theme, record where it should show up (`page`, `element`).
2. Write an observable acceptance criterion — something a reviewer or E2E
   test can verify in the browser.
3. Record the current state on Wix (`wix` column) and on the Next.js port
   (`next` column) as one of: `✅ met`, `🟡 partial`, `🔴 missing`, `—` (not
   applicable at that breakpoint).
4. Verdict is the gate: `ship` when Next matches or improves on Wix, `block`
   otherwise.

## Matrix

### I1 — Warm NC voice (not generic DTC)

Source: DESIGN-VISION §2 "Voice", HOMOGENIZATION-ANALYSIS §4 "Flattening risks"

| Page | Element | Acceptance | Wix | Next | Verdict |
|------|---------|------------|-----|------|---------|
| home | Hero headline | First-person, place-specific ("made in NC since …"), no corporate adjective pile | — | — | — |
| home | Secondary lead | References real showroom (not "curated collection") | — | — | — |
| about | Body copy | Family-owned story visible above the fold | — | — | — |
| pdp-eureka | Copy blocks | Craftsmanship language tied to specific materials, not generic comfort adjectives | — | — | — |
| contact | Hours/address | Showroom map + specific hours, not "contact us" placeholder | — | — | — |

### I2 — Density + scan-ability on commerce

Source: DESIGN-VISION §5 "Commerce", competitor-research: Strong Futons grid

| Page | Element | Acceptance | Wix | Next | Verdict |
|------|---------|------------|-----|------|---------|
| plp-futons | Grid | 3-col desktop, 2-col tablet, 1-col mobile; price anchors within 120 px of title | — | — | — |
| plp-mattresses | Filter strip | Firmness filter visible without scroll at 1440 | — | — | — |
| plp-frames | Card | Wood finish chip on every card | — | — | — |
| search | Facets | Price + collection + in-stock toggles above-the-fold mobile | — | — | — |

### I3 — Clear, single buy path on PDP

Source: DESIGN-VISION §6 "Buy path", competitor-research: Haiku PDP model

| Page | Element | Acceptance | Wix | Next | Verdict |
|------|---------|------------|-----|------|---------|
| pdp-eureka | Primary CTA | One "Add to Cart" button visible on initial viewport at all three breakpoints | — | — | — |
| pdp-eureka | Options | Size/finish selectors never push CTA below fold on mobile | — | — | — |
| pdp-eureka | Social proof | Review summary rendered within 480 px of CTA | — | — | — |
| cart | Total | Order total + estimated delivery date visible without scroll | — | — | — |
| checkout | Trust badges | Secure-checkout badge set visible at form start | — | — | — |

### I4 — Warmth + trust on post-purchase

Source: DESIGN-VISION §7 "Post-purchase"

| Page | Element | Acceptance | Wix | Next | Verdict |
|------|---------|------------|-----|------|---------|
| order-conf | Headline | Thank-you language, not generic "Order received" | — | — | — |
| order-conf | Next steps | Expected delivery window + showroom invite | — | — | — |
| account-orders | Rows | Reorder button on every row, stale-date styling | — | — | — |

### I5 — Editorial feel on content

Source: DESIGN-VISION §8 "Content", competitor-research: Gold Bond blog

| Page | Element | Acceptance | Wix | Next | Verdict |
|------|---------|------------|-----|------|---------|
| blog-index | Card | Reading time + author on every card | — | — | — |
| blog-post-sample | Typography | Measure ≤ 75 ch at desktop; 60 ch at mobile | — | — | — |
| blog-post-sample | Related | 3-post related footer on every article | — | — | — |
| videos | Thumbs | 16:9 ratio preserved at all breakpoints | — | — | — |

### I6 — Audience-specific landing pages

Source: DESIGN-VISION §9 "Landing pages"

| Page | Element | Acceptance | Wix | Next | Verdict |
|------|---------|------------|-----|------|---------|
| landing-students | Hero | Dorm context imagery, bundle price up-front | — | — | — |
| landing-apartments | Hero | Studio-footprint copy, space-saving frame call-out | — | — | — |
| landing-guest-room | Hero | Occasional-use comfort pitch, mattress thickness spec | — | — | — |
| landing-rv | Hero | Travel-friendly fit diagrams, weight spec | — | — | — |

### I7 — Accessible and responsive baselines

Source: DESIGN-VISION §10 "A11y", §3 "Responsive grid"

| Page | Element | Acceptance | Wix | Next | Verdict |
|------|---------|------------|-----|------|---------|
| all | Color contrast | All body text ≥ WCAG AA on brand backgrounds | — | — | — |
| all | Focus ring | Visible focus on every interactive element at all breakpoints | — | — | — |
| all | Tap target | Min 44×44 at mobile | — | — | — |
| all | Headings | H1 unique per page, heading order lint-clean | — | — | — |

### I8 — SEO and crawlability parity

Source: cf-3qt.7 sibling bead

| Page | Element | Acceptance | Wix | Next | Verdict |
|------|---------|------------|-----|------|---------|
| home | `<title>` | Matches current Wix title exactly | — | — | — |
| pdp-eureka | OpenGraph | og:title, og:image, og:description present | — | — | — |
| blog-post-sample | Article schema | JSON-LD article schema emitted | — | — | — |
| sitemap | Coverage | All Next routes appear in sitemap.xml | — | — | — |
| not-found | Status | HTTP 404 from origin, not 200 with 404 body | — | — | — |

## Gate

A verdict of `block` on any row stops cf-3qt.8 cutover. Rows marked
`partial` require a short remediation note from melania + Stilgar before
proceeding.
