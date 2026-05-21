# cfw-259 — Wix Dashboard Variant Pricing: Stilgar Checklist

**Task:** Set per-variant prices for 17 FLAT products in Wix Stores dashboard.  
**Why:** These products show a single price on the storefront regardless of size. Each needs individual variant prices so customers see the correct price when they select Full vs Queen vs King.  
**Time estimate:** ~3 min per product × 17 = ~50 min total.

---

## How to open any product

1. Go to: **https://manage.wix.com** → sign in as carolinafutons@gmail.com  
2. Select the Carolina Futons site  
3. Left sidebar → **Store Products** (or **Stores** → **Products**)  
4. Use the search box at top to find the product by name  
5. Click the product row to open it  
6. Click the **Variants** tab (next to "Product Info")  
7. For each variant row: click the price cell → type the new price → press Tab  
8. Click **Save** (top right)  
9. Click **Publish** (top right — required for price to appear on live site)

> **Tip:** After saving each product, run the verify command at the bottom of this doc to confirm the new prices appear.

---

## Product checklist

Mark each product `[x]` when done.

---

### 1. Albany Futon Frame — `albany-futon-frame`

Current flat price: **$529**  
Variants: **Full, Queen**

- [ ] Search: `Albany Futon Frame`  
- [ ] Open → Variants tab  
- [ ] Set **Full** price: `___________` *(enter correct price — confirm with Stilgar or Wix price list)*  
- [ ] Set **Queen** price: `___________`  
- [ ] Save → Publish

> **Verify:** `curl -sL https://carolina-futons-web.vercel.app/products/albany-futon-frame | python3 -c "import sys,re; s=sys.stdin.read(); print(sorted(set(re.findall(r'\"price\":(\d+)',s))))"`  
> Expected: 2+ distinct numbers.

---

### 2. Clove 5-Drawer Chest — `clove-5-drawer-chest`

Current flat price: **$873**  
Variants: *No size variants detected — check Color or Finish variants in dashboard*

- [ ] Search: `Clove 5-Drawer Chest`  
- [ ] Open → Variants tab  
- [ ] Identify variant options (Color / Finish / other)  
- [ ] Set price per variant: `___________` each  
- [ ] Save → Publish

> **Verify:** `curl -sL https://carolina-futons-web.vercel.app/products/clove-5-drawer-chest | python3 -c "import sys,re; s=sys.stdin.read(); print(sorted(set(re.findall(r'\"price\":(\d+)',s))))"`

---

### 3. Clover Murphy Bed Cabinet — `clover-murphy-bed-cabinet`

Current flat price: **$2,598**  
Variants: *No size variants detected — check variants in dashboard*

- [ ] Search: `Clover Murphy Bed Cabinet`  
- [ ] Open → Variants tab  
- [ ] Identify variant options  
- [ ] Set price per variant: `___________` each  
- [ ] Save → Publish

> **Verify:** `curl -sL https://carolina-futons-web.vercel.app/products/clover-murphy-bed-cabinet | python3 -c "import sys,re; s=sys.stdin.read(); print(sorted(set(re.findall(r'\"price\":(\d+)',s))))"`

---

### 4. Daisy Murphy Bed Cabinet — `daisy-murphy-bed-cabinet`

Current flat price: **$2,798**  
Variants: *No size variants detected — check variants in dashboard*

- [ ] Search: `Daisy Murphy Bed Cabinet`  
- [ ] Open → Variants tab  
- [ ] Identify variant options  
- [ ] Set price per variant: `___________` each  
- [ ] Save → Publish

> **Verify:** `curl -sL https://carolina-futons-web.vercel.app/products/daisy-murphy-bed-cabinet | python3 -c "import sys,re; s=sys.stdin.read(); print(sorted(set(re.findall(r'\"price\":(\d+)',s))))"`

---

### 5. Denali Log Futon — `denali-log-futon`

Current flat price: **$737**  
Variants: **Full, Queen**

- [ ] Search: `Denali Log Futon`  
- [ ] Open → Variants tab  
- [ ] Set **Full** price: `___________`  
- [ ] Set **Queen** price: `___________`  
- [ ] Save → Publish

> **Verify:** `curl -sL https://carolina-futons-web.vercel.app/products/denali-log-futon | python3 -c "import sys,re; s=sys.stdin.read(); print(sorted(set(re.findall(r'\"price\":(\d+)',s))))"`

---

### 6. Durango Futon Frame — `durango-futon-frame`

Current flat price: **$704**  
Variants: **Full, Queen**

- [ ] Search: `Durango Futon Frame`  
- [ ] Open → Variants tab  
- [ ] Set **Full** price: `___________`  
- [ ] Set **Queen** price: `___________`  
- [ ] Save → Publish

> **Verify:** `curl -sL https://carolina-futons-web.vercel.app/products/durango-futon-frame | python3 -c "import sys,re; s=sys.stdin.read(); print(sorted(set(re.findall(r'\"price\":(\d+)',s))))"`

---

### 7. Eureka Futon Frame — `eureka-futon-frame`

Current flat price: **$549**  
Variants: **Full, Queen**

- [ ] Search: `Eureka Futon Frame`  
- [ ] Open → Variants tab  
- [ ] Set **Full** price: `___________`  
- [ ] Set **Queen** price: `___________`  
- [ ] Save → Publish

> **Verify:** `curl -sL https://carolina-futons-web.vercel.app/products/eureka-futon-frame | python3 -c "import sys,re; s=sys.stdin.read(); print(sorted(set(re.findall(r'\"price\":(\d+)',s))))"`

---

### 8. Leg Length Options Nomad — `leg-length-options-nomad`

Current flat price: **$35**  
Variants: *Leg-length product — check leg-length options in dashboard*

- [ ] Search: `Nomad` or `Leg Length`  
- [ ] Open → Variants tab  
- [ ] Identify leg-length variant options  
- [ ] Set price per variant: `___________` each  
- [ ] Save → Publish

> **Verify:** `curl -sL https://carolina-futons-web.vercel.app/products/leg-length-options-nomad | python3 -c "import sys,re; s=sys.stdin.read(); print(sorted(set(re.findall(r'\"price\":(\d+)',s))))"`

---

### 9. Murphy Cube Cabinet Bed — `murphy-cube-cabinet-bed`

Current flat price: **$1,898**  
Variants: **Queen, King**

- [ ] Search: `Murphy Cube Cabinet Bed`  
- [ ] Open → Variants tab  
- [ ] Set **Queen** price: `___________`  
- [ ] Set **King** price: `___________`  
- [ ] Save → Publish

> **Verify:** `curl -sL https://carolina-futons-web.vercel.app/products/murphy-cube-cabinet-bed | python3 -c "import sys,re; s=sys.stdin.read(); print(sorted(set(re.findall(r'\"price\":(\d+)',s))))"`

---

### 10. Poppy Murphy Bed Cabinet — `poppy-murphy-bed-cabinet`

Current flat price: **$2,958**  
Variants: *No size variants detected — check variants in dashboard*

- [ ] Search: `Poppy Murphy Bed Cabinet`  
- [ ] Open → Variants tab  
- [ ] Identify variant options  
- [ ] Set price per variant: `___________` each  
- [ ] Save → Publish

> **Verify:** `curl -sL https://carolina-futons-web.vercel.app/products/poppy-murphy-bed-cabinet | python3 -c "import sys,re; s=sys.stdin.read(); print(sorted(set(re.findall(r'\"price\":(\d+)',s))))"`

---

### 11. Raleigh Futon Frame — `raleigh-futon-frame`

Current flat price: **$699**  
Variants: **Full, Queen**

- [ ] Search: `Raleigh Futon Frame`  
- [ ] Open → Variants tab  
- [ ] Set **Full** price: `___________`  
- [ ] Set **Queen** price: `___________`  
- [ ] Save → Publish

> **Verify:** `curl -sL https://carolina-futons-web.vercel.app/products/raleigh-futon-frame | python3 -c "import sys,re; s=sys.stdin.read(); print(sorted(set(re.findall(r'\"price\":(\d+)',s))))"`

---

### 12. Ranchero Murphy Cabinet Bed — `ranchero-murphy-cabinet-bed`

Current flat price: **$2,978**  
Variants: *No size variants detected — check variants in dashboard*

- [ ] Search: `Ranchero Murphy Cabinet Bed`  
- [ ] Open → Variants tab  
- [ ] Identify variant options  
- [ ] Set price per variant: `___________` each  
- [ ] Save → Publish

> **Verify:** `curl -sL https://carolina-futons-web.vercel.app/products/ranchero-murphy-cabinet-bed | python3 -c "import sys,re; s=sys.stdin.read(); print(sorted(set(re.findall(r'\"price\":(\d+)',s))))"`

---

### 13. Rockwell Futon Frame — `rockwell-futon-frame`

Current flat price: **$743**  
Variants: **Full, Queen**

- [ ] Search: `Rockwell Futon Frame`  
- [ ] Open → Variants tab  
- [ ] Set **Full** price: `___________`  
- [ ] Set **Queen** price: `___________`  
- [ ] Save → Publish

> **Verify:** `curl -sL https://carolina-futons-web.vercel.app/products/rockwell-futon-frame | python3 -c "import sys,re; s=sys.stdin.read(); print(sorted(set(re.findall(r'\"price\":(\d+)',s))))"`

---

### 14. Sagebrush Murphy Cabinet Bed — `sagebrush-murphy-cabinet-bed`

Current flat price: **$2,878**  
Variants: *No size variants detected — check variants in dashboard*

- [ ] Search: `Sagebrush Murphy Cabinet Bed`  
- [ ] Open → Variants tab  
- [ ] Identify variant options  
- [ ] Set price per variant: `___________` each  
- [ ] Save → Publish

> **Verify:** `curl -sL https://carolina-futons-web.vercel.app/products/sagebrush-murphy-cabinet-bed | python3 -c "import sys,re; s=sys.stdin.read(); print(sorted(set(re.findall(r'\"price\":(\d+)',s))))"`

---

### 15. Trelli Futon Frame — `trelli-futon-frame`

Current flat price: **$773**  
Variants: **Full, Queen**

- [ ] Search: `Trelli Futon Frame`  
- [ ] Open → Variants tab  
- [ ] Set **Full** price: `___________`  
- [ ] Set **Queen** price: `___________`  
- [ ] Save → Publish

> **Verify:** `curl -sL https://carolina-futons-web.vercel.app/products/trelli-futon-frame | python3 -c "import sys,re; s=sys.stdin.read(); print(sorted(set(re.findall(r'\"price\":(\d+)',s))))"`

---

### 16. Venice Futon Frame — `venice-futon-frame`

Current flat price: **$709**  
Variants: **Full, Queen, King**

- [ ] Search: `Venice Futon Frame`  
- [ ] Open → Variants tab  
- [ ] Set **Full** price: `___________`  
- [ ] Set **Queen** price: `___________`  
- [ ] Set **King** price: `___________`  
- [ ] Save → Publish

> **Verify:** `curl -sL https://carolina-futons-web.vercel.app/products/venice-futon-frame | python3 -c "import sys,re; s=sys.stdin.read(); print(sorted(set(re.findall(r'\"price\":(\d+)',s))))"`

---

### 17. Winter Futon Frame — `winter-futon-frame`

Current flat price: **$779**  
Variants: **Full, Queen**

- [ ] Search: `Winter Futon Frame`  
- [ ] Open → Variants tab  
- [ ] Set **Full** price: `___________`  
- [ ] Set **Queen** price: `___________`  
- [ ] Save → Publish

> **Verify:** `curl -sL https://carolina-futons-web.vercel.app/products/winter-futon-frame | python3 -c "import sys,re; s=sys.stdin.read(); print(sorted(set(re.findall(r'\"price\":(\d+)',s))))"`

---

## Batch verify all 17 after you're done

Run this to check which products are still FLAT:

```bash
for slug in \
  albany-futon-frame \
  clove-5-drawer-chest \
  clover-murphy-bed-cabinet \
  daisy-murphy-bed-cabinet \
  denali-log-futon \
  durango-futon-frame \
  eureka-futon-frame \
  leg-length-options-nomad \
  murphy-cube-cabinet-bed \
  poppy-murphy-bed-cabinet \
  raleigh-futon-frame \
  ranchero-murphy-cabinet-bed \
  rockwell-futon-frame \
  sagebrush-murphy-cabinet-bed \
  trelli-futon-frame \
  venice-futon-frame \
  winter-futon-frame; do
  prices=$(curl -sL "https://carolina-futons-web.vercel.app/products/$slug" \
    | python3 -c "import sys,re; s=sys.stdin.read(); p=sorted(set(re.findall(r'\"price\":(\d+)',s))); print(len(p),'prices:', p)" 2>/dev/null)
  echo "$slug: $prices"
done
```

A product is done when it shows **2+ distinct prices**. Products showing **1 price** still need variants set.

---

*Written by godfrey for cfw-259. Source data: `docs/qa/cfw-259-pricing-audit-2026-05-21.md` (blaidd, 2026-05-21).*
