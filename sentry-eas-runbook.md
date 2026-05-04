# Sentry Auth Token — EAS Setup Runbook

**Bead:** cf-3qt.8.20  
**Author:** godfrey  
**Date:** 2026-05-04  
**Scope:** EAS (mobile builds) only — NOT Vercel

---

## Background

`eas.json` production build profile references `${SENTRY_AUTH_TOKEN}` as an env
variable. This token allows the EAS build to upload source maps to Sentry so that
production crash reports show readable stack traces instead of minified code.

The token lives as an EAS project secret, not in source code.

---

## Step 1 — Create the Sentry Auth Token

1. Log in to [sentry.io](https://sentry.io) with `carolinafutons@gmail.com`
   (credentials in `secrets.env` or 1Password under "Sentry CF")
2. Navigate to: **Settings → Developer Settings → Auth Tokens**
3. Click **Create New Token**
4. Set a name: `eas-build-production`
5. Select scopes:
   - `project:releases` — required to create and finalize releases
   - `org:read` — required to resolve the org slug
   - `project:read` — required to resolve the project slug
6. Click **Create Token** and copy the value immediately (shown once only)

---

## Step 2 — Add the Token to EAS

```bash
cd /Users/hal/gt/cfutons_mobile

# Add as a project-scoped EAS secret
eas secret:create \
  --scope project \
  --name SENTRY_AUTH_TOKEN \
  --value <paste-token-here>
```

Confirm it's set:

```bash
eas secret:list
# Expected output includes:
# SENTRY_AUTH_TOKEN   project   ***
```

---

## Step 3 — Verify EAS Build Config

The `eas.json` production profile already references the secret correctly:

```json
"production": {
  "channel": "production",
  "autoIncrement": true,
  "env": {
    "SENTRY_AUTH_TOKEN": "${SENTRY_AUTH_TOKEN}"
  }
}
```

No changes to `eas.json` needed.

Note: `preview` and `simulator` profiles set `SENTRY_DISABLE_AUTO_UPLOAD: "true"` —
source map uploads are intentionally disabled on non-production builds.

---

## Step 4 — Verify in a Production Build

After setting the secret, trigger a dry-run or production build:

```bash
eas build --platform all --profile production --non-interactive
```

In the build logs, look for Sentry upload step output:

```
> @sentry/react-native upload-dsym ...
Successfully uploaded source maps to Sentry
```

If the token is wrong or missing, the build will succeed but the Sentry upload
step will print an auth error — it does not fail the build. Check build logs
explicitly.

---

## Important: NOT for Vercel

`SENTRY_AUTH_TOKEN` is for EAS mobile builds only. The Vercel deployment uses
`SENTRY_DSN` (the public DSN, not an auth token) to initialize Sentry on the
web client. Do not add `SENTRY_AUTH_TOKEN` to Vercel environment variables.

| Variable | Platform | Purpose |
|----------|----------|---------|
| `SENTRY_AUTH_TOKEN` | EAS (mobile CI) | Source map upload auth |
| `SENTRY_DSN` | Vercel (web) | Client-side error reporting endpoint |

---

## Troubleshooting

**"Invalid token" on upload** — token was copied with trailing whitespace or
expired. Regenerate in Sentry and update via `eas secret:push` or delete + recreate.

**Uploads succeeding but events missing in Sentry** — confirm the Sentry project
slug in `app.config.ts` (or `sentry.config.js`) matches the project in the org
where the token was created.

**Build fails with "SENTRY_AUTH_TOKEN not set"** — the secret was added to a
different EAS account or project. Run `eas whoami` and `eas project:info` to
confirm you're authenticated to the correct project.
