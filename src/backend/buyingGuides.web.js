/**
 * @module buyingGuides
 * @description Category buying guide content engine for SEO pillar pages.
 * Serves structured buying guide content for all 8 product categories,
 * including comparison tables, FAQ sections, internal product links,
 * and structured data schemas (Article + FAQPage).
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateSlug } from 'backend/utils/sanitize';

const SITE_URL = 'https://www.carolinafutons.com';
const PUBLISHER = { name: 'Carolina Futons', logo: `${SITE_URL}/logo.png` };

// ── Category Buying Guides ──────────────────────────────────────────

const GUIDES = {
  'futon-frames': {
    slug: 'futon-frames',
    title: 'The Complete Futon Frame Buying Guide for 2026',
    metaDescription: 'Everything you need to know before buying a futon frame. Compare wood vs metal, sizes, styles, weight capacity, and top picks from Night & Day and KD Frames.',
    keywords: ['futon frame buying guide', 'best futon frame', 'wood futon frame', 'futon frame sizes', 'Night & Day futon frame'],
    heroImage: `${SITE_URL}/buying-guides/futon-frames-hero.jpg`,
    category: 'futon-frames',
    categoryLabel: 'Futon Frames',
    publishDate: '2026-02-20',
    updatedDate: '2026-02-20',
    sections: [
      {
        heading: 'Why the Frame Matters More Than You Think',
        body: 'Your futon frame is the foundation of your entire futon experience. A quality frame determines how comfortable your futon feels as a sofa, how smoothly it converts to a bed, and how many years of daily use you will get. Cheap frames wobble, squeak, and sag within months. A solid hardwood frame from a reputable manufacturer like Night & Day Furniture or KD Frames will serve you for 15 to 20 years with proper care.\n\nThe frame also determines what size mattress you can use, how much weight the futon supports, and whether you need wall clearance for reclining. These are details that matter for everyday comfort and long-term satisfaction. Choosing the right frame is the single most important decision in your futon purchase.\n\nA well-built frame also affects the resale value and longevity of your entire futon setup. Frames from established manufacturers hold their value over time because they are designed for decades of reliable service. Investing in a quality frame upfront means you can upgrade mattresses, covers, and accessories over the years without ever replacing the core structure.',
      },
      {
        heading: 'Wood vs Metal: Which Material Is Best?',
        body: 'Solid hardwood frames are the gold standard for futons. They are stronger, quieter, and more attractive than metal frames. Hardwood frames from Night & Day Furniture use plantation-grown rubberwood or parawood, sustainably harvested and kiln-dried for stability. These frames support 500 or more pounds and provide a flat, slatted sleeping surface that keeps your mattress properly ventilated.\n\nMetal frames are lighter and less expensive, typically costing 30 to 50 percent less than comparable wood frames. KD Frames offers quality metal designs that are sturdy and easy to assemble. However, metal frames can squeak at joint points over time and may flex under heavier loads. Metal is a good choice for guest rooms or lighter-use scenarios where budget is the primary concern.\n\nUnfinished wood frames offer a middle path. They cost less than pre-finished hardwood and allow you to stain or paint the frame to match your existing decor. These frames use the same quality construction as finished models, so you get the full structural benefit of solid wood at a lower price point.',
      },
      {
        heading: 'Understanding Futon Frame Sizes',
        body: 'Futon frames come in three standard sizes. Twin frames (39 by 75 inches) are perfect for kids rooms, dorm rooms, or compact spaces where a single sleeper needs a convertible sofa. Full-size frames (54 by 75 inches) are the most popular choice and fit the widest range of futon mattresses. Queen frames (60 by 80 inches) provide the most sleeping space and are ideal for couples or dedicated bedroom use.\n\nWhen measuring for your futon, remember that the frame footprint is larger than the mattress size. A full futon in sofa position typically measures about 38 inches deep and 82 inches wide. In bed position, the depth extends to approximately 54 inches. Always measure your room and doorways before purchasing to ensure the frame fits both in your space and through your door.\n\nIf you are furnishing a multi-purpose room that serves as both living area and guest bedroom, the full-size frame offers the best compromise between compact sofa dimensions and adequate sleeping surface. Queen frames provide generous sleeping space but occupy noticeably more floor area in sofa mode, so they work best in rooms dedicated primarily to sleeping use.',
      },
      {
        heading: 'Frame Styles and Features',
        body: 'Wall hugger frames are designed for apartments and smaller rooms. They slide forward as they recline, so the frame can sit flush against the wall in both sofa and bed positions. This saves 12 to 18 inches of floor space compared to standard frames. The Dillon Wall Hugger from Strata Furniture is one of our most popular space-saving models. Wall huggers use a clever mechanical design that shifts the entire seat base forward as the backrest drops, maintaining the same total footprint in both positions.\n\nStandard frames require clearance behind the sofa for reclining. They tend to be simpler in construction and less expensive. Arm style is another important consideration. Tray arms provide flat surfaces for drinks and remote controls. Rounded arms create a more traditional sofa look. Armless designs maximize sleeping width and minimize the frame footprint. Some people prefer the clean look of armless futons for modern interiors, while arm styles add structure and a sofa-like appearance to the room.\n\nSome frames include built-in storage drawers beneath the seat. These are especially valuable in small spaces where every square foot counts. Storage drawers add 4 to 6 inches of height to the frame, so factor that into your comfort preferences for seating height. Night & Day Furniture offers matching drawer sets for most of their hardwood frames, keeping linens hidden and accessible.',
      },
      {
        heading: 'What to Look For: A Quick Checklist',
        body: 'When shopping for a futon frame, check the weight capacity first. Any frame you plan to use for sleeping should support at least 500 pounds. This ensures stability for two adults and accounts for the dynamic forces of sitting down and getting up. Frames rated below 400 pounds are intended for light occasional use only.\n\nExamine the sleeping surface construction. Flat slatted decks provide the best mattress support and airflow. Slats should be spaced no more than 3 inches apart to prevent mattress sagging between them. Avoid frames with thin wire grids or mesh supports, which create uneven sleeping surfaces and accelerate mattress wear.\n\nTest the conversion mechanism if possible. A good futon frame converts smoothly from sofa to bed with one fluid motion. Stiff or jerky mechanisms indicate poor construction and will become worse over time. Night & Day frames use precision-engineered hardware that maintains smooth operation for the life of the frame.\n\nConsider the finish options available. Most quality frames come in multiple stain colors to match your room decor. Popular finishes include natural, honey oak, cherry, espresso, and black walnut. Choose a finish that complements your existing furniture and flooring. Unfinished frames give you complete control over the final color through custom staining or painting.\n\nFinally, check the warranty offered with the frame. Reputable manufacturers like Night & Day Furniture back their hardwood frames with warranties that cover structural defects for five years or more. A strong warranty indicates the manufacturer stands behind their construction quality and expects the frame to last.',
      },
    ],
    comparisonTable: {
      title: 'Futon Frame Material Comparison',
      headers: ['Feature', 'Solid Hardwood', 'Metal', 'Unfinished Wood'],
      rows: [
        ['Durability', '15-20 years', '8-12 years', '15-20 years'],
        ['Weight Capacity', '500-750 lbs', '300-500 lbs', '500-750 lbs'],
        ['Noise Level', 'Very quiet', 'May squeak', 'Very quiet'],
        ['Price Range', '$400-$900', '$150-$400', '$300-$700'],
        ['Assembly Time', '30-60 min', '20-40 min', '30-60 min'],
        ['Aesthetics', 'Premium finish', 'Modern/industrial', 'Customizable'],
        ['Best For', 'Daily use', 'Guest rooms', 'DIY / matching decor'],
      ],
    },
    productLinks: [
      { text: 'Browse Futon Frames', url: '/futon-frames' },
      { text: 'Shop Wall Hugger Frames', url: '/wall-huggers' },
      { text: 'See Unfinished Wood Frames', url: '/unfinished-wood' },
    ],
    faqs: [
      {
        question: 'What is the best futon frame for everyday use?',
        answer: 'Solid hardwood frames from Night & Day Furniture are best for everyday use. They support 500 or more pounds, provide flat slatted sleeping surfaces, and last 15 to 20 years. The Eureka and Vienna models are top sellers for daily use. Avoid lightweight metal frames for nightly sleeping.',
      },
      {
        question: 'How much should I spend on a futon frame?',
        answer: 'Plan to spend 400 to 700 dollars for a quality solid wood frame that will last. Metal frames start around 150 dollars but may need replacement sooner. Consider the frame an investment: a 500 dollar hardwood frame used daily for 15 years costs less than 10 cents per day.',
      },
      {
        question: 'What is the difference between a wall hugger and standard futon frame?',
        answer: 'A wall hugger frame slides forward as it reclines so it can sit flush against the wall in both sofa and bed positions. Standard frames need 12 to 18 inches of clearance behind them for the backrest to recline. Wall huggers are ideal for apartments and rooms where space is limited.',
      },
      {
        question: 'Can I use any mattress on a futon frame?',
        answer: 'No. You must use a futon mattress designed to fold between sofa and bed positions. Regular mattresses will be damaged by the folding mechanism. Futon mattresses come in sizes that match specific frame dimensions: Twin, Full, or Queen.',
      },
      {
        question: 'Do futon frames come assembled?',
        answer: 'Most futon frames require assembly. Solid wood frames from Night & Day typically take 30 to 60 minutes with basic household tools. KD Frames are specifically designed for easy knockdown assembly and disassembly, which is convenient for moves or navigating tight stairways.',
      },
    ],
  },

  'mattresses': {
    slug: 'mattresses',
    title: 'Futon Mattress Buying Guide: Thickness, Fill Types & Comfort',
    metaDescription: 'Choose the perfect futon mattress. Compare innerspring vs foam, understand thickness options, and find the right firmness for sitting and sleeping comfort.',
    keywords: ['futon mattress buying guide', 'best futon mattress', 'futon mattress thickness', 'innerspring futon mattress', 'Otis Bed mattress'],
    heroImage: `${SITE_URL}/buying-guides/mattresses-hero.jpg`,
    category: 'mattresses',
    categoryLabel: 'Futon Mattresses',
    publishDate: '2026-02-20',
    updatedDate: '2026-02-20',
    sections: [
      {
        heading: 'Why Your Mattress Choice Matters Most',
        body: 'The mattress determines 80 percent of your comfort on a futon. You can have the finest hardwood frame in the world, but a thin or low-quality mattress will leave you uncomfortable for both sitting and sleeping. A great futon mattress needs to balance two conflicting demands: firm enough to provide back support for sitting, and cushioned enough to deliver comfortable sleep.\n\nModern futon mattresses have evolved far beyond the thin cotton pads of decades past. Today you can choose from innerspring mattresses with individually pocketed coils, high-density memory foam, natural latex, and hybrid constructions that combine multiple materials. Brands like Otis Bed have engineered mattresses specifically for the dual demands of futon use, with CertiPUR-US certified foams and reinforced edges.\n\nThe mattress also affects how easily the futon converts between sofa and bed modes. A well-designed futon mattress folds cleanly along its hinge point without bunching or resisting. Cheap mattresses with uneven fill or poor stitching tend to fight the fold, making daily conversion a chore. Quality construction ensures smooth, effortless transitions that you will appreciate every single day.',
      },
      {
        heading: 'Understanding Mattress Thickness',
        body: 'Mattress thickness is the single most important specification for futon comfort. For everyday sleeping, choose a mattress that is 8 to 10 inches thick. This provides enough cushioning for side sleepers and enough support for back sleepers. Mattresses in the 8 to 10 inch range also fold well on most standard futon frames.\n\nFor occasional or guest use, 6 to 8 inches provides good comfort at a lower price point. Mattresses under 6 inches should be reserved for decorative futons or very light use. Keep in mind that thicker mattresses are heavier and slightly harder to fold, so consider your daily conversion routine. A 10-inch queen mattress can weigh 70 to 90 pounds. Consider whether you will convert the futon daily or only occasionally, as this directly affects how much mattress weight you want to manage during each transition.',
      },
      {
        heading: 'Fill Types Compared',
        body: 'Innerspring mattresses use steel coil systems inside foam and fiber layers. They offer excellent support, airflow, and durability. The Otis Bed innerspring line uses individually pocketed coils that reduce motion transfer and conform to your body. Innerspring mattresses are the best choice for heavy daily use and people who sleep hot.\n\nMemory foam mattresses contour to your body shape and relieve pressure points. They are excellent for side sleepers and people with joint pain. The downside is that foam retains more heat than innerspring and may feel too soft for sitting. High-density foam (1.8 or higher pounds per cubic foot) maintains its shape longer and provides better support than low-density alternatives.\n\nCotton and polyester blend mattresses are the most affordable option. They provide a firm sitting surface but compress and flatten over time, especially with daily sleeping. These mattresses work best for futons used primarily as sofas with occasional overnight guests. Plan to replace a cotton mattress every 3 to 5 years with daily use.\n\nLatex futon mattresses are a premium option gaining popularity. Natural latex is hypoallergenic, inherently antimicrobial, and extremely durable. Latex mattresses offer a responsive bounce that differs from the slow contouring of memory foam. They sleep cooler than foam and maintain consistent support for a decade or more. The main drawback is cost, as latex mattresses typically run 20 to 40 percent more than comparable innerspring models.',
      },
      {
        heading: 'Firmness and Comfort',
        body: 'Futon mattress firmness exists on a spectrum from plush to extra firm. Medium firm is the most versatile option for futons that serve as both sofa and bed. This firmness level provides enough resistance for comfortable seated posture while still cushioning your body for sleep. Most customers find that medium firm mattresses need no break-in period and feel comfortable from the first night.\n\nPlush mattresses feel softer and are preferred by side sleepers, but they may feel too soft for sitting. Firm mattresses provide excellent back support and a solid seating surface, but stomach and side sleepers may find them uncomfortable. If you prioritize sleeping comfort, lean slightly toward the plush end. If the futon is primarily a sofa, lean toward firm. You can also adjust perceived firmness by adding a mattress topper to customize the feel without replacing the entire mattress.\n\nEdge support matters for futons that function as sofas. Reinforced edges prevent the feeling of rolling off when you sit on the edge. Otis Bed mattresses include reinforced perimeters specifically for futon use. This extra edge construction also prevents the mattress from sagging over the sides of the frame during conversion between sofa and bed positions.\n\nIf possible, test mattress firmness in person before purchasing. Firmness descriptions vary between manufacturers, so one brand\'s medium firm may feel different from another\'s. Lying on the mattress for at least five minutes gives your body time to settle and provides a more accurate impression of the comfort level you can expect at home.',
      },
      {
        heading: 'Mattress Care and Longevity',
        body: 'Proper care dramatically extends the life of your futon mattress. Rotate the mattress head to foot every three months to distribute wear evenly across the sleeping surface. Some mattresses feature no-turn design, meaning you only rotate but never flip. Check the manufacturer label for specific rotation instructions for your mattress model.\n\nAlways use a mattress protector or fitted cover to shield against spills, sweat, and dust mites. A quality protector costs 30 to 50 dollars and can add years to your mattress life. Waterproof protectors are essential if the futon is in a space used by children or near food and beverages.\n\nVacuum the mattress surface monthly using an upholstery attachment to remove dust, dead skin cells, and allergens. Spot clean stains immediately with a mild detergent and damp cloth. Never soak a futon mattress as excess moisture can damage foam layers and promote mold growth. Air the mattress in direct sunlight quarterly when possible to eliminate moisture and refresh the materials.\n\nAvoid folding the mattress in the same direction every time. Most futon mattresses have a natural fold point, but alternating the fold side when possible helps maintain even compression across the entire surface. When the futon is in bed position, allow the mattress to lay flat for at least a few hours before sleeping to let it fully expand from its folded position.',
      },
    ],
    comparisonTable: {
      title: 'Futon Mattress Fill Type Comparison',
      headers: ['Feature', 'Innerspring', 'Memory Foam', 'Cotton/Poly Blend'],
      rows: [
        ['Comfort (sleeping)', 'Excellent', 'Excellent', 'Fair'],
        ['Comfort (sitting)', 'Very good', 'Good', 'Very good'],
        ['Durability', '10-15 years', '8-12 years', '3-5 years'],
        ['Breathability', 'Excellent', 'Fair', 'Good'],
        ['Price Range', '$300-$700', '$250-$600', '$100-$250'],
        ['Weight (Full)', '50-70 lbs', '40-60 lbs', '25-40 lbs'],
        ['Best For', 'Daily sleepers', 'Side sleepers', 'Guest rooms'],
      ],
    },
    productLinks: [
      { text: 'Shop All Futon Mattresses', url: '/mattresses' },
      { text: 'Otis Bed Collection', url: '/mattresses?brand=otis-bed' },
      { text: 'Pair with a Frame', url: '/futon-frames' },
    ],
    faqs: [
      {
        question: 'What is the best futon mattress for everyday sleeping?',
        answer: 'An 8 to 10 inch innerspring mattress from Otis Bed is our top recommendation for everyday sleeping. Innerspring mattresses provide the best combination of support, breathability, and durability for nightly use. Choose CertiPUR-US certified models for chemical safety and foam quality.',
      },
      {
        question: 'How thick should a futon mattress be for daily use?',
        answer: 'For daily sleeping, choose 8 to 10 inches. For occasional guest use, 6 to 8 inches is comfortable. Mattresses under 6 inches are only suitable for decorative or very light sitting use. Thicker mattresses cost more but provide significantly better comfort and longevity.',
      },
      {
        question: 'Can I use a regular bed mattress on a futon frame?',
        answer: 'No. Regular mattresses cannot fold and will be damaged by futon frame mechanisms. Futon mattresses are specifically engineered to flex between flat and folded positions while maintaining comfort and structural integrity. Always use a mattress designed for futon use.',
      },
      {
        question: 'How long does a futon mattress last?',
        answer: 'Quality innerspring and memory foam futon mattresses last 10 to 15 years with proper care. Rotate the mattress every 3 to 6 months and use a washable cover to extend its life. Cotton and blend mattresses typically last 3 to 5 years with daily use.',
      },
      {
        question: 'Are futon mattresses good for back pain?',
        answer: 'Yes. Medium firm to firm futon mattresses provide excellent back support. Innerspring mattresses with pocketed coils conform to your spine while maintaining support. If you have chronic back pain, choose an 8 to 10 inch innerspring or high-density foam mattress rated medium firm.',
      },
    ],
  },

  'covers': {
    slug: 'covers',
    title: 'Futon Cover Buying Guide: Fabrics, Sizes & Style Tips',
    metaDescription: 'Find the perfect futon cover. Compare 700+ fabric options, understand sizing, and learn care tips. Protect your mattress and transform your room style.',
    keywords: ['futon cover buying guide', 'best futon cover', 'futon cover fabric', 'futon slipcover', 'custom futon cover'],
    heroImage: `${SITE_URL}/buying-guides/covers-hero.jpg`,
    category: 'covers',
    categoryLabel: 'Futon Covers',
    publishDate: '2026-02-20',
    updatedDate: '2026-02-20',
    sections: [
      {
        heading: 'Why Every Futon Needs a Cover',
        body: 'A futon cover is not just decorative. It protects your mattress investment from spills, pet hair, body oils, and daily wear. A good cover extends the life of your mattress by years. It also transforms the look of your room instantly. Changing a futon cover is the easiest and most affordable way to update your living space without buying new furniture.\n\nCovers also improve comfort. Soft cotton covers breathe well for warm climates. Microfiber covers add a layer of cushioning. Performance fabrics resist stains and moisture for households with children or pets. With over 700 fabric options available, you can find the perfect combination of function and style. Replacing a worn or outdated cover costs a fraction of buying a new futon, making covers one of the most cost-effective ways to refresh your furniture and extend the useful life of your mattress investment.',
      },
      {
        heading: 'Fabric Options Explained',
        body: 'Cotton twill is the most popular futon cover fabric. It is durable, breathable, and available in dozens of solid colors. Cotton softens with each wash and provides a comfortable, natural feel. It is ideal for everyday living rooms and bedrooms where breathability matters.\n\nMicrofiber and microsuede covers have a soft, velvety texture that resists pilling and fading. They are easier to spot clean than cotton and provide a slightly more upscale look. Microfiber works especially well in modern and contemporary room designs.\n\nPerformance fabrics like Sunbrella and Crypton are engineered for durability and stain resistance. These covers repel liquids, resist fading from sunlight, and clean up easily with soap and water. Performance fabrics cost more but are the best choice for families with young children, pets, or futons in high-traffic areas.\n\nDenim and canvas covers offer a casual, rugged look. They are among the most durable fabrics and develop a comfortable patina over time. These covers work well in rec rooms, basements, and casual family spaces.\n\nLinen and linen-blend covers have a naturally textured, relaxed look that suits modern and farmhouse decor. Linen is highly breathable and stays cool in summer, though it wrinkles more easily than other fabrics. If you prefer a crisp appearance, linen blends that incorporate polyester reduce wrinkling while retaining the organic aesthetic.',
      },
      {
        heading: 'Getting the Right Size',
        body: 'Futon covers come in standard sizes that match futon mattress dimensions. A full-size cover fits mattresses that are 54 by 75 inches. Queen covers fit 60 by 80 inch mattresses. Twin covers fit 39 by 75 inch mattresses. Always measure your actual mattress before ordering because sizing can vary slightly between manufacturers.\n\nMattress thickness affects cover fit. Most standard covers accommodate mattresses 6 to 8 inches thick. If your mattress is 10 inches or thicker, look for deep pocket or extra-deep covers that provide enough material to wrap around the full thickness without pulling or straining at the seams.\n\nCustom covers are available for non-standard mattress sizes or unusual frame configurations. Custom orders take 2 to 4 weeks but ensure a perfect fit. Contact us for custom cover quotes on any mattress size.\n\nWhen ordering a cover online, double-check whether the listed dimensions refer to the mattress size the cover fits or the cover dimensions themselves. A cover labeled full-size is designed to fit a full-size mattress, not to measure 54 by 75 inches when laid flat. The cover will measure slightly larger to accommodate the mattress thickness and allow for easy installation and removal.',
      },
      {
        heading: 'Care and Maintenance',
        body: 'Most removable futon covers are machine washable on a gentle cycle with cold water. Remove the cover before washing and close all zippers to prevent snagging. Tumble dry on low heat or air dry. Avoid high heat which can cause shrinkage, especially with cotton covers. Pre-treat any visible stains before putting the cover in the machine for best results.\n\nSpot clean minor stains immediately with a damp cloth and mild detergent. For performance fabric covers, soap and water handle most spills. Blot rather than rub to prevent spreading the stain. Washing covers every one to two months keeps them fresh and extends mattress life. Enzyme-based cleaners work well for organic stains like food, sweat, and pet accidents.\n\nKeep a spare cover on hand for quick changes during laundry days or when guests arrive. Rotating between two covers extends the life of each and keeps your futon looking fresh. Many customers buy one neutral solid cover for everyday use and a second patterned or seasonal cover for variety. Store the spare cover in a zippered fabric bag or an under-frame drawer to keep it clean, dust-free, and ready for a quick swap whenever you want a fresh look or need to launder the current cover.',
      },
      {
        heading: 'Choosing Colors and Patterns',
        body: 'Color selection depends on your room design and lifestyle. Neutral tones like gray, navy, charcoal, and cream are the safest choices for living rooms. They hide minor stains and blend with most decor styles. Earth tones like sage, terracotta, and sand create a warm, inviting atmosphere. Bold colors like crimson, teal, and mustard make the futon a statement piece.\n\nPatterns add visual interest but require more thought to coordinate with the room. Geometric patterns work well in modern spaces. Stripes are classic and versatile. Floral patterns suit traditional and cottage-style rooms. If you choose a patterned cover, keep throw pillows in solid coordinating colors to avoid visual clutter.\n\nConsider the practical side of color choice. Lighter colors show stains more easily and require more frequent washing. Darker colors hide wear better but may fade more noticeably in direct sunlight. Medium tones offer the best balance of aesthetics and practicality for daily use. Performance fabrics maintain their color better than cotton regardless of the shade you choose.\n\nFree fabric swatches let you see and feel the material before committing to a full cover. Order three to five swatches in your preferred colors and hold them against your futon frame and room walls in both natural and artificial light. Colors look different under different lighting conditions, so testing in your actual room is important for making the right choice. Take advantage of free swatch programs whenever available, as the small effort of ordering samples saves you from the much larger hassle of returning a full cover that does not match your expectations.',
      },
    ],
    comparisonTable: {
      title: 'Futon Cover Fabric Comparison',
      headers: ['Feature', 'Cotton Twill', 'Microfiber', 'Performance Fabric', 'Denim/Canvas'],
      rows: [
        ['Softness', 'Good', 'Excellent', 'Good', 'Fair (softens with age)'],
        ['Durability', 'Good', 'Very good', 'Excellent', 'Excellent'],
        ['Stain Resistance', 'Low', 'Medium', 'Excellent', 'Medium'],
        ['Breathability', 'Excellent', 'Good', 'Good', 'Fair'],
        ['Price Range', '$40-$80', '$50-$100', '$80-$150', '$50-$90'],
        ['Machine Washable', 'Yes', 'Yes', 'Most', 'Yes'],
        ['Best For', 'Everyday use', 'Modern decor', 'Kids/pets', 'Casual rooms'],
      ],
    },
    productLinks: [
      { text: 'Browse All Futon Covers', url: '/futon-covers' },
      { text: 'View All 700+ Fabrics', url: '/fabrics' },
      { text: 'Request Free Swatches', url: '/fabric-samples' },
    ],
    faqs: [
      {
        question: 'How do I measure for a futon cover?',
        answer: 'Measure the length, width, and thickness of your futon mattress. Standard full-size covers fit 54 by 75 inch mattresses. Standard covers accommodate mattresses 6 to 8 inches thick. For mattresses 10 inches or thicker, order a deep pocket cover. When in doubt, contact us with your measurements for a recommendation.',
      },
      {
        question: 'Can I machine wash my futon cover?',
        answer: 'Most futon covers are machine washable on a gentle cycle with cold water. Close all zippers before washing. Tumble dry on low or air dry to prevent shrinkage. Check the care label for specific instructions. Performance fabric covers may only need spot cleaning with soap and water.',
      },
      {
        question: 'What is the best futon cover for pets?',
        answer: 'Performance fabrics like Crypton or Sunbrella are the best choice for pet owners. They resist scratching, repel pet hair, and clean up easily. These covers handle claws, drool, and accidents much better than standard cotton or microfiber. The extra cost is worthwhile for pet households.',
      },
      {
        question: 'How often should I replace my futon cover?',
        answer: 'A quality futon cover lasts 2 to 5 years depending on fabric type and usage. Replace the cover when it shows significant fading, pilling, or worn spots. Having two covers that you rotate extends the life of each. Performance fabric covers typically last the longest.',
      },
      {
        question: 'Can I get a custom futon cover?',
        answer: 'Yes. We offer custom covers for non-standard mattress sizes and special frame configurations. Choose from our full library of 700 plus fabrics. Custom orders take 2 to 4 weeks. Contact us with your mattress dimensions for a custom cover quote.',
      },
    ],
  },

  'pillows': {
    slug: 'pillows',
    title: 'Futon Pillow & Cushion Guide: Throw Pillows, Bolsters & More',
    metaDescription: 'Complete your futon with the right pillows and cushions. Decorative throws, functional bolsters, and neck support pillows for sitting and sleeping comfort.',
    keywords: ['futon pillows', 'throw pillows for futon', 'futon bolster pillow', 'decorative futon pillows', 'futon cushion guide'],
    heroImage: `${SITE_URL}/buying-guides/pillows-hero.jpg`,
    category: 'pillows',
    categoryLabel: 'Pillows & Cushions',
    publishDate: '2026-02-20',
    updatedDate: '2026-02-20',
    sections: [
      {
        heading: 'Pillows Transform Your Futon Experience',
        body: 'Pillows and cushions turn a basic futon into a comfortable, stylish seating area. The right combination of decorative throw pillows, functional bolsters, and support cushions makes your futon look intentional and feel inviting. Pillows also solve a common futon complaint: the flat backrest. Adding pillow depth behind your back creates a more comfortable seated position.\n\nBeyond aesthetics, the right pillows improve sleeping comfort too. A quality neck pillow makes the difference between waking up refreshed and waking up with a stiff neck. Bolster pillows placed along the frame edges create a barrier that prevents that uncomfortable feeling of being too close to the hard wood or metal frame.\n\nInvesting in quality pillows is one of the most affordable upgrades you can make to a futon. A complete set of throw pillows, a lumbar cushion, and sleeping pillows typically costs 75 to 150 dollars total. That modest investment transforms both the look and the comfort of your futon, making it feel like a deliberately styled piece of furniture rather than a bare mattress on a frame.',
      },
      {
        heading: 'Types of Futon Pillows',
        body: 'Throw pillows are the most common decorative addition to futons. Standard sizes are 18 by 18 inches and 20 by 20 inches. Use three to five throw pillows on a full-size futon for a complete look. Mix sizes and textures for visual interest while keeping the color palette cohesive. Removable zippered covers let you change looks seasonally.\n\nBolster pillows are cylindrical cushions that serve both decorative and functional purposes. Place them along the arms of your futon for a polished sofa look. Bolsters also work as neck support pillows when sleeping on the futon. Standard bolster sizes are 6 to 8 inches in diameter and 20 to 36 inches long.\n\nLumbar support pillows are smaller rectangular pillows designed to support the lower back curve while sitting. They are typically 12 by 18 inches and filled with firm foam or memory foam. A single lumbar pillow dramatically improves seated comfort on a futon, especially for people who sit for long periods.\n\nBody pillows and sleeping pillows are functional rather than decorative. Store them when the futon is in sofa mode and bring them out for sleeping. A standard 20 by 26 inch sleeping pillow works well for futon beds. Side sleepers may prefer a full body pillow for added support.',
      },
      {
        heading: 'Choosing Fill and Fabric',
        body: 'Polyester fiberfill is the most common and affordable pillow fill. It is lightweight, hypoallergenic, and machine washable. Polyester pillows flatten over time and may need fluffing or replacement every 1 to 2 years with daily use.\n\nDown and down-alternative fills provide a premium, luxurious feel. Down pillows are softer and more moldable than polyester. Down-alternative offers similar softness with hypoallergenic properties and lower cost. Both down and down-alternative pillow fills hold their loft longer than polyester.\n\nFoam fills including memory foam and latex are best for support pillows and lumbar cushions. They maintain their shape under pressure and provide consistent support. Foam pillows are not typically machine washable, so use removable covers for easy cleaning.\n\nFabric selection should complement your futon cover. Cotton, linen, and velvet are popular choices for decorative pillows. Performance fabrics work well if you have children or pets. Indoor-outdoor fabrics are ideal for sunrooms or enclosed porches where moisture and sunlight exposure are concerns. When mixing fabrics, vary the texture rather than the color for a sophisticated look that avoids visual chaos. Pair a smooth cotton pillow with a nubby woven one in the same color family for added depth.',
      },
      {
        heading: 'Styling Tips for Futon Pillows',
        body: 'Start with two larger pillows (20 by 20 inches) in corners as your base layer. Add two to three smaller pillows (18 by 18 inches) in front for a layered look. Include one accent pillow in a contrasting texture or pattern for visual interest. This arrangement works on both full and queen futons and creates visual depth that makes the futon look intentional and well-designed.\n\nCoordinate pillow colors with your futon cover and room decor. Choose two to three colors maximum for a cohesive look. One solid color to match the cover, one complementary color, and one pattern that incorporates both colors. This simple formula creates a designer look without overthinking the arrangement. When in doubt, order fabric swatches and hold them against your existing cover to test the combination before purchasing.\n\nFor futons in bedrooms or guest rooms, keep fewer decorative pillows so conversion between sofa and bed modes is quick. Three total pillows is a good number for dual-use futons. Store sleeping pillows in a decorative basket nearby for easy access. The fewer obstacles between you and a comfortable bed, the more likely you are to enjoy using the futon for sleeping.\n\nSeasonal pillow swaps are an easy way to refresh your living space without buying new furniture. Keep a set of warm-toned pillows for fall and winter and a lighter, brighter set for spring and summer. Zippered pillow covers make seasonal changes simple: swap the covers rather than buying entirely new pillows each season. This approach is budget friendly and keeps your futon looking current year-round.',
      },
      {
        heading: 'Pillow Care and Replacement',
        body: 'Most polyester and down-alternative throw pillows are machine washable on a gentle cycle with cold water. Wash two pillows at a time to keep the washing machine balanced. Tumble dry on low heat with a clean tennis ball or dryer ball to restore loft and prevent clumping. Foam-filled pillows cannot be machine washed. Instead, spot clean the surface and wash only the removable cover.\n\nReplace throw pillows when they no longer hold their shape or spring back when compressed. A good test is to fold the pillow in half. If it stays folded rather than springing back open, the fill is compressed beyond recovery and the pillow should be replaced. Most polyester-filled throw pillows last one to two years with daily use. Down and down-alternative pillows last two to four years.\n\nBolster and lumbar pillows with foam cores last longer than soft-filled pillows because foam maintains its shape under repeated compression. However, foam does break down over time and will eventually lose its supportive properties. Replace foam support pillows every three to five years or when you notice decreased firmness and support.',
      },
    ],
    comparisonTable: {
      title: 'Futon Pillow Type Comparison',
      headers: ['Feature', 'Throw Pillows', 'Bolsters', 'Lumbar Support', 'Sleeping Pillows'],
      rows: [
        ['Primary Use', 'Decoration', 'Arm support', 'Back support', 'Sleeping'],
        ['Standard Size', '18"×18" / 20"×20"', '6-8"×24-36"', '12"×18"', '20"×26"'],
        ['Recommended Qty', '3-5', '2', '1', '1-2'],
        ['Fill Type', 'Poly or down', 'Poly or foam', 'Foam', 'Poly or down'],
        ['Price Range', '$15-$40 each', '$20-$50 each', '$25-$45', '$15-$35'],
        ['Machine Washable', 'Usually yes', 'Cover only', 'Cover only', 'Usually yes'],
        ['Best For', 'Style upgrade', 'Edge comfort', 'Sitting posture', 'Overnight use'],
      ],
    },
    productLinks: [
      { text: 'Shop Throw Pillows', url: '/pillows-cushions' },
      { text: 'Browse Bolster Pillows', url: '/pillows-cushions?type=bolster' },
      { text: 'Match with Futon Covers', url: '/futon-covers' },
    ],
    faqs: [
      {
        question: 'How many throw pillows should I put on my futon?',
        answer: 'Three to five throw pillows work well on a full or queen futon. Start with two larger pillows in the corners and add two to three smaller ones in front. For futons that convert to beds frequently, keep it to three pillows for easier transition between modes.',
      },
      {
        question: 'What size pillows work best on a futon?',
        answer: 'Standard 18 by 18 inch and 20 by 20 inch throw pillows are the best sizes for futons. Larger pillows (22 to 24 inches) can overwhelm a full-size futon. Combine two sizes for visual depth. Add one bolster pillow along each arm for a finished sofa look.',
      },
      {
        question: 'Are bolster pillows worth it for a futon?',
        answer: 'Yes. Bolster pillows serve double duty as decorative arm accents and functional neck support for sleeping. They also create a barrier between you and the hard frame edge when sleeping. A pair of quality bolsters is one of the best comfort upgrades for a futon.',
      },
      {
        question: 'How do I wash futon throw pillows?',
        answer: 'Most polyester and down-alternative throw pillows are machine washable on a gentle cycle. Use cold water and tumble dry on low. Foam-filled pillows should only have their removable covers washed. Check the care label on each pillow. Spot clean when possible to extend pillow life.',
      },
      {
        question: 'What pillows help with back support on a futon?',
        answer: 'A lumbar support pillow (12 by 18 inches with firm foam fill) provides the best back support while sitting on a futon. Place it behind your lower back to maintain the natural spine curve. Memory foam lumbar pillows conform to your body shape for personalized support.',
      },
    ],
  },

  'storage': {
    slug: 'storage',
    title: 'Futon Storage Solutions: Drawers, Shelves & Space-Saving Ideas',
    metaDescription: 'Maximize space with futon storage solutions. Under-frame drawers, casegoods, nightstands, and accessories to keep your room organized and clutter-free.',
    keywords: ['futon storage', 'under futon storage', 'futon with drawers', 'small space storage', 'casegoods furniture'],
    heroImage: `${SITE_URL}/buying-guides/storage-hero.jpg`,
    category: 'casegoods-accessories',
    categoryLabel: 'Storage & Accessories',
    publishDate: '2026-02-20',
    updatedDate: '2026-02-20',
    sections: [
      {
        heading: 'Storage Is Essential for Futon Living',
        body: 'Futons are often chosen for smaller spaces where every square foot matters. That makes storage solutions essential. Where do you put the bedding when the futon is in sofa mode? Where do guests keep their luggage? How do you keep the living room tidy when it doubles as a bedroom? Smart storage solves all these challenges.\n\nThe good news is that futon furniture manufacturers have designed excellent storage solutions that complement their frames. Under-frame drawers, matching casegoods, and clever accessory storage let you maintain a clean, organized space even when your futon does double duty as sofa and bed.\n\nPlanning your storage strategy before you purchase your futon is smart. Consider what items you need to store — bedding, pillows, clothing, or personal belongings — and choose storage solutions that accommodate those specific needs. A thoughtful storage plan keeps your room tidy and makes the daily sofa-to-bed conversion effortless rather than frustrating.',
      },
      {
        heading: 'Under-Frame Storage Drawers',
        body: 'Many futon frames from Night & Day Furniture include optional under-frame storage drawers. These drawers mount beneath the frame and slide out on smooth rails. They are perfect for storing bedding, extra pillows, seasonal covers, and guest linens. Under-frame drawers use otherwise wasted space and keep bedding hidden and dust-free. This is the single best storage upgrade for any futon setup.\n\nDrawer dimensions vary by frame model but typically provide 4 to 6 inches of storage height across the full width of the frame. Two-drawer sets are the most common configuration. The drawers match the frame finish for a seamless, integrated look. They add about 50 to 100 dollars to the frame price and are worth every penny for organized living.\n\nInstallation is straightforward. Drawers attach to the underside of the frame using pre-drilled mounting points. Most installations take 15 to 20 minutes with basic tools. The drawers ride on smooth ball-bearing slides that allow one-handed operation even when fully loaded. A single drawer can hold a complete set of sheets, a blanket, and two pillows — everything needed to convert the futon from sofa to bed in under a minute.',
      },
      {
        heading: 'Matching Casegoods and Nightstands',
        body: 'Night & Day Furniture produces matching casegoods that coordinate with their futon frames. Nightstands with drawers and shelves provide bedside storage for books, phones, and personal items. Dressers and chests from the same collection use matching finishes and hardware for a cohesive bedroom look. The Clove, Pepper, and Rosemary collections each offer a range of casegoods that complement their respective frame designs.\n\nNightstands are the most popular casegood for futon rooms. They provide a surface for a lamp, alarm clock, and phone charger, plus drawer storage for personal items. A pair of matching nightstands flanking the futon creates a balanced, bedroom-like arrangement even in a multipurpose space. Choose nightstands with at least one drawer and one open shelf for maximum utility.\n\nWhen your futon lives in a multi-purpose room, casegoods help define zones. A nightstand beside the futon signals that this is also a sleeping area. A small bookshelf or media console opposite the futon defines the entertainment zone. Matching finishes tie everything together into a deliberate, designed space rather than a mismatched collection of furniture. Dressers provide additional clothing storage when the futon serves as a primary bed in a studio apartment or spare bedroom. When selecting casegoods, consider the overall room layout and traffic flow. Nightstands should be accessible from the bed position without blocking pathways, and dressers work best against walls that are not needed for futon conversion clearance.',
      },
      {
        heading: 'Creative Storage Accessories',
        body: 'Ottoman storage benches placed at the foot of the futon provide hidden storage and extra seating. They come in fabric-covered options that complement your futon cover. Use them to store blankets, board games, or extra pillows. When guests arrive, the ottoman provides additional seating beyond the futon itself. Choose an ottoman height that matches the futon seat height for a coordinated look.\n\nWall-mounted shelves above or beside the futon create display and storage space without using floor area. Floating shelves hold books, plants, photos, and small items. Install them at a height that clears the futon backrest in its upright sofa position. A set of three staggered floating shelves creates an attractive display wall that also provides meaningful storage capacity.\n\nDecorative baskets placed beside the futon corral throw blankets, magazines, and remote controls. Woven or fabric baskets add texture to the room while keeping daily-use items accessible and tidy. A large floor basket can hold all your sleeping pillows during daytime sofa mode. Stackable baskets work well in corners where they provide vertical storage without requiring wall mounting or furniture.',
      },
      {
        heading: 'Organizing a Futon Room: Practical Tips',
        body: 'The key to a well-organized futon room is having a designated place for everything. Bedding goes in under-frame drawers or a storage ottoman. Personal items go in nightstand drawers. Decorative items go on wall shelves. Daily-use items go in accessible baskets. When everything has a home, converting between sofa and bed modes takes under two minutes.\n\nCreate a nightly routine for futon conversion. Remove throw pillows and place them in their basket. Pull bedding from the under-frame drawer. Unfold the futon and make the bed. The entire process should feel quick and effortless. If it feels like a chore, simplify: fewer decorative pillows, pre-made sheet sets that stay on the mattress, and a single comforter that stores flat in the drawer.\n\nFor studio apartments where the futon is the primary bed, consider a room divider or curtain system that separates the sleeping area from the living area. This visual separation makes the space feel larger and provides a sense of privacy. The divider also hides the bed area during the day when you want the room to feel like a living room rather than a bedroom.\n\nVertical storage is your best friend in small spaces. Tall narrow bookcases, over-door organizers, and wall-mounted hooks all use vertical space that would otherwise go to waste. Every item stored vertically is one less item on the floor competing with your futon for room.\n\nLabeling storage containers and drawers helps maintain organization over time. When every item has a clearly marked home, family members and guests know exactly where things belong. This small step prevents the gradual clutter buildup that makes futon rooms feel cramped and disorganized.',
      },
    ],
    comparisonTable: {
      title: 'Futon Storage Options Comparison',
      headers: ['Feature', 'Under-Frame Drawers', 'Nightstands', 'Ottoman Storage', 'Decorative Baskets'],
      rows: [
        ['Storage Capacity', 'Large', 'Medium', 'Medium', 'Small'],
        ['Hidden Storage', 'Yes', 'Partially', 'Yes', 'No'],
        ['Price Range', '$50-$100', '$100-$300', '$60-$150', '$20-$60'],
        ['Installation', 'Mounts to frame', 'Freestanding', 'Freestanding', 'None'],
        ['Best For', 'Bedding/linens', 'Personal items', 'Blankets/pillows', 'Daily items'],
        ['Space Required', 'None (under frame)', 'Beside futon', 'Flexible', 'Flexible'],
      ],
    },
    productLinks: [
      { text: 'Shop Casegoods & Accessories', url: '/casegoods-accessories' },
      { text: 'Browse Frames with Storage', url: '/futon-frames?feature=storage' },
      { text: 'See Matching Nightstands', url: '/casegoods-accessories?type=nightstand' },
    ],
    faqs: [
      {
        question: 'Do futon frames come with storage drawers?',
        answer: 'Some futon frames include storage drawers as an option. Night & Day Furniture offers under-frame storage drawer sets for most of their hardwood frames. Drawers typically cost 50 to 100 dollars extra and mount beneath the frame using smooth-sliding rails. They match the frame finish for a seamless look.',
      },
      {
        question: 'What is the best way to store futon bedding during the day?',
        answer: 'Under-frame storage drawers are the best solution. They keep bedding hidden, dust-free, and immediately accessible for nighttime conversion. If your frame does not have drawers, a decorative storage ottoman or large basket placed nearby serves the same purpose.',
      },
      {
        question: 'What are casegoods in furniture?',
        answer: 'Casegoods is a furniture industry term for storage furniture: dressers, nightstands, bookcases, media consoles, and similar pieces. Night & Day Furniture produces casegoods collections that match their futon frame finishes, allowing you to furnish an entire room with coordinated pieces.',
      },
      {
        question: 'How do I organize a small room with a futon?',
        answer: 'Use vertical space with wall-mounted shelves. Choose a futon frame with under-frame drawers for hidden storage. Add a nightstand with drawers for personal items. Use a decorative basket for throw blankets and pillows. Define zones with matching casegoods to make the room feel intentional rather than cramped.',
      },
      {
        question: 'Can I add drawers to my existing futon frame?',
        answer: 'It depends on the frame model. Night & Day Furniture frames are designed to accept optional drawer sets that mount to the frame underside. Check your specific frame model for drawer compatibility. Aftermarket universal drawers on casters can work under most frames with sufficient clearance.',
      },
    ],
  },

  'outdoor': {
    slug: 'outdoor',
    title: 'Outdoor Futon Furniture Guide: Patios, Porches & Sunrooms',
    metaDescription: 'Bring futon comfort outdoors. Weather-resistant frames, outdoor cushions, and setup tips for patios, screened porches, sunrooms, and covered decks.',
    keywords: ['outdoor futon', 'patio futon', 'outdoor futon frame', 'sunroom furniture', 'weather resistant futon'],
    heroImage: `${SITE_URL}/buying-guides/outdoor-hero.jpg`,
    category: 'outdoor',
    categoryLabel: 'Outdoor Furniture',
    publishDate: '2026-02-20',
    updatedDate: '2026-02-20',
    sections: [
      {
        heading: 'Futons Are Perfect for Outdoor Living Spaces',
        body: 'Outdoor living spaces deserve comfortable, convertible furniture just like indoor rooms. A futon on a screened porch, covered patio, or sunroom provides lounging comfort during the day and a spare bed for warm-weather guests. The convertible design is especially valuable outdoors where space is at a premium and furniture often needs to serve multiple purposes.\n\nThe key to outdoor futon success is choosing the right materials. Indoor futon frames and mattresses are not designed for moisture, temperature swings, or UV exposure. You need weather-appropriate components that handle outdoor conditions while maintaining the comfort and style you expect from quality furniture.\n\nOutdoor futons have grown dramatically in popularity as homeowners invest more in their patios, decks, and screened porches. A well-chosen outdoor futon anchors a conversation area, provides flexible seating for gatherings, and gives you a comfortable spot to read, nap, or stargaze on warm evenings. Many customers find that an outdoor futon gets more daily use than their indoor sofa during spring and summer months.',
      },
      {
        heading: 'Choosing an Outdoor-Ready Frame',
        body: 'Not all futon frames can handle outdoor environments. For covered patios and screened porches, treated hardwood frames work well because they resist moisture and temperature changes better than untreated wood. Look for frames with marine-grade stainless steel hardware that resists rust and corrosion. Teak, cedar, and pressure-treated pine are the best wood options for semi-outdoor environments.\n\nMetal frames with powder-coated finishes are excellent for outdoor use. The powder coating creates a durable barrier against moisture and UV damage. Aluminum frames are especially good outdoors because aluminum does not rust even when the coating chips. Steel frames need quality powder coating to prevent corrosion. Check that all fasteners and hinges are also coated or made from stainless steel to avoid rust spots.\n\nFor fully exposed outdoor locations, synthetic wicker or resin frames are the best option. These materials are impervious to rain, sun, and temperature extremes. They never need painting, staining, or sealing. Synthetic wicker frames mimic the look of natural rattan without the maintenance requirements. High-density polyethylene wicker is the most durable option and comes in colors ranging from natural tan to deep espresso.\n\nWeight is an important consideration for outdoor frames. Heavier frames resist wind better but are harder to rearrange. If your outdoor space hosts frequent gatherings where furniture gets moved around, choose a lighter aluminum or resin frame. If the futon will stay in one spot on a covered porch, a heavier hardwood frame provides superior stability and comfort.\n\nAlways check the manufacturer warranty before placing any frame outdoors. Some warranties are voided by outdoor use unless the frame is specifically rated for exterior environments. Frames sold as indoor-outdoor typically carry full warranty coverage in covered outdoor spaces but limited or no coverage for fully exposed installations.',
      },
      {
        heading: 'Outdoor Mattresses and Cushions',
        body: 'Standard futon mattresses will mildew and deteriorate quickly in outdoor environments. Outdoor futon cushions use quick-dry foam cores that drain water and resist mold growth. The foam is typically open-cell polyurethane or reticulated foam that allows air to circulate and water to pass through.\n\nOutdoor cover fabrics must resist UV fading, moisture damage, and mildew. Sunbrella fabric is the industry standard for outdoor furniture cushions. It resists fading for years in direct sunlight, repels water, and cleans easily with mild soap. Sunbrella covers are available in hundreds of colors and patterns to complement any outdoor decor.\n\nOutdoor cushions are typically thinner than indoor futon mattresses, usually 4 to 6 inches. This is adequate for seating and occasional napping but is not intended for nightly sleeping. If you need sleeping comfort on an outdoor futon, bring out an indoor mattress for overnight use and store it inside during the day.\n\nWhen shopping for outdoor cushions, pay attention to tie-down straps or Velcro attachments that secure the cushion to the frame. Wind can lift unsecured cushions off the frame, especially on elevated decks or open patios. Cushions with integrated attachment points stay put during breezy conditions and reduce the hassle of repositioning them every time you sit down.',
      },
      {
        heading: 'Placement and Protection Tips',
        body: 'Even with weather-resistant materials, outdoor futons last longest when protected from direct rain and prolonged sun exposure. Covered porches, pergolas, and screened sunrooms are ideal locations. If your futon sits on an uncovered patio, use a waterproof furniture cover when not in use. Custom-fitted covers provide the best protection, but universal covers work well when cinched tight with bungee cords or drawstrings.\n\nPosition the futon away from sprinklers and roof drip lines. Elevate the frame slightly off the ground surface to prevent moisture wicking from wet concrete or decking. Rubber or plastic furniture pads under the frame legs protect both the frame and the floor surface. On wood decks, pads also prevent scratching and staining of the deck boards.\n\nBring cushions inside or store them in a waterproof deck box during extended rainy periods and winter months. Even Sunbrella fabric benefits from being stored dry when not in use for weeks at a time. Proper storage during the off-season can double the life of your outdoor cushions. A large deck box placed near the futon does double duty as cushion storage and additional seating or a side table surface.\n\nClean outdoor futon frames at the start and end of each outdoor season. Hose down the frame to remove pollen, dirt, and debris. For wood frames, apply a UV-protective sealant annually. For metal frames, inspect for chips in the powder coating and touch up with matching spray paint to prevent rust from starting. Synthetic wicker frames need only a rinse with soapy water to look brand new.\n\nInsect prevention is another outdoor consideration many buyers overlook. Wasps and spiders sometimes nest in hollow frame tubes or between cushion folds. Shake out cushions before sitting and inspect the frame underside periodically during peak insect season. A light spray of outdoor furniture protectant deters nesting and adds a layer of moisture resistance to the frame surface.\n\nAccessorize your outdoor futon with weather-resistant throw pillows and blankets for added comfort. Outdoor pillows made with Sunbrella or similar solution-dyed acrylic fabric resist fading and mildew while adding color and personality to your patio setup.',
      },
    ],
    comparisonTable: {
      title: 'Outdoor Futon Material Comparison',
      headers: ['Feature', 'Treated Hardwood', 'Powder-Coated Metal', 'Synthetic Wicker/Resin'],
      rows: [
        ['Weather Resistance', 'Good (covered only)', 'Very good', 'Excellent'],
        ['UV Resistance', 'Moderate', 'Good', 'Excellent'],
        ['Maintenance', 'Annual treatment', 'Minimal', 'None'],
        ['Weight', 'Heavy', 'Medium', 'Light-medium'],
        ['Price Range', '$400-$800', '$250-$600', '$300-$700'],
        ['Comfort Level', 'Excellent', 'Good', 'Good'],
        ['Best For', 'Screened porches', 'Covered patios', 'Any outdoor space'],
      ],
    },
    productLinks: [
      { text: 'Shop Outdoor Frames', url: '/outdoor-furniture' },
      { text: 'Sunbrella Covers & Cushions', url: '/futon-covers?fabric=sunbrella' },
      { text: 'All-Weather Accessories', url: '/casegoods-accessories?outdoor=true' },
    ],
    faqs: [
      {
        question: 'Can I put a regular futon outside?',
        answer: 'Standard indoor futon frames and mattresses are not designed for outdoor use. Wood frames will warp and crack from moisture exposure. Indoor mattresses will develop mold and mildew. For outdoor use, choose treated or synthetic frames with quick-dry cushions and UV-resistant covers.',
      },
      {
        question: 'What is the best fabric for outdoor futon cushions?',
        answer: 'Sunbrella fabric is the industry standard for outdoor cushions. It resists UV fading for years, repels water, resists mildew, and cleans easily. Sunbrella is available in hundreds of colors and patterns. Other solution-dyed acrylic fabrics offer similar performance at varying price points.',
      },
      {
        question: 'How do I protect my outdoor futon in winter?',
        answer: 'Bring cushions inside or store them in a waterproof deck box during winter months. Cover the frame with a fitted waterproof furniture cover. If possible, move the entire futon to a covered area like a garage or shed. Proper winter storage extends the life of outdoor furniture significantly.',
      },
      {
        question: 'Can I sleep on an outdoor futon?',
        answer: 'Outdoor futon cushions are designed for sitting and occasional napping, not nightly sleeping. They are typically 4 to 6 inches thick. For overnight guests, bring out a standard indoor futon mattress for sleeping and store it inside during the day. This gives you the best of both worlds.',
      },
      {
        question: 'How long does outdoor futon furniture last?',
        answer: 'With proper care, outdoor futon frames last 8 to 15 years depending on material and exposure. Synthetic wicker and resin frames last longest. Sunbrella cushion covers maintain color for 5 or more years in direct sunlight. Quick-dry foam cores last 3 to 5 years before needing replacement.',
      },
    ],
  },

  'accessories': {
    slug: 'accessories',
    title: 'Futon Accessories Guide: Everything to Complete Your Setup',
    metaDescription: 'Essential futon accessories for comfort and style. Grip strips, arm covers, mattress pads, trays, lighting, and everything to enhance your futon experience.',
    keywords: ['futon accessories', 'futon grip strip', 'futon arm covers', 'futon mattress pad', 'futon tray table'],
    heroImage: `${SITE_URL}/buying-guides/accessories-hero.jpg`,
    category: 'casegoods-accessories',
    categoryLabel: 'Accessories',
    publishDate: '2026-02-20',
    updatedDate: '2026-02-20',
    sections: [
      {
        heading: 'Small Accessories Make a Big Difference',
        body: 'The right accessories transform a basic futon setup into a polished, comfortable living space. From practical items like grip strips that prevent mattress sliding to decorative elements like tray tables and reading lamps, accessories solve common futon frustrations and elevate daily comfort.\n\nMost futon accessories are affordable additions that pay for themselves in convenience and extended furniture life. A 15 dollar grip strip prevents mattress bunching. A 20 dollar mattress pad adds a layer of comfort and protection. A 30 dollar arm cover protects expensive frame finishes from wear. These small investments make a noticeable difference in your daily futon experience.\n\nThink of accessories as the finishing touches that turn a piece of furniture into a complete living solution. Just as a bed needs sheets, pillows, and a nightstand to feel complete, a futon needs its own set of supporting accessories to function at its best. The total cost of essential accessories typically adds 75 to 150 dollars to your futon purchase, which is a small fraction of the frame and mattress investment.',
      },
      {
        heading: 'Practical Must-Have Accessories',
        body: 'Grip strips are non-slip pads placed between the frame slats and mattress. They prevent the mattress from sliding forward when you sit down, which is the number one futon frustration. Grip strips cost 10 to 20 dollars and solve the problem completely. They are essential for any futon that sees daily seating use.\n\nMattress pads and toppers add a layer of cushioning and protection on top of your futon mattress. A 2-inch memory foam topper transforms a firm mattress into a plush sleeping surface. Fitted mattress pads protect against spills and stains. Both extend mattress life and improve comfort for very little cost.\n\nArm covers protect the most vulnerable part of your futon frame. Arms take daily wear from sitting, leaning, placing drinks, and general contact. Fabric or leather arm covers shield the wood finish and can be replaced cheaply when worn. Tray-style arm covers add a flat surface for cups and remote controls.\n\nAnother practical accessory is a fitted sheet designed specifically for futon mattresses. Unlike standard bed sheets, futon fitted sheets accommodate the folding action and stay in place during conversion. Keeping a fitted sheet on the mattress under your decorative cover simplifies the nightly bed-making routine and protects the mattress from direct body contact.',
      },
      {
        heading: 'Comfort Enhancers',
        body: 'Reading lamps that clip to the futon frame or attach to a nearby wall provide directed light for reading without illuminating the entire room. This is especially valuable when the futon is in a shared space or a bedroom. LED clip lamps with adjustable necks are affordable and energy efficient. Choose a lamp with warm white light in the 2700 to 3000 Kelvin range for comfortable evening reading that does not interfere with sleep.\n\nSide tables and C-tables (tables that slide under the futon arm) provide surfaces for laptops, snacks, and beverages without the bulk of a full coffee table. C-tables are especially popular because they store flat against the wall when not in use and take up zero floor space. Look for C-tables with a sturdy base that resists tipping when you rest a laptop on the surface. Metal frames with wood or bamboo tops combine durability with style.\n\nThrow blankets are both functional and decorative. A soft throw draped over the futon arm adds warmth, color, and texture to the room. Choose a throw that coordinates with your futon cover and pillows. Weighted blankets are popular for futons used as primary beds, providing calming pressure for better sleep. Lightweight cotton or fleece throws work best for futons in living rooms where warmth varies by season.\n\nCup holders that attach to the futon arm or slide between cushions keep beverages secure and within reach. These simple accessories cost 10 to 20 dollars and prevent spills on your futon cover and mattress. Some models include slots for remote controls and phone holders, keeping everything organized at arm height.\n\nFor futons used in home offices, a laptop desk or lap tray is a worthwhile accessory. These portable surfaces sit comfortably across your lap and provide a stable, ventilated platform for working from the futon. Many models include built-in mouse pads, wrist rests, and slight angles that improve typing ergonomics. A good lap desk costs 25 to 50 dollars and makes working from your futon far more comfortable than balancing a laptop on a cushion.',
      },
      {
        heading: 'Maintenance and Cleaning Accessories',
        body: 'A handheld upholstery vacuum keeps your futon mattress clean between deep cleanings. Regular vacuuming removes dust, crumbs, and allergens from the mattress surface and crevices. Compact cordless models are convenient for quick daily cleaning. Vacuum the mattress at least monthly and more frequently if you have pets or eat near the futon.\n\nFabric refresher spray eliminates odors from the mattress and cover between washes. Choose enzyme-based sprays for pet odors or general freshening sprays for daily use. A quick spray after folding the futon from bed to sofa mode keeps things fresh. Baking soda sprinkled on the mattress surface and vacuumed after 30 minutes is a natural deodorizing alternative.\n\nFrame maintenance kits include furniture polish, touch-up markers for scratches, and tightening tools for bolts and screws. Tightening frame hardware every 6 months prevents wobbling and squeaking. A basic furniture care kit costs 15 to 25 dollars and keeps your frame looking and performing like new. Wood furniture wax applied annually to solid hardwood frames creates a protective layer that resists moisture and minor scratches.\n\nMattress protectors deserve special mention in the accessories category. A fitted waterproof mattress protector costs 25 to 50 dollars and prevents liquid damage to the mattress core. This is especially important for futons in family rooms where spills are likely. The protector sits between the mattress and the decorative cover, invisible but highly effective. Replace the protector every two to three years or immediately if it develops tears or loses its waterproof properties.\n\nFinally, consider investing in a small set of furniture felt pads for the bottom of your futon frame legs. Felt pads prevent scratching on hardwood floors and reduce noise when the futon is shifted during conversion. A pack of self-adhesive felt pads costs under five dollars and protects flooring that would be far more expensive to repair.',
      },
    ],
    comparisonTable: {
      title: 'Essential Futon Accessories Priority Guide',
      headers: ['Accessory', 'Purpose', 'Price Range', 'Priority'],
      rows: [
        ['Grip Strip', 'Prevents mattress sliding', '$10-$20', 'Essential'],
        ['Mattress Pad', 'Comfort + protection', '$25-$60', 'Essential'],
        ['Arm Covers', 'Frame protection', '$15-$30', 'Recommended'],
        ['Throw Pillows', 'Comfort + decor', '$15-$40 each', 'Recommended'],
        ['C-Table / Side Table', 'Surface for drinks/laptop', '$30-$80', 'Nice to have'],
        ['Reading Lamp', 'Directed light', '$15-$40', 'Nice to have'],
        ['Frame Care Kit', 'Maintenance tools', '$15-$25', 'Recommended'],
      ],
    },
    productLinks: [
      { text: 'Shop All Accessories', url: '/casegoods-accessories' },
      { text: 'Grip Strips & Pads', url: '/casegoods-accessories?type=grip' },
      { text: 'Browse Arm Covers', url: '/casegoods-accessories?type=arm-covers' },
    ],
    faqs: [
      {
        question: 'How do I stop my futon mattress from sliding?',
        answer: 'Use a grip strip or non-slip pad placed between the frame slats and mattress bottom. Grip strips cost 10 to 20 dollars and completely prevent mattress sliding. They are the single most impactful futon accessory and should be the first thing you buy after your frame and mattress.',
      },
      {
        question: 'What accessories do I need for a new futon?',
        answer: 'Start with essentials: a grip strip to prevent mattress sliding and a mattress pad for comfort and protection. Then add arm covers to protect the frame finish. Throw pillows and a blanket complete the look. A C-table provides a convenient surface for drinks and laptops without taking up floor space.',
      },
      {
        question: 'Are futon mattress toppers worth it?',
        answer: 'Yes, especially for everyday sleeping. A 2-inch memory foam topper adds significant comfort to any futon mattress for 40 to 80 dollars. This is much cheaper than replacing the entire mattress. Toppers also extend mattress life by absorbing surface wear. Remove the topper for folding.',
      },
      {
        question: 'How do I maintain my futon frame?',
        answer: 'Tighten all bolts and screws every 6 months. Dust and polish wood frames quarterly with furniture polish. Use touch-up markers for minor scratches. Keep the frame away from direct sunlight to prevent fading. Lubricate metal hinges annually with a dry silicone spray.',
      },
      {
        question: 'What is a C-table and why is it good for futons?',
        answer: 'A C-table has a flat surface supported by a C-shaped base that slides under the futon arm. It provides a stable surface for laptops, drinks, and snacks at arm height without blocking floor space. When not in use, it stores flat against the wall. C-tables are ideal for small spaces where a coffee table would crowd the room.',
      },
    ],
  },

  'bundle-deals': {
    slug: 'bundle-deals',
    title: 'Futon Bundle Deals: Save on Complete Frame & Mattress Sets',
    metaDescription: 'Save 5-15% with futon bundle deals. Complete frame and mattress packages, bedroom sets, and starter bundles with everything you need in one purchase.',
    keywords: ['futon bundle deal', 'futon frame and mattress set', 'futon package deal', 'complete futon set', 'futon starter bundle'],
    heroImage: `${SITE_URL}/buying-guides/bundles-hero.jpg`,
    category: 'bundle-deals',
    categoryLabel: 'Bundle Deals',
    publishDate: '2026-02-20',
    updatedDate: '2026-02-20',
    sections: [
      {
        heading: 'Why Bundles Are the Smartest Way to Buy',
        body: 'Buying a futon frame and mattress separately means choosing compatible sizes, coordinating delivery, and paying full price for each item. Bundles solve all three problems. Our curated frame and mattress packages are pre-matched for size compatibility, ship together, and save you 5 to 15 percent compared to buying components individually.\n\nBundles also eliminate the guesswork. Each bundle is assembled by our furniture specialists who pair frames with mattresses that match in quality level, size, and intended use. A bundle designed for everyday sleeping pairs a premium hardwood frame with a thick innerspring mattress. A guest room bundle pairs an affordable frame with a comfortable mid-range mattress. You get expert curation at a bundled discount. First-time futon buyers especially benefit from bundles because every component is guaranteed to work together, eliminating the risk of ordering a mattress that does not fit the frame or a cover that does not match the room style.',
      },
      {
        heading: 'Types of Bundles Available',
        body: 'Frame and mattress bundles are the most popular option. These pair a specific frame with a compatible mattress at a 5 to 10 percent discount. Every combination has been verified for size fit and quality balance. Bundles are available in Twin, Full, and Queen sizes across multiple frame styles.\n\nComplete room bundles include a frame, mattress, cover, and matching accessories or casegoods. These packages save 10 to 15 percent and give you everything needed for a fully furnished room. Complete bundles include coordinated finishes and fabrics selected by our design team.\n\nStarter bundles are entry-level packages designed for first-time futon buyers, college students, and new apartments. They include a quality frame, comfortable mattress, and a basic cover at the lowest possible bundled price. Starter bundles prove that affordable does not mean uncomfortable.\n\nMurphy bed bundles pair cabinet beds with matching casegoods furniture. A Murphy bed with a coordinated nightstand and dresser creates a cohesive guest bedroom that completely hides when not in use. Murphy bundles save 10 to 15 percent compared to buying each piece separately.',
      },
      {
        heading: 'How to Choose the Right Bundle',
        body: 'Start with your primary use case. If the futon will be your everyday bed, invest in a premium bundle with a hardwood frame and 8 to 10 inch innerspring mattress. If it is primarily a sofa with occasional overnight guests, a mid-range bundle with a solid frame and 6 to 8 inch mattress offers the best value. If budget is the primary concern, a starter bundle gives you quality basics at the lowest possible price.\n\nConsider the room where the futon will live. Living room futons benefit from frames with attractive finishes and covers in neutral colors. Bedroom futons should prioritize sleeping comfort with thicker mattresses and lumbar-friendly frames. Guest room futons need easy conversion and moderate comfort at a reasonable price. Home offices need a futon that looks good as a sofa during the day and converts quickly for overnight work marathons.\n\nMeasure your space before choosing a bundle. Check that the frame dimensions fit your room in both sofa and bed positions. Verify that the frame will fit through doorways and hallways. Full-size bundles are the most versatile. Queen bundles provide more sleeping space but need a larger room. Twin bundles work well for kids rooms and very small spaces.\n\nRead the bundle details carefully. Some bundles include a cover and some do not. Some include storage drawers as part of the package while others list drawers as an optional add-on. Understanding exactly what is included prevents surprises and helps you compare bundle prices accurately across different retailers.',
      },
      {
        heading: 'Bundle Value Breakdown',
        body: 'Understanding the math behind bundles shows why they are such good value. A typical frame and mattress bundle saves 50 to 150 dollars compared to individual pricing. A complete room bundle with frame, mattress, cover, and nightstand can save 200 to 400 dollars. That savings covers the cost of accessories and delivery. The percentage discount increases with larger bundles because the operational savings from single-shipment processing get passed to the customer.\n\nBundles also save time. Instead of researching frames and mattresses separately, comparing sizes and compatibility, and placing multiple orders, a bundle is a single purchase decision with guaranteed compatibility. Everything arrives together, reducing delivery complexity and ensuring you can set up your futon the same day it arrives. For people furnishing a new apartment or dorm room, bundles eliminate the stress of coordinating multiple purchases.\n\nFree shipping applies to most bundles over 999 dollars within the continental United States. This saves an additional 100 to 200 dollars on a purchase that would normally require freight shipping for the frame and mattress separately. Combined with the bundle discount, total savings can reach 300 to 600 dollars on a complete room package. Local delivery and setup is available in the Hendersonville, NC area for an additional convenience.',
      },
      {
        heading: 'Seasonal Sales and Special Offers',
        body: 'Bundle pricing is available year round, but additional discounts appear during seasonal sales events. Presidents Day, Memorial Day, Labor Day, and Black Friday are the traditional furniture sale periods when bundle discounts can increase from 5 to 10 percent to 15 to 20 percent. Sign up for our email list to receive early access to seasonal bundle promotions.\n\nClearance bundles offer the deepest discounts. When a frame model is being retired or a mattress design is updated, we create clearance bundles at 20 to 30 percent off. These bundles use brand new components from current inventory — the quality is identical to full-price products. Clearance bundles sell quickly and availability is limited.\n\nPrice matching is available on identical bundle configurations from authorized retailers. If you find the same frame and mattress combination at a lower bundled price from another authorized dealer, we will match that price. Contact us with the competitor details and we will verify and match the pricing. This ensures you always get the best possible deal when shopping with Carolina Futons.\n\nGift registry bundles are popular for weddings, housewarmings, and college move-ins. Friends and family can contribute toward a bundle purchase, making it easy to crowdfund a quality futon setup. Registry bundles hold their pricing for 90 days, giving contributors time to chip in before the purchase is finalized.',
      },
    ],
    comparisonTable: {
      title: 'Futon Bundle Comparison',
      headers: ['Feature', 'Frame + Mattress', 'Complete Room', 'Starter Bundle', 'Murphy Bundle'],
      rows: [
        ['Includes', 'Frame, mattress', 'Frame, mattress, cover, accessories', 'Frame, mattress, cover', 'Cabinet bed, casegoods'],
        ['Savings', '5-10%', '10-15%', '5-10%', '10-15%'],
        ['Price Range', '$600-$1,400', '$900-$2,200', '$400-$700', '$2,500-$4,000'],
        ['Sizes Available', 'Twin, Full, Queen', 'Full, Queen', 'Twin, Full', 'Queen'],
        ['Free Shipping', 'Orders $999+', 'Most qualify', 'Some qualify', 'Most qualify'],
        ['Best For', 'Most buyers', 'Complete furnishing', 'Students/budget', 'Guest bedrooms'],
      ],
    },
    productLinks: [
      { text: 'Shop All Bundles', url: '/bundle-deals' },
      { text: 'Frame & Mattress Packages', url: '/bundle-deals?type=frame-mattress' },
      { text: 'Complete Room Sets', url: '/bundle-deals?type=complete-room' },
      { text: 'Murphy Bed Bundles', url: '/bundle-deals?type=murphy' },
    ],
    faqs: [
      {
        question: 'How much do futon bundles save compared to buying separately?',
        answer: 'Frame and mattress bundles save 5 to 10 percent, typically 50 to 150 dollars. Complete room bundles with frame, mattress, cover, and accessories save 10 to 15 percent, typically 200 to 400 dollars. Combined with free shipping on orders over 999 dollars, total savings can reach 300 to 600 dollars.',
      },
      {
        question: 'Can I customize a futon bundle?',
        answer: 'Yes. While our pre-built bundles offer the best savings, you can customize any bundle by swapping the mattress size, cover fabric, or frame finish. Custom bundles may receive a slightly smaller discount than pre-built packages. Contact us to build a custom bundle that fits your exact needs.',
      },
      {
        question: 'Do futon bundles include free shipping?',
        answer: 'Most bundles over 999 dollars qualify for free shipping within the continental United States. Starter bundles under 999 dollars have standard shipping rates. Free shipping saves an additional 100 to 200 dollars on furniture that normally requires freight delivery.',
      },
      {
        question: 'What if I only need a mattress — should I still buy a bundle?',
        answer: 'If you already have a quality frame, buying just a mattress makes sense. But if your frame is aging or you are starting fresh, a bundle provides better value than buying a frame now and mattress later. Bundle pricing is only available when purchasing components together.',
      },
      {
        question: 'Can I return individual items from a bundle?',
        answer: 'Bundle pricing requires all items to be kept together. If you need to return an individual item, the remaining items adjust to their individual retail prices. Full bundle returns follow our standard 30-day return policy. Contact us before returning bundle components so we can explain your options.',
      },
    ],
  },
};

const GUIDE_SLUGS = Object.keys(GUIDES);

// ── getBuyingGuide ──────────────────────────────────────────────────

/**
 * Retrieves a single buying guide by category slug, with related product
 * sidebar pulled from Stores/Products. Returns a "coming soon" stub for
 * categories that don't yet have a full guide defined.
 *
 * @param {string} slug - URL-safe category identifier (e.g. "futon-frames").
 * @returns {Promise<{success: boolean, guide?: Object, error?: string}>}
 *   guide includes sections, FAQs, comparison table, and up to 6 related products.
 * @permission Permissions.Anyone
 */
export const getBuyingGuide = webMethod(
  Permissions.Anyone,
  async (slug) => {
    try {
      const cleanSlug = validateSlug(slug) || sanitize(slug, 100);
      if (!cleanSlug) {
        return { success: false, error: 'Category slug is required' };
      }

      const guide = GUIDES[cleanSlug];
      if (!guide) {
        return {
          success: true,
          guide: {
            slug: cleanSlug,
            title: `${cleanSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Buying Guide`,
            categoryLabel: cleanSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            comingSoon: true,
            message: 'This buying guide is coming soon. Check back for expert advice, comparison tables, and top picks for this category.',
          },
        };
      }

      // Fetch related products for sidebar
      let relatedProducts = [];
      try {
        const products = await wixData.query('Stores/Products')
          .hasSome('collections', [guide.category])
          .limit(6)
          .find();
        relatedProducts = products.items.map(p => ({
          _id: p._id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          formattedPrice: p.formattedPrice,
          mainMedia: p.mainMedia,
          ribbon: p.ribbon,
        }));
      } catch (e) {
        // Products unavailable — continue without sidebar
      }

      return {
        success: true,
        guide: {
          ...guide,
          comingSoon: false,
          relatedProducts,
        },
      };
    } catch (err) {
      console.error('getBuyingGuide error:', err);
      return { success: false, error: 'Unable to load buying guide' };
    }
  }
);

// ── getAllBuyingGuides ───────────────────────────────────────────────

/**
 * Returns summary metadata for every available buying guide. Used on the
 * buying guides index page to render cards with title, hero image, and
 * category label.
 *
 * @returns {Promise<{success: boolean, guides?: Array<Object>, error?: string}>}
 * @permission Permissions.Anyone
 */
export const getAllBuyingGuides = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      return {
        success: true,
        guides: GUIDE_SLUGS.map(slug => {
          const g = GUIDES[slug];
          return {
            slug: g.slug,
            title: g.title,
            metaDescription: g.metaDescription,
            categoryLabel: g.categoryLabel,
            heroImage: g.heroImage,
            publishDate: g.publishDate,
          };
        }),
      };
    } catch (err) {
      console.error('getAllBuyingGuides error:', err);
      return { success: false, error: 'Unable to load buying guides' };
    }
  }
);

// ── getBuyingGuideSlugs ─────────────────────────────────────────────

/**
 * Returns the list of valid buying guide slugs. Used by the router to
 * pre-register dynamic routes and by sitemaps to enumerate guide URLs.
 *
 * @returns {Promise<{success: boolean, slugs: string[]}>}
 * @permission Permissions.Anyone
 */
export const getBuyingGuideSlugs = webMethod(
  Permissions.Anyone,
  async () => {
    return { success: true, slugs: [...GUIDE_SLUGS] };
  }
);

// ── getBuyingGuideSchema ────────────────────────────────────────────

/**
 * Generates JSON-LD structured data for a buying guide — both Article
 * and FAQPage schemas — so Google can render rich results in search.
 *
 * @param {string} slug - Category slug identifying the guide.
 * @returns {Promise<{success: boolean, articleSchema?: string, faqSchema?: string, error?: string}>}
 *   Schemas are returned as JSON strings ready for injection into a script tag.
 * @permission Permissions.Anyone
 */
export const getBuyingGuideSchema = webMethod(
  Permissions.Anyone,
  async (slug) => {
    try {
      const cleanSlug = validateSlug(slug) || sanitize(slug, 100);
      if (!cleanSlug) return { success: false, error: 'Slug required' };

      const guide = GUIDES[cleanSlug];
      if (!guide) return { success: true, articleSchema: null, faqSchema: null };

      // Article schema
      const articleSchema = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: guide.title,
        description: guide.metaDescription,
        image: guide.heroImage,
        author: { '@type': 'Organization', name: PUBLISHER.name },
        publisher: {
          '@type': 'Organization',
          name: PUBLISHER.name,
          logo: { '@type': 'ImageObject', url: PUBLISHER.logo },
        },
        datePublished: guide.publishDate,
        dateModified: guide.updatedDate,
        keywords: guide.keywords.join(', '),
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `${SITE_URL}/buying-guides/${guide.slug}`,
        },
      });

      // FAQPage schema
      const faqSchema = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: guide.faqs.map(faq => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      });

      return { success: true, articleSchema, faqSchema };
    } catch (err) {
      console.error('getBuyingGuideSchema error:', err);
      return { success: false, error: 'Unable to generate schema' };
    }
  }
);

// ── getGuideComparisonTable ─────────────────────────────────────────

/**
 * Extracts just the comparison table from a buying guide. Useful when
 * the full guide is already cached on the client but the table needs
 * to be rendered in an isolated component (e.g. a product-compare widget).
 *
 * @param {string} slug - Category slug identifying the guide.
 * @returns {Promise<{success: boolean, table?: Object|null, error?: string}>}
 * @permission Permissions.Anyone
 */
export const getGuideComparisonTable = webMethod(
  Permissions.Anyone,
  async (slug) => {
    try {
      const cleanSlug = validateSlug(slug) || sanitize(slug, 100);
      if (!cleanSlug) return { success: false, error: 'Slug required' };

      const guide = GUIDES[cleanSlug];
      if (!guide) {
        return { success: true, table: null };
      }

      return {
        success: true,
        table: guide.comparisonTable,
      };
    } catch (err) {
      console.error('getGuideComparisonTable error:', err);
      return { success: false, error: 'Unable to load comparison table' };
    }
  }
);

// ── getGuideFaqs ────────────────────────────────────────────────────

/**
 * Extracts just the FAQ list from a buying guide. Rendered in an
 * accordion on the guide page and also used to build the FAQPage
 * structured data independently of the full guide payload.
 *
 * @param {string} slug - Category slug identifying the guide.
 * @returns {Promise<{success: boolean, faqs?: Array<{question: string, answer: string}>|null, error?: string}>}
 * @permission Permissions.Anyone
 */
export const getGuideFaqs = webMethod(
  Permissions.Anyone,
  async (slug) => {
    try {
      const cleanSlug = validateSlug(slug) || sanitize(slug, 100);
      if (!cleanSlug) return { success: false, error: 'Slug required' };

      const guide = GUIDES[cleanSlug];
      if (!guide) return { success: true, faqs: null };

      return {
        success: true,
        faqs: guide.faqs,
      };
    } catch (err) {
      console.error('getGuideFaqs error:', err);
      return { success: false, error: 'Unable to load FAQs' };
    }
  }
);

// ── getSocialShareLinks ─────────────────────────────────────────────

/**
 * Builds pre-formatted share URLs for Facebook, Twitter/X, Pinterest,
 * and email for a given buying guide. The frontend renders these as
 * share buttons at the top and bottom of each guide page.
 *
 * @param {string} slug - Category slug identifying the guide.
 * @returns {Promise<{success: boolean, links?: {facebook: string, twitter: string, pinterest: string, email: string, url: string}|null, error?: string}>}
 * @permission Permissions.Anyone
 */
export const getSocialShareLinks = webMethod(
  Permissions.Anyone,
  async (slug) => {
    try {
      const cleanSlug = validateSlug(slug) || sanitize(slug, 100);
      if (!cleanSlug) return { success: false, error: 'Slug required' };

      const guide = GUIDES[cleanSlug];
      if (!guide) return { success: true, links: null };

      const pageUrl = encodeURIComponent(`${SITE_URL}/buying-guides/${guide.slug}`);
      const title = encodeURIComponent(guide.title);
      const description = encodeURIComponent(guide.metaDescription);

      return {
        success: true,
        links: {
          facebook: `https://www.facebook.com/sharer/sharer.php?u=${pageUrl}`,
          twitter: `https://twitter.com/intent/tweet?url=${pageUrl}&text=${title}`,
          pinterest: `https://pinterest.com/pin/create/button/?url=${pageUrl}&description=${description}`,
          email: `mailto:?subject=${title}&body=${description}%20${pageUrl}`,
          url: `${SITE_URL}/buying-guides/${guide.slug}`,
        },
      };
    } catch (err) {
      console.error('getSocialShareLinks error:', err);
      return { success: false, error: 'Unable to generate share links' };
    }
  }
);
