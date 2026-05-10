# Triggered Email Template — `contact_form_auto_reply` (DRAFT)

**Bead:** cf-hafn
**Audience:** customer who submitted the contact form (NOT site owner)
**Trigger source:** `src/backend/emailService.web.js#_sendCustomerAutoReplyInternal`, fired after a successful `sendEmail` owner-notification.
**Status:** draft for Stilgar — needs registration in Wix CRM Triggered Emails dashboard, copy + brand review, then enabling.

## Why this template exists

The merged audit (cf-icww F6) flagged that the contact form had no customer-side reply: only the store owner got an email, leaving the submitter with no inbox confirmation. Customers commonly re-submitted because they couldn't tell whether their first message went through. This template closes that gap.

## Template variables (passed by Velo)

| Variable        | Source                                  | Required | Notes |
|-----------------|-----------------------------------------|----------|-------|
| `customerName`  | sanitised submitter name                | yes      | Up to 200 chars; first-name use OK in greeting |
| `subject`       | original subject (or empty string)      | no       | Echo back so the customer knows which submission this acknowledges |
| `message`       | original message body                   | no       | Echo back; helpful when they sent multiple |
| `replyEta`      | static copy ("within 1 business day")   | yes      | Set in code, not user input |
| `supportPhone`  | "(828) 252-9449"                        | yes      | Fallback if the customer needs to reach us before the human reply lands |

Variable names match exactly what the Velo `triggeredEmails.emailContact(...)` call passes.

## Subject line

> We got your message — Carolina Futons

(short, recognisable, not promotional; do NOT prefix with `Re:` since this is the first email in the thread).

## Body — proposed copy

> Hi {{customerName}},
>
> Thanks for reaching out to Carolina Futons. We received your message and a real human will get back to you {{replyEta}}.
>
> If you need to reach us sooner, give us a call at **{{supportPhone}}** — we're a small team in Asheville and we usually pick up.
>
> For your records, here's what you sent us:
>
> > **Subject:** {{subject}}
> >
> > {{message}}
>
> Talk soon,
> The Carolina Futons team

## Brand notes for the editor

- Use the existing brand template chrome (header logo + footer with address + unsubscribe link).
- Body font + heading style: match the `welcome_series_*` templates — they're already brand-compliant.
- Quote-block for the echoed message: indent + lighter background so it visually separates from the assistant copy.
- No CTA button. This is a transactional acknowledgement, not a sales touch.

## Acceptance for Stilgar

1. Template registered in Wix CRM Triggered Emails dashboard with ID **`contact_form_auto_reply`** (must match the literal string in `_sendCustomerAutoReplyInternal`).
2. All five variables wired in the template editor.
3. Send-test from the dashboard to a personal address; verify variable substitution + brand chrome render.
4. After cf-xdji + cf-hafn merge: submit the contact form on STAGING_SITE as a brand-new email (no prior CRM contact); verify (a) owner email arrives, (b) customer email arrives at submitter inbox.
