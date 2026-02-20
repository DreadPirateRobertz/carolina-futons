# STORY-006 Create Test Suite for Swatch Service

## Summary
The `swatchService.web.js` module has 4 exported functions with zero test coverage. These power the fabric swatch visualizer on the PDP and category grid swatch dots. The module uses advanced wix-data query features (`.or()`, `.contains()`, `.distinct()`, `.count()`) which have now been added to the wix-data mock.

## Acceptance Criteria
- [ ] `tests/swatchService.test.js` created with 10+ tests
- [ ] Test `getProductSwatches()` — returns swatches for a product, filters by color family
- [ ] Test `getAllSwatchFamilies()` — returns distinct color family values
- [ ] Test `getSwatchCount()` — returns count of available swatches for a product
- [ ] Test `getSwatchPreviewColors()` — returns limited preview color dots
- [ ] Test empty collection handling (returns [] or 0)
- [ ] Test the `.or()` logic: matches product-specific AND "all" availability swatches
- [ ] All 505 existing tests still pass

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|-------------|
| `tests/swatchService.test.js` | CREATE | 10-12 tests for all 4 functions |

## Technical Notes
- Mock infrastructure already done: `.or()`, `.contains()`, `.distinct()`, `.count()` added to wix-data mock
- Seed `FabricSwatches` collection with test swatches
- `.availableForProducts` field holds comma-separated product IDs or "all"
- `.contains()` is string substring match — `contains('availableForProducts', 'prod-1')` matches "prod-1,prod-2"
- Preview colors limited by `limit` param (default 4)
- Sort by `sortOrder` ascending

## Estimate
- Size: S (1-2 hours)
- Priority: P1
- Dependencies: wix-data mock already updated (committed)
