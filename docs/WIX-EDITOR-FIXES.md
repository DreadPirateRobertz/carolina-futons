# Wix Studio Editor Fixes — Brand Alignment Guide

> **Audience:** Overseer / site admin with Wix Studio dashboard access
> **Purpose:** Fix two critical brand violations that exist at the Wix editor/theme level (not in code)
> **Time:** ~5 minutes total

---

## Fix 1: CTA Buttons — Green → Coral

**Problem:** CTA buttons are displaying green (`#3ECF8E`) instead of the brand coral.
**Solution:** Update Theme **Color 4** to Sunset Coral `#E8845C`.

### Steps

1. **Open Wix Studio** → Log in → Select the **Carolina Futons** site
2. **Open the Theme Manager:**
   - Click **Design** in the left sidebar (paintbrush icon)
   - Click **Colors** (or **Site Colors** depending on your editor version)
3. **Locate Color 4** in the site color palette
   - The palette shows numbered color swatches (Color 1 through Color 10+)
   - Color 4 is currently showing green `#3ECF8E` — this is the violation
4. **Click on Color 4** to open the color picker
5. **Replace the hex value:**
   - Clear the current hex field
   - Enter: `E8845C`
   - The preview should show a warm sunset coral/orange
6. **Confirm** the color change (click outside the picker or press Enter)
7. **Verify** the change propagated:
   - Navigate to the Home page — hero CTA button should now be coral
   - Check the Product Page — "Add to Cart" button should be coral
   - Check the Category Page — any action buttons should be coral

### Reference Color Palette (from WIX-STUDIO-BUILD-SPEC.md)

| Swatch | Hex | Usage |
|--------|-----|-------|
| Color 1 | `#E8D5B7` | Sand base — page backgrounds |
| Color 2 | `#3A2518` | Espresso — primary text |
| Color 3 | `#5B8FA8` | Mountain Blue — links, secondary CTA |
| **Color 4** | **`#E8845C`** | **Sunset Coral — primary CTA, sale badges** |
| Color 5 | `#F2E8D5` | Light sand — card backgrounds |
| Color 6 | `#A8CCD8` | Sky blue — subtle accents, tags |
| Color 7 | `#C9A0A0` | Mauve — tertiary accent (deprecated, avoid use) |
| Color 8 | `#5C4033` | Light espresso — secondary text |
| Color 9 | `#D4BC96` | Dark sand — borders |
| Color 10 | `#FFFFFF` | White — modal backgrounds |

---

## Fix 2: Page Backgrounds — Lavender/Pink → Sand or Off-White

**Problem:** Some page section backgrounds are using lavender or pink tones that are off-brand.
**Solution:** Replace with Sand `#E8D5B7` or Off-White `#FAF7F2`.

### Which color to use where

| Section type | Background color | Hex |
|-------------|-----------------|-----|
| Main page body / default | Off-White | `#FAF7F2` |
| Alternating content strips | Sand | `#E8D5B7` |
| Card/product grid areas | Light Sand | `#F2E8D5` |
| Hero sections | Sand or Off-White | `#E8D5B7` or `#FAF7F2` |
| Modals / overlays | White | `#FFFFFF` |

### Steps

1. **Open Wix Studio** → Select the **Carolina Futons** site
2. **Check each page** for off-brand backgrounds. Known violators:
   - Home page sections
   - Category page sections
   - Any section with a pink, lavender, or purple-tinted background

#### Per-Section Fix

3. **Click on the section/strip** with the wrong background color
4. **Open section settings:**
   - Click the section → **Design** tab in the right panel (or right-click → **Design**)
5. **Change the background:**
   - Under **Background Color**, click the color swatch
   - Clear the current hex value
   - Enter the appropriate hex:
     - `FAF7F2` for off-white (default page background)
     - `E8D5B7` for sand (alternating strips)
     - `F2E8D5` for light sand (card areas)
6. **Repeat** for every section on the page that has a lavender/pink background

#### Page-Level Background Fix

If the entire page background (not just a section) is wrong:

7. **Click on empty canvas** (outside any section) to select the page itself
8. **Page Background** → Click the color swatch
9. Enter `FAF7F2` (off-white) as the default page background
10. **Repeat** on every page in the site

### Pages to Check

- **Home** — hero strip, featured products strip, testimonials strip
- **Category Page** — header strip, filter sidebar background
- **Product Page** — product details section, reviews section
- **About** — team section, history section
- **Contact** — form section background
- **Blog** — post list background, individual post background
- **Cart / Checkout** — summary sections

---

## Verification Checklist

After making both fixes, walk through these checks:

- [ ] **CTA buttons are coral** (`#E8845C`) on every page — not green, not blue
- [ ] **No lavender/pink backgrounds** remain on any page section
- [ ] **Page backgrounds** are off-white (`#FAF7F2`) or sand (`#E8D5B7`)
- [ ] **Text remains readable** — espresso (`#3A2518`) on sand/off-white passes WCAG AA
- [ ] **Sale badges** are coral — not green
- [ ] **Preview on mobile** — colors should be consistent across breakpoints
- [ ] **Publish** the site after confirming all fixes look correct

---

## Brand Color Quick Reference

| Token | Hex | Usage |
|-------|-----|-------|
| Sand Base | `#E8D5B7` | Primary background, strips |
| Sand Light | `#F2E8D5` | Card backgrounds |
| Sand Dark | `#D4BC96` | Borders, subtle dividers |
| Off-White | `#FAF7F2` | Default page background |
| Espresso | `#3A2518` | Primary text, headings |
| Espresso Light | `#5C4033` | Secondary text |
| Mountain Blue | `#5B8FA8` | Links, secondary buttons |
| **Sunset Coral** | **`#E8845C`** | **Primary CTA, sale badges, accents** |
| Coral Dark | `#C96B44` | CTA hover state |
| Coral Light | `#F2A882` | CTA light accent |
| Sky Gradient Top | `#B8D4E3` | Decorative gradient |
| Sky Gradient Bottom | `#F0C87A` | Decorative gradient |

> **Rule:** CTAs are ALWAYS Sunset Coral `#E8845C` — never green, never blue.
> **Rule:** Backgrounds are ALWAYS sand/off-white family — never lavender, pink, or gray.
