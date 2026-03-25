import { motion } from 'framer-motion';
import { QuizStep, QuizAnswers } from '@/lib/quiz-data';
import { Slider } from '@/components/ui/slider';
import { Check } from 'lucide-react';
import footAnalysis from '@/assets/foot-analysis.jpg';

interface QuizStepContentProps {
  step: QuizStep;
  answers: QuizAnswers;
  setAnswer: (key: string, value: string | number | string[]) => void;
  handleMultiSelect: (stepId: string, value: string) => void;
}

const stepImages: Record<string, string> = {
  footType: footAnalysis,
};

const QuizStepContent = ({ step, answers, setAnswer, handleMultiSelect }: QuizStepContentProps) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.97 },
    show: { opacity: 1, y: 0, scale: 1 },
  };

  return (
    <div>
      {/* Step image (when available) */}
      {stepImages[step.id] && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 rounded-2xl overflow-hidden border border-border/50 max-w-[280px] mx-auto"
        >
          <img
            src={stepImages[step.id]}
            alt={step.title}
            className="w-full h-auto object-cover"
            loading="lazy"
            width={800}
            height={600}
          />
        </motion.div>
      )}

      {/* Title */}
      <div className="mb-8">
        <h2 className="text-2xl md:text-4xl font-bold uppercase tracking-tight mb-2 leading-tight">
          {step.title}
        </h2>
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
          {step.subtitle}
        </p>
        {step.type === 'multi' && (
          <span className="inline-block mt-2 text-xs text-primary font-medium uppercase tracking-wider">
            Select all that apply
          </span>
        )}
      </div>

      {/* Slider */}
      {step.type === 'slider' && step.sliderConfig && (
        <div className="space-y-8">
          <div className="text-center py-6">
            <div className="inline-flex items-baseline gap-1">
              <motion.span
                key={answers.weeklyMileage}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-6xl md:text-7xl font-bold text-gradient tabular-nums"
              >
                {answers.weeklyMileage}
              </motion.span>
              <span className="text-xl md:text-2xl text-muted-foreground ml-2 font-light">
                {step.sliderConfig.unit}/week
              </span>
            </div>
          </div>
          <div className="px-2">
            <Slider
              value={[answers.weeklyMileage]}
              min={step.sliderConfig.min}
              max={step.sliderConfig.max}
              step={step.sliderConfig.step}
              onValueChange={([v]) => setAnswer('weeklyMileage', v)}
              className="py-4"
            />
          </div>
          {step.sliderConfig.labels && (
            <div className="flex justify-between text-[10px] md:text-xs text-muted-foreground px-1">
              {step.sliderConfig.labels.map(l => <span key={l}>{l}</span>)}
            </div>
          )}
        </div>
      )}

      {/* Options */}
      {(step.type === 'single' || step.type === 'multi') && step.options && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className={`grid gap-3 ${
            step.options.length <= 4
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-2 sm:grid-cols-3'
          }`}
        >
          {step.options.map(option => {
            const isSelected = step.type === 'multi'
              ? (answers[step.id as keyof QuizAnswers] as string[]).includes(option.value)
              : answers[step.id as keyof QuizAnswers] === option.value;

            return (
              <motion.button
                key={option.value}
                variants={itemVariants}
                onClick={() => {
                  if (step.type === 'multi') {
                    handleMultiSelect(step.id, option.value);
                  } else {
                    setAnswer(step.id, option.value);
                  }
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative flex flex-col items-start p-4 md:p-5 rounded-2xl border-2 transition-all text-left group ${
                  isSelected
                    ? 'border-primary bg-primary/10 glow-primary-sm'
                    : 'border-border/50 bg-card/50 hover:border-muted-foreground/30 hover:bg-card/80'
                }`}
              >
                {/* Selected check */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                  >
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </motion.div>
                )}

                {option.icon && (
                  <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">
                    {option.icon}
                  </span>
                )}
                <span className="font-semibold text-sm md:text-base">{option.label}</span>
                {option.description && (
                  <span className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {option.description}
                  </span>
                )}
              </motion.button>
            );
          })}
        </motion.div>
      )}
    </div>
  );
};

export default QuizStepContent;
