# CF-8fuc SPIKE: Comments & Community Features

**Date**: 2026-03-16
**Author**: miquella
**Status**: Complete

## Executive Summary

Community engagement features are **extensively built** across three systems: product reviews
(with photo reviews), UGC gallery with voting, and testimonials. Total: 2,268 lines of
production code with 448+ test cases. The only gap is Wix Comments/Forum SDK (typed but unused).

## Existing Code Inventory

### 1. Product Reviews System (~1,850 lines backend+frontend)

| File | Lines | Purpose |
|------|-------|---------|
| `reviewsService.web.js` | 551 | 14 exports: CRUD, moderation queue, helpful voting, owner responses, verified purchase badges |
| `productReviews.web.js` | 427 | 10 exports: unified text+photo review API, highlights for cards, batch summaries |
| `photoReviews.web.js` | 302 | 8 exports: photo review submission, gallery, moderation, featured photos |
| `ProductReviews.js` | 566 | Frontend: rating summary, review cards, sort/filter, pagination, submission form, JSON-LD schema |

### 2. UGC Gallery (~1,040 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `ugcService.web.js` | 423 | 7 exports: photo submissions, voting, before/after pairs, moderation, room-type filtering |
| `UGCGallery.js` | 412 | Gallery rendering, filter tabs, sort controls, before/after slider |
| `ugcVoting.js` | 206 | Vote state management with optimistic UI and session storage |

### 3. Testimonials (~316 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `testimonialService.web.js` | 316 | 8 exports: submission with spam detection, featured carousel, category filtering, JSON-LD schema |

### Test Coverage: 448+ tests, 5,555 lines

| Area | Test Files | Tests | Lines |
|------|-----------|-------|-------|
| Reviews | 7 files | 251+ | 3,144 |
| UGC | 5 files | 167 | 2,411 |
| Testimonials | 1 file | 30 | 367 |

### Key Features
- **Moderation queues** for all user content (reviews, photos, UGC, testimonials)
- **Verified purchase badges** on reviews
- **Owner responses** to customer reviews
- **Spam detection** on testimonials (pattern matching)
- **Optimistic UI** for UGC voting
- **JSON-LD schema** generation for SEO (reviews + testimonials)
- **5 room types** for UGC filtering (living room, bedroom, office, dorm, porch)

## Gaps
1. **Wix Comments SDK unused** — typed but not integrated (no discussion threads on pages)
2. **Testimonials have no dedicated frontend UI** — backend complete, displayed via home page carousel only
3. **No email notifications** on owner responses or moderation outcomes
4. **No rate limiting** on vote submissions

## Recommendation
**No new code work needed** for core commenting/community features. Discussion threads
(Wix Comments SDK) could be a future enhancement for blog posts or buying guides.
