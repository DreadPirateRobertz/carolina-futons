# Story: Design Token Integration

**Author**: caesar
**Priority**: P1
**Status**: proposed

## Problem

`designTokens.js` exports a full design system (colors, typography, spacing, shadows) but 0 pages import it. Four pages hardcode hex values directly — Product Page (8), Category Page (9), Member Page (7), Thank You Page (3). This means color changes require find-and-replace across files, violating DRY and risking inconsistency.

## Approach

- Import `designTokens` into the 5 heaviest pages: Product Page, Category Page, Cart Page, Home, Member Page
- Replace all hardcoded hex color values (`#5B8FA8`, `#E8845C`, `#3A2518`, `#E8D5B7`, etc.) with token references (`colors.mountainBlue`, `colors.sunsetCoral`, etc.)
- Replace hardcoded shadow and transition values where present
- No visual changes — purely a code quality pass

## Acceptance Criteria

- [ ] Product Page imports designTokens and uses color tokens
- [ ] Category Page imports designTokens and uses color tokens
- [ ] Cart Page imports designTokens and uses color tokens
- [ ] Home Page imports designTokens and uses color tokens
- [ ] Member Page imports designTokens and uses color tokens
- [ ] Zero hardcoded hex values in the 5 target pages
- [ ] No visual regressions (same colors, just referenced by token)
- [ ] All tests pass
