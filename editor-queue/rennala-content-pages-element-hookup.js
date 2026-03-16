// TARGET: About, Contact, FAQ, Newsletter pages
// DESCRIPTION: Element hookup audit — comp-ID mapping + missing elements list
// AUTHOR: rennala
// DEPENDS: none
// PRIORITY: high (assigned by melania as CF-ph91)
//
// STATUS: This is a MAPPING DOCUMENT, not an executable script.
// Most elements need to be CREATED in the editor, not just nicknamed.
//
// ═══════════════════════════════════════════════════════════════════════
// PAGE 1: ABOUT (18 element IDs needed)
// ═══════════════════════════════════════════════════════════════════════
//
// EXISTING — need nickname assignment:
//   comp-lymseup9  text="ABOUT CAROLINA FUTONS"         → nickname: aboutTitle
//   comp-lymsmahj  text="HANDCRAFTED COMFORT SINCE 1991"→ nickname: aboutSubtitle
//   comp-lymsr708  text="Since 1991, Carolina Futons..." → (body text, no direct nickname match)
//
// The page currently has 3 static feature sections (OUR SHOWROOM, PREMIUM
// MATERIALS, QUALITY CRAFTSMANSHIP) but the code expects REPEATERS.
//
// MISSING — need creation in editor:
//   #brandStoryRepeater  — Repeater: brand story sections (heading + body + image)
//   #teamRepeater        — Repeater: team members (name + role + bio)
//   #teamGallery         — Gallery/Repeater: polaroid-style team photos
//   #timelineRepeater    — Repeater: business timeline milestones (year + title + desc)
//   #aboutAddress        — Text: showroom address
//   #aboutPhone          — Text: phone number
//   #aboutTodayHours     — Text: today's hours
//   #showroomFeatures    — Repeater: showroom feature list
//   #aboutDirectionsBtn  — Button: "Get Directions"
//   #aboutTestimonials   — Repeater: customer testimonials (quote + author + stars)
//   #aboutVisitTitle     — Text: "Visit Our Showroom" heading
//   #aboutVisitBody      — Text: visit CTA body copy
//   #aboutVisitBtn       — Button: "Get Directions"
//   #aboutBookBtn        — Button: "Book a Visit"
//   #aboutFaqLink        — Text/Link: FAQ page link
//   #aboutSchemaHtml     — HtmlComponent: hidden, for LD+JSON schema injection
//
// DECISION NEEDED: The existing static sections could be converted into a
// repeater (brandStoryRepeater), OR the code could be adapted to use static
// elements. Repeaters are more maintainable but require editor restructuring.
//
// ═══════════════════════════════════════════════════════════════════════
// PAGE 2: CONTACT (32 element IDs needed)
// ═══════════════════════════════════════════════════════════════════════
//
// PROBLEM: The page uses a Wix Forms app widget ("Contact us 1") with built-in
// form fields. The code expects individually-nicknamed custom elements like
// #contactName, #contactEmail, etc. Wix Forms fields can't be given Velo
// nicknames — they're controlled by the Forms app.
//
// OPTION A: Replace Wix Forms with custom input elements (Text Input, Text Box,
//           Button) and assign nicknames. More work, full Velo control.
// OPTION B: Keep Wix Forms for the contact form, adapt code to work with
//           onFormSubmit instead of custom onClick. Less editor work.
//
// EXISTING — need nickname assignment:
//   Heading "CONTACT US"         → (no code reference, page has its own)
//   Contact info text elements   → Need individual nicknames
//
// MISSING — form elements (if going OPTION A):
//   #contactName       — TextInput: visitor name
//   #contactEmail      — TextInput: visitor email
//   #contactPhone      — TextInput: visitor phone
//   #contactSubject    — Dropdown: message subject
//   #contactMessage    — TextBox: message body
//   #contactSubmit     — Button: submit form
//   #contactSuccess    — Text: success message (hidden)
//   #contactForm       — Box/Container: form wrapper
//   #contactError      — Text: error message (hidden)
//
// MISSING — business info:
//   #infoAddress       — Text: address
//   #infoPhone         — Text: phone number
//   #infoPhoneLink     — Link/Button: clickable phone
//   #directionsBtn     — Button: directions link
//   #contactFeatures   — Repeater: business features
//   #todayStatus       — Text: today's hours
//   #hoursRepeater     — Repeater: weekly hours (day + time)
//
// MISSING — testimonials section:
//   #contactTestimonials — Repeater: testimonials
//
// MISSING — appointment booking section:
//   #appointmentBookBtn      — Button: book appointment
//   #appointmentName         — TextInput
//   #appointmentEmail        — TextInput
//   #appointmentPhone        — TextInput
//   #appointmentVisitType    — Dropdown
//   #appointmentDate         — DatePicker
//   #appointmentTimeSlot     — Dropdown
//   #appointmentInterests    — CheckboxGroup
//   #appointmentError        — Text (hidden)
//   #appointmentConfirmation — Text (hidden)
//   #appointmentForm         — Box/Container
//   #appointmentSuccess      — Text (hidden)
//
// MISSING — schema/SEO:
//   #contactFaqLink    — Text/Link: FAQ link
//   #contactSchemaHtml — HtmlComponent: LD+JSON schema
//   #contactMetaHtml   — HtmlComponent: meta tags
//
// ═══════════════════════════════════════════════════════════════════════
// PAGE 3: FAQ (10 element IDs needed)
// ═══════════════════════════════════════════════════════════════════════
//
// PROBLEM: The page uses a Wix FAQ App widget with built-in accordion behavior
// and category tabs. The code expects custom repeaters with manual accordion
// expand/collapse logic.
//
// EXISTING elements (Wix FAQ widget — NOT individually nicknameable):
//   Heading "Frequently asked questions"    → Could be nicknamed faqTitle
//   Search input "Looking for something?"   → Could be nicknamed faqSearchInput
//   Category tabs (General, Products)       → Part of FAQ widget, not nicknameable
//   Accordion items                         → Part of FAQ widget, not nicknameable
//
// OPTION A: Replace Wix FAQ widget with custom repeaters. Full Velo control,
//           significant editor restructuring.
// OPTION B: Keep Wix FAQ widget, adapt code to use Wix FAQ APIs.
//           Less work but limited customization.
//
// MISSING — need creation:
//   #faqTitle            — Text: page title (may already exist as h1)
//   #faqSubtitle         — Text: subtitle
//   #faqCategoryRepeater — Repeater: category filter chips
//   #faqRepeater         — Repeater: FAQ items with accordion
//   #faqSearchInput      — TextInput: search/filter (one exists but may be part of widget)
//   #faqContactTitle     — Text: contact CTA heading
//   #faqContactBody      — Text: contact CTA body
//   #faqContactBtn       — Button: "Contact Us"
//   #faqPhoneBtn         — Button: phone link
//   #faqNoResults        — Text/Box: "No results" message (hidden)
//
// ═══════════════════════════════════════════════════════════════════════
// PAGE 4: NEWSLETTER (9 element IDs needed)
// ═══════════════════════════════════════════════════════════════════════
//
// PROBLEM: Newsletter page does NOT EXIST yet (returns 404).
// The entire page needs to be created in the editor.
//
// NEEDED — create page + all elements:
//   #newsletterHeroTitle    — Text: hero heading
//   #newsletterHeroSubtitle — Text: hero subtitle
//   #nlEmailInput           — TextInput: email address
//   #nlNameInput            — TextInput: subscriber name
//   #nlSubmitBtn            — Button: subscribe
//   #nlSuccessMessage       — Text: success message (hidden)
//   #nlErrorMessage         — Text: error message (hidden)
//   #benefitsRepeater       — Repeater: newsletter benefits list
//   #nlSocialTitle          — Text: social links heading
//
// ═══════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════
//
// Page         | Code expects | Exist | Need create | Blockers
// -------------|-------------|-------|-------------|---------------------------
// About        |     18      |   2   |     16      | Static → repeater conversion
// Contact      |     32      |   ~3  |     ~29     | Wix Forms vs custom form
// FAQ          |     10      |   ~2  |     ~8      | Wix FAQ widget vs custom
// Newsletter   |      9      |   0   |      9      | Page doesn't exist
// -------------|-------------|-------|-------------|---------------------------
// TOTAL        |     69      |   ~7  |     ~62     |
//
// RECOMMENDATION: Start with About page — it has the most existing content
// and the fewest structural decisions. The comp-ID → nickname mapping for
// the 2 existing elements (aboutTitle, aboutSubtitle) can be done immediately.
// The repeater vs static decision should be made before creating other elements.
//
// For Contact and FAQ, the Wix Forms / FAQ App vs custom element decision
// fundamentally affects the approach. This needs a PM decision (melania).
//
// Newsletter page needs to be created from scratch in the editor.

(function(ds, doc) {
  return {
    status: 'planning',
    note: 'Mapping document — see comments for full audit. Needs PM decisions before execution.',
    pages: ['About', 'Contact', 'FAQ', 'Newsletter'],
    totalNeeded: 69,
    existingToNickname: 7,
    needCreation: 62,
    decisions: [
      'About: Convert static sections to repeaters, or adapt code to static elements?',
      'Contact: Replace Wix Forms with custom inputs, or adapt code to use Forms API?',
      'FAQ: Replace Wix FAQ widget with custom repeaters, or adapt code to FAQ APIs?',
      'Newsletter: Create new page from scratch?'
    ]
  };
})(ds, doc);
