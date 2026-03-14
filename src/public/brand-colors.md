# Carolina Futons — Brand Colors

Canonical hex values for the CF blue/white brand palette.
Single source of truth: `sharedTokens.js` (this directory).

## Primary Palette

| Token | Hex | Usage |
|-------|-----|-------|
| sandBase | #F0F4F8 | Background, cards |
| sandLight | #F8FAFC | Hover states, light surfaces |
| sandDark | #E2E8F0 | Borders, dividers |
| espresso | #1E3A5F | Primary text, headers |
| espressoLight | #3D5A80 | Secondary text |

## Accent Colors

| Token | Hex | Usage |
|-------|-----|-------|
| mountainBlue | #5B8FA8 | Links, secondary actions |
| mountainBlueDark | #3D6B80 | Hover/active state |
| mountainBlueLight | #A8CCD8 | Info backgrounds |
| sunsetCoral | #4A7D94 | CTAs, primary buttons |
| sunsetCoralDark | #3D6B80 | Hover/pressed state |
| sunsetCoralLight | #A8CCD8 | Subtle highlights |
| mauve | #C9A0A0 | Fabric swatches, soft accents |

## Decorative

| Token | Hex | Usage |
|-------|-----|-------|
| skyGradientTop | #B8D4E3 | Hero gradient start |
| skyGradientBottom | #F0C87A | Hero gradient end |
| offWhite | #FFFFFF | Page background |
| white | #FFFFFF | Card background |
| overlay | rgba(30, 58, 95, 0.6) | Modal overlays |

## Semantic / Status

| Token | Hex | Usage |
|-------|-----|-------|
| success | #4A7C59 | Success states |
| error | #DC2626 | Error states |
| muted | #646C79 | Disabled, placeholder text |
| mutedBrown | #64748B | Muted gray accents |

## Platform Notes

- **Web**: `sharedTokens.js` → imported by `designTokens.js`
- **Mobile**: `src/theme/tokens.ts` mirrors these values
- Both platforms MUST reference the same token names and hex values.
- Changes to this palette require updating both platforms.
