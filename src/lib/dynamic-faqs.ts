import { QuizAnswers } from './quiz-data';

export function getDynamicFAQs(answers: QuizAnswers) {
  const faqs = [
    {
      question: 'How does RunMatch AI determine my shoe recommendation?',
      answer: 'RunMatch AI uses a weighted scoring algorithm that analyzes 9 factors: foot type, pronation pattern, weekly mileage, preferred distance, terrain, pace goals, injury history, brand preference, and budget. Each shoe in our database is scored against your profile, with terrain, distance, and pronation carrying the highest weights. The result is a personalized match percentage and a complete rotation strategy.',
    },
    {
      question: 'What is a shoe rotation and why do I need one?',
      answer: 'A shoe rotation means alternating between 2-3 different pairs of running shoes throughout the week. Research published in the British Journal of Sports Medicine shows this reduces injury risk by up to 39% because each shoe loads your muscles and joints differently. Your rotation should typically include a daily trainer, a speed shoe for workouts, and possibly a cushioned long-run shoe.',
    },
    {
      question: 'How often should I replace my running shoes?',
      answer: 'Most running shoes last 500-800 km (300-500 miles) depending on your weight, stride mechanics, and the shoe construction. Signs of worn-out shoes include visible midsole compression, uneven outsole wear, reduced bounce-back, or new aches and pains. At your current mileage, that means replacing shoes roughly every 4-6 months.',
    },
  ];

  if (answers.pronation === 'unsure' || answers.pronation === 'overpronation') {
    faqs.push({
      question: 'What if I\'m unsure about my pronation type?',
      answer: 'If you\'re unsure about your pronation, check the wear pattern on your current shoes. Wear on the inner edge suggests overpronation, outer edge suggests underpronation, and even wear indicates neutral pronation. For a definitive assessment, visit a specialty running store for a gait analysis. Our algorithm accounts for uncertainty by recommending versatile shoes that work across pronation types.',
    });
  }

  if (answers.injuries.length > 0 && !answers.injuries.includes('none')) {
    faqs.push({
      question: 'How do my injuries affect the shoe recommendation?',
      answer: `Based on your injury history, we've prioritized shoes with features that reduce strain on your vulnerable areas. This includes selecting appropriate cushioning levels, heel-to-toe drop, and support structures. We also recommend specific injury prevention exercises and recovery strategies tailored to your profile.`,
    });
  }

  faqs.push(
    {
      question: 'Can I share my RunMatch results?',
      answer: 'Yes! Every RunMatch result has a unique shareable URL. Simply copy the page URL from your browser and send it to running partners, coaches, or friends. The link contains your complete runner profile and recommendations.',
    },
    {
      question: 'Are the Amazon links affiliate links?',
      answer: 'Yes, some links on this page are Amazon affiliate links. This means GearUpToFit may earn a small commission if you purchase through them — at no extra cost to you. This helps us keep RunMatch AI free and continue creating running content.',
    },
  );

  return faqs;
}
