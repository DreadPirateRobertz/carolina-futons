# Plan: Figma-First Illustration Strategy & Crew Skill-Up

## Context

The overseer flagged that our current SVG illustrations are "too abstract." All 17 existing SVGs are hand-coded JavaScript template strings with SVG filter effects (feTurbulence, feDisplacementMap). While they pass the 8-point quality bar in automated tests, they don't achieve the hand-drawn watercolor feel of `design.jpeg`. The fundamental problem: **programmatic SVGs with filters will never match real illustration work.**

The overseer directive is clear: pivot to Figma for better illustration results. This plan establishes a Figma-first illustration workflow, creates learning resources for the crew, and produces persistent beads/stories for execution.

## Strategy: Figma-First Illustration Pipeline

### Phase 1: Foundation — Figma Design System Setup (Epic Bead)

**Goal**: Create the Carolina Futons Figma file with brand design system

1. **Create Figma design file** (bead cf-hfly already exists, assigned to melania)
   - Set up brand color styles matching sharedTokens.js (Sand, Espresso, Mountain Blue, Coral, etc.)
   - Set up typography styles (Playfair Display headings, Source Sans 3 body)
   - Create spacing/grid system matching designTokens.js
   - Add illustration zones/frames for each page (from MASTER-HOOKUP.md)

2. **Create illustration style guide page** in Figma
   - Blue Ridge Mountain reference board (photos from Blue Ridge Parkway)
   - Approved color palettes for illustrations
   - Approved brush styles and texture patterns
   - "Do this / Not this" examples showing abstract vs hand-drawn quality

3. **Share Figma URL with crew + dallas** (cfutons_mobile needs it for mobile alignment)

### Phase 2: Skill-Up — Learn Figma Draw Illustration Techniques (Story Beads)

**Goal**: Research and document specific Figma Draw techniques for Blue Ridge mountain illustrations

#### Story 2a: Figma Draw Tool Mastery
- Learn Pencil tool for mountain ridgeline sketching
- Learn Brush tool with custom brushes for watercolor texture
- Master Stretch Brush (for mountain slope gradients) and Scatter Brush (for foliage/texture distribution)
- Practice noise fills, texture fills, progressive blur for atmospheric depth
- Document: which tool for which element (ridgelines, trees, sky, flowers, etc.)

#### Story 2b: Figma Community Asset Study
- Download and study [Mountains Landscape](https://www.figma.com/community/file/923678537960272601/mountains-landscape) community file
- Download and study [Mountains](https://www.figma.com/community/file/1111995131111640662/mountains) community file
- Download [Watercolours](https://www.figma.com/community/file/1145299048770913511/watercolours) texture pack
- Study [Figma Draw Playground](https://www.figma.com/community/file/1484549117658754259/figma-draw-playground) for technique examples
- Analyze: how do these achieve hand-drawn feel? What techniques can we steal?
- Reference: [Blue Ridge Mountains vectors on Vecteezy](https://www.vecteezy.com/free-vector/blue-ridge-mountains) (1,548 free vectors)

#### Story 2c: Hand Draw Plugin Evaluation
- Install and test "Hand Draw" plugin (transforms precise vectors into sketchy hand-drawn style)
- Test on our existing mountain ridgeline paths — does it improve them?
- Evaluate roughness levels and variation settings for Blue Ridge aesthetic
- Decision: adopt plugin or use native Figma Draw tools only?

#### Story 2d: SVG Export + Optimization Pipeline
- Learn Figma SVG export settings for clean output
- Evaluate SVGO optimization for removing Figma metadata bloat
- Test: Figma-designed SVG → export → inject into HtmlComponent → does it render correctly in Wix?
- Build pipeline: Figma → Export SVG → Optimize → Replace hardcoded colors with sharedTokens variables → Integrate

### Phase 3: Proof of Concept — Redesign One Illustration in Figma (Story Bead)

**Goal**: Take one existing illustration and recreate it in Figma Draw to prove the pipeline

- Pick MountainSkyline (the most visible, used on every page via masterPage)
- Design in Figma Draw using brushes, textures, and real illustration technique
- Export SVG, optimize, integrate into codebase
- Side-by-side comparison: old programmatic SVG vs new Figma-designed SVG
- Visual verification against design.jpeg
- If quality gap is significant → green light full migration

### Phase 4: Crew + Cross-Rig Knowledge Transfer (Story Beads)

**Goal**: Share findings with cfutons crew AND cfutons_mobile (dallas) so both rigs produce Figma-quality illustrations

#### 4a: cfutons Crew Guide
- Write `docs/guides/figma-illustration-workflow.md` with:
  - Figma file URL and how to access
  - Step-by-step: how to create a Blue Ridge mountain illustration in Figma Draw
  - Tool reference: which Figma tools for which visual elements
  - Export pipeline: Figma → SVG → optimize → codebase integration
  - Quality bar: updated from "8-point code checklist" to "Figma visual quality + code integration"
- Nudge each crew member (radahn, godfrey, miquella, rennala) with guide link
- Update CLAUDE.md illustration section to reflect Figma-first workflow

#### 4b: dallas / cfutons_mobile Coordination
- **Mail dallas** with full findings summary:
  - Figma file URL (once created)
  - Figma Draw techniques that port to mobile (SVG paths work 1:1 in React Native via react-native-svg)
  - Which Figma community assets to study for mobile illustration consistency
  - Export pipeline differences for mobile (React Native SVG component vs Wix HtmlComponent)
  - Shared brand token alignment: mobile sharedTokens must match web sharedTokens exactly
- **Cross-rig illustration standards doc**: shared principles for both web + mobile
  - Same mountain ridgeline style, same atmospheric depth approach
  - Mobile may need smaller viewBox variants (phone screen vs desktop banner)
  - dallas can plan mobile illustration sprints based on our POC findings
- **Figma component library**: design reusable mountain/sky/tree components in Figma that both rigs can use
  - Web exports full SVG for HtmlComponent injection
  - Mobile exports individual components for react-native-svg composition

### Phase 5: Full Migration — Redesign All Illustrations in Figma (Epic Bead)

**Goal**: Replace all 17 programmatic SVGs with Figma-designed illustrations

Priority order (by visibility):
1. MountainSkyline (masterPage header — every page)
2. comfortIllustrations (Product Page — highest traffic)
3. emptyStateIllustrations (8 scenes — most pages)
4. onboardingIllustrations (first-time user experience)
5. CartIllustrations (commerce flow)
6. aboutIllustrations (brand story)
7. contactIllustrations (held PR #153)

Plus: 24 pages with ZERO illustrations need new Figma-designed art

## Beads to Create

### Epic: Figma-First Illustration Pipeline
- **cf-hfly** (EXISTS): Create Figma design file + share URL → Phase 1
- **NEW P1 Epic**: "Figma illustration skill-up and pipeline" — parent for all below

### Stories (under epic):
1. **P1**: "Figma design system setup — brand tokens, typography, illustration zones"
2. **P1**: "Study Figma Draw tools — pencil, brush, noise, texture, progressive blur techniques"
3. **P2**: "Study Figma Community mountain/landscape assets — analyze techniques"
4. **P2**: "Evaluate Hand Draw plugin for sketchy vector transformation"
5. **P1**: "Build SVG export pipeline — Figma → optimize → brand token injection → Wix integration"
6. **P1**: "POC: Redesign MountainSkyline in Figma Draw — prove quality improvement"
7. **P1**: "Write crew illustration workflow guide — document findings for cfutons team"
8. **P1**: "Comm findings to dallas — Figma URL, techniques, cross-rig illustration standards"
9. **P2**: "Update CLAUDE.md — replace programmatic SVG directives with Figma-first workflow"
10. **P2**: "Create cross-rig illustration standards doc — shared principles for web + mobile"
11. **P2 Epic**: "Full illustration migration — redesign all 17 SVGs in Figma + 24 uncovered pages"

## Verification

- [ ] Figma file exists with brand design system
- [ ] At least 1 illustration redesigned in Figma with visible quality improvement
- [ ] SVG export pipeline tested end-to-end (Figma → Wix HtmlComponent)
- [ ] Crew guide document written and shared with all 4 crew members
- [ ] dallas/cfutons_mobile has Figma URL + illustration technique summary
- [ ] Side-by-side visual comparison: programmatic vs Figma-designed
- [ ] Cross-rig illustration standards documented

## Key Resources

- [Figma Draw illustration tools](https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools)
- [Figma MCP server guide](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server)
- [Figma Draw playground](https://www.figma.com/community/file/1484549117658754259/figma-draw-playground)
- [Mountains Landscape community file](https://www.figma.com/community/file/923678537960272601/mountains-landscape)
- [Watercolours texture pack](https://www.figma.com/community/file/1145299048770913511/watercolours)
- [Blue Ridge Mountains vectors (Vecteezy)](https://www.vecteezy.com/free-vector/blue-ridge-mountains)
- [Hand Draw plugin](https://www.figma.com/community) — search "Hand Draw" for vector-to-sketch transformation
- [Best Figma plugins for hand-drawn aesthetics 2026](https://www.illustration.app/blog/best-figma-plugins-for-creating-hand-drawn-aesthetics-in-2026)

## Existing Files to Update
- `/Users/hal/gt/cfutons/refinery/rig/MASTER-HOOKUP.md` — add Figma illustration pipeline section
- `/Users/hal/gt/cfutons/CLAUDE.md` — update illustration directives from programmatic to Figma-first
- `/Users/hal/gt/cfutons/refinery/rig/src/public/sharedTokens.js` — no changes (stays as color source of truth)
- New: `docs/guides/figma-illustration-workflow.md` — crew workflow guide
- New: `docs/plans/2026-03-04-figma-illustration-strategy-design.md` — this plan persisted
