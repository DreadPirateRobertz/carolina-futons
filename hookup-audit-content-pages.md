# Hookup Audit: Content Pages

**Bead:** cf-83kr
**Auditor:** rennala
**Date:** 2026-03-01
**Pages:** Blog.js, Blog Post.js, Newsletter.js, About.js, Contact.js

---

## 1. Blog.js

### Element Mapping: Code → Spec

| `$w('#id')` in Code | In BUILD-SPEC? | Spec Type | Notes |
|----------------------|-----------------|-----------|-------|
| `#blogSeoSchema` | Yes | HtmlComponent | SEO JSON-LD injection |
| `#blogProductsSection` | Yes | Section | Collapsible sidebar |
| `#blogProductsRepeater` | Yes | Repeater | 2-4 featured products |
| `#sidebarProductImage` | Yes | Image | Repeater child |
| `#sidebarProductName` | Yes | Text | Repeater child |
| `#sidebarProductPrice` | Yes | Text | Repeater child |
| `#sidebarProductLink` | Yes | Button | Repeater child |
| `#shareFacebook` | Yes | Button | Social share |
| `#sharePinterest` | Yes | Button | Social share |
| `#shareTwitter` | Yes | Button | Social share |
| `#shareEmail` | Yes | Button | Social share |
| `#blogNewsletterEmail` | Yes | Input | Newsletter CTA |
| `#blogNewsletterSubmit` | Yes | Button | Newsletter CTA |
| `#blogNewsletterError` | Yes | Text | Hidden default |
| `#blogNewsletterSuccess` | Yes | Text | Hidden default |

### IDs in Code Missing from Spec
None.

### IDs in Spec Missing from Code
None.

### Backend Imports
| Import | File Exists? | Functions Used | Exported? |
|--------|-------------|----------------|-----------|
| `backend/seoHelpers.web` → `getBusinessSchema` | Yes | `getBusinessSchema` | Yes |
| `backend/productRecommendations.web` → `getFeaturedProducts` | Yes | `getFeaturedProducts` | Yes |
| `backend/contactSubmissions.web` → `submitContactForm` | Yes | `submitContactForm` | Yes (lazy import) |

### Public Imports
| Import | File Exists? |
|--------|-------------|
| `public/mobileHelpers` → `limitForViewport`, `initBackToTop` | Yes |
| `public/engagementTracker` → `trackEvent` | Yes |
| `public/ga4Tracking` → `fireCustomEvent` | Yes |
| `public/a11yHelpers` → `announce`, `makeClickable` | Yes |

### Dead Code
None identified.

### Hookup Status: READY

---

## 2. Blog Post.js

### Element Mapping: Code → Spec

| `$w('#id')` in Code | In BUILD-SPEC? | Spec Type | Notes |
|----------------------|-----------------|-----------|-------|
| `#postSeoSchema` | Yes | HtmlComponent | Article + FAQ JSON-LD |
| `#postMetaHtml` | **NO** | — | Meta tags (title, description, canonical) |

### IDs in Code Missing from Spec
| ID | Purpose | Action Needed |
|----|---------|---------------|
| `#postMetaHtml` | HtmlComponent for meta tag injection (title, description, canonical) | **Add to BUILD-SPEC** as HtmlComponent, hidden |

### IDs in Spec Missing from Code
None.

### Backend Imports
| Import | File Exists? | Functions Used | Exported? |
|--------|-------------|----------------|-----------|
| `backend/seoHelpers.web` → `getBlogArticleSchema`, `getBlogFaqSchema`, `getPageTitle`, `getCanonicalUrl`, `getPageMetaDescription` | Yes | All 5 | Yes |
| `backend/blogContent` → `getBlogPost` | Yes | `getBlogPost` | Yes |

### Public Imports
| Import | File Exists? |
|--------|-------------|
| `public/mobileHelpers` → `initBackToTop` | Yes |
| `public/engagementTracker` → `trackEvent` | Yes |

### Dead Code
None identified.

### Hookup Status: BLOCKED — 1 missing spec element (`#postMetaHtml`)

---

## 3. Newsletter.js

### Element Mapping: Code → Spec

| `$w('#id')` in Code | In BUILD-SPEC? | Spec Type | Notes |
|----------------------|-----------------|-----------|-------|
| `#newsletterHeroTitle` | **NO** | — | Hero heading text |
| `#newsletterHeroSubtitle` | **NO** | — | Hero subtitle text |
| `#nlEmailInput` | **NO** | — | Email input |
| `#nlNameInput` | **NO** | — | Name input (optional) |
| `#nlSubmitBtn` | **NO** | — | Submit button |
| `#nlSuccessMessage` | **NO** | — | Success feedback |
| `#nlErrorMessage` | **NO** | — | Error feedback |
| `#benefitsRepeater` | **NO** | — | Benefits list |
| `#benefitTitle` | **NO** | — | Repeater child |
| `#benefitDescription` | **NO** | — | Repeater child |
| `#nlSocialTitle` | **NO** | — | "Follow Us" heading |
| `#nlPinterestBtn` | **NO** | — | Social link |
| `#nlInstagramBtn` | **NO** | — | Social link |
| `#nlFacebookBtn` | **NO** | — | Social link |

### IDs in Code Missing from Spec

**The entire Newsletter page is missing from WIX-STUDIO-BUILD-SPEC.md.**

14 elements need to be added:

| ID | Type | Notes |
|----|------|-------|
| `#newsletterHeroTitle` | Text (H1) | "Stay in the Loop" |
| `#newsletterHeroSubtitle` | Text | Subtitle copy |
| `#nlEmailInput` | Input | Email address, placeholder "your@email.com" |
| `#nlNameInput` | Input | First name (optional) |
| `#nlSubmitBtn` | Button | "Subscribe" |
| `#nlSuccessMessage` | Text | Hidden default, success feedback |
| `#nlErrorMessage` | Text | Hidden default, error feedback |
| `#benefitsRepeater` | Repeater | 4 benefit items |
| `#benefitTitle` | Text (H3) | Repeater child — benefit title |
| `#benefitDescription` | Text | Repeater child — benefit description |
| `#nlSocialTitle` | Text (H2) | "Follow Us" |
| `#nlPinterestBtn` | Button | Pinterest link |
| `#nlInstagramBtn` | Button | Instagram link |
| `#nlFacebookBtn` | Button | Facebook link |

### IDs in Spec Missing from Code
N/A — no spec section exists.

### Backend Imports
None (uses `wix-crm-frontend` which is a Wix platform module).

### Public Imports
| Import | File Exists? |
|--------|-------------|
| `public/engagementTracker` → `trackEvent`, `trackNewsletterSignup` | Yes |
| `public/ga4Tracking` → `fireCustomEvent` | Yes |
| `public/designTokens.js` → `colors` | Yes |
| `public/mobileHelpers` → `initBackToTop` | Yes |
| `public/a11yHelpers` → `announce` | Yes |

### Dead Code
- `colors` imported from `public/designTokens.js` but **never used** in the file. Remove import.

### Hookup Status: BLOCKED — entire page missing from BUILD-SPEC (14 elements)

---

## 4. About.js

### Element Mapping: Code → Spec

| `$w('#id')` in Code | In BUILD-SPEC? | Spec Type | Notes |
|----------------------|-----------------|-----------|-------|
| `#teamGallery` | Yes | Gallery | Polaroid frames |
| `#polaroidImage` | Yes | Image | Gallery child |
| `#polaroidCaption` | Yes | Text | Gallery child |
| `#timelineRepeater` | Yes | Repeater | Business timeline |
| `#timelineYear` | Yes | Text | Repeater child |
| `#timelineTitle` | Yes | Text (H3) | Repeater child |
| `#timelineDesc` | Yes | Text | Repeater child |
| `#aboutSchemaHtml` | Yes | HtmlComponent | Local business JSON-LD |
| `#brandStoryRepeater` | **NO** | — | Brand story sections |
| `#storyHeading` | **NO** | — | Repeater child |
| `#storyBody` | **NO** | — | Repeater child |
| `#storyImage` | **NO** | — | Repeater child |
| `#teamRepeater` | **NO** | — | Team member cards |
| `#teamName` | **NO** | — | Repeater child |
| `#teamRole` | **NO** | — | Repeater child |
| `#teamBio` | **NO** | — | Repeater child |
| `#aboutAddress` | **NO** | — | Showroom address |
| `#aboutPhone` | **NO** | — | Showroom phone |
| `#aboutTodayHours` | **NO** | — | Today's open/closed |
| `#showroomFeatures` | **NO** | — | Features repeater |
| `#featureText` | **NO** | — | Repeater child |
| `#aboutDirectionsBtn` | **NO** | — | Google Maps link |
| `#aboutTestimonials` | **NO** | — | Testimonials repeater |
| `#testimonialQuote` | **NO** | — | Repeater child |
| `#testimonialAuthor` | **NO** | — | Repeater child |
| `#testimonialStars` | **NO** | — | Repeater child |
| `#aboutFaqLink` | **NO** | — | Link to /faq page |

### IDs in Code Missing from Spec

19 elements need to be added to the About page spec:

| ID | Type | Notes |
|----|------|-------|
| `#brandStoryRepeater` | Repeater | Brand story sections |
| `#storyHeading` | Text (H2) | Repeater child — section heading |
| `#storyBody` | Text | Repeater child — section body |
| `#storyImage` | Image | Repeater child — section image |
| `#teamRepeater` | Repeater | Team member cards |
| `#teamName` | Text (H3) | Repeater child — member name |
| `#teamRole` | Text | Repeater child — member role |
| `#teamBio` | Text | Repeater child — member bio |
| `#aboutAddress` | Text | Showroom street address |
| `#aboutPhone` | Text | Showroom phone number |
| `#aboutTodayHours` | Text | Today's open/closed status |
| `#showroomFeatures` | Repeater | Showroom feature badges |
| `#featureText` | Text | Repeater child — feature text |
| `#aboutDirectionsBtn` | Button | Opens Google Maps directions |
| `#aboutTestimonials` | Repeater | Customer testimonials |
| `#testimonialQuote` | Text | Repeater child — quote text |
| `#testimonialAuthor` | Text | Repeater child — author name |
| `#testimonialStars` | Text | Repeater child — star rating |
| `#aboutFaqLink` | Button/Text | Link to FAQ page |

### IDs in Spec Missing from Code
None — all 8 spec IDs are used in code.

### Backend Imports
| Import | File Exists? | Functions Used | Exported? |
|--------|-------------|----------------|-----------|
| `backend/seoHelpers.web` → `getBusinessSchema` | Yes | `getBusinessSchema` | Yes |

### Public Imports
| Import | File Exists? |
|--------|-------------|
| `public/engagementTracker` → `trackEvent` | Yes |
| `public/mobileHelpers` → `initBackToTop` | Yes |
| `public/a11yHelpers.js` → `makeClickable` | Yes |
| `public/aboutContactHelpers.js` → `getBrandStory`, `getTeamMembers`, `getShowroomDetails`, `formatBusinessHours`, `getSocialProofSnippets` | Yes, all exported |

### Dead Code
None identified.

### Hookup Status: BLOCKED — 19 missing spec elements

---

## 5. Contact.js

### Element Mapping: Code → Spec

| `$w('#id')` in Code | In BUILD-SPEC? | Spec Type | Notes |
|----------------------|-----------------|-----------|-------|
| `#contactName` | Yes | Input | |
| `#contactEmail` | Yes | Input | |
| `#contactPhone` | Yes | Input | Optional |
| `#contactSubject` | Yes | Input | Optional |
| `#contactMessage` | Yes | TextArea | |
| `#contactSubmit` | Yes | Button | |
| `#contactSuccess` | Yes | Box | Hidden default |
| `#contactError` | Yes | Text | Hidden default |
| `#contactNameError` | Yes | Text | Hidden default |
| `#contactEmailError` | Yes | Text | Hidden default |
| `#contactMessageError` | Yes | Text | Hidden default |
| `#infoAddress` | Yes | Text | |
| `#infoPhone` | Yes | Text | |
| `#infoPhoneLink` | Yes (as Phone Link) | Button | Click-to-call |
| `#directionsBtn` | Yes | Button | Google Maps |
| `#contactSchemaHtml` | Yes | HtmlComponent | |
| `#contactPhoneError` | **NO** | — | Phone validation error |
| `#contactForm` | **NO** | — | Form container (for hide on success) |
| `#contactMetaHtml` | **NO** | — | Meta tag injection |
| `#contactFeatures` | **NO** | — | Showroom features repeater |
| `#featureItem` | **NO** | — | Repeater child |
| `#todayStatus` | **NO** | — | Open/closed status |
| `#hoursRepeater` | **NO** | — | Weekly hours |
| `#hourDay` | **NO** | — | Repeater child |
| `#hourTime` | **NO** | — | Repeater child |
| `#contactTestimonials` | **NO** | — | Testimonials repeater |
| `#testimonialQuote` | **NO** | — | Repeater child |
| `#testimonialAuthor` | **NO** | — | Repeater child |
| `#testimonialStars` | **NO** | — | Repeater child |
| `#contactFaqLink` | **NO** | — | Link to FAQ page |
| `#appointmentBookBtn` | **NO** | — | Book appointment button |
| `#appointmentVisitType` | **NO** | — | Dropdown |
| `#appointmentDate` | **NO** | — | Dropdown |
| `#appointmentTimeSlot` | **NO** | — | Dropdown |
| `#appointmentName` | **NO** | — | Input |
| `#appointmentEmail` | **NO** | — | Input |
| `#appointmentPhone` | **NO** | — | Input |
| `#appointmentInterests` | **NO** | — | TextArea |
| `#appointmentError` | **NO** | — | Error text |
| `#appointmentForm` | **NO** | — | Form container |
| `#appointmentSuccess` | **NO** | — | Success container |
| `#appointmentConfirmation` | **NO** | — | Confirmation text |

### IDs in Code Missing from Spec

26 elements need to be added:

| ID | Type | Notes |
|----|------|-------|
| `#contactPhoneError` | Text | Hidden default, phone validation |
| `#contactForm` | Box | Form container (hidden on success) |
| `#contactMetaHtml` | HtmlComponent | Hidden, meta tag injection |
| `#contactFeatures` | Repeater | Showroom feature badges |
| `#featureItem` | Text | Repeater child |
| `#todayStatus` | Text | Open/closed today |
| `#hoursRepeater` | Repeater | Weekly schedule |
| `#hourDay` | Text | Repeater child — day name |
| `#hourTime` | Text | Repeater child — hours |
| `#contactTestimonials` | Repeater | Customer testimonials |
| `#testimonialQuote` | Text | Repeater child |
| `#testimonialAuthor` | Text | Repeater child |
| `#testimonialStars` | Text | Repeater child |
| `#contactFaqLink` | Button/Text | Link to FAQ page |
| `#appointmentBookBtn` | Button | "Book Visit" |
| `#appointmentVisitType` | Dropdown | Visit type selection |
| `#appointmentDate` | Dropdown | Date selection |
| `#appointmentTimeSlot` | Dropdown | Time slot selection |
| `#appointmentName` | Input | Customer name |
| `#appointmentEmail` | Input | Customer email |
| `#appointmentPhone` | Input | Customer phone |
| `#appointmentInterests` | TextArea | Product interests |
| `#appointmentError` | Text | Hidden default, booking error |
| `#appointmentForm` | Box | Appointment form container |
| `#appointmentSuccess` | Box | Hidden default, success state |
| `#appointmentConfirmation` | Text | Booking confirmation details |

### IDs in Spec Missing from Code
| Spec ID | Spec Type | Status |
|---------|-----------|--------|
| `#infoHours` | Text | **Not referenced in code** — `#todayStatus` and `#hoursRepeater` used instead |

### Backend Imports
| Import | File Exists? | Functions Used | Exported? |
|--------|-------------|----------------|-----------|
| `backend/seoHelpers.web` → `getBusinessSchema`, `getPageTitle`, `getCanonicalUrl`, `getPageMetaDescription` | Yes | All 4 | Yes |
| `backend/emailService.web` → `sendEmail` | Yes | `sendEmail` | Yes |
| `backend/contactSubmissions.web` → `submitContactForm` | Yes | `submitContactForm` | Yes |
| `backend/deliveryScheduling.web` → `getAvailableAppointmentSlots`, `bookAppointment`, `getVisitTypes` | Yes | All 3 | Yes |

### Public Imports
| Import | File Exists? |
|--------|-------------|
| `public/engagementTracker` → `trackEvent` | Yes |
| `public/mobileHelpers` → `initBackToTop` | Yes |
| `public/a11yHelpers.js` → `announce`, `makeClickable` | Yes |
| `public/validators` → `sanitizeText` | Yes |
| `public/aboutContactHelpers.js` → `validateContactFields`, `getShowroomDetails`, `formatBusinessHours`, `getSocialProofSnippets` | Yes, all exported |

### Dead Code
None identified.

### Hookup Status: BLOCKED — 26 missing spec elements, 1 spec element unused in code

---

## Summary

| Page | Code IDs | In Spec | Missing from Spec | Spec-only (unused) | Dead Code | Status |
|------|----------|---------|-------------------|--------------------|-----------|--------|
| **Blog.js** | 15 | 15 | 0 | 0 | None | READY |
| **Blog Post.js** | 2 | 1 | 1 | 0 | None | BLOCKED (1) |
| **Newsletter.js** | 14 | 0 | 14 | N/A | 1 unused import | BLOCKED (14) |
| **About.js** | 27 | 8 | 19 | 0 | None | BLOCKED (19) |
| **Contact.js** | 42 | 16 | 26 | 1 | None | BLOCKED (26) |
| **TOTAL** | **100** | **40** | **60** | **1** | **1** | |

### Key Findings

1. **Blog.js is fully hooked up** — all 15 element IDs match the spec exactly.
2. **Blog Post.js** needs 1 addition: `#postMetaHtml` (HtmlComponent for meta tags).
3. **Newsletter.js has no spec section at all** — an entire page definition (14 elements) must be added to WIX-STUDIO-BUILD-SPEC.md.
4. **About.js spec is minimal** — only gallery/timeline/schema are defined. Brand story, team, showroom info, testimonials, and FAQ link (19 elements) are missing.
5. **Contact.js has the largest gap** — the spec covers the basic contact form but is missing business hours, testimonials, FAQ link, and the entire appointment booking system (26 elements).
6. **Dead code**: Newsletter.js imports `colors` from `designTokens.js` but never uses it.
7. **Spec orphan**: Contact spec lists `#infoHours` but code uses `#todayStatus` + `#hoursRepeater` instead.
8. **All backend/public imports resolve** — no broken module references across any page.

### Recommended Actions

1. **Add Newsletter page section** to WIX-STUDIO-BUILD-SPEC.md (14 elements)
2. **Expand About page section** in spec (19 elements)
3. **Expand Contact page section** in spec (26 elements)
4. **Add `#postMetaHtml`** to Blog Post spec (1 element)
5. **Remove or replace `#infoHours`** in Contact spec with `#todayStatus` + `#hoursRepeater`
6. **Remove unused `colors` import** from Newsletter.js
