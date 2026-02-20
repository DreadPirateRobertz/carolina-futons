# STORY-003 Create Test Suite for Style Quiz

## Summary
The `styleQuiz.web.js` module implements a product recommendation engine with scoring, collection matching, price filtering, and style keywords — all with zero test coverage. This is high-risk untested logic that directly affects product recommendations shown to customers.

## Acceptance Criteria
- [ ] `tests/styleQuiz.test.js` created with 10+ tests
- [ ] Test `getQuizRecommendations()` returns scored results
- [ ] Test collection intersection logic (room type + use combinations)
- [ ] Test price range filtering (budget ranges)
- [ ] Test style keyword matching in product names/descriptions
- [ ] Test fallback behavior when no products match quiz answers
- [ ] Test `getQuizOptions()` returns all quiz questions
- [ ] Test top-5 results sorting by score
- [ ] All existing tests still pass

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|-------------|
| `tests/styleQuiz.test.js` | CREATE | 10-12 tests covering scoring and recommendations |
| `tests/__mocks__/wix-data.js` | VERIFY | Seed Stores/Products for quiz queries |

## Technical Notes
- Quiz answers map to collections and budget ranges
- Scoring has multiple bonuses: collection match, price fit, style keywords, rating
- Uses `wixData.query('Stores/Products')` — mock already supports this
- Fixture products in `tests/fixtures/products.js` can be reused
- `getQuizOptions()` is synchronous — returns static question list

## Estimate
- Size: M (2-3 hours)
- Priority: P1
- Dependencies: none
