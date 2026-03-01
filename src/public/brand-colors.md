# Carolina Futons — Brand Colors

Canonical hex values for the Blue Ridge Mountain palette.
Single source of truth: `sharedTokens.js` (this directory).

## Primary Palette

| Token | Hex | Usage |
|-------|-----|-------|
| sandBase | #E8D5B7 | Background, cards |
| sandLight | #F2E8D5 | Hover states, light surfaces |
| sandDark | #D4BC96 | Borders, dividers |
| espresso | #3A2518 | Primary text, headers |
| espressoLight | #5C4033 | Secondary text |

## Accent Colors

| Token | Hex | Usage |
|-------|-----|-------|
| mountainBlue | #5B8FA8 | Links, secondary actions |
| mountainBlueDark | #3D6B80 | Hover/active state |
| mountainBlueLight | #A8CCD8 | Info backgrounds |
| sunsetCoral | #E8845C | CTAs, primary buttons, alerts |
| sunsetCoralDark | #C96B44 | Hover/pressed state |
| sunsetCoralLight | #F2A882 | Subtle highlights |
| mauve | #C9A0A0 | Fabric swatches, soft accents |

## Decorative

| Token | Hex | Usage |
|-------|-----|-------|
| skyGradientTop | #B8D4E3 | Hero gradient start |
| skyGradientBottom | #F0C87A | Hero gradient end |
| offWhite | #FAF7F2 | Page background |
| white | #FFFFFF | Card background |
| overlay | rgba(58, 37, 24, 0.6) | Modal overlays |

## Semantic / Status

| Token | Hex | Usage |
|-------|-----|-------|
| success | #4A7C59 | Success states |
| error | #E8845C | Error states (same as sunsetCoral) |
| muted | #999999 | Disabled, placeholder text |
| mutedBrown | #8B7355 | Muted brown accents |

## Platform Notes

- **Web**: `sharedTokens.js` → imported by `designTokens.js`
- **Mobile**: `src/theme/tokens.ts` mirrors these values
- Both platforms MUST reference the same token names and hex values.
- Changes to this palette require updating both platforms.
