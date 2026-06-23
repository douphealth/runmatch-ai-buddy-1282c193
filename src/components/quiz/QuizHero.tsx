import { motion } from "framer-motion";
import { ArrowRight, Shield, RotateCcw, Target, ChevronDown, Home, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SEOContent from '@/components/SEOContent';
import { assetPath } from '@/lib/asset-path';
import TrustBar from '@/components/conversion/TrustBar';
import Testimonials from '@/components/conversion/Testimonials';
import LiveActivity from '@/components/conversion/LiveActivity';
import ExitIntent from '@/components/conversion/ExitIntent';
import EmailGate from '@/components/EmailGate';
import SavedMatches from '@/components/SavedMatches';
import { getAllComparisons } from '@/lib/comparisons';
import { BRANDS } from '@/lib/brands';
import { hasProgress } from '@/lib/quiz-progress';
import { useEffect, useState } from 'react';

const ComparisonHub = () => {
  const comparisons = getAllComparisons().slice(0, 9);
  return (
    <section className="relative z-10 px-4 md:px-8 py-14 bg-background border-t border-border/40">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-2">Head-to-head comparisons</h2>
        <p className="text-muted-foreground mb-6">Spec-by-spec breakdowns of the most-searched shoe matchups of 2026.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {comparisons.map(c => (
            <a key={c.slug} href={`/shoe-finder/compare/${c.slug}`} className="group rounded-xl p-5 bg-card/40 border border-border/60 hover:border-primary/40 hover:bg-card/60 transition-all">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="font-semibold group-hover:text-primary transition text-sm">
                  {c.a.brand} {c.a.model} <span className="text-primary">vs</span> {c.b.brand} {c.b.model}
                </h3>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition flex-shrink-0 ml-2" />
              </div>
              {c.pair.angle && <p className="text-xs text-muted-foreground">{c.pair.angle}</p>}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

interface QuizHeroProps {
  onStart: () => void;
  onResume?: () => void;
  onRestart?: () => void;
}

const features = [
  { icon: Target, label: 'Shoe Profile', desc: 'Personalized match' },
  { icon: RotateCcw, label: 'Rotation Plan', desc: '2-3 shoe strategy' },
  { icon: Shield, label: 'Injury Guard', desc: 'Prevention tips' },
];

const ResumeBanner = ({ onResume, onRestart }: { onResume: () => void; onRestart: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass rounded-2xl p-4 mb-6 max-w-xl mx-auto border border-primary/30 flex items-center gap-3"
    role="status"
  >
    <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
      <Clock className="w-4 h-4 text-primary" />
    </div>
    <div className="flex-1 text-left min-w-0">
      <p className="text-sm font-semibold">Resume your quiz?</p>
      <p className="text-xs text-muted-foreground">We saved your answers. Pick up where you left off.</p>
    </div>
    <Button size="sm" onClick={onResume} className="bg-primary hover:bg-primary/90 h-9 px-3 text-xs">
      Resume <ArrowRight className="ml-1 w-3 h-3" />
    </Button>
    <button
      type="button"
      onClick={onRestart}
      aria-label="Discard and restart quiz"
      className="text-muted-foreground hover:text-foreground transition p-1"
    >
      <X className="w-4 h-4" />
    </button>
  </motion.div>
);

const QuizHero = ({ onStart, onResume, onRestart }: QuizHeroProps) => {
  const [canResume, setCanResume] = useState(false);
  useEffect(() => { setCanResume(hasProgress()); }, []);
  return (
    <>
    <main id="main-content" className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Hero background */}
      <div className="absolute inset-0">
        <img
          src={assetPath('/images/hero-shoes.jpg')}
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
          href="/"
          className="group flex items-center gap-2 px-3 py-1.5 rounded-full glass hover:bg-primary/15 hover:border-primary/40 transition-all duration-300"
        >
          <Home className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/70 group-hover:text-primary transition-colors">Home</span>
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
            9 focused questions. One practical match. Get your personalized shoe profile,
            rotation strategy, and training path — built from structured shoe data.
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
            {canResume && onResume && onRestart && (
              <ResumeBanner
                onResume={() => { setCanResume(false); onResume(); }}
                onRestart={() => { setCanResume(false); onRestart(); }}
              />
            )}
            <Button
              size="lg"
              onClick={onStart}
              className="h-14 md:h-16 px-10 md:px-16 text-base md:text-lg font-bold uppercase tracking-[0.15em] rounded-2xl bg-gradient-primary hover:opacity-90 transition-all glow-primary animate-pulse-glow group"
            >
              {canResume ? 'Start a new quiz' : 'Get My Match'}
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>

            <div className="flex items-center justify-center gap-4 text-[10px] md:text-xs text-muted-foreground">
              <span className="flex items-center gap-1">🔒 No signup</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>⏱ 2 min</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>🎯 100% free</span>
            </div>

            {/* Trust bar — live runner count + verified badges */}
            <TrustBar className="mt-6 max-w-xl mx-auto" />
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
    </main>

    {/* Recall: returning runners see their saved matches first */}
    <SavedMatches />

    {/* Social proof: testimonials below the fold */}
    <section className="relative z-10 px-4 md:px-8 py-14 md:py-20 bg-gradient-to-b from-background to-background/95">
      <div className="max-w-6xl mx-auto">
        <Testimonials />
      </div>
    </section>

    {/* Programmatic SEO: category hub for internal linking + indexability */}
    <section className="relative z-10 px-4 md:px-8 py-14 bg-background border-t border-border/40">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-2">Browse by category</h2>
        <p className="text-muted-foreground mb-6">Or explore our 2026 shoe guides while the AI quiz loads.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { slug: 'daily-trainer', label: 'Daily Trainers', desc: 'Workhorse shoes for everyday miles' },
            { slug: 'marathon', label: 'Marathon Shoes', desc: 'Carbon-plated race-day picks' },
            { slug: 'trail', label: 'Trail Shoes', desc: 'Grip, protection, terrain-ready' },
            { slug: 'stability', label: 'Stability Shoes', desc: 'For overpronation & flat feet' },
            { slug: 'max-cushion', label: 'Max-Cushion Shoes', desc: 'Plush rides, joint protection' },
            { slug: 'budget', label: 'Under $120', desc: 'Best value picks of 2026' },
          ].map(c => (
            <a key={c.slug} href={`/shoe-finder/best-running-shoes/${c.slug}`} className="group rounded-xl p-5 bg-card/40 border border-border/60 hover:border-primary/40 hover:bg-card/60 transition-all">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="font-semibold group-hover:text-primary transition">{c.label}</h3>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition" />
              </div>
              <p className="text-sm text-muted-foreground">{c.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </section>

    {/* Programmatic SEO: head-to-head comparison hub */}
    <ComparisonHub />

    {/* Programmatic SEO: brand hub */}
    <section className="relative z-10 px-4 md:px-8 py-14 bg-background border-t border-border/40">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-2">Shop by brand</h2>
        <p className="text-muted-foreground mb-6">Structured 2026 picks from major running brands.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {BRANDS.map(b => (
            <a
              key={b.slug}
              href={`/shoe-finder/best-running-shoes/brand/${b.slug}`}
              className="group rounded-xl p-4 bg-card/40 border border-border/60 hover:border-primary/40 hover:bg-card/60 transition-all text-center"
            >
              <div className="font-semibold group-hover:text-primary transition">{b.name}</div>
              {b.signature && <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{b.signature}</div>}
            </a>
          ))}
        </div>
      </div>
    </section>

    <SEOContent />

    {/* FOMO: subtle live-match toasts */}
    <LiveActivity />

    {/* Exit-intent capture */}
    <ExitIntent>
      {({ open, close }) => (
        <EmailGate
          open={open}
          onClose={close}
          onUnlock={close}
          source="exit_popup"
          title="Wait — get the runner's playbook free"
          subtitle="Before you go: grab our 7-day shoe & training guide plus a $0 PDF report of the top 3 shoes for your style. No spam, unsubscribe in 1 click."
          ctaLabel="Send Me The Free Guide"
        />
      )}
    </ExitIntent>
    </>
  );
};

export default QuizHero;
