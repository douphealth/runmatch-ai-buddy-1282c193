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
    image: '/images/step-foot-type.jpg',
    options: [
      { value: 'neutral', label: 'Neutral Arch', description: 'Balanced footprint, medium arch', icon: '🦶' },
      { value: 'flat', label: 'Low Arch / Flat', description: 'Toes to heel almost connect', icon: '📏' },
      { value: 'high-arch', label: 'High Arch', description: 'Pronounced arch, midfoot lifted', icon: '⬆️' },
      { value: 'wide', label: 'Wide Forefoot', description: 'Wider than average forefoot', icon: '↔️' },
    ],
  },
  {
    id: 'pronation',
    title: 'How do you pronate?',
    subtitle: 'Check the wear pattern on your current shoes if unsure.',
    type: 'single',
    image: '/images/step-pronation.jpg',
    options: [
      { value: 'neutral', label: 'Neutral', description: 'Even wear in the middle', icon: '✅' },
      { value: 'overpronation', label: 'Overpronation', description: 'Inward roll — wear on the inside', icon: '↙️' },
      { value: 'underpronation', label: 'Underpronation', description: 'Outward roll — wear on the outside', icon: '↗️' },
      { value: 'unsure', label: 'Not Sure', description: "We'll factor this in carefully", icon: '🤔' },
    ],
  },
  {
    id: 'weeklyMileage',
    title: 'Weekly mileage',
    subtitle: 'How many kilometers do you run per week on average?',
    type: 'slider',
    image: '/images/step-mileage.jpg',
    sliderConfig: { min: 0, max: 120, step: 5, unit: 'km', labels: ['0 km', '30 km', '60 km', '90 km', '120+ km'] },
  },
  {
    id: 'distance',
    title: 'Preferred race distance',
    subtitle: 'What distance do you train for most often?',
    type: 'single',
    image: '/images/step-distance.jpg',
    options: [
      { value: '5k', label: '5K', icon: '🛣️', description: '3.1 miles · Speed focus' },
      { value: '10k', label: '10K', icon: '👟', description: '6.2 miles · Speed + endurance' },
      { value: 'half-marathon', label: 'Half Marathon', icon: '📍', description: '13.1 miles' },
      { value: 'marathon', label: 'Marathon', icon: '⛰️', description: '26.2 miles' },
      { value: 'ultra', label: 'Ultra', icon: '🏔️', description: '50K+ · Trail epic' },
      { value: 'mixed', label: 'Mixed', icon: '🔄', description: 'Various distances' },
    ],
  },
  {
    id: 'terrain',
    title: 'Primary terrain',
    subtitle: 'Where do you do most of your running?',
    type: 'single',
    image: '/images/step-terrain.jpg',
    options: [
      { value: 'road', label: 'Road', description: 'Pavement & sidewalks', icon: '🛣️' },
      { value: 'trail', label: 'Trail', description: 'Dirt, rocks, roots', icon: '🌲' },
      { value: 'track', label: 'Track', description: 'Running track surface', icon: '🏟️' },
      { value: 'mixed', label: 'Mixed / Treadmill', description: 'Combination of surfaces', icon: '🔀' },
    ],
  },
  {
    id: 'paceGoal',
    title: 'Pace goal',
    subtitle: 'What kind of training intensity are you targeting?',
    type: 'single',
    image: '/images/step-pace.jpg',
    options: [
      { value: 'easy', label: 'Easy / Recovery', description: 'Comfortable conversational pace', icon: '🍃' },
      { value: 'moderate', label: 'Moderate', description: 'Steady aerobic effort', icon: '💪' },
      { value: 'tempo', label: 'Tempo', description: 'Comfortably hard threshold', icon: '🔥' },
      { value: 'race', label: 'Race / Interval', description: 'All-out competitive effort', icon: '⚡' },
    ],
  },
  {
    id: 'injuries',
    title: 'Injury history',
    subtitle: "Select any injuries you've experienced. This affects our recommendation.",
    type: 'multi',
    image: '/images/step-injury.jpg',
    options: [
      { value: 'plantar-fasciitis', label: 'Plantar Fasciitis', icon: '🦶' },
      { value: 'shin-splints', label: 'Shin Splints', icon: '🦴' },
      { value: 'it-band', label: 'IT Band Syndrome', icon: '🦵' },
      { value: 'knee-pain', label: 'Knee Pain', icon: '🦿' },
      { value: 'achilles', label: 'Achilles Tendinitis', icon: '⚡' },
      { value: 'none', label: 'None', icon: '✅' },
    ],
  },
  {
    id: 'brand',
    title: 'Brand preference',
    subtitle: "Select one or more brands you prefer, or skip if you have no preference.",
    type: 'brand-multi',
    image: '/images/step-brand.jpg',
  },
  {
    id: 'budget',
    title: 'Budget range',
    subtitle: 'Select one or more budget ranges you\'re comfortable with.',
    type: 'multi',
    image: '/images/step-budget.jpg',
    options: [
      { value: 'under-100', label: 'Under $100', description: 'Budget-friendly picks', icon: '💵' },
      { value: '100-150', label: '$100 – $150', description: 'Mid-range sweet spot', icon: '💰' },
      { value: '150-200', label: '$150 – $200', description: 'Premium performance', icon: '💎' },
      { value: '200-plus', label: '$200+', description: 'Top-tier technology', icon: '👑' },
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
