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
  type: 'single' | 'multi' | 'slider';
  options?: QuizOption[];
  sliderConfig?: { min: number; max: number; step: number; unit: string; labels?: string[] };
}

export const quizSteps: QuizStep[] = [
  {
    id: 'footType',
    title: 'WHAT IS YOUR FOOT TYPE?',
    subtitle: 'This helps us determine the right support and fit for you.',
    type: 'single',
    options: [
      { value: 'neutral', label: 'Neutral', description: 'Normal arch height', icon: '🦶' },
      { value: 'flat', label: 'Flat', description: 'Low or no arch', icon: '📏' },
      { value: 'high-arch', label: 'High Arch', description: 'Pronounced arch curve', icon: '⬆️' },
      { value: 'wide', label: 'Wide', description: 'Wider than average forefoot', icon: '↔️' },
    ],
  },
  {
    id: 'pronation',
    title: 'HOW DO YOU PRONATE?',
    subtitle: 'Check the wear pattern on your current shoes if unsure.',
    type: 'single',
    options: [
      { value: 'neutral', label: 'Neutral', description: 'Even wear pattern' },
      { value: 'overpronation', label: 'Overpronation', description: 'Inward roll — inner edge wear' },
      { value: 'underpronation', label: 'Underpronation', description: 'Outward roll — outer edge wear' },
      { value: 'unsure', label: 'Not Sure', description: "We'll factor this in carefully" },
    ],
  },
  {
    id: 'weeklyMileage',
    title: 'WEEKLY MILEAGE',
    subtitle: 'How many kilometers do you run per week on average?',
    type: 'slider',
    sliderConfig: { min: 0, max: 120, step: 5, unit: 'km', labels: ['0 km', '30 km', '60 km', '90 km', '120+ km'] },
  },
  {
    id: 'distance',
    title: 'PREFERRED RACE DISTANCE',
    subtitle: 'What distance do you train for most often?',
    type: 'single',
    options: [
      { value: '5k', label: '5K', icon: '🏃' },
      { value: '10k', label: '10K', icon: '🏃‍♂️' },
      { value: 'half-marathon', label: 'Half Marathon', icon: '🏅' },
      { value: 'marathon', label: 'Marathon', icon: '🏆' },
      { value: 'ultra', label: 'Ultra', icon: '⛰️' },
      { value: 'mixed', label: 'Mixed', icon: '🔄' },
    ],
  },
  {
    id: 'terrain',
    title: 'PRIMARY TERRAIN',
    subtitle: 'Where do you do most of your running?',
    type: 'single',
    options: [
      { value: 'road', label: 'Road', description: 'Pavement & sidewalks', icon: '🛣️' },
      { value: 'trail', label: 'Trail', description: 'Dirt, rocks, roots', icon: '🌲' },
      { value: 'track', label: 'Track', description: 'Running track surface', icon: '🏟️' },
      { value: 'mixed', label: 'Mixed', description: 'Combination of surfaces', icon: '🔀' },
    ],
  },
  {
    id: 'paceGoal',
    title: 'PACE GOAL',
    subtitle: 'What kind of training intensity are you targeting?',
    type: 'single',
    options: [
      { value: 'easy', label: 'Easy / Recovery', description: 'Comfortable conversational pace' },
      { value: 'moderate', label: 'Moderate', description: 'Steady aerobic effort' },
      { value: 'tempo', label: 'Tempo', description: 'Comfortably hard threshold' },
      { value: 'race', label: 'Race Pace', description: 'All-out competitive effort' },
    ],
  },
  {
    id: 'injuries',
    title: 'INJURY HISTORY',
    subtitle: 'Select any injuries you've experienced. This affects our recommendation.',
    type: 'multi',
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
    title: 'BRAND PREFERENCE',
    subtitle: 'Any brand you lean toward? We'll factor this into the match.',
    type: 'single',
    options: [
      { value: 'nike', label: 'Nike' },
      { value: 'asics', label: 'Asics' },
      { value: 'brooks', label: 'Brooks' },
      { value: 'hoka', label: 'Hoka' },
      { value: 'new-balance', label: 'New Balance' },
      { value: 'saucony', label: 'Saucony' },
      { value: 'no-preference', label: 'No Preference' },
    ],
  },
  {
    id: 'budget',
    title: 'BUDGET RANGE',
    subtitle: 'What are you looking to spend on your next pair?',
    type: 'single',
    options: [
      { value: 'under-100', label: 'Under $100', description: 'Budget-friendly picks' },
      { value: '100-150', label: '$100 – $150', description: 'Mid-range sweet spot' },
      { value: '150-200', label: '$150 – $200', description: 'Premium performance' },
      { value: '200-plus', label: '$200+', description: 'Top-tier technology' },
    ],
  },
];

export interface QuizAnswers {
  footType: string;
  pronation: string;
  weeklyMileage: number;
  distance: string;
  terrain: string;
  paceGoal: string;
  injuries: string[];
  brand: string;
  budget: string;
}

export const defaultAnswers: QuizAnswers = {
  footType: '',
  pronation: '',
  weeklyMileage: 30,
  distance: '',
  terrain: '',
  paceGoal: '',
  injuries: [],
  brand: '',
  budget: '',
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
    return JSON.parse(atob(encoded));
  } catch {
    return null;
  }
}
