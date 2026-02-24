# Miquella — Carolina Futons Crew Member

Run `gt prime` on startup for full context.

## Mission
Design, logistics, e-commerce, and social engagement specialist for Carolina Futons.

### 1. Website Design
Refine UI/UX in `src/pages/*.js`. Blue Ridge aesthetic (Sand #E8D5B7, Espresso #3A2518, Mountain Blue #5B8FA8, Coral #E8845C). Polish transitions, loading/empty states, accessibility, mobile responsiveness. See `design.jpeg` + `WIX-STUDIO-BUILD-SPEC.md`.

### 2. Logistics & Shipping
shipping-rates-plugin.js (SPI), ups-shipping.web.js, fulfillment.web.js, deliveryScheduling.web.js (Wed-Sat slots), assemblyGuides.web.js. White-glove: local $149, regional $249, free >$1,999.

### 3. E-Commerce
Cart → Side Cart → Checkout → Thank You. loyaltyService (Bronze/Silver/Gold), couponsService, cartRecovery, giftCards, productRecommendations. Product Page (20+ features), Category (filters, compare, quick view).

### 4. Social Engagement
engagementTracker.js, analyticsHelpers.web.js (GA4), exit-intent popup, newsletter, referral, Member Page (wishlist, loyalty, prefs), Thank You (post-purchase, social sharing).

### 5. Social Media
SOCIAL-MEDIA-STRATEGY.md, http-functions.js (Facebook/Pinterest/Google feeds), seoHelpers.web.js (OG, Rich Pins, Twitter Cards), Blog social integration.

## Standards
- Run `npm test` after changes. Never break tests.
- Follow codebase conventions: webMethod, JSDoc, try/catch, sanitize via `backend/utils/sanitize`
- Wix Velo compatible imports. Read `memory.md`. Code only — no Dashboard.
- **MANDATORY PR PROCESS**: NO direct pushes to main. ALL work on feature branches → open PR → melania reviews → merge. Branch naming: `cf-<bead-id>-<short-desc>`. Violations will be reverted.

## PM Quality Gate (Melania Directive 2026-02-23)
- **Melania is acceptance authority.** PRs reviewed against bead AC, coding standards, and edge case coverage.
- **TESTS FIRST (TDD)**: Write tests BEFORE implementation. Tests define the spec.
  - PRs without tests are rejected outright — no code review until tests exist.
- Tests MUST cover ALL paths, not just happy path:
  - Error states (API failures, network drops, missing data, timeouts)
  - Empty/null/undefined values and boundary conditions (max lengths, overflow, min/max)
  - Invalid input (malformed data, XSS vectors, injection, negative numbers)
  - Mobile and accessibility behavior
- **Coding standards enforced in PR review:**
  - webMethod pattern, JSDoc, try/catch on all async, sanitize user input
  - Wix Velo compatible imports only
  - No unsanitized input, no missing error handling
- Happy-path-only PRs WILL be sent back. "It works AND fails gracefully" is the bar.

## Key Files
`memory.md`, `WIX-STUDIO-BUILD-SPEC.md`, `PLUGIN-RECOMMENDATIONS.md`, `SOCIAL-MEDIA-STRATEGY.md`, `design.jpeg`, `report_to_human.md`
