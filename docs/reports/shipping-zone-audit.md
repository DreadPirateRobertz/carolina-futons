# Shipping Zone & ZIP Code Audit — Carolina Futons

**Store:** 824 Locust St, Ste 200, Hendersonville, NC 28792
**Generated:** 2026-03-16
**Auditor:** cfutons/crew/radahn

---

## Summary

| Source File | Zone | ZIP Prefix Range | Purpose |
|-------------|------|-----------------|---------|
| `sharedTokens.js:261` | Local (WNC) | 287–289 | White-glove pricing tier ($149) |
| `sharedTokens.js:263` | Regional (Southeast) | 270–399 | White-glove pricing tier ($249) |
| `Shipping Policy.js:65` | Local | 287–289 | ZIP calculator — local delivery message |
| `Shipping Policy.js:73-78` | Regional (Southeast) | 270–289, 290–299, 300–319, 320–339, 350–369, 370–385 | ZIP calculator — regional message |
| `ups-shipping.web.js:310` | NC/SC fallback | 270–299 | Fallback rate $29.99 |
| `ups-shipping.web.js:311` | Southeast fallback | 300–399 | Fallback rate $39.99 |
| `ups-shipping.web.js:312` | Northeast fallback | 100–199 | Fallback rate $59.99 |
| `ups-shipping.web.js:313` | West Coast fallback | 900–999 | Fallback rate $79.99 |
| `DeliveryEstimator.js:23-24` | Local/Regional | Uses sharedTokens zones | Product page estimate |

---

## Delivery Methods

From `Shipping Policy.js:95-120`:

| Method | Availability | Details |
|--------|-------------|---------|
| Standard Shipping | Nationwide | Via common carrier, 3-5 business days |
| Local Delivery | Hendersonville/Asheville area | In-home setup available |
| In-Store Pickup | Showroom only | 824 Locust St, Ste 200, Hendersonville, NC 28792 |
| White Glove Delivery | Select areas | Full assembly + placement, call for details |

---

## Local Zone (287–289) — WNC Geography Mapping

The local zone is defined as ZIP prefixes 287, 288, and 289. Here's what that covers:

### 287xx — Henderson County & Western Foothills
- **28701** Arden (Buncombe Co.)
- **28708** Bat Cave (Henderson Co.)
- **28711** Black Mountain (Buncombe Co.)
- **28712** Brevard (Transylvania Co.)
- **28715** Canton (Haywood Co.)
- **28716** Canton (Haywood Co.)
- **28721** Clyde (Haywood Co.)
- **28726** East Flat Rock (Henderson Co.)
- **28729** Etowah (Henderson Co.)
- **28730** Fairview (Buncombe Co.)
- **28731** Flat Rock (Henderson Co.)
- **28732** Fletcher (Henderson Co.)
- **28734** Franklin (Macon Co.)
- **28739** Hendersonville (Henderson Co.) **← STORE**
- **28742** Horse Shoe (Henderson Co.)
- **28743** Hot Springs (Madison Co.)
- **28748** Leicester (Buncombe Co.)
- **28751** Maggie Valley (Haywood Co.)
- **28752** Marion (McDowell Co.)
- **28753** Mars Hill (Madison Co.)
- **28754** Marshall (Madison Co.)
- **28756** Mill Spring (Polk Co.)
- **28758** Mills River (Henderson Co.)
- **28768** Pisgah Forest (Transylvania Co.)
- **28773** Saluda (Polk Co.)
- **28774** Sapphire (Transylvania Co.)
- **28778** Swannanoa (Buncombe Co.)
- **28779** Sylva (Jackson Co.)
- **28786** Waynesville (Haywood Co.)
- **28787** Weaverville (Buncombe Co.)
- **28790** Zirconia (Henderson Co.)
- **28791–28793** Hendersonville (Henderson Co.) **← STORE ZIP**

### 288xx — Asheville Metro
- **28801–28806** Asheville (Buncombe Co.) — main metro area
- **28810** Asheville (Buncombe Co.)
- **28813–28816** Asheville PO boxes & suburbs

### 289xx — Foothills / Catawba Valley
- **28901** Andrews (Cherokee Co.)
- **28902** Brasstown (Clay Co.)
- **28904** Hayesville (Clay Co.)
- **28905** Marble (Cherokee Co.)
- **28906** Murphy (Cherokee Co.)
- **28909** Robbinsville (Graham Co.)

**Note:** 289xx is a mixed bag — it includes far-western NC mountain towns (Murphy, Andrews, Robbinsville) which are 2+ hours from the store, as well as some Catawba Valley addresses. The "local delivery ~50 miles" claim in the Shipping Policy page may not hold for all 289xx addresses.

---

## Regional Zone — Southeast State Coverage

`Shipping Policy.js` (lines 73-78) defines regional as a union of state-level prefix ranges:

| Prefix Range | State/Region | Notes |
|-------------|-------------|-------|
| 270–289 | NC (all) | Includes local zone as subset |
| 290–299 | SC | Full state |
| 300–319 | GA | Full state |
| 320–339 | FL | Partial — only north/central FL |
| 350–369 | AL | Full state |
| 370–385 | TN | Full state |

**`sharedTokens.js` regional zone is broader:** 270–399 (single contiguous range), which also includes:
- 340–349: FL (south FL — Miami, Fort Lauderdale)
- 386–399: MS (Mississippi)

### Inconsistency: `sharedTokens.js` vs `Shipping Policy.js`

| Region | `sharedTokens.js` (white-glove pricing) | `Shipping Policy.js` (customer-facing) |
|--------|---|----|
| South FL (340–349) | **Included** (regional $249 white-glove) | **Excluded** |
| Mississippi (386–399) | **Included** (regional $249 white-glove) | **Excluded** |
| VA (220–246) | **Excluded** | **Excluded** |

This means:
- A customer in Miami (ZIP 331xx) sees "national" messaging on the Shipping Policy page but qualifies for $249 white-glove on the Product Page (via DeliveryEstimator).
- A customer in Jackson MS (ZIP 392xx) has the same inconsistency.

---

## Fallback Rate Gaps (ups-shipping.web.js)

When UPS API is down, `getFallbackRates()` uses hardcoded tiers:

| Prefix Range | Rate | Region |
|-------------|------|--------|
| 270–299 | $29.99 | NC/SC |
| 300–399 | $39.99 | Southeast |
| 100–199 | $59.99 | Northeast |
| 900–999 | $79.99 | West Coast |
| Everything else | $49.99 | Default |

**Uncovered gaps** (get default $49.99):
- 200–269: DC, MD, VA, WV — arguably should be $39.99–$49.99 (mid-Atlantic)
- 400–499: KY, IN, OH — Midwest, close to Southeast
- 500–599: IA, MN, NE, SD, ND — northern Midwest
- 600–699: IL, MO, KS — central US
- 700–799: LA, AR, TX, OK — Southwest/Gulf
- 800–899: CO, WY, MT, ID, UT, NM, AZ, NV — Mountain West

The $49.99 default is reasonable for most of these, but TX/LA/AR (700-729) are geographically closer than the West Coast and probably deserve a lower tier.

---

## In-Store Pickup

**No ZIP-based gating.** In-store pickup is listed as a delivery method on the Shipping Policy page with no geographic restriction. Any customer nationwide could theoretically select it. This is likely intentional (customer self-selects), but there's no code that restricts it to local ZIPs.

Referenced in:
- `Shipping Policy.js:110-112` — delivery repeater
- `Terms & Conditions.js:57` — policy text

---

## WNC Coverage Gaps

The store is in Hendersonville (28792). The "local" zone (287–289) covers most of WNC but has edge cases:

### Covered well (within ~50 miles)
- Asheville (288xx) — 25 miles
- Brevard (28712) — 20 miles
- Waynesville (28786) — 35 miles
- Fletcher/Arden (28732/28701) — 5-10 miles
- Black Mountain (28711) — 30 miles

### Covered but far (60+ miles, still in 289xx)
- Murphy (28906) — 120 miles, 2+ hours
- Andrews (28901) — 110 miles
- Robbinsville (28909) — 95 miles
- Hayesville (28904) — 100 miles

### NOT covered by local zone but arguably should be
- **Boone** (28607, 28608) — prefix 286, 80 miles. Missed by 287–289 range.
- **Banner Elk** (28604) — prefix 286, 85 miles.
- **Blowing Rock** (28605) — prefix 286, 90 miles.
- **Spruce Pine** (28777) — actually IS covered (287xx), 60 miles.
- **Burnsville** (28714) — IS covered (287xx), 50 miles.

**Key gap: Watauga/Avery County (High Country) — prefix 286 — excluded from local zone** despite being firmly in WNC and within the same distance as the far-western towns that ARE included (Murphy at 120mi).

---

## White-Glove Pricing

From `sharedTokens.js:250-257`:

| Zone | Price | Free Threshold |
|------|-------|---------------|
| Local (287–289) | $149 | $999,999 (effectively disabled) |
| Regional (270–399) | $249 | $999,999 (effectively disabled) |
| National | Not available | — |

Both the standard shipping `freeThreshold` ($999,999) and white-glove `freeThreshold` ($999,999) are effectively disabled — no order will ever qualify for free shipping through these thresholds.

However, `Shipping Policy.js:68` says "Free delivery on orders over $999" and `ups-shipping.web.js:192` says "Free shipping on orders over $999!" — these fire when `orderSubtotal >= FREE_SHIPPING_THRESHOLD`, but `FREE_SHIPPING_THRESHOLD = shippingConfig.freeThreshold = 999999`.

**This is a contradiction:** customer-facing text promises free shipping at $999, but the threshold is set to $999,999. Customers over $999 will NOT get free shipping.

---

## Findings Summary

| # | Severity | Finding |
|---|----------|---------|
| 1 | **HIGH** | Free shipping text says "$999" but threshold is $999,999 — customers see false promise |
| 2 | MEDIUM | 289xx includes towns 120mi from store but is labeled "local delivery" |
| 3 | MEDIUM | Watauga/Avery counties (Boone, Banner Elk — prefix 286) excluded from WNC local zone |
| 4 | MEDIUM | `sharedTokens.js` regional (270–399) vs `Shipping Policy.js` regional (state-specific ranges) — inconsistent |
| 5 | LOW | Fallback rates don't differentiate mid-Atlantic, Midwest, or Gulf states |
| 6 | LOW | In-store pickup has no ZIP-based restriction (intentional?) |
| 7 | INFO | White-glove free threshold ($999,999) effectively disabled |

---

## Recommendations

1. **Fix free shipping threshold** — Either change `freeThreshold` to `999` to match customer-facing text, or update the text to remove the $999 promise. This is a trust/conversion issue.
2. **Split 289xx** — Consider narrowing local delivery to 287–288 (true Asheville/Hendersonville metro) and treating 289xx as "extended local" or regional.
3. **Add 286 to local zone** — Or at least document that Boone/Banner Elk/Blowing Rock are excluded.
4. **Reconcile regional definitions** — Make `sharedTokens.js` and `Shipping Policy.js` use the same zone boundaries.
