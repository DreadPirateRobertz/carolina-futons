// TARGET: Homepage (c1dmp)
// DESCRIPTION: Replace 4 static category cards with a 6-item repeater for SHOP BY COLLECTIONS
// AUTHOR: godfrey
// DEPENDS: none
// PRIORITY: P0 — this enables the Velo code to dynamically populate all categories
//
// CONTEXT:
// Currently, the SHOP BY COLLECTIONS section has 4 hardcoded category cards:
//   - comp-lybfa708 (Futon Frames)
//   - comp-lybfds6j (Murphy Cabinet Beds)
//   - comp-lybfdwld (Platform Beds)
//   - comp-lybfdz8k (Mattresses)
//
// The Velo code (Home.js initCategoryShowcase) looks for a repeater with ID
// #categoryRepeater. Each repeater item should have:
//   - #categoryCard (container box)
//   - #categoryCardImage (image element)
//   - #categoryCardTitle (text element for category name)
//   - #categoryCardTagline (text element for tagline)
//   - #categoryCardCount (text element for product count)
//
// MANUAL STEPS (for melania in editor):
// 1. Select the SHOP BY COLLECTIONS section (comp-ly76uqq8)
// 2. Delete the 4 static category containers:
//    - comp-lybfa708 (Futon Frames)
//    - comp-lybfds6j (Murphy Cabinet Beds)
//    - comp-lybfdwld (Platform Beds)
//    - comp-lybfdz8k (Mattresses)
// 3. Add a Repeater (Wix: Add → List & Grid → Repeater)
//    - Set repeater ID to: categoryRepeater
//    - Place it below the "SHOP BY COLLECTIONS" heading (comp-lybfbg0x)
// 4. Design repeater item template:
//    - Add an Image → set ID to: categoryCardImage
//    - Add a Text element → set ID to: categoryCardTitle (for category name)
//    - Add a Text element → set ID to: categoryCardTagline (for tagline)
//    - Add a Text element → set ID to: categoryCardCount (for "X Products")
//    - Wrap all in a Box → set ID to: categoryCard
// 5. Style: 3 columns desktop, 2 columns tablet, 1 column mobile
//    - Card height: ~250px
//    - Image: fill mode, top of card
//    - Title: bold, Espresso (#3A2518), below image
//    - Tagline: regular, smaller, below title
//    - Count: small, Mountain Blue (#5B8FA8), bottom of card
// 6. Layout: spacing 20px gap between cards
//
// The Velo code will automatically:
// - Populate repeater.data with first 6 categories
// - Set images from getCategoryCardImage()
// - Set names, taglines, product counts
// - Add click handlers to navigate to category pages
// - Add hover effect (Coral accent)
//
// NO documentServices script needed — this is a visual editor task.
// The Velo code is already written and waiting for the repeater.

console.log('[godfrey] Homepage category repeater: MANUAL EDITOR TASK');
console.log('See script comments for step-by-step instructions.');
