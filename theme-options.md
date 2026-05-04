# Theme Options for Stilgar — cf-3qt.8.22

**Purpose:** Pick one of A/B/C/D as the production homepage before DNS cutover.  
**Preview routes:** `/theme-a`, `/theme-b`, `/theme-c`, `/theme-d` (all `robots: noindex`)  
**Note on theme switching:** The light/dark toggle (`cf-theme` in localStorage) works across all themes — it is separate from this A/B/C/D choice.

---

## Theme A — Mascot World

**Route:** `/theme-a`  
**Mood:** Warm, hand-crafted, storybook. Feels like a mountain general store that's been there since 1891.

**What you see:** Full-viewport `BearHero` illustration — the bear character from the v3 mascot system in a Blue Ridge landscape with amber sky gradient. Below it: Playfair Display headline ("Furniture that earns its place."), Source Sans body copy, dark ink CTA button. Four category cards each paired with a different animal mascot (Bear → Futons, Deer → Murphy Beds, Fox → Platform Beds, Owl → Mattresses). Ends with an Easter egg promo card ("Find the bear — 10% off") and the `MascotFooterDivider` ridge scene.

**Palette:** Warm parchment background (`#F5E8C8`), dark brown ink (`#2A1810`), Blue Ridge ridge blues (`#1F2E38 → #C8DCE5`), amber sky accents (`#F5D5A0`).  
**Typography:** Playfair Display (headings) + Source Sans (body). Classic editorial combination.  
**Key components:** `BearHero`, `MascotCategoryCard` (per-animal), `MascotFooterDivider`.  
**Interactivity:** Bear animation (framer-motion float on footer), animal mascots on category cards.

---

## Theme B — Marugame Grid

**Route:** `/theme-b`  
**Mood:** Bold, typographic, editorial. Closer to a modern design magazine than a furniture store — confident and minimal.

**What you see:** `MarugameHero` — a large-type italic display treatment using the site's heading font at `clamp(88px, 18vw, 260px)`, stacked in two rows with ghost/outline type behind solid type. The hero is almost entirely typography with sparse supporting copy at 11px uppercase tracking. Below it: `MarugameGrid`, a live product grid pulling from Wix (8 products, paginated).

**Palette:** Stays within the site's existing design tokens — `cf-navy`, `cf-cream`, `cf-charcoal`. No new custom colors introduced.  
**Typography:** Heavy italic heading font at an oversized scale; the type IS the hero image.  
**Key components:** `MarugameHero` (type-led), `MarugameGrid` (live products).  
**Interactivity:** Paginated live product grid; no mascot animations.

---

## Theme C — Stargazing

**Route:** `/theme-c`  
**Mood:** Atmospheric, night-sky, contemplative. Poetic and distinctive — high-delight but also the highest brand-risk of the four.

**What you see:** Full-viewport `StargazingHero` — a bear lying on a hill under a deep navy night sky (`#0E1424`). 14 fireflies pulse on a 3.6-second stagger, a shooting star fires every 8 seconds, the Milky Way drifts slowly across the viewport. Below: a minimal dark section describing the scene (effectively still a preview/tech spec page rather than a finished homepage).

**Palette:** Deep navy (`#0E1838`), dark purple (`#3A2548`), warm cream (`#FAF2DE`), pale gold (`#F5E89A`). Entirely dark — no light-mode page body.  
**Typography:** Serif + mono (small uppercase labels). Very spare.  
**Key components:** `StargazingHero` (SVG + CSS keyframe animation system).  
**Interactivity:** All motion respects `prefers-reduced-motion`. Heavy animation budget (fireflies, shooting star, milky way drift).  
**Caveat:** The content section below the hero is a preview stub, not production copy.

---

## Theme D — Fontshare Minimal

**Route:** `/theme-d`  
**Mood:** Clean, commerce-first, filter-driven. Prioritizes product browsing over brand storytelling — closest to a conventional e-commerce homepage.

**What you see:** `FilterFirst` — a single-page filter + product grid. Category pills (Futon Frames / Murphy Beds / Platform Beds / Mattresses) at the top; clicking a pill swaps the product grid below in real-time. Loads 24 products per category from Wix at page render. Small eyebrow + large bold headline; no hero illustration.

**Palette:** Site tokens (`cf-espresso`, `cf-cta`, `cf-charcoal`). Typography uses Clash Display (headings) + Satoshi (body), loaded from Fontshare CDN — the only theme with an external font dependency.  
**Typography:** Clash Display at `clamp` sizes (bold, geometric); Satoshi (clean grotesque body). Modern and neutral.  
**Key components:** `FilterFirst` (category tabs + live product grid).  
**Interactivity:** Client-side category switching; no illustrations or mascot scenes.  
**Caveat:** Fontshare CDN dependency (`api.fontshare.com`) adds a network request per page load and may affect LCP if the CDN is slow.

---

## Recommendation

**Theme A** for Carolina Futons.

The Mascot World direction is the only one that builds the brand as actively as it serves the catalog. The bear character, mountain palette, and handmade tone match what actually differentiates Carolina Futons from online commodity furniture — family-owned since 1991, Hendersonville craft, direct relationships. Theme B's typography is striking but anonymous (could be any furniture brand). Theme C is the most distinctive but dark-only and not finished for production. Theme D is the most conversion-focused but reads as generic e-commerce.

Theme A also has the lowest risk: it uses the v3 mascot system already deployed across PLPs, the footer, and the about page — no new design language to introduce at cutover.

**If Stilgar wants faster page-to-product flow:** Theme D is the pragmatic choice — add a mascot accent and it could work. The Fontshare dependency should be replaced with a self-hosted font before launch.
