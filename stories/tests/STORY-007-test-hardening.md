# STORY-007 Test Hardening: XSS Vectors, Sort Order, XML Escaping

## Problem
Three recently added test suites have specific coverage gaps identified in design session review:
1. **contactSubmissions.test.js** — needs XSS attack vector testing (script tags, event handlers, unicode bypasses)
2. **swatchService.test.js** — needs sort order verification (sortOrder ascending)
3. **googleMerchantFeed.test.js** — needs XML special character escaping tests (&, <, >, quotes in product names/descriptions)

## Approach
Add targeted tests to each existing test file. No source code changes needed unless tests reveal actual bugs.

## Acceptance Criteria
- [ ] contactSubmissions: Add 3-4 XSS vector tests (`<script>`, `onerror=`, `javascript:`, nested/encoded tags)
- [ ] contactSubmissions: Verify sanitize() strips all vectors from name, email, message fields
- [ ] swatchService: Add test verifying swatches return in `sortOrder` ascending order
- [ ] swatchService: Add test with unsorted seed data to confirm sort is applied
- [ ] googleMerchantFeed: Add test with `&`, `<`, `>`, `"` in product name/description
- [ ] googleMerchantFeed: Verify XML output is properly escaped (no raw `&` or `<` in output)
- [ ] googleMerchantFeed: Test product with empty description (edge case)
- [ ] All existing tests still pass

## Files to Modify
| File | Action | What Changes |
|------|--------|-------------|
| `tests/contactSubmissions.test.js` | MODIFY | Add 3-4 XSS vector tests |
| `tests/swatchService.test.js` | MODIFY | Add 2 sort order tests |
| `tests/googleMerchantFeed.test.js` | MODIFY | Add 3 XML escaping tests |

## Technical Notes
- XSS vectors to test: `<script>alert(1)</script>`, `" onerror="alert(1)`, `<img src=x onerror=alert(1)>`, `&#x3C;script&#x3E;`
- XML escaping: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`
- swatchService sort: seed data with sortOrder values out of order (3, 1, 2), verify returned in (1, 2, 3)
- If XML escaping is NOT implemented in the feed generator, this becomes a bug fix story

## Estimate
- Size: S (1-2 hours)
- Priority: P1
- Dependencies: none
