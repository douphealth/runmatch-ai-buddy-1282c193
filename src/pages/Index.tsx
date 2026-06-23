import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { quizSteps, QuizAnswers, defaultAnswers, generateSlug, encodeAnswers } from '@/lib/quiz-data';
import { generateWebAppSchema } from '@/lib/seo';
import QuizHero from '@/components/quiz/QuizHero';
import QuizProgress from '@/components/quiz/QuizProgress';
import QuizStepContent from '@/components/quiz/QuizStepContent';
import QuizNavigation from '@/components/quiz/QuizNavigation';
import { Brain } from 'lucide-react';
import { track } from '@/lib/analytics';
import { saveProgress, loadProgress, clearProgress } from '@/lib/quiz-progress';

const Index = () => {
  const [currentStep, setCurrentStep] = useState(-1);
  const [answers, setAnswers] = useState<QuizAnswers>(defaultAnswers);
  const navigate = useNavigate();
  const quizStartedAt = useRef<number | null>(null);

  useEffect(() => { track.quizView(); }, []);

  useEffect(() => {
    const webApp = document.createElement('script');
    webApp.type = 'application/ld+json';
    webApp.textContent = JSON.stringify(generateWebAppSchema());

    const faq = document.createElement('script');
    faq.type = 'application/ld+json';
    faq.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Is RunMatch AI free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. No signup, no email required, no paywall. Some product links are Amazon affiliate links — GearUpToFit may earn a commission at no extra cost to you.' } },
        { '@type': 'Question', name: 'How long does the running shoe quiz take?', acceptedAnswer: { '@type': 'Answer', text: 'About 2 minutes for 9 questions covering foot type, pronation, mileage, distance, terrain, pace goals, injury history, brand preference, and budget.' } },
        { '@type': 'Question', name: 'How does RunMatch AI choose a shoe?', acceptedAnswer: { '@type': 'Answer', text: 'A deterministic scoring engine evaluates each shoe in a structured database with source links where available against your biomechanics and training profile across cushioning, drop, stack height, support type, weight, and intended use. The same answers always produce the same recommendation.' } },
        { '@type': 'Question', name: 'What is a shoe rotation?', acceptedAnswer: { '@type': 'Answer', text: 'Rotating between 2–3 different running shoes loads tissues differently and has been associated with up to 39% lower injury risk (British Journal of Sports Medicine, 2015). RunMatch AI builds you a daily trainer plus speed shoe plus long-run shoe rotation.' } },
        { '@type': 'Question', name: 'How often should I replace running shoes?', acceptedAnswer: { '@type': 'Answer', text: 'Most running shoes last 500–800 km (300–500 miles) depending on body weight, gait, and midsole foam. Replace sooner if you feel new aches or see midsole compression.' } },
      ],
    });

    document.head.appendChild(webApp);
    document.head.appendChild(faq);
    return () => { webApp.remove(); faq.remove(); };
  }, []);

  const progress = currentStep >= 0 ? ((currentStep + 1) / quizSteps.length) * 100 : 0;

  const answeredCount = useMemo(() => {
    let count = 0;
    if (answers.footType) count++;
    if (answers.pronation) count++;
    if (answers.weeklyMileage !== 30) count++;
    if (answers.distance) count++;
    if (answers.terrain) count++;
    if (answers.paceGoal) count++;
    if (answers.injuries.length > 0) count++;
    if (answers.brand.length > 0) count++;
    if (answers.budget.length > 0) count++;
    return count;
  }, [answers]);

  const confidencePercent = Math.round((answeredCount / 9) * 100);

  const setAnswer = useCallback((key: string, value: string | number | string[]) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }, []);

  const canProceed = () => {
    if (currentStep < 0) return true;
    const step = quizSteps[currentStep];
    const val = answers[step.id as keyof QuizAnswers];
    if (step.type === 'slider') return true;
    if (step.type === 'brand-multi') return true; // optional
    if (step.type === 'multi') return (val as string[]).length > 0;
    return !!val;
  };

  const handleNext = useCallback(() => {
    setCurrentStep(prev => {
      if (prev >= 0 && prev < quizSteps.length) {
        const step = quizSteps[prev];
        const val = answers[step.id as keyof QuizAnswers] as string | number | string[];
        track.quizStepComplete(prev, step.id, val);
      }
      if (prev < quizSteps.length - 1) return prev + 1;
      const slug = generateSlug(answers);
      const encoded = encodeAnswers(answers);
      track.quizComplete({ slug, durationMs: quizStartedAt.current ? Date.now() - quizStartedAt.current : 0 });
      clearProgress();
      navigate(`/app/runmatch/${slug}?d=${encoded}`);
      return prev;
    });
  }, [answers, navigate]);

  const handleBack = () => {
    setCurrentStep(prev => Math.max(-1, prev - 1));
  };

  const handleMultiSelect = useCallback((stepId: string, value: string) => {
    setAnswers(prev => {
      const current = prev[stepId as keyof QuizAnswers] as string[];
      if (value === 'none') return { ...prev, [stepId]: ['none'] };
      const filtered = current.filter(v => v !== 'none');
      if (filtered.includes(value)) {
        return { ...prev, [stepId]: filtered.filter(v => v !== value) };
      }
      return { ...prev, [stepId]: [...filtered, value] };
    });
  }, []);

  // Persist quiz progress to localStorage so users can resume after closing
  // the tab. Cleared on completion (navigate) and on explicit reset.
  useEffect(() => {
    if (currentStep < 0) return;
    saveProgress({ answers, step: currentStep });
  }, [answers, currentStep]);

  const handleStart = useCallback(() => {
    quizStartedAt.current = Date.now();
    track.quizStart();
    setCurrentStep(0);
  }, []);

  const handleResume = useCallback(() => {
    const p = loadProgress();
    if (!p) { handleStart(); return; }
    setAnswers(p.answers);
    quizStartedAt.current = Date.now();
    track.quizStart();
    track.ctaClick('quiz_resume', 'hero');
    setCurrentStep(Math.min(p.step, quizSteps.length - 1));
  }, [handleStart]);

  const handleRestart = useCallback(() => {
    clearProgress();
    handleStart();
  }, [handleStart]);

  if (currentStep === -1) {
    return <QuizHero onStart={handleStart} onResume={handleResume} onRestart={handleRestart} />;
  }

  const step = quizSteps[currentStep];
  const isLast = currentStep === quizSteps.length - 1;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-dark relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/3 rounded-full blur-[120px]" />
      </div>

      <QuizProgress currentStep={currentStep} totalSteps={quizSteps.length} progress={progress} />

      <div className="flex-1 flex items-center justify-center px-4 py-6 md:py-8 relative z-10">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 60, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -60, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <QuizStepContent
                step={step}
                answers={answers}
                setAnswer={setAnswer}
                handleMultiSelect={handleMultiSelect}
                onAutoAdvance={step.type === 'single' ? handleNext : undefined}
              />
            </motion.div>
          </AnimatePresence>

          {currentStep >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-6 glass rounded-xl p-3 flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Brain className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">AI Confidence</span>
                  <span className="text-xs font-bold text-primary">{confidencePercent}%</span>
                </div>
                <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-primary rounded-full"
                    initial={false}
                    animate={{ width: `${confidencePercent}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <QuizNavigation
        onBack={handleBack}
        onNext={handleNext}
        canProceed={canProceed()}
        isLast={isLast}
        hideNext={step.type === 'single'}
      />
    </div>
  );
};

export default Index;
