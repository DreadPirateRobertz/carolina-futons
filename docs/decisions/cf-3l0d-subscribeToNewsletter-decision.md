# cf-3l0d — `subscribeToNewsletter` welcome-flow decision

**Status:** awaiting Stilgar/Mayor pick
**Owner:** rennala
**Filed:** 2026-05-05
**Refs:** cf-icww F2, cf-xdji (resolveContactId helper)

## Problem

The styleQuiz.web.js comment claims:

> // subscribeToNewsletter deduplicates silently and triggers the welcome flow.

But `subscribeToNewsletter` does NOT queue any `welcome_series_*` row. It only:
1. Inserts a `NewsletterSubscribers` row
2. Fires-and-forgets `_syncToESPInternal(...)` to Klaviyo

The welcome series is queued only by `captureExitIntentEmail`, which the exit-intent UI calls *separately* alongside `subscribeToNewsletter`.

## Caller inventory

### Bucket 1 — explicitly composes both calls (welcome IS queued)
| Caller | Pairs `subscribeToNewsletter` with `captureExitIntentEmail`? |
|---|---|
| `src/public/exitIntentCapture.js#submitExitCapture` | yes (lines 209–222) |

### Bucket 2 — calls `subscribeToNewsletter` only (welcome NOT queued, contrary to comment)
| Caller | Source label |
|---|---|
| `src/public/exitIntentCapture.js#submitExitIntentEmail` | `exit_intent_popup` |
| `src/public/FooterSection.js` | `footer_newsletter` |
| `src/pages/Blog.js` | `blog_newsletter` |
| `src/pages/Blog Post.js` | `blog_post` |
| `src/pages/Home.js` | (default — no source) |
| `src/pages/masterPage.js` | `exit_intent_popup` |
| `src/pages/Newsletter.js` | `newsletter_page` |
| `src/pages/Thank You Page.js` | `thank_you_page` |
| `src/backend/styleQuiz.web.js#captureQuizLead` | `style_quiz` |
| `src/backend/http-functions.js#post_mailingListSignups` | webhook source |

**9 of 10 callers expect welcome behaviour but don't get it.** Only `submitExitCapture` is wired correctly.

## Options

### Option A — rename to honest scope, callers compose explicitly
- Rename `subscribeToNewsletter` → `subscribeToMailingList` (or similar)
- Update the styleQuiz comment to remove the false claim
- Each Bucket-2 caller decides: do they want welcome? if yes, they call `triggerWelcomeSeries(email, '')` (post-cf-xdji) themselves
- **Pro:** API name truthfully reflects what the function does; explicit composition is auditable
- **Con:** 10 caller sites to fix; future callers will probably forget the second call again ("rename" doesn't prevent the same mistake from recurring); historical name strongly implies welcome behaviour

### Option B — auto-trigger welcome inside `subscribeToNewsletter` (recommended)
- After cf-xdji lands, `subscribeToNewsletter` itself calls the welcome trigger (with the `resolveContactId` helper bridging the anonymous-capture → CRM contact gap)
- `submitExitCapture` drops its explicit `captureExitIntentEmail` call (now a duplicate; the EmailQueue dedup guard would catch it anyway, but better to remove the redundant code)
- **Pro:** one place to own welcome behaviour; Bucket-2 callers' implicit assumption becomes correct; matches the historical name
- **Con:** depends on cf-xdji landing first; couples `subscribeToNewsletter` (Anyone permission) to `triggerWelcomeSeries` (currently SiteMember) — needs a privileged internal helper or a permission relax with explicit safeguards (rate limit + dedup are already there)

### Option C — keep `subscribeToNewsletter` thin, add wrapper `subscribeAndWelcome`
- Hybrid: leave `subscribeToNewsletter` semantics narrow (CMS + ESP), introduce `subscribeAndWelcome(email, opts)` that does subscribe + welcome queue
- Bucket-2 callers switch to `subscribeAndWelcome`
- **Pro:** preserves narrow primitive while making the common case ergonomic
- **Con:** still requires updating all 9 caller sites; two near-duplicate webMethods to maintain

## Recommendation: **Option B**

- 9/10 callers' implicit assumption becomes correct without per-call changes
- Single source of truth for welcome behaviour
- Existing dedup guard (`EmailQueue` query keyed on `recipientEmail + sequenceType + sequenceStep`) makes redundant calls safe
- Couples cleanly to cf-xdji, which already needs to solve the anonymous-contactId problem for F1+F7

**Sequencing:** wait for cf-xdji to merge → import `resolveContactId` in `newsletterService.web.js` → in `subscribeToNewsletter` success branch, after the CMS insert, resolve contactId then call `triggerWelcomeSeries(cleanEmail, '')` (or call `enqueueEmail` directly with the resolved contactId for each welcome step). Update styleQuiz.web.js comment to reflect reality. Remove the now-redundant `captureExitIntentEmail` call from `submitExitCapture`.

## Risk if we wait too long

`subscribeToNewsletter` continues to look like it triggers welcome but doesn't, so any new caller (e.g. a fresh signup form on a new page) silently joins Bucket 2. Cost grows linearly with new callers.

## Asks for Stilgar / Mayor

1. **Pick A / B / C.** Default = B unless you object.
2. If B: do we want `triggerWelcomeSeries` permission relaxed to Anyone, or do we add an internal-only `_triggerWelcomeSeriesInternal` helper that is callable from `subscribeToNewsletter`'s `Anyone` context? (I recommend the internal helper — keeps the public webMethod gated to SiteMember.)
3. Confirm OK to remove the redundant `captureExitIntentEmail` call from `submitExitCapture` once welcome is auto-triggered.

Reply on cf-3l0d or `gt mail` with pick + answers; I'll implement once cf-xdji is in.
