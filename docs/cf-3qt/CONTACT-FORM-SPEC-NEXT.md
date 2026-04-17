# Contact Form Spec — Next.js (cf-3qt Phase 4)

**Owner:** blaidd
**Phase:** cf-3qt.4 (content) — `/contact`
**Status:** prep (Phase 1 still blocked)
**Replaces:** `src/pages/Contact.js` (Velo) → Next.js route + route handler.

This spec is the single source of truth for the Next.js contact form. It re-uses the existing Velo backend verbatim — no server-side behavior change. The Next.js layer is a proxy + UI.

---

## 1. Contract with the existing backend

Two webMethods are already correct; we call both (matching current Velo flow in `src/pages/Contact.js:100-115`).

### 1a. `emailService.sendEmail` (Permissions.Anyone)

Fires the triggered email to the site owner and inserts to `ContactSubmissions` collection.

Input shape:
```ts
{
  name: string;      // required, max 200
  email: string;     // required, max 254, must match email regex
  phone?: string;    // max 20
  subject?: string;  // max 300
  message: string;   // required, max 2000
}
```

Response:
```ts
{ success: true }
| { success: false, message: string }   // validation / rate-limit / invalid email
```

Server enforces: schema validation, sanitization, email regex, **3 submissions/hour per email** (`EMAIL_RATE_LIMIT_MAX`). Rate-limit message is user-facing.

### 1b. `contactSubmissions.submitContactForm` (Permissions.Anyone)

A secondary lightweight capture with different rate limits (3/hour per email in `ContactRateLimits`) — fires even if `sendEmail` throws, to preserve the lead.

The Velo page calls both in parallel. The Next.js proxy does the same.

---

## 2. Route layout

```
app/
  contact/
    page.tsx                 # Server component — SEO + static copy
    contact-form.tsx         # Client component — form UI + validation
  api/
    contact/
      route.ts               # POST proxy → sendEmail + submitContactForm
```

### `app/contact/page.tsx` (server)

- SEO: title, description, canonical via `generateMetadata`. Reuse copy from existing `seoHelpers.getPageTitle('contact')` / `getPageMetaDescription('contact')` by calling them via `/api/seo/page?slug=contact` — keeps the Velo content store authoritative.
- Layout: two-column on `md+`, stacked on mobile. Form left, business info right.
- Static blocks below fold: Business Hours (rendered from `lib/business/hours.ts`, ported from `public/aboutContactHelpers.js:formatBusinessHours`), Testimonials (from `@wix/data` `Testimonials` collection, ISR 3600), FAQ link.
- Appointment booking (Section 7 of Velo spec) is **out of scope for Phase 4** — deferred. Flag this to Melania.
- JSON-LD: `LocalBusiness` schema block rendered server-side (port `localBusinessSeo.js`).

### `app/contact/contact-form.tsx` (client)

- React Hook Form + Zod for validation (matches Phase 1 design-system convention).
- Fields, in order: Name, Email, Phone (optional), Subject (optional), Message.
- Submit button disabled while pending; aria-busy on form during in-flight.
- Success: swap form for `<SubmittedState />` with thank-you copy + "Send another" link.
- Error: inline banner at top + field-level errors; keep form values intact.
- Honeypot: hidden `website` field; non-empty → drop client-side (also server-drops).

---

## 3. Validation (Zod → shared with server)

```ts
// lib/contact/schema.ts
import { z } from 'zod';

export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name').max(200),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
  phone: z.string().trim().max(20).optional().default(''),
  subject: z.string().trim().max(300).optional().default(''),
  message: z.string().trim().min(1, 'Message is required').max(2000),
  website: z.string().max(0).optional(), // honeypot — must stay empty
});

export type ContactInput = z.infer<typeof contactSchema>;
```

Server re-parses on the route handler (never trust client validation).

Max lengths match the Velo `validateSchema` contract so we never send a payload the backend will reject.

---

## 4. Route handler — `app/api/contact/route.ts`

```ts
import { NextResponse } from 'next/server';
import { contactSchema } from '@/lib/contact/schema';
import { wixServerClient } from '@/lib/wix/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'validation', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.website) {
    return NextResponse.json({ ok: true }); // silent honeypot drop
  }

  const { name, email, phone, subject, message } = parsed.data;

  // Call both webMethods in parallel — same as current Velo page.
  const [emailRes, submissionRes] = await Promise.allSettled([
    wixServerClient.sendEmail({ name, email, phone, subject, message }),
    wixServerClient.submitContactForm({
      email,
      name,
      phone,
      notes: `${subject ? `Subject: ${subject}\n` : ''}${message}`,
      source: 'contact-page',
    }),
  ]);

  // sendEmail success is the signal users see. submitContactForm failing
  // only loses the redundant CMS row; log but don't surface.
  const emailOk = emailRes.status === 'fulfilled' && emailRes.value?.success === true;
  if (!emailOk) {
    const msg = emailRes.status === 'fulfilled'
      ? (emailRes.value?.message ?? 'Send failed')
      : 'Send failed';
    return NextResponse.json({ ok: false, error: 'send-failed', message: msg }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
```

### Rate-limit & abuse posture

- Server-side rate limit lives in the Velo backend (3/hour per email). No second limiter in Next.js.
- Honeypot drops silently ({ ok: true }) — matches existing behavior and avoids telling bots they're caught.
- Log failures to Sentry with `tag: 'contact-form'`. Do not log PII bodies.

---

## 5. Wix server client (shared with other webMethods)

Phase 1 will ship `lib/wix/server.ts`. Contact only needs:

```ts
sendEmail(input: ContactInput): Promise<{ success: boolean; message?: string }>;
submitContactForm(input: {
  email: string; name?: string; phone?: string;
  notes?: string; source?: string; productId?: string; productName?: string;
}): Promise<{ success: boolean; message?: string }>;
```

Auth: **Admin visitor token** (site-owner credentials). Webforms are `Permissions.Anyone`, but routing through an admin client keeps the option open for future Admin-only methods to share one client. Credentials via `WIX_ADMIN_API_KEY` in Vercel env.

---

## 6. Accessibility requirements (port from Velo spec)

- Every input has a `<label>` or `aria-label`. No placeholder-as-label.
- Required fields use `aria-required="true"` + visual asterisk in label.
- Errors announced via `aria-describedby` → `<p id="contactNameError" role="alert">`.
- Submit button text changes to "Sending…" when pending; loading state readable by screen readers (`aria-live="polite"`).
- Success region uses `role="status"` + `aria-live="polite"` so the form→thankyou swap is announced.
- Minimum target size 44×44 on mobile.
- Tab order: Name → Email → Phone → Subject → Message → honeypot (hidden, `tabindex="-1"`) → Submit.

---

## 7. Analytics

Fire events via `lib/analytics/track.ts`:

| Event | When | Props |
|---|---|---|
| `contact_form_view` | page mount | `{}` |
| `contact_form_submit_attempt` | onSubmit fired | `{ hasPhone, hasSubject }` |
| `contact_form_submit_success` | API returned ok | `{}` |
| `contact_form_submit_error` | API returned 4xx/5xx | `{ reason }` |
| `contact_form_validation_error` | client Zod failure | `{ field }` |

These replace the Velo `trackEvent('contact_form_submit')` calls.

---

## 8. Acceptance checklist

- [ ] `/contact` renders on Vercel preview with Phase 1 design tokens
- [ ] Form validates client-side; shows field-level errors
- [ ] Submitting with valid data fires both webMethods; Stilgar's test inbox receives the triggered email
- [ ] A new row lands in the `ContactSubmissions` CMS collection
- [ ] Rate-limit path (4th submission within 1h for same email) shows the user-facing rate-limit message
- [ ] Honeypot submissions return 200 with no email fired, no CMS row
- [ ] Screen-reader walk-through passes (NVDA or VoiceOver)
- [ ] Lighthouse a11y ≥ 95
- [ ] JSON-LD validates (Rich Results test)
- [ ] No secrets in client bundle (grep the Vercel build output for `WIX_ADMIN_API_KEY`)

---

## 9. Out of scope (for Phase 4)

- Appointment booking (Velo sections 7A/7B) — punt to post-migration bead.
- A/B testing submit copy — punt.
- Inline captcha — rate-limiting + honeypot is sufficient per current posture; revisit if spam metrics regress.

---

## 10. References

- Velo page: `src/pages/Contact.js`
- Backends: `src/backend/emailService.web.js` (`sendEmail` @ line 116), `src/backend/contactSubmissions.web.js` (`submitContactForm` @ line 109)
- Helpers ported from: `src/public/aboutContactHelpers.js`, `src/public/localBusinessSeo.js`, `src/public/validators.js`
- Wix Studio spec (decommissioned after cf-3qt.6): `docs/CONTACT-PAGE-BUILD-SPEC.md`
