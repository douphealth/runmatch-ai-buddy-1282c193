import { motion } from 'framer-motion';
import { quizSteps } from '@/lib/quiz-data';

interface QuizProgressProps {
  currentStep: number;
  totalSteps: number;
  progress: number;
}

const stepIcons = ['🦶', '🔄', '📊', '🏁', '🌍', '⚡', '🛡️', '👟', '💰'];

const QuizProgress = ({ currentStep, totalSteps, progress }: QuizProgressProps) => {
  return (
    <div className="sticky top-0 z-20 glass-strong px-4 py-3 md:py-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{stepIcons[currentStep] || '📋'}</span>
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              {quizSteps[currentStep]?.title?.replace('?', '') || 'Quiz'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-primary tabular-nums">
              {currentStep + 1}/{totalSteps}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Step dots (desktop) */}
        <div className="hidden md:flex items-center justify-between mt-3 px-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i <= currentStep
                  ? 'bg-primary scale-100'
                  : 'bg-secondary scale-75'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuizProgress;
