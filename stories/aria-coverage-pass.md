# Story: ARIA Coverage Pass — Remaining Pages

**Author**: caesar
**Priority**: P1
**Status**: proposed

## Problem

Only 5 of 21 pages have ARIA labels (Product, Category, Cart, Side Cart, Checkout — added during UX audits). The remaining 16 pages have zero accessibility attributes. Notable gaps: Home (highest traffic), Blog, FAQ, Contact, About, Member Page, and ironically the Accessibility Statement page itself.

## Approach

- Add ARIA labels to interactive elements (buttons, links, inputs, toggles, modals) on all remaining pages
- Priority order: Home, Member Page, Blog, FAQ, Contact, About, then remaining utility pages
- Follow the established pattern: `try { element.accessibility.ariaLabel = '...'; } catch (e) {}` for graceful degradation
- Add `aria-expanded` to any collapsible/accordion sections
- Add `role` attributes where semantic HTML isn't sufficient (e.g., nav landmarks)

## Acceptance Criteria

- [ ] Home Page has ARIA labels on all interactive elements
- [ ] Member Page has ARIA labels
- [ ] Blog Page has ARIA labels
- [ ] FAQ Page has ARIA labels
- [ ] Contact Page has ARIA labels
- [ ] About Page has ARIA labels
- [ ] Remaining utility pages (Search, Policies, etc.) have basic ARIA
- [ ] All tests pass
