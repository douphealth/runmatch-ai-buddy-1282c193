import { motion } from 'framer-motion';

interface QuizProgressProps {
  currentStep: number;
  totalSteps: number;
  progress: number;
}

const stepLabels = ['Foot Type', 'Pronation', 'Mileage', 'Distance', 'Terrain', 'Pace', 'Injuries', 'Brand', 'Budget', 'Your shoe'];
const stepIcons = ['🦶', '🔄', '📊', '🏁', '🌍', '⚡', '🛡️', '👟', '💰', '⭐'];

const QuizProgress = ({ currentStep, totalSteps, progress }: QuizProgressProps) => {
  return (
    <div className="sticky top-0 z-20 glass-strong px-4 py-3 md:py-4">
      <div className="max-w-2xl mx-auto">
        {/* Mobile: compact */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <motion.span
              key={currentStep}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-lg"
            >
              {stepIcons[currentStep] || '📋'}
            </motion.span>
            <motion.span
              key={`label-${currentStep}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs font-bold text-foreground uppercase tracking-wider"
            >
              {stepLabels[currentStep] || 'Quiz'}
            </motion.span>
          </div>
          <span className="text-xs font-bold text-primary tabular-nums bg-primary/10 px-2.5 py-1 rounded-full">
            {currentStep + 1} / {totalSteps}
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 bg-secondary/50 rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-primary rounded-full"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
          {/* Glow dot at end */}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-lg shadow-primary/50"
            initial={false}
            animate={{ left: `calc(${progress}% - 6px)` }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        </div>

        {/* Desktop step dots */}
        <div className="hidden md:flex items-center justify-between mt-3 px-0.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <motion.div
                animate={{
                  scale: i === currentStep ? 1.3 : 1,
                  backgroundColor: i <= currentStep ? 'hsl(1 76% 56%)' : 'hsl(220 15% 20%)',
                }}
                className="w-2 h-2 rounded-full transition-colors"
              />
              <span className={`text-[9px] font-medium transition-colors ${
                i === currentStep ? 'text-primary' : i < currentStep ? 'text-muted-foreground' : 'text-muted-foreground/40'
              }`}>
                {stepLabels[i]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuizProgress;
