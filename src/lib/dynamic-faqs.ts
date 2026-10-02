import { QuizAnswers } from './quiz-data';
import { PRONATION_STATEMENT, REPLACEMENT_STATEMENT, ROTATION_STATEMENT } from './evidence';

/** "500–800 km at about 45 km a week works out to roughly 2–4 months." or '' when not meaningful. */
function replacementTimeline(weeklyKm: number): string {
  if (!Number.isFinite(weeklyKm) || weeklyKm < 5) return '';
  const weeksPerMonth = 4.345;
  const lo = Math.max(1, Math.round(500 / (weeklyKm * weeksPerMonth)));
  const hi = Math.max(lo, Math.round(800 / (weeklyKm * weeksPerMonth)));
  const span = lo === hi ? `about ${lo} month${lo === 1 ? '' : 's'}` : `roughly ${lo}–${hi} months`;
  return ` At about ${Math.round(weeklyKm)} km a week, that works out to ${span} of use.`;
}

export function getDynamicFAQs(answers: QuizAnswers) {
  const hasInjury = answers.injuries.some((i) => i !== 'none');
  const faqs = [
    {
      question: 'How does RunMatch AI determine my shoe recommendation?',
      answer: 'RunMatch AI scores every shoe in its database against your answers across terrain, race distance, gait and support, foot shape, comfort needs, budget, brand preference, pace and weekly mileage. If you name a shoe you already run in, the feel of that shoe is scored too. The same answers always give the same ranking, and each result lists the factors that drove its score.',
    },
    {
      question: 'What is a shoe rotation and why might I want one?',
      answer: `A shoe rotation means alternating between two or three pairs of running shoes through the week, for example a daily trainer, a faster shoe for workouts and a cushioned shoe for long runs. ${ROTATION_STATEMENT}`,
    },
    {
      question: 'How often should I replace my running shoes?',
      answer: `${REPLACEMENT_STATEMENT}${replacementTimeline(answers.weeklyMileage)}`,
    },
  ];

  if (answers.pronation === 'unsure' || answers.pronation === 'overpronation') {
    faqs.push({
      question: "What if I'm unsure about my pronation type?",
      answer: `You can check the wear pattern on an old pair: wear on the inner edge suggests your foot rolls inward, outer-edge wear suggests it rolls outward, and even wear is neutral. A specialty running store can also watch you run. ${PRONATION_STATEMENT} When you pick "not sure", RunMatch favors versatile neutral shoes.`,
    });
  }

  if (hasInjury) {
    faqs.push({
      question: 'How do my injuries affect the shoe recommendation?',
      answer:
        "Because you mentioned an injury or pain, RunMatch leans toward cautious, well-cushioned everyday shoes and away from race-day plated shoes. Shoes cannot diagnose or treat an injury, so this is a comfort-first shortlist, not medical advice. If the pain is current, getting worse or has lasted more than a couple of weeks, see a physiotherapist, sports-medicine doctor or podiatrist before choosing shoes.",
    });
  }

  faqs.push(
    {
      question: 'Can I share my RunMatch results?',
      answer: 'Yes. Use the Copy Link button on your result to send it to running partners, coaches or friends. The link re-creates your result from your answers, so whoever opens it sees the same shortlist.',
    },
    {
      question: 'Are the Amazon links affiliate links?',
      answer: 'Yes. As an Amazon Associate, GearUpToFit earns from qualifying purchases, at no extra cost to you. That helps keep RunMatch AI free. Rankings are produced by the scoring engine and are not influenced by commission.',
    },
  );

  return faqs;
}
