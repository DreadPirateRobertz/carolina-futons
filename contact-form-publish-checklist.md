# Contact Form — Publish Checklist (Stilgar Action Required)

**Prepared by:** blaidd  
**Bead:** cf-3qt.8.24  
**Date:** 2026-05-04  
**Status:** `contactSubmissions` Velo endpoint is **coded but not live** — requires one Publish action in Wix Studio.

---

## The Flow

```
User fills ContactForm (ContactForm.tsx)
        ↓
sendContactForm() server action  (src/app/contact/actions.ts:75)
        ↓ validates fields + Turnstile CAPTCHA
        ↓ POST JSON to:
https://www.carolinafutons.com/_functions/contactSubmissions
        ↓
Velo HTTP function handler  (http-functions.js:2641 — Wix Studio backend)
        ↓ writes to Wix CRM / sends notification email
```

**Key wiring:**
- Endpoint constructed at `actions.ts:115`: `` `${optionalEnv("WIX_VELO_SITE_URL")}/_functions/contactSubmissions` ``
- `WIX_VELO_SITE_URL` defaults to `https://www.carolinafutons.com` (hardcoded default in `src/lib/env.ts:18`)
- POST body is a `ContactRequest` JSON object: `{ name, email, phone?, subject, message, sizeOfInterest? }`
- Success: Velo returns HTTP 200 `{ success: true }` → user sees success state
- Failure: Velo returns 4xx/5xx → user sees "We couldn't send that" error toast
- Rate limit: Velo returns 429 → user sees rate-limit message

---

## Why It's Currently Broken

The Velo backend code exists at `http-functions.js:2641` in Wix Studio, **but the live Wix site has not been published with that code active.** Until Stilgar publishes, the endpoint returns 404 — every contact form submission silently fails.

Wix Velo HTTP functions are only available on the **live** published site, not in Preview mode. The `/_functions/` path is served by the Wix CDN and does not exist on unpublished drafts.

---

## Stilgar's Action — One Step

1. Open **Wix Studio** → carolinafutons.com site
2. Confirm the Velo backend file `http-functions.js` contains the `contactSubmissions` handler (search for `contactSubmissions` — it should be around line 2641)
3. Click **Publish** (top-right of Wix Studio editor)
4. Wait for publish to complete (~1–2 min)

That's it. No code changes required — the cfW server action already points to the correct URL.

---

## Verification

After Stilgar publishes, verify the endpoint is live with:

```bash
# Expect HTTP 400 (validation error — no body sent) or 200, NOT 404
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://www.carolinafutons.com/_functions/contactSubmissions \
  -H "Content-Type: application/json" \
  -d '{}'

# A valid test submission (fill real values — this WILL write to Wix CRM)
curl -s -X POST https://www.carolinafutons.com/_functions/contactSubmissions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Submission",
    "email": "test@example.com",
    "subject": "Endpoint verification",
    "message": "This is a test submission from the post-cutover checklist."
  }'
```

**PASS:** HTTP 200 `{"success":true}` or HTTP 400/422 with a validation error body (endpoint is live, Velo is processing)  
**FAIL:** HTTP 404 — endpoint not published yet; Stilgar must re-publish

---

## Appointment Form (separate path — SMTP)

The **AppointmentForm** on the same `/contact` page uses a different path: it emails directly via SMTP (`nodemailer`) using `SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS` Vercel env vars. This flow does **not** depend on Wix publish — it requires only the SMTP env vars to be set in Vercel.

Verify appointment form separately:
```bash
# Check SMTP vars are set in Vercel:
vercel env ls | grep SMTP
```

---

## Pre-cutover Checklist

- [ ] Stilgar has published the live Wix site with `contactSubmissions` handler active
- [ ] `curl` verification above returns 200 or 400 (not 404)
- [ ] `TURNSTILE_SECRET_KEY` is set in Vercel (CAPTCHA verification — see `.env.example`)
- [ ] SMTP vars set in Vercel for appointment form (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`)
- [ ] Manual smoke: submit test contact message on `/contact` page, confirm success state renders

---

*Checklist owner: blaidd | Action owner: Stilgar*
