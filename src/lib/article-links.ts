import { QuizAnswers } from './quiz-data';

export interface ArticleLink {
  url: string;
  title: string;
  category: string;
  icon: string;
}

export interface ToolLink {
  url: string;
  title: string;
  description: string;
  icon: string;
}

// Dynamic article selection based on quiz answers
export function getRecommendedArticles(answers: QuizAnswers): ArticleLink[] {
  const articles: ArticleLink[] = [];

  // Distance-based
  if (answers.distance === 'half-marathon') {
    articles.push(
      { url: 'https://gearuptofit.com/running/half-marathon-training-guide/', title: 'Half Marathon Training Guide', category: 'Training', icon: '🏅' },
      { url: 'https://gearuptofit.com/nutrition/what-to-eat-before-a-half-marathon/', title: 'What to Eat Before a Half Marathon', category: 'Nutrition', icon: '🍌' },
      { url: 'https://gearuptofit.com/nutrition/nutrition-plan-for-half-marathon/', title: 'Half Marathon Nutrition Plan', category: 'Nutrition', icon: '🥤' },
    );
  } else if (answers.distance === 'marathon' || answers.distance === 'ultra') {
    articles.push(
      { url: 'https://gearuptofit.com/running/fueling-tips-for-every-runner/', title: 'Fueling Tips for Every Runner', category: 'Nutrition', icon: '⛽' },
      { url: 'https://gearuptofit.com/running/long-run-nutrition/', title: 'Long Run Nutrition Strategy', category: 'Nutrition', icon: '🍯' },
      { url: 'https://gearuptofit.com/running/tapering-strategies/', title: 'Tapering Strategies for Race Day', category: 'Training', icon: '📉' },
    );
  } else if (answers.distance === '5k' || answers.distance === '10k') {
    articles.push(
      { url: 'https://gearuptofit.com/running/interval-training-for-runners/', title: 'Interval Training for Runners', category: 'Speed', icon: '⚡' },
      { url: 'https://gearuptofit.com/running/hill-training-for-runners/', title: 'Hill Training for Runners', category: 'Speed', icon: '⛰️' },
      { url: 'https://gearuptofit.com/running/outdoor-speed-training/', title: 'Outdoor Speed Training', category: 'Speed', icon: '🏃' },
    );
  }

  // Beginner signals (low mileage)
  if (answers.weeklyMileage < 20) {
    articles.push(
      { url: 'https://gearuptofit.com/running/how-to-start-running-from-scratch-the-smart-guide/', title: 'How to Start Running from Scratch', category: 'Beginner', icon: '🌱' },
      { url: 'https://gearuptofit.com/running/from-couch-to-your-first-5k/', title: 'From Couch to Your First 5K', category: 'Beginner', icon: '🛋️' },
      { url: 'https://gearuptofit.com/running/running-gear-for-beginners/', title: 'Running Gear for Beginners', category: 'Gear', icon: '🎒' },
    );
  }

  // Terrain-based
  if (answers.terrain === 'trail') {
    articles.push(
      { url: 'https://gearuptofit.com/running/start-trail-running/', title: 'How to Start Trail Running', category: 'Trail', icon: '🌲' },
      { url: 'https://gearuptofit.com/running/trail-running-terrains/', title: 'Guide to Trail Running Terrains', category: 'Trail', icon: '🏔️' },
    );
  }

  // Injury-based
  if (answers.injuries.includes('plantar-fasciitis')) {
    articles.push({ url: 'https://gearuptofit.com/review/best-running-shoes-for-plantar-fasciitis/', title: 'Best Running Shoes for Plantar Fasciitis', category: 'Injury', icon: '🦶' });
  }
  if (answers.injuries.includes('achilles')) {
    articles.push({ url: 'https://gearuptofit.com/running/the-best-running-sneakers-for-achilles-tendonitis/', title: 'Best Shoes for Achilles Tendinitis', category: 'Injury', icon: '⚡' });
  }
  if (answers.injuries.length > 0 && !answers.injuries.includes('none')) {
    articles.push(
      { url: 'https://gearuptofit.com/running/running-biomechanics-and-injury-prevention/', title: 'Running Biomechanics & Injury Prevention', category: 'Injury', icon: '🛡️' },
      { url: 'https://gearuptofit.com/running/return-to-running-after-injury/', title: 'Return to Running After Injury', category: 'Recovery', icon: '💪' },
      { url: 'https://gearuptofit.com/running/prevent-common-outdoor-running-injuries/', title: 'Prevent Common Running Injuries', category: 'Prevention', icon: '🏥' },
    );
  }

  // Pronation/foot type
  if (answers.pronation === 'overpronation') {
    articles.push({ url: 'https://gearuptofit.com/review/best-running-shoes-for-overpronation/', title: 'Best Shoes for Overpronation', category: 'Gear', icon: '👟' });
  }
  if (answers.footType === 'wide') {
    articles.push({ url: 'https://gearuptofit.com/review/best-running-shoes-for-wide-feet/', title: 'Best Running Shoes for Wide Feet', category: 'Gear', icon: '↔️' });
  }
  if (answers.footType === 'flat') {
    articles.push({ url: 'https://gearuptofit.com/review/best-running-shoes-for-flat-feet/', title: 'Best Running Shoes for Flat Feet', category: 'Gear', icon: '📏' });
  }

  // Form articles
  articles.push(
    { url: 'https://gearuptofit.com/running/master-proper-running-form/', title: 'Master Proper Running Form', category: 'Form', icon: '🏃‍♂️' },
    { url: 'https://gearuptofit.com/running/master-your-running-cadence/', title: 'Master Your Running Cadence', category: 'Form', icon: '🎵' },
  );

  // General shoe articles
  articles.push(
    { url: 'https://gearuptofit.com/review/best-running-shoes/', title: 'Best Running Shoes 2026', category: 'Reviews', icon: '👟' },
    { url: 'https://gearuptofit.com/review/best-daily-running-shoes/', title: 'Best Daily Running Shoes', category: 'Reviews', icon: '🏃' },
  );

  // Deduplicate by URL and return top 6
  const seen = new Set<string>();
  return articles.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  }).slice(0, 6);
}

export function getInjuryArticles(injuries: string[]): ArticleLink[] {
  if (injuries.includes('none') || injuries.length === 0) return [];
  const articles: ArticleLink[] = [];

  if (injuries.includes('plantar-fasciitis')) {
    articles.push({ url: 'https://gearuptofit.com/review/best-running-shoes-for-plantar-fasciitis/', title: 'Best Running Shoes for Plantar Fasciitis', category: 'Injury', icon: '🦶' });
  }
  if (injuries.includes('achilles')) {
    articles.push({ url: 'https://gearuptofit.com/running/the-best-running-sneakers-for-achilles-tendonitis/', title: 'Best Shoes for Achilles Tendinitis', category: 'Injury', icon: '⚡' });
  }
  articles.push(
    { url: 'https://gearuptofit.com/running/running-biomechanics-and-injury-prevention/', title: 'Biomechanics & Injury Prevention', category: 'Science', icon: '🔬' },
    { url: 'https://gearuptofit.com/running/common-foot-problems-for-runners/', title: 'Common Foot Problems for Runners', category: 'Health', icon: '🏥' },
    { url: 'https://gearuptofit.com/running/return-to-running-after-injury/', title: 'Return to Running After Injury', category: 'Recovery', icon: '💪' },
    { url: 'https://gearuptofit.com/running/prevent-common-outdoor-running-injuries/', title: 'Prevent Common Running Injuries', category: 'Prevention', icon: '🛡️' },
  );
  return articles.slice(0, 4);
}

export function getToolLinks(answers: QuizAnswers): ToolLink[] {
  const tools: ToolLink[] = [
    { url: 'https://gearuptofit.com/running/custom-running-plan-free/', title: 'Free Custom Running Plan', description: 'AI-generated training plan for your goals', icon: '📋' },
    { url: 'https://gearuptofit.com/running/running-distance-calculator/', title: 'Running Distance Calculator', description: 'Calculate routes, pace, and splits', icon: '📐' },
  ];

  if (answers.weeklyMileage > 40) {
    tools.push({ url: 'https://gearuptofit.com/fitness-and-health-calculators/fat-burning-heart-rate-calculator/', title: 'Fat Burning HR Calculator', description: 'Optimize your training zones', icon: '❤️' });
  }

  tools.push(
    { url: 'https://gearuptofit.com/fitness-and-health-calculators/macro-calculator/', title: 'Macro Calculator', description: 'Dial in your nutrition for performance', icon: '🥗' },
    { url: 'https://gearuptofit.com/fitness-and-health-calculators/sleep-efficiency-calculator/', title: 'Sleep Efficiency Calculator', description: 'Recovery starts with quality sleep', icon: '😴' },
  );

  return tools.slice(0, 4);
}

export function getKitLinks(): ArticleLink[] {
  return [
    { url: 'https://gearuptofit.com/review/best-running-socks-for-blister-prevention/', title: 'Best Running Socks', category: 'Socks', icon: '🧦' },
    { url: 'https://gearuptofit.com/review/best-smartwatches-for-runners/', title: 'Best Running Watches', category: 'Tech', icon: '⌚' },
    { url: 'https://gearuptofit.com/review/low-light-running-headlamps/', title: 'Best Running Headlamps', category: 'Safety', icon: '🔦' },
    { url: 'https://gearuptofit.com/best-foam-rollers-for-muscle-recovery/', title: 'Best Foam Rollers', category: 'Recovery', icon: '🧘' },
  ];
}
