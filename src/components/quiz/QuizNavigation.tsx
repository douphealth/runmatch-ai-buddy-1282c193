import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuizNavigationProps {
  onBack: () => void;
  onNext: () => void;
  canProceed: boolean;
  isLast: boolean;
}

const QuizNavigation = ({ onBack, onNext, canProceed, isLast }: QuizNavigationProps) => {
  return (
    <div className="sticky bottom-0 glass-strong px-4 py-4 md:py-5 z-20">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          onClick={onBack}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={onNext}
            disabled={!canProceed}
            className={`gap-2 px-8 md:px-10 font-bold uppercase tracking-[0.1em] rounded-xl transition-all ${
              isLast
                ? 'bg-gradient-primary glow-primary h-12 text-base'
                : 'bg-primary hover:bg-primary/90 h-11'
            }`}
          >
            {isLast ? 'Get My Match' : 'Next'}
            {isLast ? <Zap className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default QuizNavigation;
