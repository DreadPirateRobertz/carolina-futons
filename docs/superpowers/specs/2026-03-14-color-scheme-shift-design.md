# CF-1v76: Color Scheme Shift — Template Beige/Salmon → CF Blue Branding

**Date**: 2026-03-14
**Author**: miquella
**Status**: Design
**Bead**: CF-1v76 (P1)

## Problem

The staging site uses the Wix Furniture Store template's warm beige/salmon palette (sand backgrounds, brown text, coral buttons). The production carolinafutons.com uses a clean blue/white scheme with the CF brand blue as the primary color. The staging site needs to match production branding.

## Design Decisions

1. **UI chrome shifts to blue/white** — backgrounds, text, buttons, links, borders
2. **Illustrations stay warm** — the Blue Ridge Mountain SVGs (skylines, timeline, team portrait, etc.) keep their warm sunset/mountain palette. They're the site's distinctive competitive advantage and look beautiful against a clean white background.
3. **Single-file change** — all 76 consumer files import colors from `sharedTokens.js`. Changing the hex values there propagates everywhere automatically.
4. **Token names stay** — renaming 958 references across 53 files is high risk for zero user-facing benefit. The names are internal identifiers only.

## Production Site Reference

From screenshots (`design-vision/screenshots/cf-current-*.png`):
- **Logo**: CF brand blue square (~#5B8FA8, matches existing `mountainBlue` token)
- **Header**: White background, blue logo, blue nav links
- **Category buttons**: Blue with white text
- **Page background**: Pure white
- **Text**: Dark navy/charcoal
- **Overall feel**: Clean, modern, professional

## Color Mapping

### Primary UI Tokens (CHANGING)

| Token | Old Hex | New Hex | Visual |
|-------|---------|---------|--------|
| `sandBase` | #E8D5B7 | #F0F4F8 | Warm sand → light blue-gray surface |
| `sandLight` | #F2E8D5 | #F8FAFC | Light sand → near-white |
| `sandDark` | #D4BC96 | #E2E8F0 | Dark sand → cool border gray |
| `espresso` | #3A2518 | #1E3A5F | Dark brown → dark navy |
| `espressoLight` | #5C4033 | #3D5A80 | Medium brown → medium navy |
| `offWhite` | #FAF7F2 | #FFFFFF | Warm off-white → pure white |
| `sunsetCoral` | #E8845C | #5B8FA8 | Coral → CF brand blue (buttons, accents) |
| `sunsetCoralDark` | #C96B44 | #3D6B80 | Dark coral → dark blue (hover states) |
| `sunsetCoralLight` | #F2A882 | #A8CCD8 | Light coral → light blue (badges, highlights) |
| `mutedBrown` | #816D51 | #64748B | Muted brown → slate gray |
| `overlay` | rgba(58,37,24,0.6) | rgba(30,58,95,0.6) | Brown overlay → navy overlay |
| `muted` | #767676 | #64748B | Gray → slate (still WCAG AA compliant) |
| `error` | #C0392B | #DC2626 | Slightly brighter red for contrast on white |

### Tokens That Stay (NO CHANGE)

| Token | Hex | Reason |
|-------|-----|--------|
| `mountainBlue` | #5B8FA8 | Already the CF brand blue |
| `mountainBlueDark` | #3D6B80 | Already correct |
| `mountainBlueLight` | #A8CCD8 | Already correct |
| `white` | #FFFFFF | Already correct |
| `success` | #4A7C59 | Universal green, works on white |
| `skyGradientTop` | #B8D4E3 | Illustration-only, stays warm |
| `skyGradientBottom` | #F0C87A | Illustration-only, stays warm |

### Shadow Tint Shift

Shadows currently use espresso-tinted `rgba(58,37,24,...)`. Shift to navy-tinted:

| Shadow | Old | New |
|--------|-----|-----|
| `card` | rgba(58,37,24,0.08) | rgba(30,58,95,0.08) |
| `cardHover` | rgba(58,37,24,0.12) | rgba(30,58,95,0.12) |
| `nav` | rgba(58,37,24,0.06) | rgba(30,58,95,0.06) |
| `modal` | rgba(58,37,24,0.2) | rgba(30,58,95,0.2) |
| `button` | rgba(232,132,92,0.3) | rgba(91,143,168,0.3) |

## Files to Modify

### Core (values change, everything propagates)
1. `src/public/sharedTokens.js` — hex values + shadow colors + overlay
2. `src/public/brand-colors.md` — documentation mirror

### Tests (expected values update)
3. `tests/sharedTokens.test.js` — token value assertions
4. `tests/brandPalette.test.js` — BRAND_PALETTE set + BANNED_COLORS

### Hardcoded Hex References (11 files)
5. `src/public/OnboardingIllustrationsFigma.js` — check if UI or illustration colors
6. `src/public/CartIllustrationsFigma.js` — check if UI or illustration colors
7. `src/public/MountainSkylineFigma.js` — illustration, likely no change
8. `src/public/contactIllustrations.js` — illustration, likely no change
9. `src/public/aboutIllustrations.js` — illustration, likely no change
10. `src/backend/emailAutomation.web.js` — email templates need brand blue
11. `src/public/UGCGallery.js` — hardcoded colors need updating
12. `src/public/FooterSection.js` — check for hardcoded values
13. `src/public/ProductDetails.js` — check for hardcoded values
14. `src/public/priceMatchHelpers.js` — check for hardcoded values

### Documentation
15. `design-vision/DESIGN-VISION.html` — CSS variables in :root
16. `design-vision/design-system.html` — CSS variables in :root

## Files NOT Modified

- All illustration JS files (`comfortIllustrations.js`, `CartIllustrations.js`, `emptyStateIllustrations.js`, `onboardingIllustrations.js`, `MountainSkyline.js`, `ComfortStoryCards.js`, `emptyStates.js`) — warm palette is intentional
- All Figma pipeline SVGs — warm palette is the artistic vision
- `designTokens.js` — re-exports from sharedTokens, auto-updates
- `carolinaFutonsLogo.js` — uses `colors.espresso` dynamically, auto-updates to navy

## WCAG AA Compliance

All new color pairs must maintain 4.5:1 contrast ratio:
- `espresso` (#1E3A5F) on `offWhite` (#FFFFFF): ~10.2:1 ✓
- `espresso` (#1E3A5F) on `sandBase` (#F0F4F8): ~9.1:1 ✓
- `white` (#FFFFFF) on `sunsetCoral` (#5B8FA8): ~3.5:1 — needs verification for small text
- `white` (#FFFFFF) on `sunsetCoralDark` (#3D6B80): ~5.2:1 ✓

Note: If #5B8FA8 doesn't meet 4.5:1 for white text on buttons, darken to #4A7D94 (~4.5:1).

## Testing Strategy

1. Update `sharedTokens.js` values
2. Run `npx vitest run` — expect failures in token value tests
3. Update test expectations
4. Run full suite — all 12,000+ tests should pass
5. Spot-check: email templates, badge colors, contrast ratios

## Out of Scope

- Token renaming (sandBase → surfaceLight, etc.) — follow-up bead
- Illustration palette changes — they stay warm
- Wiring illustrations into live site — separate task
- Font changes — Playfair Display + Source Sans 3 stay
- Wix editor theme sync — melania handles via browser
