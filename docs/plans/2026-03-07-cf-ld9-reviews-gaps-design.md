# CF-ld9: Customer Reviews & Ratings — Gap Fill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fill 5 gaps in the existing reviews system — owner response display, star filter, flag/report UI, styleReviewCard wiring, and review aggregate SEO schema enrichment.

**Architecture:** All changes are additive to existing `ProductReviews.js` (frontend) and `reviewsService.web.js` (backend). No new files needed. TDD — tests first for each gap.

**Tech Stack:** Wix Velo ($w model), Vitest, existing design tokens from `designTokens.js`

---

### Task 1: Owner Response Display — Tests

**Files:**
- Modify: `tests/productReviews.test.js`

**Step 1: Add mock review data with ownerResponse**

In the existing `mockReviews` fixture (line 8), add `ownerResponse` fields:

```javascript
// Update rev-1 in mockReviews.reviews to include owner response
{ _id: 'rev-1', authorName: 'Sarah M.', rating: 5, title: 'Great', body: 'Solid build.', photos: [], verifiedPurchase: true, helpful: 3, date: 'January 15, 2026', ownerResponse: 'Thank you for your kind words!', ownerResponseDate: 'January 20, 2026' },
// rev-2 stays without ownerResponse (null/undefined)
```

**Step 2: Write failing tests for owner response rendering**

Add to the `repeater item bindings` describe block:

```javascript
it('shows #reviewOwnerResponse when owner response exists', () => {
  renderHandler($item, mockReviews.reviews[0]); // has ownerResponse
  expect($item('#reviewOwnerResponse').show).toHaveBeenCalled();
  expect($item('#reviewOwnerResponseText').text).toBe('Thank you for your kind words!');
});

it('shows #reviewOwnerResponseDate when owner response exists', () => {
  renderHandler($item, mockReviews.reviews[0]);
  expect($item('#reviewOwnerResponseDate').text).toBe('January 20, 2026');
});

it('hides #reviewOwnerResponse when no owner response', () => {
  renderHandler($item, mockReviews.reviews[1]); // no ownerResponse
  expect($item('#reviewOwnerResponse').hide).toHaveBeenCalled();
});

it('sets owner response ARIA label', () => {
  renderHandler($item, mockReviews.reviews[0]);
  expect($item('#reviewOwnerResponse').accessibility.ariaLabel).toBe('Store response');
});
```

**Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/productReviews.test.js --reporter=verbose 2>&1 | tail -20`
Expected: 4 new tests FAIL (ownerResponse not rendered in ProductReviews.js yet)

**Step 4: Commit failing tests**

```bash
git add tests/productReviews.test.js
git commit -m "test(cf-ld9): add failing tests for owner response display"
```

---

### Task 2: Owner Response Display — Implementation

**Files:**
- Modify: `src/public/ProductReviews.js` (in `renderReviews` → `onItemReady` callback, ~line 130-164)

**Step 1: Add owner response rendering in onItemReady**

After the review photos block (~line 163), before the closing of onItemReady:

```javascript
// Owner response
try {
  if (itemData.ownerResponse) {
    $item('#reviewOwnerResponse').show();
    try { $item('#reviewOwnerResponse').accessibility.ariaLabel = 'Store response'; } catch (e) {}
    try { $item('#reviewOwnerResponseText').text = itemData.ownerResponse; } catch (e) {}
    try { $item('#reviewOwnerResponseDate').text = itemData.ownerResponseDate || ''; } catch (e) {}
  } else {
    $item('#reviewOwnerResponse').hide();
  }
} catch (e) {}
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/productReviews.test.js --reporter=verbose 2>&1 | tail -20`
Expected: All tests PASS including 4 new owner response tests

**Step 3: Commit**

```bash
git add src/public/ProductReviews.js
git commit -m "feat(cf-ld9): render owner response in review cards"
```

---

### Task 3: Star Filter — Backend Change + Tests

**Files:**
- Modify: `src/backend/reviewsService.web.js` (`getProductReviews`, ~line 47-84)
- Modify: `tests/reviewsService.test.js`

**Step 1: Write failing backend test**

Add to `tests/reviewsService.test.js`:

```javascript
describe('getProductReviews filterStars', () => {
  it('filters reviews by star rating when filterStars provided', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod-1', rating: 5, status: 'approved', body: 'Great', authorName: 'A' },
      { _id: 'r2', productId: 'prod-1', rating: 3, status: 'approved', body: 'OK', authorName: 'B' },
      { _id: 'r3', productId: 'prod-1', rating: 5, status: 'approved', body: 'Awesome', authorName: 'C' },
    ]);
    const { getProductReviews } = await import('../src/backend/reviewsService.web.js');
    const result = await getProductReviews('prod-1', { filterStars: 5 });
    expect(result.reviews.every(r => r.rating === 5)).toBe(true);
    expect(result.total).toBe(2);
  });

  it('returns all reviews when filterStars not provided', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod-1', rating: 5, status: 'approved', body: 'Great', authorName: 'A' },
      { _id: 'r2', productId: 'prod-1', rating: 3, status: 'approved', body: 'OK', authorName: 'B' },
    ]);
    const { getProductReviews } = await import('../src/backend/reviewsService.web.js');
    const result = await getProductReviews('prod-1', {});
    expect(result.total).toBe(2);
  });

  it('ignores invalid filterStars values', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod-1', rating: 5, status: 'approved', body: 'Great', authorName: 'A' },
    ]);
    const { getProductReviews } = await import('../src/backend/reviewsService.web.js');
    const result = await getProductReviews('prod-1', { filterStars: 0 });
    expect(result.total).toBe(1); // 0 is invalid, should return all
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/reviewsService.test.js --reporter=verbose 2>&1 | tail -20`

**Step 3: Add filterStars to getProductReviews**

In `src/backend/reviewsService.web.js`, modify `getProductReviews` (~line 49-84):

```javascript
async (productId, options = {}) => {
    const pid = validateId(productId);
    if (!pid) return { reviews: [], total: 0, page: 0, pageSize: PAGE_SIZE };

    const { sort = 'newest', page = 0, filterStars } = options;

    let query = wixData.query(COLLECTION)
      .eq('productId', pid)
      .eq('status', 'approved');

    // Star filter
    if (filterStars >= 1 && filterStars <= 5) {
      query = query.eq('rating', Math.round(filterStars));
    }

    // ... rest unchanged (sort switch, pagination)
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/reviewsService.test.js --reporter=verbose 2>&1 | tail -20`

**Step 5: Commit**

```bash
git add src/backend/reviewsService.web.js tests/reviewsService.test.js
git commit -m "feat(cf-ld9): add filterStars param to getProductReviews"
```

---

### Task 4: Star Filter — Frontend Tests

**Files:**
- Modify: `tests/productReviews.test.js`

**Step 1: Write failing frontend tests for star filter**

Add new describe block:

```javascript
describe('star filter', () => {
  it('sets up star filter buttons for 5 through 1', async () => {
    await initProductReviews($w, state);
    for (let star = 1; star <= 5; star++) {
      expect($w(`#starFilter${star}`).onClick).toHaveBeenCalled();
    }
  });

  it('sets up "All" filter button', async () => {
    await initProductReviews($w, state);
    expect($w('#starFilterAll').onClick).toHaveBeenCalled();
  });

  it('re-fetches reviews with filterStars on star click', async () => {
    const { getProductReviews } = await import('backend/reviewsService.web');
    await initProductReviews($w, state);

    const clickHandler = $w('#starFilter5').onClick.mock.calls[0][0];
    await clickHandler();

    expect(getProductReviews).toHaveBeenCalledWith(
      state.product._id,
      expect.objectContaining({ filterStars: 5, page: 0 })
    );
  });

  it('clears filter on "All" click', async () => {
    const { getProductReviews } = await import('backend/reviewsService.web');
    await initProductReviews($w, state);

    // First filter to 5 stars
    const filter5Handler = $w('#starFilter5').onClick.mock.calls[0][0];
    await filter5Handler();

    // Then click All
    const allHandler = $w('#starFilterAll').onClick.mock.calls[0][0];
    await allHandler();

    expect(getProductReviews).toHaveBeenLastCalledWith(
      state.product._id,
      expect.objectContaining({ page: 0 })
    );
    // filterStars should be undefined/null
    const lastCall = getProductReviews.mock.calls[getProductReviews.mock.calls.length - 1];
    expect(lastCall[1].filterStars).toBeUndefined();
  });

  it('resets page to 0 when filtering', async () => {
    const { getProductReviews } = await import('backend/reviewsService.web');
    getProductReviews.mockResolvedValue({ reviews: mockReviews.reviews, total: 25, page: 0, pageSize: 10 });

    await initProductReviews($w, state);

    // Navigate to page 1
    const nextHandler = $w('#reviewsNextBtn').onClick.mock.calls[0][0];
    await nextHandler();

    // Filter by 4 stars
    const filter4Handler = $w('#starFilter4').onClick.mock.calls[0][0];
    await filter4Handler();

    expect(getProductReviews).toHaveBeenLastCalledWith(
      state.product._id,
      expect.objectContaining({ filterStars: 4, page: 0 })
    );
  });

  it('sets ARIA labels on star filter buttons', async () => {
    await initProductReviews($w, state);
    expect($w('#starFilter5').accessibility.ariaLabel).toBe('Show 5 star reviews');
    expect($w('#starFilterAll').accessibility.ariaLabel).toBe('Show all reviews');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/productReviews.test.js --reporter=verbose 2>&1 | tail -20`

**Step 3: Commit failing tests**

```bash
git add tests/productReviews.test.js
git commit -m "test(cf-ld9): add failing tests for star filter UI"
```

---

### Task 5: Star Filter — Frontend Implementation

**Files:**
- Modify: `src/public/ProductReviews.js`

**Step 1: Add star filter state and init function**

After `initHelpfulVoting($w);` (~line 56), add:

```javascript
// Star filter
initStarFilter($w, state, getProductReviews);
```

Add new function before the Helpful Voting section:

```javascript
// ── Star Filter ──────────────────────────────────────────────────────

function initStarFilter($w, state, getProductReviews) {
  // "All" button
  try {
    const allBtn = $w('#starFilterAll');
    if (allBtn) {
      try { allBtn.accessibility.ariaLabel = 'Show all reviews'; } catch (e) {}
      allBtn.onClick(async () => {
        state.reviewFilterStars = undefined;
        state.reviewPage = 0;
        const result = await getProductReviews(state.product._id, {
          sort: state.reviewSort, page: 0,
        });
        renderReviews($w, result);
        updatePaginationState($w, state, result);
      });
    }
  } catch (e) {}

  // Star buttons 1-5
  for (let star = 1; star <= 5; star++) {
    try {
      const btn = $w(`#starFilter${star}`);
      if (!btn) continue;
      try { btn.accessibility.ariaLabel = `Show ${star} star reviews`; } catch (e) {}
      btn.onClick(async () => {
        state.reviewFilterStars = star;
        state.reviewPage = 0;
        const result = await getProductReviews(state.product._id, {
          sort: state.reviewSort, page: 0, filterStars: star,
        });
        renderReviews($w, result);
        updatePaginationState($w, state, result);
      });
    } catch (e) {}
  }
}
```

**Step 2: Update sort dropdown onChange to preserve filterStars**

In `initSortDropdown`, update the onChange handler (~line 189) to include filterStars:

```javascript
const result = await getProductReviews(state.product._id, {
  sort: state.reviewSort, page: 0, filterStars: state.reviewFilterStars,
});
```

**Step 3: Update pagination to preserve filterStars**

In `initPagination`, update both next/prev onClick handlers to include filterStars:

```javascript
// In next button handler:
const result = await getProductReviews(state.product._id, {
  sort: state.reviewSort, page: state.reviewPage, filterStars: state.reviewFilterStars,
});

// Same for prev button handler
```

**Step 4: Add filterStars reset in initProductReviews**

After `state.reviewPage = DEFAULT_PAGE;` (~line 27), add:

```javascript
state.reviewFilterStars = undefined;
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/productReviews.test.js --reporter=verbose 2>&1 | tail -20`

**Step 6: Commit**

```bash
git add src/public/ProductReviews.js
git commit -m "feat(cf-ld9): add star filter UI with 1-5 star + All buttons"
```

---

### Task 6: Flag/Report — Tests

**Files:**
- Modify: `tests/productReviews.test.js`

**Step 1: Add flagReview to backend mock**

Update the `vi.mock('backend/reviewsService.web')` block to include:

```javascript
flagReview: vi.fn(async () => ({ success: true })),
```

**Step 2: Write failing tests**

Add new describe block:

```javascript
describe('flag/report review', () => {
  let $item;
  let renderHandler;

  beforeEach(async () => {
    await initProductReviews($w, state);
    const repeater = $w('#reviewsRepeater');
    renderHandler = repeater.onItemReady.mock.calls[0][0];
    $item = create$w();
  });

  it('sets up report button on each review', () => {
    renderHandler($item, mockReviews.reviews[0]);
    expect($item('#reviewReportBtn').onClick).toHaveBeenCalled();
  });

  it('shows reason dropdown on report click', () => {
    renderHandler($item, mockReviews.reviews[0]);
    const clickHandler = $item('#reviewReportBtn').onClick.mock.calls[0][0];
    clickHandler();
    expect($item('#reviewReportDropdown').show).toHaveBeenCalled();
  });

  it('calls flagReview with reason on dropdown change', async () => {
    const { flagReview } = await import('backend/reviewsService.web');
    renderHandler($item, mockReviews.reviews[0]);

    const clickHandler = $item('#reviewReportBtn').onClick.mock.calls[0][0];
    clickHandler();

    $item('#reviewReportDropdown').value = 'spam';
    const changeHandler = $item('#reviewReportDropdown').onChange.mock.calls[0][0];
    await changeHandler();

    expect(flagReview).toHaveBeenCalledWith('rev-1', 'spam');
  });

  it('disables report button after successful flag', async () => {
    renderHandler($item, mockReviews.reviews[0]);

    const clickHandler = $item('#reviewReportBtn').onClick.mock.calls[0][0];
    clickHandler();

    $item('#reviewReportDropdown').value = 'offensive';
    const changeHandler = $item('#reviewReportDropdown').onChange.mock.calls[0][0];
    await changeHandler();

    expect($item('#reviewReportBtn').disable).toHaveBeenCalled();
  });

  it('shows confirmation text after flagging', async () => {
    renderHandler($item, mockReviews.reviews[0]);

    const clickHandler = $item('#reviewReportBtn').onClick.mock.calls[0][0];
    clickHandler();

    $item('#reviewReportDropdown').value = 'fake';
    const changeHandler = $item('#reviewReportDropdown').onChange.mock.calls[0][0];
    await changeHandler();

    expect($item('#reviewReportBtn').label).toBe('Reported');
  });

  it('sets ARIA label on report button', () => {
    renderHandler($item, mockReviews.reviews[0]);
    expect($item('#reviewReportBtn').accessibility.ariaLabel).toBe('Report this review');
  });

  it('handles flag failure gracefully', async () => {
    const { flagReview } = await import('backend/reviewsService.web');
    flagReview.mockResolvedValueOnce({ success: false, error: 'Failed' });

    renderHandler($item, mockReviews.reviews[0]);

    const clickHandler = $item('#reviewReportBtn').onClick.mock.calls[0][0];
    clickHandler();

    $item('#reviewReportDropdown').value = 'spam';
    const changeHandler = $item('#reviewReportDropdown').onChange.mock.calls[0][0];
    await changeHandler();

    // Should NOT disable button on failure
    expect($item('#reviewReportBtn').disable).not.toHaveBeenCalled();
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/productReviews.test.js --reporter=verbose 2>&1 | tail -20`

**Step 4: Commit failing tests**

```bash
git add tests/productReviews.test.js
git commit -m "test(cf-ld9): add failing tests for flag/report button"
```

---

### Task 7: Flag/Report — Implementation

**Files:**
- Modify: `src/public/ProductReviews.js` (in `renderReviews` → `onItemReady`, after owner response block)

**Step 1: Add flag/report UI in onItemReady**

```javascript
// Report button
try {
  const reportBtn = $item('#reviewReportBtn');
  if (reportBtn) {
    try { reportBtn.accessibility.ariaLabel = 'Report this review'; } catch (e) {}
    reportBtn.onClick(() => {
      try {
        const dropdown = $item('#reviewReportDropdown');
        if (dropdown) {
          dropdown.options = [
            { label: 'Spam', value: 'spam' },
            { label: 'Offensive', value: 'offensive' },
            { label: 'Fake review', value: 'fake' },
            { label: 'Other', value: 'other' },
          ];
          dropdown.show();
          dropdown.onChange(async () => {
            try {
              const { flagReview } = await import('backend/reviewsService.web');
              const result = await flagReview(itemData._id, dropdown.value);
              if (result.success) {
                reportBtn.disable();
                reportBtn.label = 'Reported';
                try { dropdown.hide(); } catch (e) {}
              }
            } catch (e) {}
          });
        }
      } catch (e) {}
    });
  }
} catch (e) {}
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/productReviews.test.js --reporter=verbose 2>&1 | tail -20`

**Step 3: Commit**

```bash
git add src/public/ProductReviews.js
git commit -m "feat(cf-ld9): add flag/report button with reason dropdown"
```

---

### Task 8: styleReviewCard Integration — Test + Implementation

**Files:**
- Modify: `tests/productReviews.test.js`
- Modify: `src/public/ProductReviews.js`

**Step 1: Write failing test**

Add to `repeater item bindings` describe block:

```javascript
it('calls styleReviewCard on each review item container', () => {
  const { styleReviewCard } = require('public/ProductPagePolish.js');
  renderHandler($item, mockReviews.reviews[0]);
  expect(styleReviewCard).toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/productReviews.test.js -t "calls styleReviewCard" --reporter=verbose 2>&1 | tail -10`

**Step 3: Add styleReviewCard call in onItemReady**

In `renderReviews()` `onItemReady` callback, at the beginning (~line 131):

```javascript
try { styleReviewCard($item('#reviewCard')); } catch (e) {}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/productReviews.test.js -t "calls styleReviewCard" --reporter=verbose 2>&1 | tail -10`

**Step 5: Commit**

```bash
git add src/public/ProductReviews.js tests/productReviews.test.js
git commit -m "feat(cf-ld9): wire styleReviewCard for brand-token card styling"
```

---

### Task 9: Review SEO Schema Enrichment — Tests

**Files:**
- Modify: `tests/productReviews.test.js`

**Step 1: Write failing tests for schema injection**

Add new describe block:

```javascript
describe('review schema markup', () => {
  it('injects JSON-LD AggregateRating into #reviewSchemaMarkup', async () => {
    await initProductReviews($w, state);
    const schemaEl = $w('#reviewSchemaMarkup');
    expect(schemaEl.postMessage).toHaveBeenCalled();
  });

  it('includes correct aggregate values in schema', async () => {
    await initProductReviews($w, state);
    const schemaEl = $w('#reviewSchemaMarkup');
    const schemaArg = schemaEl.postMessage.mock.calls[0][0];
    expect(schemaArg).toContain('"ratingValue":4.5');
    expect(schemaArg).toContain('"reviewCount":12');
    expect(schemaArg).toContain('"AggregateRating"');
  });

  it('skips schema when no reviews', async () => {
    const { getAggregateRating } = await import('backend/reviewsService.web');
    getAggregateRating.mockResolvedValueOnce({ average: 0, total: 0, breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });

    await initProductReviews($w, state);
    const schemaEl = $w('#reviewSchemaMarkup');
    expect(schemaEl.postMessage).not.toHaveBeenCalled();
  });
});
```

Note: `createMockElement` already includes a `postMessage` mock-able method. If not, add `postMessage: vi.fn()` to `createMockElement`.

**Step 2: Verify createMockElement has postMessage**

Check existing mock — if not present, add `postMessage: vi.fn()` to `createMockElement`.

**Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/productReviews.test.js -t "review schema" --reporter=verbose 2>&1 | tail -10`

**Step 4: Commit failing tests**

```bash
git add tests/productReviews.test.js
git commit -m "test(cf-ld9): add failing tests for review schema markup"
```

---

### Task 10: Review SEO Schema Enrichment — Implementation

**Files:**
- Modify: `src/public/ProductReviews.js`

**Step 1: Add schema injection function**

Add new function:

```javascript
// ── Review Schema Markup ─────────────────────────────────────────────

function injectReviewSchema($w, aggregate, product) {
  if (!aggregate || aggregate.total === 0) return;
  try {
    const schema = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product?.name || '',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: aggregate.average,
        bestRating: 5,
        worstRating: 1,
        reviewCount: aggregate.total,
      },
    });
    const el = $w('#reviewSchemaMarkup');
    if (el) el.postMessage(schema);
  } catch (e) {}
}
```

**Step 2: Call it in initProductReviews**

After `renderAggregate($w, aggregate);` (~line 41), add:

```javascript
// Inject review schema for SEO
injectReviewSchema($w, aggregate, state.product);
```

**Step 3: Run tests to verify they pass**

Run: `npx vitest run tests/productReviews.test.js --reporter=verbose 2>&1 | tail -20`

**Step 4: Run full test suite**

Run: `npx vitest run 2>&1 | tail -10`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/public/ProductReviews.js
git commit -m "feat(cf-ld9): inject AggregateRating JSON-LD schema for SEO"
```

---

### Task 11: Final Integration + Branch + PR

**Step 1: Create feature branch**

```bash
git checkout -b cf-ld9-reviews-gaps
```

Note: If already on feature branch, skip this.

**Step 2: Run full test suite**

Run: `npx vitest run 2>&1 | tail -10`
Expected: All tests pass

**Step 3: Push and create PR**

```bash
git push -u origin cf-ld9-reviews-gaps
gh pr create --title "feat(cf-ld9): reviews gaps — owner response, star filter, flag, styling, SEO" --body "$(cat <<'EOF'
## Summary
- Owner response display in review cards (show/hide with store response text + date)
- Star filter UI (1-5 star buttons + All, wired to backend filterStars)
- Flag/report button with reason dropdown (spam/offensive/fake/other)
- styleReviewCard integration for brand-token card styling
- AggregateRating JSON-LD schema injection for SEO rich snippets

## Test plan
- [ ] Owner response shows when present, hides when absent
- [ ] Star filter re-fetches reviews by rating, resets page
- [ ] Flag button submits reason, disables after success
- [ ] styleReviewCard called per review item
- [ ] JSON-LD schema has correct aggregate values, skipped when no reviews
- [ ] All existing tests still pass
- [ ] SPA state-bleed: filterStars resets on product navigation

## Bead
CF-ld9

Generated with Claude Code
EOF
)"
```
