# STORY-004 Extract Safe Element Init Pattern for Page Files (REVISED)

## Problem
Page files use 543 try/catch blocks total. ~450 are silent catches wrapping optional `$w()` element access. This buries ~90 real error handlers (API calls, cart operations, form validation) in noise, making it impossible to distinguish expected "element missing" from actual bugs.

## Try/Catch Audit by File

| File | Total try/catch | Silent catches | Real error handling |
|------|-----------------|----------------|---------------------|
| Product Page.js | 136 | ~110 | ~26 |
| masterPage.js | 68 | ~62 | ~6 |
| Category Page.js | 66 | ~55 | ~11 |
| Member Page.js | 45 | ~38 | ~7 |
| Cart Page.js | 41 | ~35 | ~6 |
| Home.js | 35 | ~28 | ~7 |
| Side Cart.js | 33 | ~29 | ~4 |
| Thank You Page.js | 29 | ~25 | ~4 |
| Blog.js | 19 | ~13 | ~6 |
| Fullscreen Page.js | 13 | ~11 | ~2 |
| Contact.js | 12 | ~6 | ~6 |
| FAQ.js | 9 | ~8 | ~1 |
| Checkout.js | 8 | ~7 | ~1 |
| Others (8 files) | 29 | ~23 | ~6 |
| **TOTAL** | **543** | **~450** | **~93** |

## Approach
Create `src/public/safeInit.js` with two utilities:
```javascript
export function safeSelect(selector) {
  try { return $w(selector); } catch { return null; }
}
export function safeCall(fn) {
  try { fn(); } catch { /* element may not exist on this page */ }
}
```

Replace silent catches: `try { $w('#el').onClick(fn) } catch(e) {}` becomes `safeCall(() => $w('#el').onClick(fn))` or `const el = safeSelect('#el'); if (el) el.onClick(fn);`

## Acceptance Criteria
- [ ] `src/public/safeInit.js` created with `safeSelect()` and `safeCall()`
- [ ] `tests/safeInit.test.js` created with 5-6 tests
- [ ] Phase 1: Refactor `masterPage.js` — convert ~62 silent catches (keep 6 real handlers)
- [ ] Phase 2: Refactor `Product Page.js` — convert ~110 silent catches (keep 26 real handlers)
- [ ] Phase 3: Refactor `Category Page.js` — convert ~55 silent catches (keep 11 real handlers)
- [ ] No behavioral changes — all pages work identically
- [ ] All existing tests still pass

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|-------------|
| `src/public/safeInit.js` | CREATE | safeSelect(), safeCall() utilities |
| `tests/safeInit.test.js` | CREATE | 5-6 tests for utility functions |
| `src/pages/masterPage.js` | MODIFY | Convert ~62 silent catches |
| `src/pages/Product Page.js` | MODIFY | Convert ~110 silent catches |
| `src/pages/Category Page.js` | MODIFY | Convert ~55 silent catches |

## What Stays (Real Error Handlers — DO NOT Convert)
- API call catches with user-facing error messages (Contact.js form submit)
- Cart operation catches with quantity revert logic (Cart Page.js, Side Cart.js)
- Data fetch catches with fallback state (Product Page.js product load)
- Email/notification catches with retry or logging (Thank You Page.js)

## Estimate
- Size: L (6-8 hours across 3 phases)
- Priority: P2
- Dependencies: none
