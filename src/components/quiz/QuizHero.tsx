import { motion } from "framer-motion";
import { ArrowRight, Shield, RotateCcw, Target, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SEOContent from '@/components/SEOContent';

interface QuizHeroProps {
  onStart: () => void;
}

const features = [
  { icon: Target, label: 'Shoe Profile', desc: 'Personalized match' },
  { icon: RotateCcw, label: 'Rotation Plan', desc: '2-3 shoe strategy' },
  { icon: Shield, label: 'Injury Guard', desc: 'Prevention tips' },
];

const QuizHero = ({ onStart }: QuizHeroProps) => {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Hero background */}
      <div className="absolute inset-0">
        <img
          src="/images/hero-shoes.jpg"
          alt="Premium running shoes with dramatic red lighting"
          className="w-full h-full object-cover"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 to-transparent" />
      </div>

      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-primary/30 rounded-full"
            initial={{ x: `${20 + i * 15}%`, y: '100%', opacity: 0 }}
            animate={{
              y: '-10%',
              opacity: [0, 0.8, 0],
            }}
            transition={{
              duration: 4 + i * 1.5,
              repeat: Infinity,
              delay: i * 0.8,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 md:px-8 py-4">
        <div className="flex items-center gap-2">
          <img
            src="https://gearuptofit.com/wp-content/uploads/2023/03/cropped-Grey-Black-Illustration-Gym-Fitness-Logo.png"
            alt="GearUpToFit Logo"
            className="w-8 h-8 rounded-lg object-contain"
          />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">RunMatch AI</span>
        </div>
        <a
          href="https://gearuptofit.com/about-us/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          by GearUpToFit
        </a>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 relative z-10 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center max-w-3xl"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass mb-6 md:mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              Personalized · AI-Powered · Free
            </span>
          </motion.div>

          {/* Heading */}
          <h2 className="text-[2.5rem] sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-4 md:mb-6 uppercase leading-[0.9] sm:leading-[0.85] break-words" aria-label="RunMatch AI Running Shoe Finder">
            Find Your
            <motion.span
              className="block text-gradient mt-1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              Perfect Shoe
            </motion.span>
          </h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm sm:text-base md:text-lg text-muted-foreground mb-8 md:mb-10 max-w-xl mx-auto leading-relaxed px-2 sm:px-0"
          >
            9 expert questions. One perfect match. Get your personalized shoe profile,
            rotation strategy, and training path — backed by sports science.
          </motion.p>

          {/* Features row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="flex items-stretch justify-center gap-3 md:gap-4 mb-8 md:mb-10"
          >
            {features.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.1 }}
                className="glass rounded-xl p-3 md:p-4 flex flex-col items-center gap-2 flex-1 max-w-[140px]"
              >
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
                  <f.icon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-foreground">
                  {f.label}
                </span>
                <span className="text-[9px] md:text-[10px] text-muted-foreground hidden md:block">
                  {f.desc}
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="space-y-4"
          >
            <Button
              size="lg"
              onClick={onStart}
              className="h-14 md:h-16 px-10 md:px-16 text-base md:text-lg font-bold uppercase tracking-[0.15em] rounded-2xl bg-gradient-primary hover:opacity-90 transition-all glow-primary animate-pulse-glow group"
            >
              Get My Match
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>

            <div className="flex items-center justify-center gap-4 text-[10px] md:text-xs text-muted-foreground">
              <span className="flex items-center gap-1">🔒 No signup</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>⏱ 2 min</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>🎯 100% free</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <ChevronDown className="w-5 h-5 text-muted-foreground/50" />
          </motion.div>
        </motion.div>
      </div>
    </div>
    <SEOContent />
    </>
  );
};

export default QuizHero;
