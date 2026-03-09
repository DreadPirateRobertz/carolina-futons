# Pages Build Spec — Batch 2: Store Locator, Financing, Sustainability

> **For radahn**: Build these elements in Wix Studio editor via Playwright.
> Source files: `src/pages/Store Locator.js`, `src/pages/Financing.js`, `src/pages/Sustainability.js`
> Bead: CF-rs29

---

## Build Instructions

Build sections top-to-bottom matching page scroll order. Each element needs:
1. Add element of correct type
2. Set element ID (Properties panel > ID field)
3. Position within parent container
4. Set placeholder content
5. Set ARIA labels where noted

**Design tokens** (from `sharedTokens.js`):
- Sand: `#E8D5B7` | Espresso: `#3A2518` | Mountain Blue: `#5B8FA8` | Coral: `#E8845C`
- Off-white bg: `#FAF7F2` | Sand light: `#F2E8D5`
- Headings: Playfair Display | Body: Source Sans 3

---

# Page 1: Store Locator

> **Page name**: "Store Locator"
> **Source**: `src/pages/Store Locator.js` (19 page-level elements, 6 repeaters, 13 repeater-item elements)
> **Backend**: `storeLocatorService.web` (getStoreLocatorSchema, isShowroomOpen, getNearbyCities, getDirectionsUrl)
> **Helpers**: `storeLocatorHelpers.js`, `localBusinessSeo.js`, `pageSeo.js`

---

## SL Section 1: Contact Info / Hero

**Layout**: Hero section with showroom address, phone, email, and action buttons.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 1 | `storeAddress` | Text | "123 Main St, Raleigh, NC 27601" | Address text, set dynamically |
| 2 | `storePhone` | Text | "(919) 555-0100" | Phone number display |
| 3 | `storeEmail` | Text | "info@carolinafutons.com" | Email display |
| 4 | `storePhoneBtn` | Button | "Call Us" | aria-label: "Call Carolina Futons at (919) 555-0100". Opens tel: link |
| 5 | `storeEmailBtn` | Button | "Email Us" | aria-label: "Email Carolina Futons". Opens mailto: link |
| 6 | `storeDirectionsBtn` | Button | "Get Directions" | aria-label: "Get directions to our showroom". Coral CTA `#E8845C` |

---

## SL Section 2: Google Map Embed

**Layout**: Full-width or large map area with "Open in Google Maps" link below.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 7 | `storeMapHtml` | HtmlComponent (iframe) | Google Maps embed | Receives embedUrl via postMessage. aria-label set dynamically |
| 8 | `openInMapsBtn` | Button/Text Link | "Open in Google Maps" | aria-label: "Open location in Google Maps" |

---

## SL Section 3: Business Hours

**Layout**: Hours table as a repeater. Open/closed status badge above or beside.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 9 | `hoursRepeater` | Repeater | 7 rows (Mon–Sun) | aria-label: "Weekly business hours" |
| — | `hoursDay` | Text (repeater item) | "Monday" | Day name |
| — | `hoursTime` | Text (repeater item) | "10:00 AM – 6:00 PM" | Hours text |
| 10 | `statusBadge` | Text | "Open Now" / "Closed" | Green/red badge styling. Set dynamically |
| 11 | `statusHours` | Text | "Open until 6:00 PM" | Current hours context |
| 12 | `statusNextOpen` | Text | "Opens Monday at 10:00 AM" | Hidden when currently open. Show/hide dynamic |

---

## SL Section 4: Showroom Features

**Layout**: Grid of feature cards.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 13 | `featuresRepeater` | Repeater | Feature cards | aria-label: "Showroom features and services" |
| — | `featureTitle` | Text (repeater item) | "Try Before You Buy" | Feature name |
| — | `featureDesc` | Text (repeater item) | "Test every futon frame..." | Feature description |

---

## SL Section 5: Showroom Photo Gallery

**Layout**: Image gallery with captions.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 14 | `showroomGallery` | Repeater or Gallery | Photo cards | aria-label: "Showroom photo gallery" |
| — | `galleryImage` | Image (repeater item) | Showroom photo | Set alt text dynamically |
| — | `galleryCaption` | Text (repeater item) | "Our showroom floor" | Caption below image |

---

## SL Section 6: Amenities

**Layout**: List or grid of amenity items.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 15 | `amenitiesRepeater` | Repeater | Amenity items | aria-label: "Showroom amenities" |
| — | `amenityLabel` | Text (repeater item) | "Free Parking" | Amenity name |
| — | `amenityDetail` | Text (repeater item) | "Large lot with..." | Detail text |

---

## SL Section 7: Directions — Nearby Cities

**Layout**: Cards showing driving distance/time from nearby cities with map links.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 16 | `directionsRepeater` | Repeater | City direction cards | aria-label: "Driving directions from nearby cities" |
| — | `cityLabel` | Text (repeater item) | "Durham, NC" | City name |
| — | `cityDistance` | Text (repeater item) | "28 miles" | Distance |
| — | `cityDriveTime` | Text (repeater item) | "35 min" | Drive time |
| — | `cityDirections` | Text (repeater item) | "Take I-40 East..." | Brief directions |
| — | `cityMapBtn` | Button (repeater item) | "Get Directions" | aria-label: "Get directions from Durham, NC". Opens Google Maps |

---

## SL Section 8: Custom Address Directions

**Layout**: Text input + button for custom address lookup.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 17 | `directionsAddressInput` | TextInput | placeholder: "Enter your address" | aria-label: "Enter your address for directions" |
| 18 | `directionsGoBtn` | Button | "Get Directions" | aria-label: "Get directions from your address" |

---

## SL Section 9: Schema (hidden)

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 19 | `storeSchemaHtml` | HtmlComponent | (hidden) | Receives LocalBusiness JSON-LD via postMessage. Not visible |

---

## Store Locator — Element Count Summary

| Type | Count |
|------|-------|
| Page-level elements | 19 |
| Repeaters | 6 (`hoursRepeater`, `featuresRepeater`, `showroomGallery`, `amenitiesRepeater`, `directionsRepeater`, + custom address input group) |
| Repeater item elements | 13 (`hoursDay`, `hoursTime`, `featureTitle`, `featureDesc`, `galleryImage`, `galleryCaption`, `amenityLabel`, `amenityDetail`, `cityLabel`, `cityDistance`, `cityDriveTime`, `cityDirections`, `cityMapBtn`) |
| **Total** | **32** |

---
---

# Page 2: Financing

> **Page name**: "Financing"
> **Source**: `src/pages/Financing.js` (18 page-level elements, 5 repeaters, 16 repeater-item elements)
> **Backend**: `financingCalc.web` (getFinancingWidget — lazy imported)
> **Helpers**: `financingPageHelpers.js`, `pageSeo.js`

---

## FN Section 1: Price Input & Calculator

**Layout**: Input field with "Calculate" button. Error text below input. Results section hidden initially.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 1 | `priceInput` | TextInput | placeholder: "Enter product price (e.g. $799)" | aria-label: "Enter a price to calculate financing options". Supports Enter key |
| 2 | `calculateBtn` | Button | "Calculate" | aria-label: "Calculate financing options". Coral CTA `#E8845C` |
| 3 | `priceError` | Text | "" | Red error text. Hidden by default. Shows validation errors |
| 4 | `resultsSection` | Container (Box/Section) | (empty initially) | Collapsed by default. Expands when results load |
| 5 | `loadingIndicator` | Container/Box or Image | Loading spinner | Hidden by default. Shown during API call |

---

## FN Section 2: Results Display

**Layout**: Inside `resultsSection`. Shows price range label, result header, and lowest monthly highlight.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 6 | `priceRangeLabel` | Text | "Mid-Range ($500–$999)" | Price tier label. Show/hide dynamic |
| 7 | `resultHeader` | Text (H2) | "Financing options for $799" | Dynamic heading |
| 8 | `lowestMonthly` | Text | "As low as $33/mo" | Highlight badge. Show/hide dynamic |
| 9 | `noResultsMessage` | Text | "Financing plans start at $200..." | Shown when no plans available. Hidden by default |

---

## FN Section 3: Comparison Table

**Layout**: Repeater rows comparing financing plans side by side.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 10 | `comparisonRepeater` | Repeater | Comparison rows | aria-label: "Financing plan comparison". Collapsible |
| — | `compLabel` | Text (repeater item) | "Affirm 12 mo" | Plan label |
| — | `compPayment` | Text (repeater item) | "$72/mo" | Monthly payment |
| — | `compTotal` | Text (repeater item) | "$864" | Total cost |
| — | `compInterest` | Text (repeater item) | "0% APR" | Interest rate text |
| — | `zeroBadge` | Text (repeater item) | "0% APR" | Badge, shown only for zero-interest. Hidden by default |

---

## FN Section 4: Afterpay Section

**Layout**: Separate section for Afterpay "Pay in 4" schedule. Collapsible.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 11 | `afterpaySection` | Container (Box/Section) | Afterpay details | Collapsed by default. Expand when Afterpay eligible |
| 12 | `afterpayMessage` | Text | "Pay in 4 interest-free installments" | Afterpay summary message |
| 13 | `afterpayScheduleRepeater` | Repeater | Payment schedule (4 rows) | Payment timeline |
| — | `scheduleLabel` | Text (repeater item) | "Today" | Payment timing |
| — | `scheduleAmount` | Text (repeater item) | "$199.75" | Payment amount |
| — | `schedulePayment` | Text (repeater item) | "Payment 1" | Payment number |

---

## FN Section 5: Quick Price Buttons

**Layout**: Row of preset price buttons for one-click calculation.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 14 | `quickPriceRepeater` | Repeater | Quick price buttons | aria-label: "Quick price selection" |
| — | `quickPriceLabel` | Text (repeater item) | "$499" | Price label |
| — | `quickPriceBtn` | Button/Container (repeater item) | (clickable area) | aria-label: "Calculate financing for $499". Sets price + triggers calc |

---

## FN Section 6: Provider Info

**Layout**: Cards introducing each payment provider (Affirm, Klarna, Afterpay).

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 15 | `providerRepeater` | Repeater | Provider cards | aria-label: "Payment providers" |
| — | `providerName` | Text (repeater item) | "Affirm" | Provider name |
| — | `providerDesc` | Text (repeater item) | "Pay over time with fixed..." | Description |
| — | `providerRange` | Text (repeater item) | "$200 – $5,000" | Eligible price range |

---

## FN Section 7: Financing FAQs

**Layout**: Accordion-style FAQ list. Answers collapsed by default with +/− chevron.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 16 | `financingFaqRepeater` | Repeater | FAQ items | aria-label: "Financing frequently asked questions" |
| — | `faqQuestion` | Text (repeater item) | "How does financing work?" | Clickable — toggles answer. aria-label: "Toggle answer: ..." |
| — | `faqAnswer` | Text (repeater item) | "Choose your plan at checkout..." | Collapsed by default |
| — | `faqChevron` | Text (repeater item) | "+" | Toggles to "−" when expanded |

---

## FN Section 8: CTA Buttons

**Layout**: Two CTA buttons at page bottom.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 17 | `shopNowBtn` | Button | "Shop Now" | Links to /shop. Coral CTA `#E8845C` |
| 18 | `financingContactBtn` | Button | "Contact Us" | Links to /contact. Secondary style |

---

## Financing — Element Count Summary

| Type | Count |
|------|-------|
| Page-level elements | 18 |
| Repeaters | 5 (`comparisonRepeater`, `afterpayScheduleRepeater`, `quickPriceRepeater`, `providerRepeater`, `financingFaqRepeater`) |
| Repeater item elements | 16 (`compLabel`, `compPayment`, `compTotal`, `compInterest`, `zeroBadge`, `scheduleLabel`, `scheduleAmount`, `schedulePayment`, `quickPriceLabel`, `quickPriceBtn`, `providerName`, `providerDesc`, `providerRange`, `faqQuestion`, `faqAnswer`, `faqChevron`) |
| **Total** | **34** |

---
---

# Page 3: Sustainability

> **Page name**: "Sustainability"
> **Source**: `src/pages/Sustainability.js` (16 page-level elements, 4 repeaters, 9 repeater-item elements)
> **Backend**: `seoHelpers.web` (getBusinessSchema)
> **Helpers**: `sustainabilityHelpers.js`, `pageSeo.js`

---

## SS Section 1: Hero

**Layout**: Full-width hero with heading, subheading, and intro paragraph. Sand/green nature theme.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 1 | `sustainHeroHeading` | Text (H1) | "Sustainability at Carolina Futons" | Playfair Display, 36px, espresso |
| 2 | `sustainHeroSubheading` | Text (H2) | "Building Better, Naturally" | Playfair Display, 24px |
| 3 | `sustainHeroIntro` | Text (paragraph) | "We believe great furniture..." | Source Sans 3, 16px |

---

## SS Section 2: Materials

**Layout**: Section heading + description + repeater grid of material highlight cards.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 4 | `materialsHeading` | Text (H2) | "Sustainably Sourced Materials" | Section heading |
| 5 | `materialsDescription` | Text | "Every piece starts with..." | Intro paragraph |
| 6 | `materialsRepeater` | Repeater | Material cards | aria-label: "Sustainably sourced materials" |
| — | `materialTitle` | Text (repeater item) | "Appalachian Hardwood" | Material name |
| — | `materialDesc` | Text (repeater item) | "Locally sourced from..." | Material description |

---

## SS Section 3: Certifications

**Layout**: Section heading + certification cards.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 7 | `certificationsHeading` | Text (H2) | "Environmental Certifications" | Section heading |
| 8 | `certificationsRepeater` | Repeater | Certification cards | aria-label: "Environmental certifications" |
| — | `certName` | Text (repeater item) | "FSC Certified" | Certification name |
| — | `certDesc` | Text (repeater item) | "Forest Stewardship Council..." | Description |

---

## SS Section 4: Badges Showcase

**Layout**: Grid of sustainability badge items.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 9 | `badgesRepeater` | Repeater | Badge items | aria-label: "Sustainability badges" |
| — | `badgeLabel` | Text (repeater item) | "Made in USA" | Badge label |
| — | `badgeDesc` | Text (repeater item) | "Manufactured domestically..." | Badge description |

---

## SS Section 5: Carbon Offset

**Layout**: Info section about carbon offset at checkout.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 10 | `carbonOffsetSection` | Container (Box/Section) | Carbon offset info | Parent container |
| 11 | `carbonHeading` | Text (H2) | "Carbon Offset at Checkout" | Section heading |
| 12 | `carbonDescription` | Text | "Add a small contribution at checkout to offset the carbon footprint of your purchase. We partner with verified reforestation programs." | Body text |

---

## SS Section 6: Trade-In Program

**Layout**: Trade-in section with heading, description, condition dropdown, and credit estimate display.

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 13 | `tradeInHeading` | Text (H2) | "Furniture Trade-In Program" | Section heading |
| 14 | `tradeInDescription` | Text | "Bring in your old futon..." | Program description |
| 15 | `tradeInCondition` | Dropdown | Options: Excellent, Good, Fair, Poor | Condition selector. Options set from getConditionOptions() |
| 16 | `tradeInEstimate` | Text | "Estimated credit: $50–$150" | Updates on dropdown change. Hidden until selection |

---

## SS Section 7: Trade-In Steps

**Layout**: Step-by-step process repeater (numbered steps).

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 17 | `tradeInStepsRepeater` | Repeater | Process steps | aria-label: "Trade-in process steps" |
| — | `stepNumber` | Text (repeater item) | "1" | Step number |
| — | `stepTitle` | Text (repeater item) | "Bring It In" | Step title |
| — | `stepDesc` | Text (repeater item) | "Drop off your old furniture..." | Step description |

---

## SS Section 8: Schema (hidden)

| # | Element ID | Wix Type | Content/Placeholder | Notes |
|---|-----------|----------|-------------------|-------|
| 18 | `sustainSchemaHtml` | HtmlComponent | (hidden) | Receives business JSON-LD via postMessage. Not visible |

---

## Sustainability — Element Count Summary

| Type | Count |
|------|-------|
| Page-level elements | 18 (16 visible + `tradeInStepsRepeater` + `sustainSchemaHtml`) |
| Repeaters | 4 (`materialsRepeater`, `certificationsRepeater`, `badgesRepeater`, `tradeInStepsRepeater`) |
| Repeater item elements | 9 (`materialTitle`, `materialDesc`, `certName`, `certDesc`, `badgeLabel`, `badgeDesc`, `stepNumber`, `stepTitle`, `stepDesc`) |
| **Total** | **27** |

---
---

# Grand Total — All 3 Pages

| Page | Page-Level | Repeaters | Item Elements | Total |
|------|-----------|-----------|--------------|-------|
| Store Locator | 19 | 6 | 13 | 32 |
| Financing | 18 | 5 | 16 | 34 |
| Sustainability | 18 | 4 | 9 | 27 |
| **Combined** | **55** | **15** | **38** | **93** |

---

## Build Priority

1. **Financing** — Interactive calculator, highest customer-facing value
2. **Store Locator** — SEO critical (LocalBusiness schema), drives foot traffic
3. **Sustainability** — Brand content, lower urgency

## Notes for radahn

- All pages use `initBackToTop($w)` from `mobileHelpers` — ensure back-to-top button element exists on each page (from masterPage)
- All pages call `initPageSeo()` from `pageSeo.js` — SEO meta elements must exist
- All pages call `trackEvent('page_view', ...)` — analytics tracking automatic
- HtmlComponent elements (`storeMapHtml`, `storeSchemaHtml`, `sustainSchemaHtml`) receive content via `postMessage()` — they need to be blank iframes
- Repeater item elements are created inside the repeater's template — they only need to exist once in the template row
- Accordion FAQ pattern (Financing): `faqAnswer` starts collapsed, `faqChevron` starts as "+"
