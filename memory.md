# Carolina Futons - Project Memory

**Repo**: `git@github.com:DreadPirateRobertz/carolina-futons.git` | **Local**: `/Users/hal/Projects/carolina-futons/`
**Rig**: `cfutons` (prefix: `cf`) | **Site**: Experiment_2 (NOT live) | **Login**: `halworker85@gmail.com`
**Stack**: Wix Studio + Wix Velo (JS), UPS REST API, Wix Stores/CRM/Secrets Manager
**Design**: Blue Ridge Mountain aesthetic — sand(#E8D5B7)/espresso(#3A2518)/coral(#E8845C). Playfair Display + Source Sans 3. See `design.jpeg`, `WIX-STUDIO-BUILD-SPEC.md`
**Owner**: Brenda Deal, 824 Locust St Ste 200, Hendersonville NC 28792. (828) 252-9449. Wed-Sat 10-5.
**Tests**: 1,395 passing (Vitest + Wix mocks, 53 files in `tests/`)

## Architecture (Key Decisions)

- **Cross-sell**: `productRecommendations.web.js` — frame+mattress pairing, 8 categories, 5% bundle discount
- **Shipping**: Two-layer — SPI plugin (checkout) + fulfillment (post-purchase UPS). Free >$999. White-glove: $149 local/$249 regional/free >$1999
- **Discounts**: 5% >$500, 10% >$1000 (Cart + Side Cart progress bars)
- **SEO**: JSON-LD via hidden HtmlComponent (Product, LocalBusiness, BreadcrumbList, FAQPage, WebSite)
- **UPS**: OAuth 2.0, Rating v2403, Shipping, Tracking, Address Validation. Sandbox via `UPS_SANDBOX` secret
- **Swatches**: `swatchService.web.js` → FabricSwatches CMS. PDP selector + category dots
- **Images**: `placeholderImages.js` uses `wix:image://` format. URIs are synthetic — need real uploads
- **Promos**: `promotions.web.js` → Promotions CMS. Countdown, carousel, discount code, email capture
- **Errors**: Silent catch non-critical; user-facing + phone fallback critical; flat-rate fallback UPS

## Open Beads

| Bead | Pri | Title | Status |
|------|-----|-------|--------|
| cf-f2z | P1 | Advanced search & filtering | IN_PROGRESS — caesar |
| cf-qq9 | P1 | Order tracking + UPS | IN_PROGRESS — radahn |
| cf-cz4 | P2 | Returns portal | Backend done (34 tests), needs frontend |
| cf-cmi | P2 | EmailQueue ISO strings bug | IN_PROGRESS — radahn |
| cf-6es | P2 | Error monitoring dashboard | OPEN |
| cf-7t5 | P2 | Live chat widget | OPEN |
| cf-8su | P2 | Product size guide | OPEN |
| cf-yuc | P2 | WCAG 2.1 AA audit | OPEN |
| cf-514 | P3 | Extract time constants | OPEN |
| cf-g7e | P3 | AbandonedCarts JSON bug | OPEN |

**Dashboard items**: cf-6ub(P0) secrets, cf-69b(P1) editor layout, cf-xv3(P1) 11 CMS collections, cf-8gu(P1) UPS creds, cf-e3o(P1) illustrations, cf-1ur(P2) email templates

## CMS Collections (Need Creation)

ProductAnalytics, ContactSubmissions, Wishlist, Fulfillments, FabricSwatches, Promotions, MemberPreferences, AbandonedCarts, DeliverySchedule, AssemblyGuides, GiftCards, ShowroomAppointments — field schemas in source code

## Secrets (Need Storing in Wix Secrets Manager)

UPS_CLIENT_ID, UPS_CLIENT_SECRET, UPS_ACCOUNT_NUMBER, UPS_SANDBOX, SITE_OWNER_CONTACT_ID — creds in local .conf (gitignored, never committed). Store then DELETE local files.

## Completed Work Summary

5 convoys complete (17 beads merged): gallery/category beautification, customer engagement, CMS data architecture, Wix media format, swatch visualizer. Plus 8 pre-convoy beads (bugs, SEO, feeds, TDD, docs). Sprint 2026-02-20: 6 backend modules + 3 page updates.

## Critical Rules

1. ASK BEFORE touching Wix Dashboard
2. Backup BEFORE modifying (WIX-BACKUP-PROCEDURE.md)
3. Site is Experiment_2 — NOT live
4. Never commit secrets (.gitignore blocks *.conf, *.env, *.secret)
5. Well-commented code + markdown API docs
6. TDD with Vitest
7. Use wix:image:// format for non-product images
8. `gt sling` needs `--hook-raw-bead` (mol-polecat-work formula missing in cfutons)
9. `gt session start` required after sling
10. All workers MUST update memory before death/kill
11. **MANDATORY PR PROCESS** — NO direct pushes to main. Workflow: feature branch → push branch → `gh pr create` → review/approval → merge. Melania enforces. Applies to cfutons AND cfutons_mobile.

## Known Open Issues

- placeholderImages.js URIs are synthetic — need real Wix Media Manager uploads
- Mobile responsiveness not yet coded
- wix-stores-frontend may need migration to wix-ecom API

## Session Pickup

1. `cd /Users/hal/Projects/carolina-futons && git pull` + read this file
2. Check `bd list` for open beads, `gt polecat list cfutons` for workers
3. Priority: CMS collections (cf-xv3) > secrets (cf-6ub) > editor layout (cf-69b) > live test
