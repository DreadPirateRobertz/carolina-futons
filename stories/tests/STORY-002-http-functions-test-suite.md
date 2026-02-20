# STORY-002 Create Test Suite for HTTP Functions

## Summary
The `http-functions.js` module exports 5 HTTP endpoints (Google Shopping feed, Facebook catalog, Pinterest feed, sitemap, health) with zero test coverage. These feed endpoints are critical for marketing integrations and need regression protection.

## Acceptance Criteria
- [ ] `tests/httpFunctions.test.js` created with 10+ tests
- [ ] Test XML well-formedness for Google feed and sitemap
- [ ] Test TSV format for Facebook and Pinterest feeds
- [ ] Test `detectBrandFromProduct()` and `detectGoogleCategory()` helpers
- [ ] Test health endpoint returns 200 with status info
- [ ] Test error handling for empty product lists
- [ ] All existing tests still pass

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|-------------|
| `tests/httpFunctions.test.js` | CREATE | 10-15 tests for all 5 endpoints |
| `tests/__mocks__/wix-data.js` | VERIFY | Seed Products collection for feed tests |

## Technical Notes
- Functions use `ok()`, `serverError()` from `wix-http-functions` — need mock
- Google feed returns XML, Facebook/Pinterest return TSV
- Product data seeded via `__seed('Stores/Products', [...])` in wix-data mock
- `detectBrandFromProduct()` and `detectGoogleCategory()` are internal helpers — test via feed output
- Response headers need verification (Content-Type for XML vs TSV)

## Estimate
- Size: M (2-3 hours)
- Priority: P1
- Dependencies: none
