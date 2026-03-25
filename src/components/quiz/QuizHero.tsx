import { motion } from 'framer-motion';
import { ArrowRight, Zap, Shield, RotateCcw, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import heroImage from '@/assets/hero-shoes.jpg';

interface QuizHeroProps {
  onStart: () => void;
}

const features = [
  { icon: Target, label: 'Shoe Profile Match' },
  { icon: RotateCcw, label: 'Rotation Strategy' },
  { icon: Shield, label: 'Injury Prevention' },
];

const QuizHero = ({ onStart }: QuizHeroProps) => {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Hero background image */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Premium running shoes with dramatic red lighting"
          className="w-full h-full object-cover"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 relative z-10">
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass mb-8"
          >
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              AI-Powered Recommendation Engine
            </span>
          </motion.div>

          {/* Heading */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 uppercase leading-[0.9]">
            Find Your
            <span className="block text-gradient mt-1">Perfect Shoe</span>
          </h1>

          <p className="text-base md:text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
            Answer 9 expert questions about your running profile. Get a personalized shoe match, rotation strategy, and training path — all backed by sports science.
          </p>

          {/* Features row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="flex items-center justify-center gap-6 md:gap-8 mb-10"
          >
            {features.map((f) => (
              <div key={f.label} className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <f.icon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {f.label}
                </span>
              </div>
            ))}
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            <Button
              size="lg"
              onClick={onStart}
              className="h-14 md:h-16 px-10 md:px-14 text-base md:text-lg font-bold uppercase tracking-[0.15em] rounded-2xl bg-gradient-primary hover:opacity-90 transition-all glow-primary group"
            >
              Get My Match
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>

          {/* Trust line */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-8 text-xs text-muted-foreground"
          >
            🔒 No signup required · Takes 2 minutes · Powered by{' '}
            <a
              href="https://gearuptofit.com/about-us/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              GearUpToFit
            </a>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
};

export default QuizHero;
