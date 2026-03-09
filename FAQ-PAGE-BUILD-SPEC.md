# FAQ Page — Wix Studio Element Build Spec

**For:** radahn (Playwright builder)
**Page:** FAQ (ID: `v7lk1`)
**Total elements:** ~9
**Priority:** Build top-to-bottom. Simple page — single session.

---

## How to Use This Spec

1. Open FAQ page in Wix Studio editor
2. For each section below, add elements in order
3. Set element ID exactly as shown (case-sensitive)
4. Elements marked `collapsed` should be collapsed by default
5. Repeater children go INSIDE the repeater container

---

## SECTION 1: CATEGORY FILTERS (above-fold)

Horizontal row of category filter tabs.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Category Repeater | Repeater | `#faqCategoryRepeater` | ARIA role: "tablist", label: "FAQ category filters". Horizontal layout |
| → Category Label | Text | `#categoryLabel` | Repeater child: clickable category name. ARIA role: "tab", tabIndex: 0. Keyboard: Enter/Space to select |

---

## SECTION 2: FAQ SEARCH (above-fold)

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Search Input | Input | `#faqSearchInput` | Text input with placeholder "Search FAQs...". ARIA label: "Search frequently asked questions". Debounced 300ms keypress filter |

---

## SECTION 3: FAQ ACCORDION (main content)

Repeater of collapsible question/answer pairs.

| Element | Type | ID | Notes |
|---------|------|----|-------|
| FAQ Repeater | Repeater | `#faqRepeater` | Main FAQ list. Each item is a collapsible accordion |
| → Question | Text | `#faqQuestion` | Repeater child: clickable question text. ARIA role: "button", tabIndex: 0. Keyboard: Enter/Space to toggle |
| → Answer | Text | `#faqAnswer` | Repeater child: answer text. **Collapsed by default** |
| → Toggle | Text | `#faqToggle` | Repeater child: "+"/"\u2212" toggle indicator. ARIA: ariaExpanded=false initially. Keyboard: Enter/Space to toggle |

---

## SECTION 4: EMPTY STATE (conditional)

| Element | Type | ID | Notes |
|---------|------|----|-------|
| No Results | Text | `#faqNoResults` | "No FAQs match..." message. **Collapsed by default**. Shown when search/filter yields 0 results |

---

## SECTION 5: ACCESSIBILITY (hidden)

| Element | Type | ID | Notes |
|---------|------|----|-------|
| Live Region | Text | `#a11yLiveRegion` | Hidden, ARIA live region for screen reader announcements. Used by `announce($w, msg)` |

**Note:** The `a11yLiveRegion` element is shared across pages via `a11yHelpers.js`. It may already exist in the masterPage. Check before adding — if it's on masterPage, skip this element.

---

## BUILD ORDER (recommended)

1. **Category Filters** — Section 1 (above-fold)
2. **Search Input** — Section 2 (above-fold)
3. **FAQ Accordion** — Section 3 (main content)
4. **No Results** — Section 4 (conditional empty state)
5. **Live Region** — Section 5 (if not on masterPage)

---

## DESIGN TOKENS (apply to all elements)

| Token | Value | Apply To |
|-------|-------|----------|
| Headings font | Playfair Display | Page title ("Frequently Asked Questions") |
| Body font | Source Sans 3 | Questions, answers, category labels, search input |
| Background | `#FAF7F2` (Off White) | Page background |
| Card background | `#FFFFFF` | FAQ accordion items |
| Text color | `#3A2518` (Espresso) | All text |
| Active category | `#E8845C` (Coral) | Selected category tab highlight |
| Toggle color | `#5B8FA8` (Mountain Blue) | +/− toggle icon |
| Border radius | 8px | Accordion cards, search input |
| Shadows | `rgba(58,37,24,0.08)` | Accordion cards |
| Search border | `#E8D5B7` (Sand) | Search input border |
