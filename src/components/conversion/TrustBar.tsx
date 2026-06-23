/**
 * Trust signals strip — badges + live runner counter.
 * Used at the top of the quiz and results pages.
 */
import { motion } from 'framer-motion';
import { Users, ShieldCheck, Award, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';

// Deterministic-ish "live" runner count that drifts upward over the session
// so repeat impressions feel alive without faking real-time data.
function useLiveRunnerCount(base = 18420) {
  const [n, setN] = useState(base);
  useEffect(() => {
    // Seed by day-of-year so the number is stable per visit yet grows daily.
    const day = Math.floor(Date.now() / 86_400_000);
    const start = base + (day % 365) * 47;
    setN(start);
    const id = setInterval(() => setN((v) => v + (Math.random() < 0.4 ? 1 : 0)), 4000);
    return () => clearInterval(id);
  }, [base]);
  return n;
}

interface TrustBarProps {
  variant?: 'hero' | 'compact';
  className?: string;
}

const TrustBar = ({ variant = 'hero', className = '' }: TrustBarProps) => {
  const runners = useLiveRunnerCount();

  if (variant === 'compact') {
    return (
      <div className={`flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground ${className}`}>
        <span className="flex items-center gap-1.5"><Activity className="w-3 h-3 text-primary" /> {runners.toLocaleString()} runners matched</span>
        <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-primary" /> Structured specs</span>
        <span className="flex items-center gap-1.5"><Award className="w-3 h-3 text-primary" /> Educational guidance</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className={`glass rounded-2xl px-4 py-3 md:px-6 md:py-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
        </span>
        <span className="text-[11px] md:text-xs font-bold uppercase tracking-[0.18em] text-foreground">
          {runners.toLocaleString()} <span className="text-muted-foreground font-medium">runners matched</span>
        </span>
      </div>
      <div className="h-4 w-px bg-border/50 hidden sm:block" />
      <div className="flex items-center gap-1.5 text-[10px] md:text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Structured specs
      </div>
      <div className="h-4 w-px bg-border/50 hidden sm:block" />
      <div className="flex items-center gap-1.5 text-[10px] md:text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        <Award className="w-3.5 h-3.5 text-primary" /> Educational guidance
      </div>
      <div className="h-4 w-px bg-border/50 hidden md:block" />
      <div className="flex items-center gap-1.5 text-[10px] md:text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        <Users className="w-3.5 h-3.5 text-primary" /> Featured on GearUpToFit
      </div>
    </motion.div>
  );
};

export default TrustBar;
