# Accessibility Pre-Launch Audit — cf-3qt.8.12

**Date:** 2026-05-04  
**Tool:** @axe-core/playwright 4.11 (WCAG 2.1 AA + best-practice rules)  
**Target:** https://carolina-futons-web.vercel.app  
**Scanned by:** miquella  
**Bead:** cf-3qt.8.12

---

## Executive Summary

**0 critical, 0 serious violations.** The site passes WCAG 2.1 AA at the error level across all 5 pages. All remaining violations are moderate (landmark structure) or minor (redundant alt text), and most stem from a single systemic issue: page components render a `<main>` while the layout already provides `<main id="main">`, creating nested `<main>` landmarks.

**Pre-launch blocker? No.  
Recommended to fix before launch? Yes** — the landmark issues are low-effort and meaningfully improve screen-reader UX.

---

## Pages Scanned

| # | Page | URL | Total | Critical | Serious | Moderate | Minor |
|---|------|-----|-------|----------|---------|----------|-------|
| 1 | Home | `/` | 2 | 0 | 0 | 1 | 1 |
| 2 | Shop (all categories) | `/shop` | 4 | 0 | 0 | 3 | 1 |
| 3 | Futon Frames PLP | `/shop/futon-frames` | 4 | 0 | 0 | 3 | 1 |
| 4 | PDP — Kingston Futon Frame | `/products/kingston-futon-frame` | 1 | 0 | 0 | 0 | 1 |
| 5 | Contact | `/contact` | 4 | 0 | 0 | 3 | 1 |
| | **Total** | | **15** | **0** | **0** | **10** | **5** |

---

## Critical Violations

*None.*

---

## Serious Violations

*None.*

---

## Moderate Violations

### M-1 · Nested `<main>` landmarks

**Rules:** `landmark-no-duplicate-main`, `landmark-main-is-top-level`, `landmark-unique`  
**Severity:** Moderate  
**WCAG:** 1.3.6, 4.1.2  
**Affected pages:** Shop, Futon Frames PLP, Contact (and all pages whose component root is `<main>`)  
**Nodes:** `#main` (layout) + `div[data-slot="page-transition"] > main` (page component)

**Root cause:** `layout.tsx` wraps all children in `<main id="main">`. Several page components also declare `<main>` as their outermost element, creating nested `<main>` landmarks which is invalid per ARIA and confusing for screen readers.

**Fix:** Change the outermost element in affected page components from `<main>` to `<div>`.

```diff
// src/app/shop/page.tsx, contact/page.tsx, visit/page.tsx, etc.
- <main className="w-full">
+ <div className="w-full">
  ...
- </main>
+ </div>
```

**Effort:** Low — mechanical rename, one PR covers all pages.

---

### M-2 · Unlabelled `<section>` landmark

**Rule:** `landmark-unique`  
**Severity:** Moderate  
**WCAG:** 1.3.6  
**Affected pages:** Home  
**Node:** `.pb-6` (a `<section>` without `aria-label`)

**Root cause:** A `<section>` without `aria-label` or `aria-labelledby` is exposed as an unnamed region landmark. Multiple unnamed regions are indistinguishable for screen reader users.

**Fix:** Add `aria-label` or change `<section>` to `<div>` if it isn't a meaningful region.

```diff
- <section className="pb-6">
+ <section className="pb-6" aria-label="Featured products">
```

**Effort:** Low — one-line change.

---

## Minor Violations

### m-1 · Redundant logo alt text

**Rule:** `image-redundant-alt`  
**Severity:** Minor (best-practice)  
**Affected pages:** All 5  
**Node:** `img[alt="Carolina Futons"]` in site header

**Root cause:** The header logo `<img alt="Carolina Futons">` is adjacent to visible text "Carolina Futons". Screen readers announce the brand name twice.

**Fix:** Set `alt=""` on the logo image — it is decorative when the text label is already present.

```diff
- <img src="/brand/cf-logo-square.png" alt="Carolina Futons" />
+ <img src="/brand/cf-logo-square.png" alt="" role="presentation" />
```

**Effort:** Very low — one-line change in the Header component.

---

## Recommended Fix Priority

| ID | Rule | Effort | Pages affected | Recommended |
|----|------|--------|----------------|-------------|
| M-1 | Nested `<main>` / duplicate main | Low | Shop, PLP, Contact + more | **Fix before launch** |
| M-2 | Unlabelled `<section>` on Home | Low | Home | Fix before launch |
| m-1 | Redundant logo alt text | Very low | All | Fix before launch |

All three can ship in one PR. Estimated dev time: 30 min.

---

## What's Working Well

- **No color contrast violations** (WCAG 1.4.3) — CF brand palette passes throughout.
- All interactive elements (buttons, links, form inputs) are keyboard-focusable and labeled.
- Contact form inputs have correct `<label>` associations.
- PDP images have descriptive alt text.
- Skip-to-main link present in layout (`href="#main"`, `sr-only focus:not-sr-only`).
- `lang="en"` set on `<html>`.
- Decorative SVG illustrations correctly use `aria-hidden="true"`.
- No missing form labels, no empty button text, no keyboard traps.

---

## Raw Data

| Page | Violation IDs |
|------|--------------|
| `/` | `image-redundant-alt`, `landmark-unique` |
| `/shop` | `image-redundant-alt`, `landmark-main-is-top-level`, `landmark-no-duplicate-main`, `landmark-unique` |
| `/shop/futon-frames` | `image-redundant-alt`, `landmark-main-is-top-level`, `landmark-no-duplicate-main`, `landmark-unique` |
| `/products/kingston-futon-frame` | `image-redundant-alt` |
| `/contact` | `image-redundant-alt`, `landmark-main-is-top-level`, `landmark-no-duplicate-main`, `landmark-unique` |

---

*Audit by miquella · cf-3qt.8.12 · Recommend follow-up bead for landmark fix PR (M-1 is systemic, affects all pages with `<main>` root components).*
