# Form Input Consistency Audit — cf-76yz
**Date:** 2026-05-24  
**Auditor:** cfutons/crew/blaidd  
**Scope:** newsletter signup, /contact, /swatch-request, /style-quiz  
**Method:** Code analysis (`src/pages/*.js`, `src/styles/global.css`, `src/public/sharedTokens.js`) + existing QA screenshots  

---

## Summary Matrix

| Dimension | Newsletter | /contact | /swatch-request | /style-quiz email gate |
|---|---|---|---|---|
| Input min-height ≥44px | ❌ No CSS rule | ❌ No CSS rule | ❌ No CSS rule | ❌ No CSS rule |
| Focus ring | ✅ Global `*:focus-visible` | ✅ Global `*:focus-visible` | ✅ Global `*:focus-visible` | ✅ Global `*:focus-visible` |
| Focus ring color | ✅ `3px solid #3D6B80` | ✅ `3px solid #3D6B80` | ✅ `3px solid #3D6B80` | ✅ `3px solid #3D6B80` |
| Error granularity | ⚠️ Form-level only | ✅ Per-field | ⚠️ Form-level only | ✅ Single-field (OK) |
| Error red border on input | ⚠️ None (JS shows/hides text) | ⚠️ None (JS shows/hides text) | ⚠️ Wix native only | ⚠️ None |
| Visual field labels | ❌ Placeholder-only | ✅ Present in editor | ✅ Present in editor | ❌ ARIA-only |
| Success state | ⚠️ Inline text swap | ⚠️ Fade to panel | ⚠️ Expand section | ℹ️ Advance step (OK) |
| Submit button color | ✅ CF blue | ✅ CF blue | ✗ No CSS rule | ⚠️ No CSS rule |

---

## Form 1: Newsletter Signup (`/newsletter` + footer modal)

**Component:** `src/pages/Newsletter.js`  
**Screenshot:** `qa-forms-newsletter-failure-1280.png`

### Findings

**F1.1 — Input height below 44px tap target** (P3)  
The footer newsletter CSS sets `padding: 10px 14px` only. No `min-height: 44px`. On mobile 390, inputs measure ~36-38px (already confirmed by `cfw-433u` for /account+/signup on cfw side; same gap here in Wix Velo forms). `[data-hook="form-root"] input` only sets `font-size`, no height constraint.

**F1.2 — No visual labels on inputs** (P3)  
`#nlEmailInput` placeholder: "your@email.com". `#nlNameInput` placeholder: "First name (optional)". Only ARIA labels are set programmatically (`ariaLabel`). Once a user starts typing, context is lost. The dedicated `/newsletter` page form has the same gap as the footer modal. `cf-c6e3` covers the footer modal; this extends the same defect to the page-level form.

**F1.3 — Error state is form-level, not field-level** (P4)  
`#nlErrorMessage` is a single element shown for any validation error. No red border is applied to `#nlEmailInput` on error. Contrast: contact form uses `#contactNameError`, `#contactEmailError` per-field.

**F1.4 — No `--cf-error` CSS variable** (P4)  
The error color `#DC2626` lives in `sharedTokens.js` as `colors.error` but is NOT defined as a CSS variable (`--cf-error`). Error text elements can't reference it in CSS.

**F1.5 — Success state: inline text swap** (P4)  
On success, inputs + button are hidden and `#nlSuccessMessage` text is swapped in. No visual toast. Pattern differs from contact (fade-to-panel) and swatch (expand-section).

---

## Form 2: Contact (`/contact`)

**Component:** `src/pages/Contact.js`  
**Screenshots:** `qa-forms-contact-pre-1280.png`, `qa-forms-contact-pre-390.png`, `qa-forms-contact-invalid-1280.png`

### Findings

**F2.1 — Input height below 44px on mobile** (P3)  
`[data-hook="form-root"] input` in global.css sets only `font-size: 15px` (desktop) and `font-size: 16px` (mobile). No `min-height: 44px`. The 390px screenshot shows visually short inputs consistent with ~36-38px rendered height.

**F2.2 — Per-field error pattern is correct but no red border CSS** (P4)  
Contact has good per-field error elements (`#contactNameError`, `#contactEmailError`, `#contactMessageError`) — this is the gold-standard pattern. However, no CSS rule colors the error text with `--cf-error` nor adds a red border to the associated input. The JS shows/hides the text but the input itself has no visual error affordance beyond the text below it.

**F2.3 — Submit button: CF blue via CSS** ✅  
`[data-hook="form-root"] button[type="submit"]` sets `background-color: var(--cf-blue)`.

**F2.4 — Success: fade-to-panel** (P4)  
`#contactSuccess` fades in, `#contactForm` fades out. Non-toast. Differs from other forms.

---

## Form 3: Swatch Request (`/swatches`)

**Component:** `src/pages/Fabric Swatches.js`  
**Screenshots:** `qa-forms-swatch-failure-1280.png`, `qa-forms-swatch-invalid-1280.png`

### Findings

**F3.1 — Input height below 44px** (P3)  
No swatch-specific CSS rules for inputs. No `min-height: 44px` anywhere for swatch form fields (`#swatchFirstName`, `#swatchLastName`, `#swatchEmail`, `#swatchAddress1`, `#swatchCity`, `#swatchState`, `#swatchZip`).

**F3.2 — Error state: form-level only** (P3)  
`_validateForm()` returns a single string message; `#swatchFormError` is a single text element. The swatch form has ~7 required fields but a single error at the bottom. The `qa-forms-swatch-invalid-1280.png` screenshot shows Wix's native red borders on invalid fields (from HTML5 validation), but the JS validation path only updates `#swatchFormError` text. This creates a dual-path inconsistency: HTML5 native marks individual fields red; JS validation shows generic bottom message.

**F3.3 — Submit button styling** (P4)  
No CSS rule targets `#swatchSubmitBtn`. Button styling relies entirely on Wix editor theme defaults. Not guaranteed to match CF blue pattern.

**F3.4 — Success: expand section** (P4)  
`#swatchFormSuccess` expands inline. No toast. Third different success pattern across forms.

---

## Form 4: Style Quiz Email Gate (`/style-quiz`)

**Component:** `src/pages/Style Quiz.js`  
**Screenshot:** Not captured (requires completing 3 quiz steps to trigger gate)

### Findings

**F4.1 — Email input no min-height:44px** (P3)  
`#quizEmailInput` has no CSS height rule. Style quiz buttons (`[data-hook="quiz-next-button"]`) correctly have `min-height: 44px` but the email input does not.

**F4.2 — No visual label on email input** (P3)  
Email gate shows `#quizEmailInput` with no CSS-targeted label. Heading "Almost there! Enter your email..." serves as instructional copy but isn't a form label. ARIA label is set via JS (`ariaLabel`).

**F4.3 — Submit button: no explicit CF-blue CSS** (P4)  
`[data-hook="quiz-next-button"]` is styled correctly, but the email gate's `#quizEmailSubmitBtn` isn't targeted by the quiz CSS block. It falls through to Wix default.

**F4.4 — Error state: single-field, acceptable** ✅  
`#quizEmailError` expands with specific message. Single field, single error — correct pattern for this context.

---

## Global Issues (all 4 forms)

**G1 — No `--cf-error` CSS variable defined**  
`global.css` defines `--cf-blue`, `--cf-blue-dark`, `--cf-navy`, `--cf-white`, `--cf-gray-light` but NOT `--cf-error`. The `error: '#DC2626'` token exists in `sharedTokens.js`. Error state styling in CSS has no consistent token to reference.

**G2 — Focus ring: consistent and correct** ✅  
Global `*:focus-visible { outline: 3px solid var(--cf-blue-dark) !important; outline-offset: 2px !important; }` applies to all form inputs uniformly. Color matches `colors.mountainBlueDark`.

**G3 — Input min-height: universally missing from all 4 forms**  
The CSS enforces 44px on buttons, nav links, filter dropdowns, and other interactive elements, but NO `min-height: 44px` rule exists for the form inputs of these 4 forms. This affects all viewports; mobile is the priority failure (WCAG 2.5.5).

---

## Follow-on Beads Filed

| Bead | Priority | Title |
|---|---|---|
| see below | P3 | Form inputs missing min-height:44px — newsletter/contact/swatch/style-quiz |
| see below | P3 | Newsletter + style-quiz email gate: no visual field labels (placeholder-only) |
| see below | P4 | Error state CSS: no `--cf-error` variable + no red border on invalid inputs |
| see below | P4 | Success state: 3 different post-submit patterns across 4 forms |

---

## Reference Screenshots

- `qa-forms-contact-pre-1280.png` — Contact form desktop (input height visible)
- `qa-forms-contact-pre-390.png` — Contact form mobile (short inputs)
- `qa-forms-newsletter-failure-1280.png` — Newsletter modal (placeholder-only label)
- `qa-forms-swatch-invalid-1280.png` — Swatch form error state (Wix native vs JS error inconsistency)
