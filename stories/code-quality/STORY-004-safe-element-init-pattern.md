# STORY-004 Extract Safe Element Init Pattern for Page Files

## Summary
The `masterPage.js` and other page files repeat a try/catch pattern 50+ times for element initialization (elements may not exist on all pages). Extracting a `safeInit()` utility would reduce duplication, improve readability, and make it easier to distinguish expected "element missing" catches from real errors.

## Acceptance Criteria
- [ ] `src/public/safeInit.js` created with utility functions
- [ ] `safeSelect(selector)` — returns element or null without throwing
- [ ] `safeCall(fn)` — wraps a function call in try/catch
- [ ] `masterPage.js` refactored to use the utilities (at least 10 conversions)
- [ ] No behavioral changes — all pages work identically
- [ ] All existing tests still pass

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|-------------|
| `src/public/safeInit.js` | CREATE | safeSelect(), safeCall() utilities |
| `src/pages/masterPage.js` | MODIFY | Replace repetitive try/catch with utility calls |
| `tests/safeInit.test.js` | CREATE | 5-6 tests for the utility functions |

## Technical Notes
- Pattern to replace: `try { $w('#el').onClick(...) } catch (e) { /* element may not exist */ }`
- Becomes: `const el = safeSelect('#el'); if (el) el.onClick(...);`
- Must handle Wix's `$w()` which throws when element doesn't exist
- Only convert the simple try/catch blocks, not complex ones with real error handling
- Page files that would benefit: masterPage, Home, Category Page, Product Page

## Estimate
- Size: M (3-4 hours)
- Priority: P2
- Dependencies: none
