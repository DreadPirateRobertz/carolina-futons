# WIX_API_KEY Creation Runbook — Stilgar (Account ed8a7220)

**Bead:** cf-3qt.8.21  
**Date:** 2026-05-04  
**Purpose:** Create a server-side Wix API key for the Carolina Futons headless app.  
This is required to unblock cf-0s4l (provision script).

---

## What This Key Is For

`WIX_API_KEY` is a server-side secret used by the Next.js app to make admin-level
reads against Wix APIs (Stores catalog, CMS collections, Members).  
It is **not** the same as `WIX_CLIENT_ID_HEADLESS` (OAuth client ID for end-user auth).

---

## Steps

### 1. Log into Wix Business Manager

1. Open [manage.wix.com](https://manage.wix.com) in a browser.
2. Sign in as the site owner account (`ed8a7220`).
3. Select the **Carolina Futons** site from the dashboard.

### 2. Navigate to API Keys

In the left sidebar:

- **New UI path:** Settings → **API Keys** (under "Advanced")
- **Alternate path:** Dev Tools → **API Keys**

If neither is visible, use the search bar at the top and search for "API Keys".

### 3. Create a New API Key

1. Click **+ Generate API Key** (or **+ New Key**).
2. Set the name: `carolina-futons-web (prod)`.
3. Under **Permissions**, enable these scopes:
   - **Stores** → Read (catalog, products, collections)
   - **CMS / Content Manager** → Read
   - **Members** → Read
4. Click **Generate**.
5. **Copy the key immediately** — Wix shows it only once.

### 4. Add to Vercel Environment Variables

1. Open [vercel.com/dashboard](https://vercel.com/dashboard).
2. Select the **carolina-futons-web** project.
3. Go to **Settings → Environment Variables**.
4. Click **Add New**:
   - **Name:** `WIX_API_KEY`
   - **Value:** *(paste the key you copied)*
   - **Environments:** check **Production** and **Preview**
5. Click **Save**.
6. Trigger a new deployment (or redeploy) to pick up the new variable.

### 5. Store the Key Securely

Save the key value to the secrets file at:

```
/Users/hal/gt/cfutons/refinery/rig/scripts/secrets.env
```

Add the line:

```
WIX_API_KEY=<your-key-here>
```

**Do not commit `secrets.env` to any repository.**

---

## Verification

After the next deployment, the provision script (`bd provision` or direct invocation)
should be able to authenticate without a 401. Check Vercel function logs if the error
persists — look for `WIX_API_KEY` missing or invalid scope errors.

---

*Runbook by miquella · cf-3qt.8.21 · 2026-05-04*
