# STORY-008 Create Shared Error Handler Utility

## Problem
135 `console.error` calls scattered across backend and page files. ~80% of catch blocks are silent (`catch(e) {}`) or log-only (`catch(e) { console.error(e); }`). No centralized error handling means:
- No way to aggregate errors for monitoring
- Silent catches hide real bugs in production
- No consistent error format for admin dashboard
- No distinction between expected errors (element missing) and unexpected errors (API failure)

## Error Pattern Audit

| Pattern | Count | Location |
|---------|-------|----------|
| `catch(e) {}` (completely silent) | ~280 | All page files |
| `catch(e) { console.error(...) }` (log only) | ~135 | Backend + pages |
| `catch(e) { /* show user message */ }` | ~30 | Contact, Cart, Product |
| `catch(e) { /* fallback value */ }` | ~25 | Backend services |
| `catch(e) { throw new Error(...) }` | ~5 | emailService, fulfillment |

## Approach
Create `src/backend/utils/errorHandler.js` with:
```javascript
export function logError(context, error, { silent = false } = {}) {
  const entry = {
    context,
    message: error?.message || String(error),
    timestamp: new Date().toISOString(),
    stack: error?.stack,
  };
  if (!silent) console.error(`[${context}]`, entry.message);
  return entry;
}

export function withErrorBoundary(fn, context, fallback) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      logError(context, err);
      return typeof fallback === 'function' ? fallback(err) : fallback;
    }
  };
}
```

## Acceptance Criteria
- [ ] `src/backend/utils/errorHandler.js` created with `logError()` and `withErrorBoundary()`
- [ ] `tests/errorHandler.test.js` created with 8-10 tests
- [ ] `logError()` returns structured error object with context, message, timestamp
- [ ] `withErrorBoundary()` wraps async functions with consistent catch + fallback
- [ ] Refactor 3 backend modules to use `withErrorBoundary()` as proof of concept:
  - `cartRecovery.web.js` (5 catches)
  - `fulfillment.web.js` (5 catches)
  - `emailService.web.js` (3 catches)
- [ ] All existing tests still pass

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|-------------|
| `src/backend/utils/errorHandler.js` | CREATE | logError(), withErrorBoundary() |
| `tests/errorHandler.test.js` | CREATE | 8-10 tests |
| `src/backend/cartRecovery.web.js` | MODIFY | Use withErrorBoundary for webMethods |
| `src/backend/fulfillment.web.js` | MODIFY | Use withErrorBoundary for webMethods |
| `src/backend/emailService.web.js` | MODIFY | Use withErrorBoundary for webMethods |

## Technical Notes
- Do NOT touch page file catches in this story — those are covered by STORY-004 (safeInit)
- `withErrorBoundary` is for backend webMethods only (async functions with known fallback values)
- Keep `logError` simple — no external services. Future story can add Wix monitoring integration
- Backend catches that re-throw should NOT use withErrorBoundary (they need explicit handling)

## Estimate
- Size: M (3-4 hours)
- Priority: P2
- Dependencies: none (pairs well with STORY-004)
