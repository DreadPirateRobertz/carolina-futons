# Contact Page — Wix Studio Element Build Spec

**For:** radahn (Playwright builder)
**Page:** Contact (ID: `u1s7i`)
**Total elements:** ~47
**Priority:** Build top-to-bottom. Contact form and business info are critical (above-fold).

---

## How to Use This Spec

1. Open Contact page in Wix Studio editor
2. For each section below, add elements in order
3. Set element ID exactly as shown (case-sensitive)
4. Elements marked `hidden` should have initial visibility = hidden
5. Elements marked `collapsed` should be collapsed by default
6. Repeater children go INSIDE the repeater container

---

## SECTION 1: HERO ILLUSTRATION (above-fold, decorative)

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Hero Skyline | HtmlComponent | `#contactHeroSkyline` | SVG mountain skyline border. Populated by `contactIllustrations.js` |

---

## SECTION 2: CONTACT FORM (above-fold, critical)

Two-column layout recommended: form on left, business info on right.

### 2A: Form Container

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Form Container | Box | `#contactForm` | Contains all form fields. Hidden on successful submission |
| Name Input | Input | `#contactName` | Required. ARIA: label="Your name", required=true, describedBy="contactNameError" |
| Name Error | Text | `#contactNameError` | Validation error. Hidden default. ARIA: role="alert", live="assertive" |
| Email Input | Input | `#contactEmail` | Required. ARIA: label="Your email address", required=true, describedBy="contactEmailError" |
| Email Error | Text | `#contactEmailError` | Validation error. Hidden default |
| Phone Input | Input | `#contactPhone` | Optional. ARIA: label="Your phone number (optional)" |
| Phone Error | Text | `#contactPhoneError` | Validation error. Hidden default |
| Subject Input | Input | `#contactSubject` | Optional. ARIA: label="Message subject (optional)" |
| Message Input | TextBox | `#contactMessage` | Required, max 5000 chars. ARIA: label="Your message", required=true, describedBy="contactMessageError" |
| Message Error | Text | `#contactMessageError` | Validation error. Hidden default |
| Submit Button | Button | `#contactSubmit` | "Send Message". Coral bg (#E8845C), white text. ARIA: label="Send message to Carolina Futons". Disables during submission, label changes to "Sending..." |
| Success Message | Text | `#contactSuccess` | "Message sent!" confirmation. Hidden default. Shown with fade animation on success |
| Error Message | Text | `#contactError` | General submission error. Hidden default. Shows fallback phone number |

---

## SECTION 3: BUSINESS INFO (above-fold)

### 3A: Address & Contact

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Address | Text | `#infoAddress` | Business street address |
| Phone | Text | `#infoPhone` | Phone number display |
| Phone Link | Button/Link | `#infoPhoneLink` | Click-to-call link. ARIA: label="Call Carolina Futons at (828) 252-9449" |
| Directions Button | Button | `#directionsBtn` | "Get Directions" — opens Google Maps. ARIA: label="Get directions to our showroom" |

### 3B: Showroom Features

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Features Repeater | Repeater | `#contactFeatures` | Showroom feature bullets (e.g., "Free parking", "Wheelchair accessible") |
| → Feature Item | Text | `#featureItem` | Repeater child: feature text |

---

## SECTION 4: BUSINESS HOURS (below-fold)

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Today Status | Text | `#todayStatus` | Live open/closed status with today's hours |
| Hours Repeater | Repeater | `#hoursRepeater` | Full weekly schedule |
| → Day | Text | `#hourDay` | Repeater child: day name (Mon, Tue, etc.) |
| → Time | Text | `#hourTime` | Repeater child: hours (e.g., "10 AM – 6 PM" or "Closed") |

---

## SECTION 5: TESTIMONIALS (below-fold)

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Testimonials Repeater | Repeater | `#contactTestimonials` | ARIA label: "Customer testimonials" |
| → Quote | Text | `#testimonialQuote` | Repeater child: quoted text |
| → Author | Text | `#testimonialAuthor` | Repeater child: "— Author Name" |
| → Stars | Text | `#testimonialStars` | Repeater child: star rating (★★★★★) |

---

## SECTION 6: FAQ LINK (below-fold)

| Element | Type | ID | Notes |
|---------|------|----|-------|
| FAQ Link | Text/Link | `#contactFaqLink` | "Have questions? See our FAQ" — navigates to /faq. ARIA: role="link" |

---

## SECTION 7: APPOINTMENT BOOKING (below-fold)

Full showroom appointment booking form with date/time slot selection.

### 7A: Booking Form

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Form Container | Box | `#appointmentForm` | Contains all booking fields. Hidden on successful booking |
| Name Input | Input | `#appointmentName` | Required. ARIA: label="Your name", required=true |
| Email Input | Input | `#appointmentEmail` | Required. ARIA: label="Your email address", required=true |
| Phone Input | Input | `#appointmentPhone` | Optional. ARIA: label="Your phone number (optional)" |
| Visit Type | Dropdown | `#appointmentVisitType` | Required. ARIA: label="Type of visit", required=true. Options loaded dynamically from backend |
| Date Picker | DatePicker/Dropdown | `#appointmentDate` | Required. ARIA: label="Preferred date", required=true. Options loaded based on visit type |
| Time Slot | Dropdown | `#appointmentTimeSlot` | Required. ARIA: label="Preferred time slot", required=true. Shows available slots with spots remaining |
| Interests | TextBox | `#appointmentInterests` | Optional, max 1000 chars. ARIA: label="What are you interested in? (optional)" |
| Book Button | Button | `#appointmentBookBtn` | "Book Visit". Coral bg. ARIA: label="Book showroom appointment". Disables during submission |

### 7B: Booking Feedback

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Success Container | Box | `#appointmentSuccess` | Hidden default. Shows confirmation details on successful booking |
| Confirmation Text | Text | `#appointmentConfirmation` | Multi-line confirmation: visit type, date/time, location, phone, reschedule info |
| Error Message | Text | `#appointmentError` | Hidden default. Shows validation/booking errors |

---

## SECTION 8: SHOWROOM ILLUSTRATION (below-fold, decorative)

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Showroom Scene | HtmlComponent | `#contactShowroomScene` | SVG showroom illustration. Populated by `contactIllustrations.js` |

---

## SECTION 9: SEO SCHEMA (hidden elements)

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Business Schema | HtmlComponent | `#contactSchemaHtml` | Hidden, 0×0, LocalBusiness JSON-LD injection via postMessage |
| Meta HTML | HtmlComponent | `#contactMetaHtml` | Hidden, 0×0, Open Graph / meta tag injection via postMessage |

---

## BUILD ORDER (recommended)

1. **Hero Skyline** — Section 1 (decorative border)
2. **Contact Form** — Section 2 (above-fold, most critical)
3. **Business Info** — Section 3 (above-fold)
4. **Business Hours** — Section 4
5. **Testimonials** — Section 5
6. **FAQ Link** — Section 6
7. **Appointment Booking** — Section 7 (complex form)
8. **Showroom Illustration** — Section 8 (decorative)
9. **SEO Schema** — Section 9 (hidden elements)

---

## DESIGN TOKENS (apply to all elements)

| Token | Value | Apply To |
|-------|-------|----------|
| Primary CTA | `#E8845C` (Coral) bg, white text | Submit buttons (Send Message, Book Visit) |
| Headings font | Playfair Display | Page title, section headings |
| Body font | Source Sans 3 | All body text, form labels, hours |
| Background | `#FAF7F2` (Off White) | Page background |
| Card background | `#FFFFFF` | Form containers, testimonial cards, hours card |
| Text color | `#3A2518` (Espresso) | All text |
| Error color | `#D32F2F` | Validation error text |
| Success color | `#388E3C` | Success confirmation text |
| Border radius | 8px | Cards, buttons, inputs |
| Input border | `#E8D5B7` (Sand) | Form input borders |
| Shadows | `rgba(58,37,24,0.08)` | Cards, form containers |
| Star color | `#E8845C` (Coral) | Testimonial star ratings |
| Open status | `#388E3C` (Green) | "Open Now" badge |
| Closed status | `#D32F2F` (Red) | "Closed" badge |
