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
- **MANDATORY PR PROCESS**: NO direct pushes to main. ALL work on feature branches → open PR → melania assigns reviewers and tells them to review→ merge -> mail the crew member that completed to gt handoff. Branch naming: `cf-<bead-id>-<short-desc>`. Violations will be reverted.


You must also sync and gt handoff when you have delegated your duties and your crew is working

## PR Completion & Handoff Protocol

When a PR is successfully merged:
1. **Merger** closes the associated bead: `bd close <bead-id>`
2. **Merger** mails the crew member who opened the PR: `gt mail send cfutons/crew/<name> -s "PR merged: <bead-id>" -m "Your PR for <bead-id> has been merged. Please gt handoff to cycle your session."`
3. **Crew member** receives mail, verifies merge, then runs `gt handoff` to cycle their session with context for next assignment
4. **Melania** assigns next work from ready queue before or after handoff mail

### gt handoff — When and How
- Run `gt handoff` ONLY after your PR is **successfully merged to main**
- Do NOT handoff when: PR is just opened, context is full, or between tasks — stay in session
- Include context notes: `gt handoff -s "Completed <bead-id>" -m "PR merged, tests green, next: pick up <next-bead>"`
- Handoff preserves your hooked molecule — your next session picks up where you left off

### Session Continuity Checklist
1. `git status` — clean working tree
2. `git push` — all commits on remote
3. Verify PR is **merged** (not just opened)
4. `bd close <id>` — bead closed after merge confirmed
5. `gt handoff -s "..." -m "..."` — context notes for next session



## PM Quality Gate (Melania Directive 2026-02-27)
- **Melania is the FINAL ARBITER on all PRs.** No PR merges without melania's explicit approval.
- **Crew does NOT self-merge.** Open PR → melania reviews → melania merges or rejects.
- PRs reviewed against bead AC, coding standards, and edge case coverage.
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

---

## Figma MCP Design System Rules

### The Soul: Blue Ridge Mountain Illustrative Aesthetic

**`design.jpeg` is the north star.** Every design decision must honor:
- Hand-illustrated mountain cabin feel — warm, rustic, personal
- Watercolor mountain skyline borders (signature repeating element across page headers)
- Sand/espresso/coral warmth — NOT cold minimalist furniture-site template
- Hand-lettered logo personality, wood textures, cozy lifestyle photography
- This site has CHARACTER. Generic = failure.

### Design Tokens — Single Source of Truth

- IMPORTANT: All brand tokens live in `src/public/sharedTokens.js` (platform-agnostic)
- Web-specific tokens (typography scale, grid, SEO) in `src/public/designTokens.js` (imports from sharedTokens)
- IMPORTANT: Never hardcode colors. Always import from `designTokens.js`:
  - Primary: Sand `#E8D5B7`, Espresso `#3A2518`, Mountain Blue `#5B8FA8`, Coral `#E8845C`
  - Backgrounds: `offWhite #FAF7F2`, `sandLight #F2E8D5`
  - CTAs: ALWAYS `sunsetCoral #E8845C` — never green, never blue
  - Decorative: `skyGradientTop #B8D4E3` → `skyGradientBottom #F0C87A` for mountain skyline fills
- Typography: Playfair Display (headings), Source Sans 3 (body) — from `fontFamilies`
- Spacing uses 4px base scale (xs=4, sm=8, md=16, lg=24, xl=32, xxl=48, xxxl=64)
- Shadows: warm espresso-tinted (`rgba(58,37,24,...)`) — NOT neutral gray
- Transitions: fast=150ms, medium=250ms, slow=400ms — all ease timing

### Project Structure

```
src/
├── pages/           ← Full page modules (Wix Velo $w model), one per route
│   ├── Home.js, masterPage.js, Product Page.js, Category Page.js, ...
├── public/          ← Shared frontend helpers, components, design tokens
│   ├── sharedTokens.js      ← BRAND TOKENS (cross-platform source of truth)
│   ├── designTokens.js      ← WEB tokens (imports sharedTokens + web-specific)
│   ├── navigationHelpers.js ← Mobile drawer, nav links, focus traps
│   ├── mobileHelpers.js     ← isMobile(), getViewport(), responsive utils
│   ├── a11yHelpers.js       ← Announce, focus management, ARIA
│   ├── galleryHelpers.js    ← Product image gallery logic
│   ├── productCardHelpers.js← Card rendering, badges, wishlist hearts
│   ├── FooterSection.js, LiveChat.js, StarRatingCard.js, ...
├── backend/         ← Wix Velo backend (webMethod pattern)
│   ├── utils/sanitize ← Input sanitization (ALWAYS use for user input)
│   ├── *.web.js     ← Backend web modules (webMethod exports)
tests/               ← Vitest test files (TDD — tests BEFORE implementation)
design-vision/       ← Competitor analysis, screenshots, design vision HTML doc
```

### Figma MCP Integration Flow

When implementing any design from Figma:

1. **Get context first**: Call `get_design_context` with nodeId + fileKey for structured representation
2. **Get screenshot**: Call `get_screenshot` for visual reference — compare against `design.jpeg` aesthetic
3. **Download assets**: If Figma MCP returns localhost image/SVG sources, use them directly
4. **Translate, don't copy**: Figma output is React+Tailwind reference — translate to Wix Velo `$w` model:
   - Replace Tailwind classes with `$w` element style properties
   - Replace React state with Wix Velo `$w` element show/hide/collapse
   - Replace React event handlers with `$w('#element').onClick()` pattern
5. **Reuse existing components**: Check `src/public/` for existing helpers before creating new ones
6. **Validate**: Compare final UI against Figma screenshot for 1:1 visual parity

### Illustration & Asset Strategy

- **SVG**: Mountain skyline silhouettes, decorative borders, sunrise/sunset gradients — programmatic, lightweight, repeatable
- **Photography**: Hero lifestyle shots, product context imagery — stock or custom
- **Icons**: Use existing codebase icons. DO NOT install new icon packages
- **Assets**: Store in appropriate Wix media directories
- IMPORTANT: If Figma MCP returns a localhost source for an image/SVG, use that source directly — DO NOT create placeholders

### SVG Illustration Quality Bar (PM Directive 2026-03-02)

**design.jpeg is the quality bar. Flat vector shapes with opacity = REJECTED.**

**Mountains MUST look like Blue Ridge Mountains** — soft rolling ridgelines, 5-7 overlapping layers fading into distance with atmospheric haze between them, morning/evening light. NOT jagged Rockies, NOT flat hills, NOT generic peaks. Study Blue Ridge Parkway photos for reference. The signature look: layered ridgelines where each successive range is lighter and hazier.

Every SVG illustration MUST include:
1. **SVG filter effects** — `feTurbulence` + `feDisplacementMap` for watercolor texture on fills. No flat shapes.
2. **Organic hand-drawn paths** — Add wobble/irregularity to bezier curves. Blue Ridge ridgelines are soft and rolling, not smooth mathematical curves. Add extra control points for natural undulation.
3. **Detail elements** — Birds (V shapes in sky), pine tree branch layers (not blobs), wildflowers at base, chimney smoke, stars. Minimum 15 SVG elements per scene.
4. **Rich gradients** — 5+ stops for sky transitions, not 2-stop linear. Layer multiple gradients for depth.
5. **Paper grain overlay** — Subtle `feNoise` or texture filter for hand-drawn feel.
6. **Atmospheric depth** — Foreground/midground/background layers with varying opacity. Fog, haze, light rays.
7. **All colors from sharedTokens** — Zero hardcoded hex. Destructure from `colors`.
8. **ALWAYS render and visually verify** — Tests passing is necessary but NOT sufficient. Screenshot the SVG and compare against design.jpeg before submitting PR.

### Styling in Wix Velo

- Wix Velo uses `$w('#elementId').style.property` for runtime styling
- Layout is primarily set in Wix Studio editor — code handles dynamic state
- Responsive behavior: use `mobileHelpers.js` (`isMobile()`, `getViewport()`) for viewport detection
- Animations: use `$w('#el').show('fade', { duration: 250 })` / `.hide()` with design token durations
- IMPORTANT: All try/catch around `$w()` calls — elements may not exist on all pages

### Component Conventions

- Page modules export `$w.onReady(() => {...})` lifecycle
- Helper modules in `src/public/` export pure functions or initializers (e.g., `initMobileDrawer($w, path)`)
- Backend modules use `webMethod(Permissions.Anyone, async (args) => {...})` pattern
- JSDoc on all exports. Try/catch on all async. Sanitize all user input via `backend/utils/sanitize`
- Naming: PascalCase for component files (`StarRatingCard.js`), camelCase for helper files (`galleryHelpers.js`)

### Responsive Breakpoints

| Name | Width | Grid |
|------|-------|------|
| mobile | 320px | 1 col, 16px gap |
| mobileLarge | 480px | 1 col |
| tablet | 768px | 2 col, 20px gap |
| desktop | 1024px | 3 col, 24px gap |
| wide | 1280px | max-width container |
| ultraWide | 1440px | centered content |

### Accessibility (WCAG AA)

- All interactive elements: keyboard-navigable, visible focus rings
- Color contrast: 4.5:1 minimum (espresso on sand passes, coral on white needs verification)
- ARIA labels on all buttons, live regions for dynamic content (`a11yHelpers.js`)
- Focus traps on modals/drawers (`createFocusTrap` from navigationHelpers)
- Screen reader announcements via `announce($w, 'message')`
