# About Page — Wix Studio Element Build Spec

**For:** radahn (Playwright builder)
**Page:** About (ID: `sax48`)
**Total elements:** ~27
**Priority:** Build top-to-bottom.

---

## How to Use This Spec

1. Open About page in Wix Studio editor
2. For each section below, add elements in order
3. Set element ID exactly as shown (case-sensitive)
4. Elements marked `hidden` should have initial visibility = hidden
5. Elements marked `collapsed` should be collapsed by default
6. Repeater children go INSIDE the repeater container

---

## SECTION 1: BRAND STORY (above-fold, critical)

Repeater-driven storytelling section with heading, body text, and image per item.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Story Repeater | Repeater | `#brandStoryRepeater` | ARIA label: "Our brand story". Contains story cards |
| → Story Heading | Text (H2) | `#storyHeading` | Repeater child: section heading (e.g., "Our Roots") |
| → Story Body | Text | `#storyBody` | Repeater child: paragraph text |
| → Story Image | Image | `#storyImage` | Repeater child: accompanying photo with alt text |

---

## SECTION 2: TEAM SECTION (above-fold)

Team member cards in a repeater grid.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Team Repeater | Repeater | `#teamRepeater` | ARIA label: "Our team". Grid of team member cards |
| → Team Name | Text | `#teamName` | Repeater child: member name |
| → Team Role | Text | `#teamRole` | Repeater child: job title/role |
| → Team Bio | Text | `#teamBio` | Repeater child: short biography |

---

## SECTION 3: POLAROID PHOTO GALLERY (below-fold)

Team/family photos in tilted polaroid-style frames.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Photo Gallery | Gallery/Repeater | `#teamGallery` | ARIA label: "Team photo gallery". Polaroid-style layout |
| → Polaroid Image | Image | `#polaroidImage` | Repeater child: photo. Default alt: "The Carolina Futons team in Hendersonville, NC" |
| → Polaroid Caption | Text | `#polaroidCaption` | Repeater child: photo caption/description |

---

## SECTION 4: BUSINESS TIMELINE (below-fold)

Vertical timeline of business milestones.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Timeline Repeater | Repeater | `#timelineRepeater` | ARIA role: "list", label: "Business history timeline" |
| → Timeline Year | Text | `#timelineYear` | Repeater child: year badge (e.g., "1991", "2000s", "Today"). Code sets ariaLabel="\<year\>: \<title\>" |
| → Timeline Title | Text | `#timelineTitle` | Repeater child: milestone title |
| → Timeline Desc | Text | `#timelineDesc` | Repeater child: milestone description |

**Hardcoded milestones (populated by code):**
1. **1991** — "Sims' Futon Gallery Opens"
2. **2000s** — "Largest Selection in the Carolinas"
3. **2021** — "A New Chapter Begins"
4. **Today** — "Carolina Futons"

---

## SECTION 5: SHOWROOM INFO (below-fold)

Business details: address, phone, features, directions.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Address | Text | `#aboutAddress` | Business street address |
| Phone | Text | `#aboutPhone` | Business phone number |
| Today's Hours | Text | `#aboutTodayHours` | Live open/closed status |
| Features Repeater | Repeater | `#showroomFeatures` | Showroom feature bullets |
| → Feature Text | Text | `#featureText` | Repeater child: feature description |
| Directions Button | Button | `#aboutDirectionsBtn` | "Get Directions" — opens Google Maps. ARIA label: "Get directions to our showroom" |

---

## SECTION 6: SOCIAL PROOF / TESTIMONIALS (below-fold)

Customer testimonial cards.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Testimonials Repeater | Repeater | `#aboutTestimonials` | ARIA label: "Customer testimonials" |
| → Quote | Text | `#testimonialQuote` | Repeater child: quoted text (wrapped in "") |
| → Author | Text | `#testimonialAuthor` | Repeater child: "— Author Name" |
| → Stars | Text | `#testimonialStars` | Repeater child: star rating (★★★★★) |

---

## SECTION 7: FAQ LINK (below-fold)

| Element | Type | ID | Notes |
|---------|------|----|-------|
| FAQ Link | Text/Link | `#aboutFaqLink` | "Have questions? See our FAQ" — navigates to /faq. ARIA: role="link", ariaLabel="Visit our frequently asked questions page" |

---

## SECTION 8: SEO SCHEMA (hidden)

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Schema HTML | HtmlComponent | `#aboutSchemaHtml` | Hidden, 0×0, for LocalBusiness JSON-LD injection via postMessage |

---

## BUILD ORDER (recommended)

1. **Brand Story** — Section 1 (above-fold, hero content)
2. **Team Section** — Section 2 (above-fold)
3. **Photo Gallery** — Section 3
4. **Timeline** — Section 4
5. **Showroom Info** — Section 5
6. **Testimonials** — Section 6
7. **FAQ Link** — Section 7
8. **SEO Schema** — Section 8 (hidden element)

---

## DESIGN TOKENS (apply to all elements)

| Token | Value | Apply To |
|-------|-------|----------|
| Headings font | Playfair Display | H1 page title, H2 section headings, timeline titles |
| Body font | Source Sans 3 | All body text, bios, descriptions |
| Background | `#FAF7F2` (Off White) | Page background |
| Card background | `#FFFFFF` | Team cards, testimonial cards |
| Text color | `#3A2518` (Espresso) | All text |
| CTA button | `#E8845C` (Coral) bg, white text | Directions button |
| Border radius | 8px | Cards, buttons |
| Shadows | `rgba(58,37,24,0.08)` | Cards |
| Timeline accent | `#5B8FA8` (Mountain Blue) | Year badges, timeline line |
| Star color | `#E8845C` (Coral) | Testimonial star ratings |
