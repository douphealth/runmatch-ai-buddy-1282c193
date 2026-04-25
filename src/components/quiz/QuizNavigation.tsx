import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuizNavigationProps {
  onBack: () => void;
  onNext: () => void;
  canProceed: boolean;
  isLast: boolean;
  hideNext?: boolean;
}

const QuizNavigation = ({ onBack, onNext, canProceed, isLast, hideNext = false }: QuizNavigationProps) => {
  return (
    <div className="sticky bottom-0 glass-strong px-4 py-4 md:py-5 z-20">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          onClick={onBack}
          className="gap-2 text-muted-foreground hover:text-foreground rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <motion.div whileHover={{ scale: canProceed ? 1.03 : 1 }} whileTap={{ scale: canProceed ? 0.97 : 1 }}>
          <Button
            onClick={onNext}
            disabled={!canProceed}
            className={`gap-2 font-bold uppercase tracking-[0.1em] rounded-xl transition-all ${
              isLast
                ? 'bg-gradient-primary glow-primary h-13 md:h-14 px-8 md:px-12 text-base animate-pulse-glow'
                : 'bg-primary hover:bg-primary/90 h-11 md:h-12 px-6 md:px-10'
            }`}
          >
            {isLast ? (
              <>
                <Sparkles className="w-4 h-4" />
                Get My Match
                <Zap className="w-4 h-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default QuizNavigation;
