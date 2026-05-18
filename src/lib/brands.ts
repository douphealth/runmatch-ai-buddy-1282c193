import { shoeDatabase, Shoe } from './shoe-database';

/**
 * Brand landing pages — programmatic SEO targeting commercial brand intent.
 *
 * Each entry powers a /best-running-shoes/brand/:slug page with brand-specific
 * H1s, intros, FAQs and a brand-filtered shoe grid drawn from the verified
 * shoe database. Adding a brand here automatically:
 *   - registers its page
 *   - exposes it in the homepage brand hub
 *   - lists it in the sitemap (via the prerender script)
 */

export interface BrandDef {
  slug: string;        // url-safe, kebab-case
  name: string;        // matches Shoe.brand exactly
  h1: string;
  title: string;       // <60 chars
  description: string; // <160 chars
  intro: string;
  faqs: { question: string; answer: string }[];
  signature?: string;  // one-line technology hook (e.g. "ZoomX foam")
}

export const BRANDS: BrandDef[] = [
  {
    slug: 'nike',
    name: 'Nike',
    h1: 'Best Nike Running Shoes (2026)',
    title: 'Best Nike Running Shoes 2026 | RunMatch AI',
    description: 'Top Nike running shoes for 2026 — Pegasus, Vaporfly, Alphafly and more. Verified specs and a free AI quiz to find your match.',
    intro: 'Nike pairs ZoomX PEBA foam with carbon plates in its race shoes (Vaporfly, Alphafly) and ReactX in its daily trainers (Pegasus, Vomero). These are our 2026 picks scored by the RunMatch AI engine.',
    signature: 'ZoomX foam + Flyknit upper',
    faqs: [
      { question: 'Which Nike running shoe is best for beginners?', answer: 'The Nike Pegasus 41 is the most beginner-friendly Nike daily trainer — balanced 7/10 cushioning, 10mm drop, durable Cushlon midsole, and a wide enough toebox for most foot shapes.' },
      { question: 'Is the Nike Vaporfly worth it?', answer: 'For race day, yes. Independent biomechanics studies show carbon-plated ZoomX shoes improve running economy by 2–4%, which translates to ~5–10 minutes faster over a marathon for most runners.' },
      { question: 'Do Nike running shoes run small?', answer: 'Most modern Nike runners (Pegasus, Vomero, Invincible) fit true to size with a slightly snug forefoot. The Alphafly and Vaporfly run true, but heel-lock lacing is recommended.' },
    ],
  },
  {
    slug: 'brooks',
    name: 'Brooks',
    h1: 'Best Brooks Running Shoes (2026)',
    title: 'Best Brooks Running Shoes 2026 | RunMatch AI',
    description: 'Top Brooks running shoes 2026 — Ghost, Glycerin, Adrenaline GTS. Verified specs and a free AI quiz to pick yours.',
    intro: 'Brooks dominates the comfort-and-stability category: DNA LOFT v3 nitrogen-infused foam, GuideRails support, and roomy fits make them a long-distance favorite.',
    signature: 'DNA LOFT v3 + GuideRails',
    faqs: [
      { question: 'Are Brooks shoes good for flat feet?', answer: 'Yes. The Brooks Adrenaline GTS and Glycerin GTS use GuideRails — a holistic support system that gently corrects excess inward rotation without the rigid medial post of older stability shoes.' },
      { question: 'What is the most cushioned Brooks shoe?', answer: 'The Brooks Glycerin Max with a 44mm stack of DNA Tuned foam is the brand\'s most cushioned daily trainer in 2026.' },
      { question: 'Brooks Ghost vs Glycerin — which one?', answer: 'Ghost is the lighter, more versatile daily trainer (~284g). Glycerin is softer and more premium, ideal for long runs and recovery (~292g).' },
    ],
  },
  {
    slug: 'hoka',
    name: 'Hoka',
    h1: 'Best Hoka Running Shoes (2026)',
    title: 'Best Hoka Running Shoes 2026 | RunMatch AI',
    description: 'Top Hoka running shoes 2026 — Clifton, Bondi, Mach. Max-cushion verified picks and a free AI quiz to find yours.',
    intro: 'Hoka built the max-cushion category. The Clifton and Bondi deliver plush rocker-geometry rides; the Mach and Rocket X line up for tempo and race day.',
    signature: 'Meta-Rocker geometry + max stack',
    faqs: [
      { question: 'Hoka Clifton vs Bondi — which is more cushioned?', answer: 'The Bondi has a 39mm stack vs the Clifton 10\'s 42mm forefoot / 49mm heel — but the Clifton feels softer underfoot due to its updated CMEVA foam.' },
      { question: 'Are Hoka shoes good for plantar fasciitis?', answer: 'The thick midsole and Meta-Rocker geometry reduce loading on the plantar fascia. The Hoka Bondi and Clifton are commonly recommended by podiatrists alongside professional treatment.' },
      { question: 'Do Hoka shoes run small?', answer: 'Most Hoka models run true to size with a slightly narrow midfoot. Order the wide (2E) version if you have a wider forefoot.' },
    ],
  },
  {
    slug: 'asics',
    name: 'Asics',
    h1: 'Best Asics Running Shoes (2026)',
    title: 'Best Asics Running Shoes 2026 | RunMatch AI',
    description: 'Top Asics running shoes 2026 — Nimbus, Kayano, Novablast, Superblast. Verified specs and a free AI quiz inside.',
    intro: 'Asics leads with FF Blast Plus Eco and FF Turbo foams. The Gel-Nimbus and Gel-Kayano anchor the daily lineup; Novablast and Superblast deliver bouncier rides.',
    signature: 'FF Blast Plus Eco + PureGel',
    faqs: [
      { question: 'Asics Nimbus vs Kayano — which one?', answer: 'Gel-Nimbus is a max-cushion neutral trainer. Gel-Kayano adds 4D Guidance System stability for runners who overpronate or want extra support on long runs.' },
      { question: 'Is the Asics Superblast good for racing?', answer: 'The Superblast 2 is a non-plated super-trainer beloved by marathoners who want race-day energy return with daily-trainer durability — great for half-marathons and easy long runs.' },
      { question: 'Do Asics run true to size?', answer: 'Yes — most Asics road models run true with a moderately snug heel and a roomy enough toebox. Wide (2E) options exist for Nimbus, Kayano, and GT-2000.' },
    ],
  },
  {
    slug: 'saucony',
    name: 'Saucony',
    h1: 'Best Saucony Running Shoes (2026)',
    title: 'Best Saucony Running Shoes 2026 | RunMatch AI',
    description: 'Top Saucony running shoes 2026 — Endorphin Pro, Speed, Triumph, Ride. Verified specs and a free AI quiz inside.',
    intro: 'Saucony\'s Endorphin family popularized PWRRUN PB foam with a SpeedRoll geometry. The Ride and Triumph cover daily mileage; Endorphin Pro and Elite are race-day weapons.',
    signature: 'PWRRUN PB + SpeedRoll',
    faqs: [
      { question: 'Saucony Endorphin Speed vs Pro?', answer: 'Speed uses a nylon plate and PWRRUN PB foam — versatile for tempo, intervals, and easy long runs. Pro has a full carbon plate for max race-day propulsion.' },
      { question: 'Is Saucony good for wide feet?', answer: 'Yes. Saucony offers wide (2E) and extra-wide (4E) widths on the Ride, Triumph, Echelon, and Guide.' },
      { question: 'How long do Saucony Endorphin shoes last?', answer: 'PWRRUN PB midsoles compress faster than EVA. Expect 200–300 miles in the Pro/Elite, 350–450 miles in the Speed.' },
    ],
  },
  {
    slug: 'new-balance',
    name: 'New Balance',
    h1: 'Best New Balance Running Shoes (2026)',
    title: 'Best New Balance Running Shoes 2026 | RunMatch AI',
    description: 'Top New Balance running shoes 2026 — FuelCell SC Elite, Rebel, 1080, More. Verified specs and a free AI quiz inside.',
    intro: 'New Balance pairs FuelCell PEBA foam with carbon Energy Arc plates in its race shoes. The 1080 and More v5 are plush daily workhorses with industry-leading width options.',
    signature: 'FuelCell PEBA + Energy Arc',
    faqs: [
      { question: 'New Balance 1080 vs More — which is softer?', answer: 'The More v5 has a higher stack (43mm) and feels plusher; the 1080 v14 is more responsive and slightly lighter, better suited to tempo days.' },
      { question: 'Does New Balance offer wide widths?', answer: 'Yes — New Balance offers more width options than any other brand: B (narrow), D (standard), 2E (wide), and 4E (extra-wide) on most road models.' },
      { question: 'Is the FuelCell SC Elite worth it?', answer: 'The SC Elite v5 is one of the lightest carbon-plated marathon shoes on the market (~205g) with PEBA FuelCell foam — competitive with Vaporfly and Adios Pro for sub-3:30 marathoners.' },
    ],
  },
  {
    slug: 'adidas',
    name: 'Adidas',
    h1: 'Best Adidas Running Shoes (2026)',
    title: 'Best Adidas Running Shoes 2026 | RunMatch AI',
    description: 'Top Adidas running shoes 2026 — Adios Pro, Boston, Supernova. Verified specs and a free AI quiz inside.',
    intro: 'Adidas combines Lightstrike Pro PEBA foam with Energy Rods to create some of the fastest race-day shoes in the world. The Boston and Supernova handle daily mileage.',
    signature: 'Lightstrike Pro + Energy Rods',
    faqs: [
      { question: 'Adidas Adios Pro vs Boston — which is faster?', answer: 'Adios Pro 4 is the full carbon race shoe (~210g) used by elites for marathon PRs. Boston 13 is a workhorse super-trainer with the same foam but a more durable build for daily speed work.' },
      { question: 'Is the Adios Pro better than Vaporfly?', answer: 'Both win on different stride types. Adios Pro 4 favors heel/midfoot strikers with its Energy Rods system; Vaporfly 3 suits forefoot strikers with its single plate.' },
      { question: 'Do Adidas running shoes run small?', answer: 'Most Adidas runners fit true to size with a snug heel and slim midfoot. The Adizero line runs slightly short — consider a half size up.' },
    ],
  },
  {
    slug: 'on',
    name: 'On',
    h1: 'Best On Running Shoes (2026)',
    title: 'Best On Running Shoes 2026 | RunMatch AI',
    description: 'Top On Running shoes 2026 — Cloudmonster, Cloudsurfer, Cloudboom. Verified specs and a free AI quiz inside.',
    intro: 'Swiss brand On uses its signature CloudTec midsole plus Helion superfoam for a distinctive ride. Cloudmonster and Cloudsurfer cover daily miles; Cloudboom Echo races.',
    signature: 'CloudTec + Helion superfoam',
    faqs: [
      { question: 'Are On shoes good for daily running?', answer: 'Yes — the Cloudmonster 2 and Cloudsurfer 7 are well-cushioned daily trainers with the brand\'s signature CloudTec ride.' },
      { question: 'Do On Cloud shoes pick up rocks?', answer: 'The latest CloudTec Phase pods on the Cloudsurfer 7 and Cloudmonster 2 are sealed enough to largely solve the older "pebble trap" issue.' },
      { question: 'Is the Cloudboom Echo a true marathon shoe?', answer: 'Yes — Cloudboom Echo 3 has a Speedboard carbon plate and full PEBA Helion HF midsole. It\'s been worn by elite marathoners and finishes in the top race-day category.' },
    ],
  },
  {
    slug: 'mizuno',
    name: 'Mizuno',
    h1: 'Best Mizuno Running Shoes (2026)',
    title: 'Best Mizuno Running Shoes 2026 | RunMatch AI',
    description: 'Top Mizuno running shoes 2026 — Wave Rider, Wave Sky, Neo Vista. Verified specs and a free AI quiz inside.',
    intro: 'Mizuno\'s Wave technology and Enerzy NXT foam deliver a uniquely smooth, stable ride. The Wave Rider is the brand\'s iconic daily trainer; the Neo Vista is its modern super-trainer.',
    signature: 'Wave plate + Enerzy NXT',
    faqs: [
      { question: 'Is the Mizuno Wave Rider stable?', answer: 'Yes — the Wave plate provides natural stability without medial posting, making it a great option for runners between neutral and mild stability.' },
      { question: 'Mizuno Neo Vista — daily or race?', answer: 'The Neo Vista is a non-plated super-trainer with PEBA Enerzy NXT foam. It\'s built for long runs, marathons, and tempo workouts — not a pure race shoe but very versatile.' },
      { question: 'Do Mizuno shoes run small?', answer: 'Most Mizuno models fit true to size with a slightly snug forefoot. Wide (2E) widths are available on Wave Rider, Wave Inspire, and Wave Horizon.' },
    ],
  },
  {
    slug: 'altra',
    name: 'Altra',
    h1: 'Best Altra Zero-Drop Running Shoes (2026)',
    title: 'Best Altra Running Shoes 2026 | RunMatch AI',
    description: 'Top Altra zero-drop running shoes 2026 — Torin, Escalante, Lone Peak. Verified specs and a free AI quiz inside.',
    intro: 'Altra is the leader in zero-drop, foot-shaped running shoes. The FootShape™ toebox lets toes splay naturally, and the balanced 0mm drop strengthens the posterior chain over time.',
    signature: 'Zero drop + FootShape toebox',
    faqs: [
      { question: 'How do I transition to zero-drop shoes?', answer: 'Gradually. Start with 1–2 short runs per week in a zero-drop shoe, build calf and Achilles capacity over 6–8 weeks, and avoid jumping straight from a 10mm-drop trainer to full-time zero-drop running.' },
      { question: 'Are Altra shoes good for wide feet?', answer: 'Yes — Altra\'s FootShape toebox is the roomiest in the industry, making them a top pick for wide feet, bunions, and runners who want toe splay.' },
      { question: 'Altra Torin vs Escalante?', answer: 'Torin is the cushioned daily trainer (~258g). Escalante is lighter and more flexible — better for shorter distances and runners who like a more ground-feel ride.' },
    ],
  },
];

export function getBrand(slug: string): BrandDef | undefined {
  return BRANDS.find(b => b.slug === slug);
}

export function getBrandShoes(brand: BrandDef, limit = 8): Shoe[] {
  return shoeDatabase
    .filter(s => s.brand.toLowerCase() === brand.name.toLowerCase())
    .sort((a, b) => b.year - a.year || b.cushioning - a.cushioning)
    .slice(0, limit);
}

export function getBrandCount(brand: BrandDef): number {
  return shoeDatabase.filter(s => s.brand.toLowerCase() === brand.name.toLowerCase()).length;
}
