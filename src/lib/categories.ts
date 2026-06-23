import { shoeDatabase, Shoe } from './shoe-database';

export interface CategoryDef {
  slug: string;
  h1: string;
  title: string; // <60 chars
  description: string; // <160 chars
  intro: string;
  filter: (s: Shoe) => boolean;
  sort?: (a: Shoe, b: Shoe) => number;
  faqs: { question: string; answer: string }[];
  howTo: { name: string; description: string; steps: { name: string; text: string }[] };
  quizPrefill?: string; // search string appended to /
}

const byScore = (scoreFn: (s: Shoe) => number) => (a: Shoe, b: Shoe) => scoreFn(b) - scoreFn(a);

export const CATEGORIES: CategoryDef[] = [
  {
    slug: 'daily-trainer',
    h1: 'Best Daily Trainer Running Shoes (2026)',
    title: 'Best Daily Trainer Running Shoes 2026 | RunMatch AI',
    description: 'Top daily trainer running shoes for 2026 — structured specs, editor-reviewed picks, and a free quiz to find your match in 90 seconds.',
    intro: 'Daily trainers are the workhorse of any rotation: durable midsoles, balanced cushioning, and comfort across 30–80% of your weekly mileage. These are our 2026 top picks, scored against the same specs we use inside the RunMatch AI engine.',
    filter: s => s.category === 'daily' || s.category === 'hybrid',
    sort: byScore(s => s.cushioning * 1.2 + (s.widthOptions ? 1 : 0) - Math.abs(s.weightGrams - 280) / 50),
    faqs: [
      { question: 'What is a daily trainer running shoe?', answer: 'A daily trainer is a durable, well-cushioned road shoe built for the majority of your weekly mileage — easy runs, recovery, and moderate efforts. Look for cushioning 6–8/10 and weights 240–300g.' },
      { question: 'How long do daily trainers last?', answer: 'Most daily trainers last 400–600 miles (640–960 km). Rotate two pairs to extend lifespan and reduce repetitive-load injury risk.' },
      { question: 'Do I need more than one daily trainer?', answer: 'A 2-shoe rotation (daily + speed/long-run) reduces injury risk by ~39% according to a 2013 study in the Scandinavian Journal of Medicine & Science in Sports.' },
    ],
    howTo: {
      name: 'How to Choose a Daily Trainer Running Shoe',
      description: 'Pick a daily trainer that matches your foot type, mileage, and run paces.',
      steps: [
        { name: 'Check your pronation', text: 'Look at the wear pattern on an old pair. Even wear = neutral. Inner wear = overpronation. Outer wear = underpronation.' },
        { name: 'Match cushioning to mileage', text: 'Under 20 mpw: 5–7/10 cushioning. 20–50 mpw: 7–8/10. Over 50 mpw: 8–9/10.' },
        { name: 'Verify the drop and weight', text: 'A 8–10mm drop suits most heel strikers. 240–290g is the sweet spot for daily comfort.' },
        { name: 'Take the RunMatch AI quiz', text: 'Get a personalized 3-shoe rotation in 90 seconds, free.' },
      ],
    },
  },
  {
    slug: 'marathon',
    h1: 'Best Marathon Running Shoes (2026)',
    title: 'Best Marathon Running Shoes 2026 | RunMatch AI',
    description: 'Carbon-plated, max-cushion race-day shoes for marathon and half-marathon PRs. Free AI quiz to pick the right one for your stride.',
    intro: 'Marathon race-day shoes pair high-energy foam (PEBA, ZoomX, FuelCell) with a carbon plate for sustained propulsion across 13.1–26.2 miles. These are the top performers in our 2026 database.',
    filter: s => s.category === 'race' || (s.category === 'max-cushion' && s.bestDistances.includes('marathon')),
    sort: byScore(s => -s.weightGrams + s.cushioning * 8),
    faqs: [
      { question: 'Are carbon-plated shoes worth it for marathon?', answer: 'Yes — peer-reviewed studies show 2–4% running economy improvement on race-day super shoes for most runners. For a 4-hour marathoner, that is roughly 5–10 minutes.' },
      { question: 'How many miles can I run in a super shoe?', answer: 'Most carbon-plated PEBA shoes last 150–250 miles before significant foam degradation. Save them for races and key workouts.' },
      { question: 'Do I need a super shoe to run a marathon?', answer: 'No. A well-cushioned daily trainer is fine for first marathons. Super shoes shine when chasing a PR or running sub-3:45.' },
    ],
    howTo: {
      name: 'How to Pick a Marathon Race-Day Shoe',
      description: 'Find a race-day shoe that fits your pace, distance, and biomechanics.',
      steps: [
        { name: 'Confirm goal pace', text: 'Sub-3:30 marathoners benefit most from full carbon plates. 4-hour+ runners may prefer plated trainers with more stability.' },
        { name: 'Test long-run compatibility', text: 'Do at least one 18–22 mile long run in the shoe before race day to confirm tolerance.' },
        { name: 'Match plate stiffness to cadence', text: 'Higher cadence (>180 spm) runners favor stiffer plates; lower cadence prefers softer setups.' },
        { name: 'Take the RunMatch AI quiz', text: 'Get a race-day pick alongside your daily and speed shoes in one rotation.' },
      ],
    },
  },
  {
    slug: 'trail',
    h1: 'Best Trail Running Shoes (2026)',
    title: 'Best Trail Running Shoes 2026 | RunMatch AI',
    description: 'Top trail running shoes for technical, mixed, and groomed terrain. Aggressive lugs, rock plates, and source-linked specs where available — free AI quiz inside.',
    intro: 'Trail shoes need traction, protection, and terrain-specific midsole tuning. These picks cover technical mountain singletrack to groomed fire roads.',
    filter: s => s.terrain.includes('trail') || s.category === 'trail',
    sort: byScore(s => s.cushioning + (s.injuryFriendly.length * 0.5)),
    faqs: [
      { question: 'Can I use road shoes on trail?', answer: 'For groomed gravel and fire roads, yes. For technical singletrack with roots, rocks, and mud, dedicated trail shoes with 3mm+ lugs and a rock plate are safer.' },
      { question: 'What lug depth do I need?', answer: '2–3mm for dry/hardpack, 4–5mm for soft/muddy terrain, 6mm+ for snow and extreme mud.' },
      { question: 'Are waterproof trail shoes worth it?', answer: 'Only in cold or persistent wet conditions. GORE-TEX shoes run warmer and dry slower once water enters from the top.' },
    ],
    howTo: {
      name: 'How to Choose a Trail Running Shoe',
      description: 'Match your trail shoe to terrain, distance, and protection needs.',
      steps: [
        { name: 'Define your primary terrain', text: 'Technical (rocks/roots), mixed (groomed singletrack), or door-to-trail (mostly road).' },
        { name: 'Pick lug depth', text: '2–3mm for hardpack, 4–5mm for mud, 6mm+ for snow.' },
        { name: 'Decide on a rock plate', text: 'Essential for technical terrain or any ultra distance.' },
        { name: 'Take the RunMatch AI quiz', text: 'Get a trail-specific recommendation calibrated to your weekly mileage and injury history.' },
      ],
    },
  },
  {
    slug: 'stability',
    h1: 'Best Stability Running Shoes for Overpronation (2026)',
    title: 'Best Stability Running Shoes 2026 | RunMatch AI',
    description: 'Top stability shoes for overpronation and flat feet. Guide rails, medial posts, structured specs, and a free AI quiz inside.',
    intro: 'Modern stability shoes use guide rails and broad bases rather than aggressive medial posts to keep the foot aligned without forcing it. These picks balance support with a natural ride.',
    filter: s => s.category === 'stability' || s.pronation.includes('overpronation'),
    sort: byScore(s => (s.pronation.includes('overpronation') ? 5 : 0) + s.cushioning),
    faqs: [
      { question: 'Do I need a stability shoe?', answer: 'Only if you overpronate AND it causes pain or recurring injury. A 2023 systematic review found neutral shoes are safe for most overpronators without injury history.' },
      { question: 'What is overpronation?', answer: 'Overpronation is excessive inward roll of the foot after landing. It is normal in moderation — pathological only when paired with pain or instability.' },
      { question: 'Are guide rails better than medial posts?', answer: 'Most runners find guide rails (Brooks GuideRails, ASICS 3D Guidance) more comfortable than older medial-post designs. They engage only when needed.' },
    ],
    howTo: {
      name: 'How to Choose a Stability Running Shoe',
      description: 'Match support level to your pronation pattern and pain history.',
      steps: [
        { name: 'Get a gait analysis', text: 'Visit a specialty run shop or use a slow-motion phone video on a treadmill.' },
        { name: 'Match support level', text: 'Mild overpronation: guide rails. Severe overpronation or PTTD: medial post.' },
        { name: 'Confirm width fit', text: 'Stability is wasted if the shoe is too narrow. Look for 2E/4E options if needed.' },
        { name: 'Take the RunMatch AI quiz', text: 'Get a pronation-aware recommendation in 90 seconds.' },
      ],
    },
  },
  {
    slug: 'max-cushion',
    h1: 'Best Max-Cushion Running Shoes (2026)',
    title: 'Best Max-Cushion Running Shoes 2026 | RunMatch AI',
    description: 'Max-cushion daily trainers for high mileage, recovery, and joint protection. Structured specs and a free AI quiz inside.',
    intro: 'Max-cushion shoes reduce peak impact forces by up to 20% (J. Sports Sciences, 2022), making them ideal for recovery, high mileage, and runners managing knee or shin issues.',
    filter: s => s.category === 'max-cushion' || s.cushioning >= 9,
    sort: byScore(s => s.cushioning * 2 - Math.abs(s.weightGrams - 280) / 100),
    faqs: [
      { question: 'Are max-cushion shoes slower?', answer: 'Slightly heavier shoes can cost 1–2% running economy, but the recovery benefit on easy days outweighs this for most runners.' },
      { question: 'Do max-cushion shoes prevent injury?', answer: 'Evidence is mixed. They reduce impact peak but may shift load to other tissues. Pair with a lower-cushion speed shoe for tissue variation.' },
      { question: 'Are max-cushion shoes good for beginners?', answer: 'Yes — beginners adapting to running benefit from the forgiving ride and reduced impact during the bone-and-tendon adaptation phase.' },
    ],
    howTo: {
      name: 'How to Choose a Max-Cushion Running Shoe',
      description: 'Pick a max-cushion shoe that protects without sacrificing stability.',
      steps: [
        { name: 'Confirm you need it', text: 'High mileage (40+ mpw), 200+ lbs body weight, or recurring knee/shin pain are the strongest indicators.' },
        { name: 'Check stack height vs. stability', text: 'Stacks above 40mm can feel tippy — look for a wide base if you have weak ankles.' },
        { name: 'Avoid for speed work', text: 'Max-cushion shoes are recovery/long-run tools, not workout shoes.' },
        { name: 'Take the RunMatch AI quiz', text: 'Get a rotation that pairs your max-cushion daily with a faster shoe for variety.' },
      ],
    },
  },
  {
    slug: 'budget',
    h1: 'Best Budget Running Shoes Under $120 (2026)',
    title: 'Best Budget Running Shoes Under $120 | RunMatch AI',
    description: 'Top-rated running shoes under $120 for 2026. Real specs, no fluff, free AI quiz to match the right pair to your stride.',
    intro: 'You do not need a $250 super shoe to start running. These sub-$120 picks deliver durable foams, reliable outsoles, and category-leading value.',
    filter: s => s.priceUSD <= 120,
    sort: byScore(s => 200 - s.priceUSD + s.cushioning),
    faqs: [
      { question: 'Are cheap running shoes bad?', answer: 'No. Many sub-$120 shoes use the same outsole rubber and similar EVA foams as premium models. They simply skip the carbon plate and PEBA midsole.' },
      { question: 'How much should a beginner spend?', answer: '$90–$130 is the sweet spot. Going under $70 usually means outdated foams or last-gen models with low remaining lifespan.' },
      { question: 'Where can I find deals?', answer: 'End-of-cycle models (e.g., Pegasus 40 vs 41) often sell at 30–50% off when the new version launches. Specs are nearly identical.' },
    ],
    howTo: {
      name: 'How to Find the Best Budget Running Shoe',
      description: 'Get premium ride quality without paying premium prices.',
      steps: [
        { name: 'Target previous-generation models', text: 'Pegasus 40, Ghost 15, Cumulus 25 — last year\'s flagships at 30–50% off.' },
        { name: 'Skip carbon plates if budget is tight', text: 'EVA + rubber outsole pairs deliver 90% of the comfort at 50% of the price.' },
        { name: 'Buy from authorized retailers', text: 'Amazon, Running Warehouse, and brand stores guarantee authenticity and free returns.' },
        { name: 'Take the RunMatch AI quiz', text: 'Filter by your budget and get only shoes you can actually afford.' },
      ],
    },
  },
];

export function getCategory(slug: string): CategoryDef | undefined {
  return CATEGORIES.find(c => c.slug === slug);
}

export function getCategoryShoes(cat: CategoryDef, limit = 8): Shoe[] {
  const filtered = shoeDatabase.filter(cat.filter);
  const sorted = cat.sort ? [...filtered].sort(cat.sort) : filtered;
  return sorted.slice(0, limit);
}
