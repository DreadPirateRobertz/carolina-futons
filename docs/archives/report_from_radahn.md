# Story Proposals from Radahn — 2026-02-23

gt mail is down (all agent addresses unresolvable). Filing this directly.

## Stability Stories (5)

### P1

| ID | Title |
|---|---|
| cf-rym | Instrument 1,426 silent catch blocks with error logging |
| cf-k9d | Replace Promise.all with Promise.allSettled for page init |
| cf-2lm | Shared safeParse utility for JSON.parse hardening |

### P2

| ID | Title |
|---|---|
| cf-dui | Financial calculation NaN guards (financingCalc toNumber NaN) |
| cf-vhy | Instrument fire-and-forget .catch(() => {}) patterns |

## Feature Stories (6)

### P1

| ID | Title | Why |
|---|---|---|
| cf-0bw | Room planner frontend page | Backend complete, no UI — wasted investment |
| cf-y8x | Promotions admin CRUD APIs | Marketing blocked on dev for every campaign |

### P2

| ID | Title | Why |
|---|---|---|
| cf-k5j | Buying guides frontend pages | SEO content, backend ready, no frontend |
| cf-0vr | Video reviews and testimonials | 80% conversion lift over photo-only |
| cf-yd6 | Warranty tracking and claims system | No warranty mgmt, common support question |
| cf-rzr | Showroom appointment booking | Customers drive 1-3hrs without confirming |

## Key Findings

- Site is ~85-90% feature-complete
- 1,426 silent catch blocks (zero error visibility in production)
- No circuit breakers anywhere in codebase
- errorMonitoring.web.js exists but most code ignores it
- 7 backend services are stubs (liveChat, promotions admin, etc.)
- All 70 backend modules have test files (100% coverage at file level)

Run `bd show <id>` for full story details. Please approve or refine.
