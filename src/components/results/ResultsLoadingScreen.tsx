import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { shoeDatabase } from '@/lib/shoe-database';

// The scoring itself takes a few milliseconds. This short transition only
// exists so the result doesn't pop in abruptly; it is kept brief (about 1s,
// down from 3s) and skipped entirely for people who ask for reduced motion.
const STAGE_MS = 160;

const stages = [
  { label: 'Reading your answers...', icon: '🦶', pct: 15 },
  { label: 'Checking foot type & gait...', icon: '🔬', pct: 30 },
  { label: `Scoring ${shoeDatabase.length} shoes against your answers...`, icon: '👟', pct: 50 },
  { label: 'Building your rotation...', icon: '🔄', pct: 70 },
  { label: 'Writing the reasons behind each pick...', icon: '📊', pct: 85 },
  { label: 'Done', icon: '✨', pct: 100 },
];

interface ResultsLoadingScreenProps {
  onComplete: () => void;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const ResultsLoadingScreen = ({ onComplete }: ResultsLoadingScreenProps) => {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      onComplete();
      return;
    }
    const timers: number[] = [];
    stages.forEach((_, i) => {
      timers.push(window.setTimeout(() => setStageIndex(i), i * STAGE_MS));
    });
    timers.push(window.setTimeout(onComplete, stages.length * STAGE_MS + 120));
    return () => timers.forEach(window.clearTimeout);
  }, [onComplete]);

  const stage = stages[stageIndex];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-dark" role="status" aria-live="polite">
      <div className="text-center max-w-md w-full space-y-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 mx-auto rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center"
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={stageIndex}
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 90 }}
              className="text-4xl"
            >
              {stage.icon}
            </motion.span>
          </AnimatePresence>
        </motion.div>

        <div>
          <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-tight mb-2">
            Matching Your Profile
          </h2>
          <AnimatePresence mode="wait">
            <motion.p
              key={stageIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-sm text-muted-foreground"
            >
              {stage.label}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="space-y-3">
          <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-primary rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${stage.pct}%` }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider">
            <span>Working</span>
            <span className="text-primary font-bold">{stage.pct}%</span>
          </div>
        </div>

        <div className="flex justify-center gap-6 text-[10px] text-muted-foreground">
          <span>📋 Your answers</span>
          <span>👟 {shoeDatabase.length} shoes</span>
          <span>⚖️ 9 weighted factors</span>
        </div>
      </div>
    </div>
  );
};

export default ResultsLoadingScreen;
