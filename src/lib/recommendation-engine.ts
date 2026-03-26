import { QuizAnswers } from './quiz-data';

export interface ShoeRecommendation {
  shoeProfile: {
    category: string;
    cushioning: string;
    dropRange: string;
    supportType: string;
    summary: string;
  };
  categoryExplanation: string;
  rotation: Array<{ purpose: string; shoeType: string; description: string }>;
  trainingEmphasis: string[];
  whyItWorks: string;
  slug: string;
}

export function generateRecommendation(answers: QuizAnswers): ShoeRecommendation {
  const { footType, pronation, weeklyMileage, distance, terrain, paceGoal, injuries, brand, budget } = answers;

  let supportType = 'Neutral';
  if (pronation === 'overpronation' || footType === 'flat') {
    supportType = injuries.includes('knee-pain') || injuries.includes('shin-splints') ? 'Motion Control' : 'Stability';
  } else if (pronation === 'underpronation' || footType === 'high-arch') {
    supportType = 'Neutral with Cushion';
  }

  let cushioning = 'Moderate';
  if (distance === 'marathon' || distance === 'ultra' || weeklyMileage > 60) {
    cushioning = 'Maximum';
  } else if (distance === '5k' || paceGoal === 'race') {
    cushioning = 'Light to Moderate';
  }
  if (injuries.includes('plantar-fasciitis') || injuries.includes('knee-pain')) {
    cushioning = 'Maximum';
  }

  let dropRange = '8–10mm';
  if (terrain === 'trail') dropRange = '4–6mm';
  if (paceGoal === 'race' && (distance === '5k' || distance === '10k')) dropRange = '6–8mm';
  if (injuries.includes('achilles')) dropRange = '10–12mm';
  if (injuries.includes('plantar-fasciitis')) dropRange = '8–12mm';

  let category = 'Daily Trainer';
  if (terrain === 'trail') category = 'Trail Runner';
  else if (paceGoal === 'race' || paceGoal === 'tempo') category = distance === '5k' || distance === '10k' ? 'Racing Flat / Speed Trainer' : 'Performance Trainer';
  else if (distance === 'marathon' || distance === 'ultra') category = 'Long-Distance Cushioned Trainer';
  else if (weeklyMileage < 20) category = 'Versatile Daily Trainer';

  if (footType === 'wide') category += ' (Wide Fit)';

  const summary = `A ${cushioning.toLowerCase()}-cushioned ${supportType.toLowerCase()} ${category.toLowerCase()} with a ${dropRange} heel-to-toe drop, optimized for ${terrain === 'trail' ? 'technical terrain' : terrain === 'track' ? 'track sessions' : 'road running'}.`;

  const categoryReasons: string[] = [];
  if (supportType !== 'Neutral') categoryReasons.push(`Your ${pronation === 'overpronation' ? 'overpronation' : 'foot type'} benefits from ${supportType.toLowerCase()} features to reduce injury risk.`);
  if (cushioning === 'Maximum') categoryReasons.push(`Higher mileage and ${distance} distance demand maximum cushioning to protect joints over time.`);
  if (terrain === 'trail') categoryReasons.push('Trail-specific outsoles provide the grip and protection you need on uneven surfaces.');
  if (paceGoal === 'race') categoryReasons.push('A lighter, more responsive build helps you hit goal pace on race day.');
  categoryReasons.push(`This category balances durability and performance for runners logging ${weeklyMileage} km/week.`);

  const rotation: ShoeRecommendation['rotation'] = [
    { purpose: 'Daily Training', shoeType: `${supportType} ${category}`, description: `Your go-to shoe for ${Math.round(weeklyMileage * 0.6)} km/week of easy and moderate runs.` },
  ];
  if (weeklyMileage > 30 || paceGoal === 'tempo' || paceGoal === 'race') {
    rotation.push({ purpose: 'Speed Work', shoeType: terrain === 'trail' ? 'Lightweight Trail Racer' : 'Lightweight Tempo Trainer', description: 'A lighter, more responsive shoe for intervals, tempo runs, and race-day efforts.' });
  }
  if (weeklyMileage > 40 || distance === 'marathon' || distance === 'ultra' || distance === 'half-marathon') {
    rotation.push({ purpose: 'Long Run', shoeType: 'Max-Cushioned Long-Run Shoe', description: 'Extra cushioning and support for your weekly long run to keep legs fresh.' });
  }
  if (terrain === 'mixed') {
    rotation.push({ purpose: 'Trail Days', shoeType: 'Trail Runner', description: 'Aggressive tread and rock plates for off-road sessions.' });
  }

  const training: string[] = [];
  if (distance === '5k') {
    training.push('Focus on speed intervals (400m–1km repeats) twice per week.');
    training.push('Build a base of 3–4 easy runs per week before adding intensity.');
  } else if (distance === '10k') {
    training.push('Include one tempo run (20–30 min at threshold pace) per week.');
    training.push('Add strides after easy runs to build leg turnover.');
  } else if (distance === 'half-marathon') {
    training.push('Build your long run gradually to 18–20 km over 8–10 weeks.');
    training.push('Practice race-pace segments during long runs.');
  } else if (distance === 'marathon') {
    training.push('Follow a 16–20 week progressive plan with peak long run of 32–35 km.');
    training.push('Prioritize fueling strategy during long runs over 90 minutes.');
  } else if (distance === 'ultra') {
    training.push('Back-to-back long runs on weekends simulate race-day fatigue.');
    training.push('Train on similar terrain and elevation to your target event.');
  } else {
    training.push('Vary your distances throughout the week to build all-around fitness.');
  }
  if (injuries.length > 0 && !injuries.includes('none')) {
    training.push('Incorporate strength training 2x/week focusing on hip and core stability to prevent re-injury.');
    training.push('Add dynamic warm-ups and post-run stretching to your routine.');
  }
  if (paceGoal === 'easy') {
    training.push('Keep 80% of your runs at conversational pace to build aerobic base.');
  }

  const whyParts = [
    `Based on your ${footType === 'wide' ? 'wide' : footType} foot type and ${pronation} pronation pattern, ${supportType.toLowerCase()} shoes will provide the right balance of guidance and natural movement.`,
    `At ${weeklyMileage} km/week targeting ${distance.replace('-', ' ')} on ${terrain} surfaces, ${cushioning.toLowerCase()} cushioning protects against cumulative impact while keeping the ride responsive.`,
  ];
  if (injuries.length > 0 && !injuries.includes('none')) {
    const injuryNames = injuries.map(i => i.replace(/-/g, ' ')).join(', ');
    whyParts.push(`Your history of ${injuryNames} means we prioritized extra protection and a ${dropRange} drop to reduce strain on vulnerable areas.`);
  }
  if (brand.length > 0) {
    const brandNames = brand.map(b => b.charAt(0).toUpperCase() + b.slice(1)).join(', ');
    whyParts.push(`${brandNames} offer${brand.length === 1 ? 's' : ''} excellent options in this category, so you can stay with brand${brand.length > 1 ? 's' : ''} you trust.`);
  }

  return {
    shoeProfile: { category, cushioning, dropRange, supportType, summary },
    categoryExplanation: categoryReasons.join(' '),
    rotation,
    trainingEmphasis: training,
    whyItWorks: whyParts.join(' '),
    slug: '',
  };
}
