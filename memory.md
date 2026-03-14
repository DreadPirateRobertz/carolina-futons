# Carolina Futons - Project Memory

**Repo**: `git@github.com:DreadPirateRobertz/carolina-futons.git`
**Rig**: `cfutons` (prefix: `cf`) | **Site**: My Site 3 (Furniture Store template #3563)
**Login**: `halworker85@gmail.com` | **Site ID**: `3af610bf-06fb-410d-a406-c1258fa84372`
**Stack**: Wix Studio + Wix Velo (JS), UPS REST API, Wix Stores/CRM/Secrets Manager
**Design**: Blue Ridge Mountain aesthetic — Sand `#E8D5B7`, Espresso `#3A2518`, Mountain Blue `#5B8FA8`, Coral `#E8845C`. Playfair Display + Source Sans 3. See `design.jpeg`, `WIX-STUDIO-BUILD-SPEC.md`
**Owner**: Brenda Deal, 824 Locust St Ste 200, Hendersonville NC 28792. (828) 252-9449. Wed-Sat 10-5.
**Tests**: 308 test files (Vitest + Wix mocks) | **Source**: 253 files across src/

## Architecture (Key Decisions)

- **Cross-sell**: `productRecommendations.web.js` — frame+mattress pairing, 8 categories, 5% bundle discount
- **Shipping**: Two-layer — SPI plugin (checkout) + fulfillment (post-purchase UPS). Free >$999. White-glove: $149 local/$249 regional/free >$1999
- **Discounts**: 5% >$500, 10% >$1000 (Cart + Side Cart progress bars)
- **SEO**: JSON-LD via hidden HtmlComponent (Product, LocalBusiness, BreadcrumbList, FAQPage, WebSite)
- **UPS**: OAuth 2.0, Rating v2403, Shipping, Tracking, Address Validation. Sandbox via `UPS_SANDBOX` secret
- **Swatches**: `swatchService.web.js` → FabricSwatches CMS. PDP selector + category dots
- **Promos**: `promotions.web.js` → Promotions CMS. Countdown, carousel, discount code, email capture
- **Errors**: Silent catch non-critical; user-facing + phone fallback critical; flat-rate fallback UPS
- **Product Grid**: All product grids use Repeater pattern (`.onItemReady()`). Template Gallery elements swapped for Repeaters in editor.

## Template Migration (Active)

Migrating from blank skeleton to Furniture Store template #3563 ("Option C" remap workflow):
- **Approach**: Code element IDs remapped to match template IDs (not vice versa)
- **Tool**: `scripts/remap-element-ids.js` — bulk-renames `$w('#oldId')` → `$w('#newId')`
- **Mappings**: `scripts/category-page-mapping.json`, `scripts/masterpage-home-id-mapping.json`
- **Stage3 repo**: `DreadPirateRobertz/carolina-futons-stage3-velo` on GitHub
- **Key decision**: Gallery→Repeater swap in editor (Stilgar directive) — code keeps `.onItemReady()` unchanged
- **Beads**: test-dld (Home+masterPage hookup, P1), test-zou (Category Page hookup, P1)

## CMS Collections (Need Creation)

ProductAnalytics, ContactSubmissions, Wishlist, Fulfillments, FabricSwatches, Promotions, MemberPreferences, AbandonedCarts, DeliverySchedule, AssemblyGuides, GiftCards, ShowroomAppointments

## Secrets (Need Storing in Wix Secrets Manager)

UPS_CLIENT_ID, UPS_CLIENT_SECRET, UPS_ACCOUNT_NUMBER, UPS_SANDBOX, SITE_OWNER_CONTACT_ID, WIX_BACKEND_KEY. Provision via `scripts/provisionSecrets.js --values scripts/secrets.env`.

## Critical Rules

1. ASK BEFORE touching Wix Dashboard
2. Backup BEFORE modifying (`docs/WIX-BACKUP-PROCEDURE.md`)
3. Never commit secrets (.gitignore blocks *.conf, *.env, *.secret)
4. TDD with Vitest — tests before implementation
5. Use wix:image:// format for non-product images
6. **MANDATORY PR PROCESS** — NO direct pushes to main. Feature branch → PR → review → merge.
7. Melania is final arbiter on all PRs
8. Design tokens from `sharedTokens.js` — never hardcode colors
9. All user input sanitized via `backend/utils/sanitize`

## File Organization

```
Root (operational):  CLAUDE.md, AGENTS.md, README.md, memory.md,
                     WIX-STUDIO-BUILD-SPEC.md, MASTER-HOOKUP.md,
                     PLUGIN-RECOMMENDATIONS.md, SOCIAL-MEDIA-STRATEGY.md
docs/                All reference docs, build specs, guides, plans, reports
content/             Product catalog, CMS data, blog content
scripts/             Build tools, ID remapping, secret provisioning
design-vision/       Competitor screenshots, design analysis
```

## Session Pickup

1. `gt prime` for full context
2. `gt mol status` → check hook for assigned work
3. `gt mail inbox` → check for messages
4. `BEADS_DIR=/Users/hal/gt/cfutons/.beads bd ready` → find available work
