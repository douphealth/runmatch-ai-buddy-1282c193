export interface QuizOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface QuizStep {
  id: string;
  title: string;
  subtitle: string;
  type: 'single' | 'multi' | 'slider' | 'brand-multi';
  options?: QuizOption[];
  sliderConfig?: { min: number; max: number; step: number; unit: string; labels?: string[] };
  image?: string;
}

export const quizSteps: QuizStep[] = [
  {
    id: 'footType',
    title: 'What is your foot type?',
    subtitle: 'This helps us determine the right support and fit for you.',
    type: 'single',
    image: '/images/step-foot-type.webp',
    options: [
      { value: 'neutral', label: 'Neutral Arch', description: 'Balanced footprint, medium arch', icon: 'Footprints' },
      { value: 'flat', label: 'Low Arch / Flat', description: 'Toes to heel almost connect', icon: 'Minus' },
      { value: 'high-arch', label: 'High Arch', description: 'Pronounced arch, midfoot lifted', icon: 'TrendingUp' },
      { value: 'wide', label: 'Wide Forefoot', description: 'Wider than average forefoot', icon: 'MoveHorizontal' },
    ],
  },
  {
    id: 'pronation',
    title: 'How do you pronate?',
    subtitle: 'Check the wear pattern on your current shoes if unsure.',
    type: 'single',
    image: '/images/step-pronation.webp',
    options: [
      { value: 'neutral', label: 'Neutral', description: 'Even wear in the middle', icon: 'CheckCircle2' },
      { value: 'overpronation', label: 'Overpronation', description: 'Inward roll — wear on the inside', icon: 'ArrowDownLeft' },
      { value: 'underpronation', label: 'Underpronation', description: 'Outward roll — wear on the outside', icon: 'ArrowUpRight' },
      { value: 'unsure', label: 'Not Sure', description: "We'll factor this in carefully", icon: 'HelpCircle' },
    ],
  },
  {
    id: 'weeklyMileage',
    title: 'Weekly mileage',
    subtitle: 'How many kilometers do you run per week on average?',
    type: 'slider',
    image: '/images/step-mileage.webp',
    sliderConfig: { min: 0, max: 120, step: 5, unit: 'km', labels: ['0 km', '30 km', '60 km', '90 km', '120+ km'] },
  },
  {
    id: 'distance',
    title: 'Preferred race distance',
    subtitle: 'What distance do you train for most often?',
    type: 'single',
    image: '/images/step-distance.webp',
    options: [
      { value: '5k', label: '5K', icon: 'Zap', description: '3.1 miles · Speed focus' },
      { value: '10k', label: '10K', icon: 'Activity', description: '6.2 miles · Speed + endurance' },
      { value: 'half-marathon', label: 'Half Marathon', icon: 'MapPin', description: '13.1 miles' },
      { value: 'marathon', label: 'Marathon', icon: 'Trophy', description: '26.2 miles' },
      { value: 'ultra', label: 'Ultra', icon: 'Mountain', description: '50K+ · Trail epic' },
      { value: 'mixed', label: 'Mixed', icon: 'Shuffle', description: 'Various distances' },
    ],
  },
  {
    id: 'terrain',
    title: 'Primary terrain',
    subtitle: 'Where do you do most of your running?',
    type: 'single',
    image: '/images/step-terrain.webp',
    options: [
      { value: 'road', label: 'Road', description: 'Pavement & sidewalks', icon: 'Route' },
      { value: 'trail', label: 'Trail', description: 'Dirt, rocks, roots', icon: 'Trees' },
      { value: 'track', label: 'Track', description: 'Running track surface', icon: 'CircleDot' },
      { value: 'mixed', label: 'Mixed / Treadmill', description: 'Combination of surfaces', icon: 'Shuffle' },
    ],
  },
  {
    id: 'paceGoal',
    title: 'Pace goal',
    subtitle: 'What kind of training intensity are you targeting?',
    type: 'single',
    image: '/images/step-pace.webp',
    options: [
      { value: 'easy', label: 'Easy / Recovery', description: 'Comfortable conversational pace', icon: 'Leaf' },
      { value: 'moderate', label: 'Moderate', description: 'Steady aerobic effort', icon: 'Gauge' },
      { value: 'tempo', label: 'Tempo', description: 'Comfortably hard threshold', icon: 'Flame' },
      { value: 'race', label: 'Race / Interval', description: 'All-out competitive effort', icon: 'Rocket' },
    ],
  },
  {
    id: 'injuries',
    title: 'Injury history',
    subtitle: "Select any injuries you've experienced. This affects our recommendation.",
    type: 'multi',
    image: '/images/step-injury.webp',
    options: [
      { value: 'plantar-fasciitis', label: 'Plantar Fasciitis', icon: 'Footprints' },
      { value: 'shin-splints', label: 'Shin Splints', icon: 'Bone' },
      { value: 'it-band', label: 'IT Band Syndrome', icon: 'Move' },
      { value: 'knee-pain', label: 'Knee Pain', icon: 'Activity' },
      { value: 'achilles', label: 'Achilles Tendinitis', icon: 'Zap' },
      { value: 'none', label: 'None', icon: 'ShieldCheck' },
    ],
  },
  {
    id: 'brand',
    title: 'Brand preference',
    subtitle: "Select one or more brands you prefer, or skip if you have no preference.",
    type: 'brand-multi',
    image: '/images/step-brand.webp',
  },
  {
    id: 'budget',
    title: 'Budget range',
    subtitle: 'Select one or more budget ranges you\'re comfortable with.',
    type: 'multi',
    image: '/images/step-budget.webp',
    options: [
      { value: 'under-100', label: 'Under $100', description: 'Budget-friendly picks', icon: 'DollarSign' },
      { value: '100-150', label: '$100 – $150', description: 'Mid-range sweet spot', icon: 'Wallet' },
      { value: '150-200', label: '$150 – $200', description: 'Premium performance', icon: 'Gem' },
      { value: '200-plus', label: '$200+', description: 'Top-tier technology', icon: 'Crown' },
    ],
  },
];

export const popularBrands = [
  'Nike', 'Adidas', 'Asics', 'Brooks', 'Hoka', 'New Balance', 'Saucony',
  'Mizuno', 'On', 'Altra', 'Puma', 'Reebok', 'Under Armour', 'Salomon',
  'Merrell', 'Inov-8', 'Topo Athletic', 'Newton', 'La Sportiva', 'Craft',
  'Diadora', 'Karhu', 'Zoot', '361 Degrees', 'Vibram', 'Xero Shoes',
];

export interface QuizAnswers {
  footType: string;
  pronation: string;
  weeklyMileage: number;
  distance: string;
  terrain: string;
  paceGoal: string;
  injuries: string[];
  brand: string[];
  budget: string[];
}

export const defaultAnswers: QuizAnswers = {
  footType: '',
  pronation: '',
  weeklyMileage: 30,
  distance: '',
  terrain: '',
  paceGoal: '',
  injuries: [],
  brand: [],
  budget: [],
};

export function generateSlug(answers: QuizAnswers): string {
  const parts = [
    answers.pronation || 'neutral',
    answers.distance || '10k',
    answers.terrain || 'road',
    answers.footType || 'neutral',
  ].map(p => p.toLowerCase().replace(/\s+/g, '-'));
  return parts.join('-');
}

// Reconstruct a complete QuizAnswers object from a slug alone, using sensible
// defaults for unencoded fields. Powers SEO pre-rendering and direct slug
// visits when no ?d= payload is present (e.g. shared search-engine results).
const VALID_PRONATION = new Set(['neutral', 'overpronation', 'underpronation', 'unsure']);
const VALID_DISTANCE = new Set(['5k', '10k', 'half-marathon', 'marathon', 'ultra', 'mixed']);
const VALID_TERRAIN = new Set(['road', 'trail', 'track', 'mixed']);
const VALID_FOOT = new Set(['neutral', 'flat', 'high-arch', 'wide']);

export function answersFromSlug(slug: string | undefined): QuizAnswers | null {
  if (!slug) return null;
  // Slug shape: "{pronation}-{distance}-{terrain}-{footType}"
  // Both distance ("half-marathon") and footType ("high-arch") may contain a
  // hyphen, so we anchor on the known-single-token pronation + terrain.
  const lower = slug.toLowerCase();
  const tokens = lower.split('-').filter(Boolean);
  if (tokens.length < 4) return null;

  const pronation = tokens[0];
  if (!VALID_PRONATION.has(pronation)) return null;

  // footType: try the last 2 tokens joined first (e.g. "high-arch"),
  // otherwise the last single token.
  let footType: string;
  let terrainIdx: number;
  const lastTwo = tokens.slice(-2).join('-');
  if (VALID_FOOT.has(lastTwo)) {
    footType = lastTwo;
    terrainIdx = tokens.length - 3;
  } else if (VALID_FOOT.has(tokens[tokens.length - 1])) {
    footType = tokens[tokens.length - 1];
    terrainIdx = tokens.length - 2;
  } else {
    return null;
  }

  const terrain = tokens[terrainIdx];
  if (!VALID_TERRAIN.has(terrain)) return null;

  const distance = tokens.slice(1, terrainIdx).join('-');
  if (!VALID_DISTANCE.has(distance)) return null;

  // Sensible defaults for fields not encoded in the slug.
  const weeklyMileage = ['marathon', 'ultra'].includes(distance) ? 60
    : distance === 'half-marathon' ? 45
    : distance === '10k' ? 30
    : 20;

  return {
    footType,
    pronation,
    weeklyMileage,
    distance,
    terrain,
    paceGoal: 'moderate',
    injuries: [],
    brand: [],
    budget: ['under-100', '100-150', '150-200', '200-plus'],
  };
}

export function encodeAnswers(answers: QuizAnswers): string {
  return btoa(JSON.stringify(answers));
}

export function decodeAnswers(encoded: string): QuizAnswers | null {
  try {
    const parsed = JSON.parse(atob(encoded));
    // Backward compat: convert old string brand/budget to arrays
    if (typeof parsed.brand === 'string') {
      parsed.brand = parsed.brand && parsed.brand !== 'no-preference' ? [parsed.brand] : [];
    }
    if (typeof parsed.budget === 'string') {
      parsed.budget = parsed.budget ? [parsed.budget] : [];
    }
    return parsed;
  } catch {
    return null;
  }
}
