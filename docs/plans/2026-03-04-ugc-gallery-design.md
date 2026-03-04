# UGC Gallery Design

**Bead:** cf-o486
**Date:** 2026-03-04

## Overview

User-generated content gallery for Carolina Futons — customer room photos, social media pulls, before/after setups, voting/favorites.

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/backend/ugcService.web.js` | CRUD: submit, query, vote, report, moderate |
| `src/public/UGCGallery.js` | Gallery rendering, filtering, lightbox integration |
| `src/public/ugcVoting.js` | Vote/favorite logic with optimistic UI |
| `src/pages/UGC Gallery.js` | Standalone gallery page |
| `tests/ugcService.test.js` | Backend tests |
| `tests/ugcGallery.test.js` | Frontend helper tests |
| `tests/ugcVoting.test.js` | Voting tests |

### Reused Existing Code

- `galleryHelpers.js` — lightbox, lazy loading
- `engagementTracker.js` — analytics tracking
- `a11yHelpers.js` — dialog, announce, makeClickable
- `mediaGallery.web.js` — CDN URL conversion
- `sanitize.js` — input validation
- `LifestyleGallery.js` — structural template for gallery helper

## Collections

### UGCPhotos

| Field | Type | Notes |
|-------|------|-------|
| memberId | Text (indexed) | Wix member ID |
| memberDisplayName | Text | Public display name |
| photoUrl | Image | Wix media URL |
| caption | Text (max 300) | User caption |
| productId | Text (indexed) | Linked product (optional) |
| productName | Text | Denormalized |
| roomType | Text (indexed) | living-room, bedroom, office, dorm, porch |
| tags | Tags | before, after, setup, lifestyle, instagram, pinterest |
| socialSource | Text | instagram, pinterest, direct-upload, admin-added |
| socialPostUrl | Text | Original social URL |
| status | Text (indexed) | pending, approved, rejected, featured |
| voteCount | Number | Favorites/upvotes |
| submittedAt | Date (indexed) | Submission timestamp |
| moderatedAt | Date | Moderation timestamp |
| reportCount | Number | Abuse flags |
| beforeAfterId | Text | Links before/after pairs |
| beforeAfterType | Text | before, after, or null |

### UGCVotes

| Field | Type | Notes |
|-------|------|-------|
| memberId | Text | Voter member ID |
| photoId | Text | Photo being voted on |
| createdAt | Date | Vote timestamp |

Unique constraint on memberId + photoId prevents double-voting.

## Backend API (ugcService.web.js)

| Method | Permission | Purpose |
|--------|-----------|---------|
| `submitUGCPhoto(data)` | SiteMember | Submit photo (status: pending) |
| `getApprovedPhotos(opts)` | Anyone | Browse gallery with filters/sort |
| `getBeforeAfterPairs(opts)` | Anyone | Get paired before/after photos |
| `voteForPhoto(photoId)` | SiteMember | Toggle vote (add/remove) |
| `reportPhoto(photoId, reason)` | SiteMember | Flag inappropriate content |
| `moderatePhoto(photoId, action)` | Admin | Approve/reject/feature |
| `getUGCStats()` | Anyone | Gallery stats for social proof |

## Frontend Components

### UGCGallery.js

- Filter tabs: All, Living Room, Bedroom, Office, Dorm, Porch, Before/After
- Sort: Recent, Most Voted, Featured
- Masonry-style card grid (desktop 3-col, tablet 2-col, mobile 1-col)
- Photo cards: image, caption, member name, vote count, vote button
- Lightbox on click (reuse galleryHelpers.initImageLightbox)
- Before/after slider comparison in lightbox
- Lazy loading for images
- Skeleton loading states

### ugcVoting.js

- Optimistic UI: instant vote count update, revert on failure
- localStorage cache of user's votes for fast heart-fill rendering
- Backend sync via voteForPhoto webMethod
- Announce vote result via a11yHelpers.announce

### UGC Gallery Page

- Hero section with mountain skyline
- Submit photo CTA (opens modal for members, login prompt for visitors)
- Gallery grid with filters
- Featured photos carousel at top
- "Share your setup" social proof section

## Permissions Model

- **Browse**: Anyone (no login)
- **Submit/Vote/Report**: SiteMember (login required)
- **Moderate**: Admin only
- All submissions start as `pending` — require admin approval before appearing

## Implementation Order

1. Tests first (TDD)
2. Backend service (ugcService.web.js)
3. Voting helper (ugcVoting.js)
4. Gallery helper (UGCGallery.js)
5. Page (UGC Gallery.js)
6. vitest.config.js alias updates
