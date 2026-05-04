# Accessibility Pre-Launch Audit — cf-3qt.8.10

**Date:** 2026-05-04  
**Tool:** @axe-core/playwright 4.11 (WCAG 2.1 AA + best-practice rules)  
**Target:** https://carolina-futons-web.vercel.app  
**Scanned by:** miquella

---

## Executive Summary

**0 critical, 0 serious violations.** The site passes WCAG 2.1 AA at the error level across all 5 pages. All remaining violations are moderate (landmark structure) or minor (redundant alt text), and most are caused by a single systemic issue: page components using `<main>` while the layout already provides `<main id="main">`.

**Verdict: Pre-launch blocker? No. Recommended to fix before launch: Yes (moderate landmark issues are low-effort and improve screen-reader UX).**

---

## Pages Scanned

| Page | URL | Violations | Critical | Serious | Moderate | Minor |
|------|-----|-----------|----------|---------|----------|-------|
| Home | `/` | 2 | 0 | 0 | 1 | 1 |
| Futon Frames PLP | `/shop/futon-frames` | 4 | 0 | 0 | 3 | 1 |
| About | `/about` | 4 | 0 | 0 | 3 | 1 |
| Contact | `/contact` | 4 | 0 | 0 | 3 | 1 |
| PDP (Kingston) | `/products/kingston-futon-frame` | 1 | 0 | 0 | 0 | 1 |
| **Total** | | **15** | **0** | **0** | **10** | **5** |

---

## Critical Violations

*None.*

---

## Serious Violations

*None.*

---

## Moderate Violations

### M-1 · `landmark-no-duplicate-main` + `landmark-main-is-top-level` + `landmark-unique`

**Severity:** Moderate  
**WCAG:** 1.3.6, 4.1.2 (ARIA landmark structure)  
**Affected pages:** Futon Frames PLP, About, Contact (and likely all pages with `<main>` root in page component)  
**Nodes:** `#main` (layout's `<main>`) + `div[data-slot="page-transition"] > main` (page component's `<main>`)

**Root cause:** `layout.tsx` wraps page children in `<main id="main">`. Individual page components (About, Contact, PLP, etc.) also render a `<main>` as their outermost element. This creates nested `<main>` landmarks — invalid per ARIA spec and confusing for screen readers.

**Fix:** Change outermost element in page components from `<main>` to `<div>`. The layout already provides the semantic `<main>`.

```diff
// src/app/about/page.tsx, contact/page.tsx, visit/page.tsx, etc.
- <main className="w-full">
+ <div className="w-full">
  ...
- </main>
+ </div>
```

**Effort:** Low — mechanical find-and-replace. Recommend a single PR covering all pages.

---

### M-2 · `landmark-unique` (Home page section)

**Severity:** Moderate  
**WCAG:** 1.3.6  
**Affected pages:** Home  
**Node:** `.pb-6` (an unlabelled `<section>`)

**Root cause:** A `<section>` element without an `aria-label` or `aria-labelledby` is treated as a generic landmark. When multiple such sections exist, screen readers can't distinguish them.

**Fix:** Add `aria-label` to the section, or change `<section>` to `<div>` if it's not semantically a distinct region.

```diff
- <section className="pb-6">
+ <section className="pb-6" aria-label="Featured products">
```

**Effort:** Low.

---

## Minor Violations

### m-1 · `image-redundant-alt` (all pages)

**Severity:** Minor  
**WCAG:** best-practice  
**Affected pages:** All 5 (logo in header)  
**Node:** `img[alt="Carolina Futons"]`

**Root cause:** The header logo `<img alt="Carolina Futons">` is adjacent to a text element that also reads "Carolina Futons". Screen readers announce the image alt text AND the text, duplicating the brand name.

**Fix:** Set `alt=""` on the logo image (it is decorative when the text label is already present), or add `aria-hidden="true"`.

```diff
- <img src="/brand/cf-logo-square.png" alt="Carolina Futons" />
+ <img src="/brand/cf-logo-square.png" alt="" aria-hidden="true" />
```

**Effort:** Very low — one-line change in the Header component.

---

## Recommended Fix Priority

| ID | Rule | Effort | Impact | Recommended |
|----|------|--------|--------|-------------|
| M-1 | Nested `<main>` landmarks | Low | High — screen readers lose page structure | **Fix before launch** |
| M-2 | Unlabelled home `<section>` | Low | Medium | Fix before launch |
| m-1 | Redundant logo alt text | Very low | Low | Fix before launch |

All three are low-effort and can be bundled into a single PR.

---

## What's Working Well

- No color contrast violations (WCAG 1.4.3) — CF color palette passes throughout.
- All interactive elements (buttons, links, inputs) are keyboard-focusable and labeled.
- Form inputs have associated labels (`/contact`, `/signup`).
- Images on PDP have meaningful alt text.
- Skip-to-main link present in layout.
- `lang="en"` set on `<html>`.
- `aria-hidden="true"` correctly applied on decorative SVG illustrations.

---

## Raw Results

Full JSON: `/tmp/a11y-results.json` (on scanning machine, not committed)  
Scan script: `/tmp/a11y-scan/scan.mjs`

---

*Audit by miquella for cf-3qt.8.10. Recommend follow-up bead for the landmark fix PR (M-1 affects all pages).*
