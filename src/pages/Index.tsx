import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { quizSteps, QuizAnswers, defaultAnswers, generateSlug, encodeAnswers } from '@/lib/quiz-data';
import QuizHero from '@/components/quiz/QuizHero';
import QuizProgress from '@/components/quiz/QuizProgress';
import QuizStepContent from '@/components/quiz/QuizStepContent';
import QuizNavigation from '@/components/quiz/QuizNavigation';

const Index = () => {
  const [currentStep, setCurrentStep] = useState(-1);
  const [answers, setAnswers] = useState<QuizAnswers>(defaultAnswers);
  const navigate = useNavigate();

  const progress = currentStep >= 0 ? ((currentStep + 1) / quizSteps.length) * 100 : 0;

  const setAnswer = useCallback((key: string, value: string | number | string[]) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }, []);

  const canProceed = () => {
    if (currentStep < 0) return true;
    const step = quizSteps[currentStep];
    const val = answers[step.id as keyof QuizAnswers];
    if (step.type === 'slider') return true;
    if (step.type === 'brand-input') return true; // brand is optional
    if (step.type === 'multi') return (val as string[]).length > 0;
    return !!val;
  };

  const handleNext = () => {
    if (currentStep < quizSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      const slug = generateSlug(answers);
      const encoded = encodeAnswers(answers);
      navigate(`/app/runmatch/${slug}?d=${encoded}`);
    }
  };

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

  if (currentStep === -1) {
    return <QuizHero onStart={() => setCurrentStep(0)} />;
  }

  const step = quizSteps[currentStep];
  const isLast = currentStep === quizSteps.length - 1;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-dark relative overflow-hidden">
      {/* Background image */}
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
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <QuizNavigation
        onBack={handleBack}
        onNext={handleNext}
        canProceed={canProceed()}
        isLast={isLast}
      />
    </div>
  );
};

export default Index;
