# cfw-259 — Live-Site Variant Pricing Audit (Group A)

**Date:** 2026-05-21  
**Auditor:** blaidd  
**Source:** https://carolina-futons-web.vercel.app  
**Method:** SSR HTML scrape — extracted all distinct `"price":\d+` values per product page  
**Scope:** 46 Group A products (Size + Color/Frame Color/Finish variants)

## Summary

| Category | Count |
|----------|-------|
| PRICED (multiple distinct prices — variant pricing live) | **29** |
| FLAT (single price — still needs per-variant pricing) | **17** |
| ERROR | 0 |

> **Note on PRICED products:** Prices extracted from full page HTML may include related-product prices from carousels. The meaningful signal is FLAT vs PRICED — for exact values, verify in Wix dashboard.

## Full Audit Table

| Slug | Sizes detected | Distinct prices found | Status |
|------|---------------|----------------------|--------|
| albany-futon-frame | Full, Queen | $529 | FLAT |
| autumn-futon-frame | Full, Queen, King | $739, $789, $839 | PRICED |
| bali-futon-frame | Full, Queen | $729, $779 | PRICED |
| basic-platform-bed | Twin, Full, Queen, King | $486, $549, $589, $706 | PRICED |
| black-pepper-futon-frame | Twin, Full, Queen, King | $349, $499, $619, $699, $799 | PRICED |
| clove-5-drawer-chest | King | $873 | FLAT |
| clover-murphy-bed-cabinet | Queen | $2,598 | FLAT |
| daisy-murphy-bed-cabinet | Queen | $2,798 | FLAT |
| denali-log-futon | Full, Queen | $737 | FLAT |
| dillon-futon-frame | Full, Queen | $642, $672, $712 | PRICED |
| durango-futon-frame | Full, Queen | $704 | FLAT |
| eureka-futon-frame | Full, Queen | $549 | FLAT |
| fuji-futon-frame | Full, Queen | $589, $639 | PRICED |
| galena-futon-frame | Full, Queen | $722, $752, $839 | PRICED |
| key-west-futon-frame | Full, Queen | $719, $769 | PRICED |
| kingston-futon-frame | Full, Queen, King | $619, $669, $699 | PRICED |
| lambton-futon-frame | Full, Queen | $778, $803, $843 | PRICED |
| leg-length-options-nomad | — | $35 | FLAT |
| monterey-futon-frame | Full, Queen, King | $549, $589, $649 | PRICED |
| murphy-cabinet-express | Twin, Full, Queen | $2,138, $2,498, $2,598 | PRICED |
| murphy-cube-cabinet-bed | Queen, King | $1,898 | FLAT |
| northern-exposure-log-futon | Full, Queen | $1,129, $1,169, $903 | PRICED |
| nutmeg-platform-bed | Twin, Full, Queen, King | $266, $299, $334, $407 | PRICED |
| pagoda-futon-frame | Full, Queen | $737, $767, $855 | PRICED |
| paprika-futon-frame | Twin, Full, Queen, King | $244, $631, $779, $818, $953 | PRICED |
| poppy-murphy-bed-cabinet | Queen | $2,958 | FLAT |
| raleigh-futon-frame | Full, Queen | $699 | FLAT |
| ranchero-murphy-cabinet-bed | — | $2,978 | FLAT |
| rockwell-futon-frame | Full, Queen | $743 | FLAT |
| rosemary-futon-frame | Twin, Full, Queen, King | $251, $616, $735, $821, $944 | PRICED |
| ruskin-futon-frame | Full, Queen | $629, $669 | PRICED |
| sagebrush-murphy-cabinet-bed | Queen | $2,878 | FLAT |
| san-sebastian-sealy-cabinet-bed | Twin, Full, Queen | $1,778, $2,198, $2,398 | PRICED |
| solstice-futon-frame | Full, Queen | $1,021, $420, $922 | PRICED |
| sunrise-futon-frame | Full, Queen | $729, $779, $829 | PRICED |
| tamarind-futon-frame | Twin, Full, Queen, King | $1,063, $321, $686, $825, $924 | PRICED |
| tarragon-futon-frame | Twin, Full, Queen, King | $1,043, $297, $662, $867, $906 | PRICED |
| thyme-futon-frame | Twin, Full, Queen, King | $224, $589, $706, $757, $845 | PRICED |
| tiro-futon-frame | Full, Queen | $782, $812, $852 | PRICED |
| tozi-futon-frame | Full, Queen | $656, $686, $726 | PRICED |
| trelli-futon-frame | Full, Queen | $773 | FLAT |
| trinity-futon-frame | Full, Queen | $549, $599 | PRICED |
| venice-futon-frame | Full, Queen, King | $709 | FLAT |
| wilderness-log-futon | Full, Queen, King | $1,031, $1,289, $1,597 | PRICED |
| winchester-futon-frame | Full, Queen | $689, $739 | PRICED |
| winter-futon-frame | Full, Queen | $779 | FLAT |

## FLAT Products — Priority Queue for Stilgar

These 17 products still need per-variant pricing populated in Wix dashboard:

| # | Slug | Sizes | Current (flat) price |
|---|------|-------|---------------------|
| 1 | albany-futon-frame | Full, Queen | $529 |
| 2 | clove-5-drawer-chest | (no sizes detected — check Color variants) | $873 |
| 3 | clover-murphy-bed-cabinet | (no sizes detected — check variants) | $2,598 |
| 4 | daisy-murphy-bed-cabinet | (no sizes detected — check variants) | $2,798 |
| 5 | denali-log-futon | Full, Queen | $737 |
| 6 | durango-futon-frame | Full, Queen | $704 |
| 7 | eureka-futon-frame | Full, Queen | $549 |
| 8 | leg-length-options-nomad | (leg-length product — check variants) | $35 |
| 9 | murphy-cube-cabinet-bed | Queen, King | $1,898 |
| 10 | poppy-murphy-bed-cabinet | (no sizes detected — check variants) | $2,958 |
| 11 | raleigh-futon-frame | Full, Queen | $699 |
| 12 | ranchero-murphy-cabinet-bed | (no sizes detected — check variants) | $2,978 |
| 13 | rockwell-futon-frame | Full, Queen | $743 |
| 14 | sagebrush-murphy-cabinet-bed | (no sizes detected — check variants) | $2,878 |
| 15 | trelli-futon-frame | Full, Queen | $773 |
| 16 | venice-futon-frame | Full, Queen, King | $709 |
| 17 | winter-futon-frame | Full, Queen | $779 |

## Verification Command

After Stilgar populates per-variant pricing for any product, verify:

```sh
curl -sL https://carolina-futons-web.vercel.app/products/<slug> \
  | python3 -c "import sys,re; src=sys.stdin.read().replace(chr(92)+chr(34),chr(34)); print(sorted(set(re.findall(r'\"price\":(\d+)',src))))"
```

Expected: multiple distinct integers (one per size). If single value returned, the variant pricing did not save or publish correctly.
