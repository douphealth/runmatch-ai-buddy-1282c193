import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { quizSteps, QuizAnswers, defaultAnswers, generateSlug, encodeAnswers } from '@/lib/quiz-data';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, ArrowRight, Zap } from 'lucide-react';

const Index = () => {
  const [currentStep, setCurrentStep] = useState(-1); // -1 = hero
  const [answers, setAnswers] = useState<QuizAnswers>(defaultAnswers);
  const navigate = useNavigate();

  const progress = currentStep >= 0 ? ((currentStep + 1) / quizSteps.length) * 100 : 0;

  const setAnswer = (key: string, value: string | number | string[]) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const canProceed = () => {
    if (currentStep < 0) return true;
    const step = quizSteps[currentStep];
    const val = answers[step.id as keyof QuizAnswers];
    if (step.type === 'slider') return true;
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

  const handleMultiSelect = (stepId: string, value: string) => {
    const current = answers[stepId as keyof QuizAnswers] as string[];
    if (value === 'none') {
      setAnswer(stepId, ['none']);
      return;
    }
    const filtered = current.filter(v => v !== 'none');
    if (filtered.includes(value)) {
      setAnswer(stepId, filtered.filter(v => v !== value));
    } else {
      setAnswer(stepId, [...filtered, value]);
    }
  };

  // Hero screen
  if (currentStep === -1) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center relative z-10 max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 mb-8">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Powered Recommendation</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 uppercase">
            Find Your Perfect
            <span className="block text-primary">Running Shoe</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-lg mx-auto leading-relaxed">
            Answer 9 quick questions about your running profile. Get a personalized shoe match, rotation strategy, and training tips.
          </p>

          <Button
            size="lg"
            onClick={() => setCurrentStep(0)}
            className="h-14 px-10 text-lg font-semibold uppercase tracking-wider rounded-xl bg-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/25"
          >
            Get My Match
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>

          <p className="mt-6 text-sm text-muted-foreground">
            Powered by{' '}
            <a href="https://gearuptofit.com/about-us/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              GearUpToFit
            </a>
          </p>
        </motion.div>
      </div>
    );
  }

  const step = quizSteps[currentStep];
  const isLast = currentStep === quizSteps.length - 1;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Progress */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Step {currentStep + 1} of {quizSteps.length}
            </span>
            <span className="text-xs font-medium text-primary">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5 bg-secondary" />
        </div>
      </div>

      {/* Quiz Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-2 uppercase tracking-tight">{step.title}</h2>
              <p className="text-muted-foreground mb-8">{step.subtitle}</p>

              {step.type === 'slider' && step.sliderConfig && (
                <div className="space-y-8">
                  <div className="text-center">
                    <span className="text-5xl font-bold text-primary">
                      {answers.weeklyMileage}
                    </span>
                    <span className="text-2xl text-muted-foreground ml-2">{step.sliderConfig.unit}/week</span>
                  </div>
                  <Slider
                    value={[answers.weeklyMileage]}
                    min={step.sliderConfig.min}
                    max={step.sliderConfig.max}
                    step={step.sliderConfig.step}
                    onValueChange={([v]) => setAnswer('weeklyMileage', v)}
                    className="py-4"
                  />
                  {step.sliderConfig.labels && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      {step.sliderConfig.labels.map(l => <span key={l}>{l}</span>)}
                    </div>
                  )}
                </div>
              )}

              {(step.type === 'single' || step.type === 'multi') && step.options && (
                <div className="grid grid-cols-2 gap-3">
                  {step.options.map(option => {
                    const isSelected = step.type === 'multi'
                      ? (answers[step.id as keyof QuizAnswers] as string[]).includes(option.value)
                      : answers[step.id as keyof QuizAnswers] === option.value;

                    return (
                      <button
                        key={option.value}
                        onClick={() => {
                          if (step.type === 'multi') {
                            handleMultiSelect(step.id, option.value);
                          } else {
                            setAnswer(step.id, option.value);
                          }
                        }}
                        className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
                            : 'border-border bg-card hover:border-muted-foreground/30'
                        }`}
                      >
                        {option.icon && <span className="text-xl mb-1">{option.icon}</span>}
                        <span className="font-semibold text-sm">{option.label}</span>
                        {option.description && (
                          <span className="text-xs text-muted-foreground mt-0.5">{option.description}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <div className="sticky bottom-0 bg-background/80 backdrop-blur-lg border-t border-border px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <Button variant="ghost" onClick={handleBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="gap-2 bg-primary hover:bg-primary/90 px-8 font-semibold uppercase tracking-wider"
          >
            {isLast ? 'Get My Match' : 'Next'}
            {isLast ? <Zap className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
