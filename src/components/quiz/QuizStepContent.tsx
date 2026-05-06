import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { QuizStep, QuizAnswers, popularBrands } from '@/lib/quiz-data';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Check, Search, X, icons as LucideIcons, type LucideIcon } from 'lucide-react';

const renderIcon = (name: string | undefined, isSelected: boolean) => {
  if (!name) return null;
  const Icon = (LucideIcons as Record<string, LucideIcon>)[name];
  if (!Icon) return null;
  return (
    <span
      className={`relative mb-2.5 inline-flex items-center justify-center w-11 h-11 md:w-12 md:h-12 rounded-xl transition-all duration-300 ${
        isSelected
          ? 'bg-gradient-to-br from-primary/25 to-primary/5 ring-1 ring-primary/40 shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.4)]'
          : 'bg-gradient-to-br from-muted/40 to-muted/10 ring-1 ring-border/40 group-hover:ring-primary/30 group-hover:from-primary/10'
      }`}
    >
      <Icon
        className={`w-5 h-5 md:w-6 md:h-6 transition-colors duration-300 ${
          isSelected ? 'text-primary' : 'text-foreground/70 group-hover:text-primary'
        }`}
        strokeWidth={2}
      />
    </span>
  );
};

interface QuizStepContentProps {
  step: QuizStep;
  answers: QuizAnswers;
  setAnswer: (key: string, value: string | number | string[]) => void;
  handleMultiSelect: (stepId: string, value: string) => void;
  onAutoAdvance?: () => void;
}

const QuizStepContent = ({ step, answers, setAnswer, handleMultiSelect, onAutoAdvance }: QuizStepContentProps) => {
  const [brandSearch, setBrandSearch] = useState('');

  const filteredBrands = useMemo(() => {
    if (!brandSearch) return popularBrands;
    return popularBrands.filter(b => b.toLowerCase().includes(brandSearch.toLowerCase()));
  }, [brandSearch]);

  const selectedBrands = answers.brand;

  const toggleBrand = (brand: string) => {
    const lower = brand.toLowerCase();
    if (selectedBrands.includes(lower)) {
      setAnswer('brand', selectedBrands.filter(b => b !== lower));
    } else {
      setAnswer('brand', [...selectedBrands, lower]);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 25 } },
  };

  return (
    <div>
      {/* Step Image — premium editorial hero, mobile-first */}
      {step.image && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-5 md:mb-7 -mx-4 sm:mx-0"
        >
          <div
          className="
              relative overflow-hidden
              rounded-2xl sm:rounded-3xl
              bg-gradient-to-br from-card/80 via-card/50 to-background/80
              ring-1 ring-border/40
              shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.25)]
              aspect-[3/2] sm:aspect-[16/9] md:aspect-[2/1]
              max-h-[260px] sm:max-h-[320px] md:max-h-[360px] lg:max-h-[400px]
              mx-2 sm:mx-0
            "
          >
            {/* Ambient glow behind image */}
            <div className="absolute -inset-8 bg-primary/10 blur-3xl opacity-40 pointer-events-none" />

            {/* Image — object-contain preserves built-in labels & triptych composition */}
            <motion.img
              src={step.image}
              alt={step.title}
              initial={{ scale: 1.02 }}
              animate={{ scale: 1 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full h-full object-cover object-center will-change-transform"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />

            {/* Step badge — floats top-right, no gradient overlay so image labels stay legible */}
            <div className="absolute top-2.5 right-2.5 sm:top-3.5 sm:right-3.5 z-10">
              <motion.span
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="inline-flex items-center gap-1.5 text-[9px] sm:text-[10px] md:text-xs font-bold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-primary bg-background/85 backdrop-blur-md border border-primary/30 px-2.5 py-1 rounded-full shadow-lg shadow-background/30"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Step {(['footType','pronation','weeklyMileage','distance','terrain','paceGoal','injuries','brand','budget'].indexOf(step.id) + 1)} / 9
              </motion.span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Title */}
      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-4xl font-bold uppercase tracking-tight mb-2 leading-tight">
          {step.title}
        </h2>
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
          {step.subtitle}
        </p>
        {(step.type === 'multi' || step.type === 'brand-multi') && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-1.5 mt-3 text-xs text-primary font-semibold uppercase tracking-wider bg-primary/10 px-3 py-1.5 rounded-full"
          >
            <Check className="w-3 h-3" />
            Select all that apply
          </motion.span>
        )}
      </div>

      {/* Slider */}
      {step.type === 'slider' && step.sliderConfig && (
        <div className="space-y-6">
          <div className="text-center py-4">
            <div className="glass rounded-2xl inline-flex items-baseline gap-1 px-8 py-5">
              <motion.span
                key={answers.weeklyMileage}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-5xl md:text-7xl font-bold text-gradient tabular-nums"
              >
                {answers.weeklyMileage}
              </motion.span>
              <span className="text-lg md:text-2xl text-muted-foreground ml-2 font-light">
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
          <div className="flex justify-center gap-2 mt-2">
            {[
              { label: 'Beginner', val: 15 },
              { label: 'Intermediate', val: 40 },
              { label: 'Advanced', val: 70 },
              { label: 'Elite', val: 100 },
            ].map(preset => (
              <button
                key={preset.label}
                onClick={() => setAnswer('weeklyMileage', preset.val)}
                className={`text-[10px] md:text-xs px-3 py-1.5 rounded-full border transition-all ${
                  answers.weeklyMileage === preset.val
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/50 text-muted-foreground hover:border-muted-foreground/50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Brand Multi-Select */}
      {step.type === 'brand-multi' && (
        <div className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              placeholder="Search brands..."
              className="pl-11 h-12 md:h-14 text-base bg-card/50 border-border/50 rounded-xl focus:border-primary"
            />
            {brandSearch && (
              <button
                onClick={() => setBrandSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Selected brands display */}
          {selectedBrands.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedBrands.map(b => (
                <motion.button
                  key={b}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  onClick={() => toggleBrand(b)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/20 text-primary text-xs font-semibold border border-primary/30"
                >
                  {b.charAt(0).toUpperCase() + b.slice(1)}
                  <X className="w-3 h-3" />
                </motion.button>
              ))}
            </div>
          )}

          {/* No preference button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setAnswer('brand', [])}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
              selectedBrands.length === 0
                ? 'border-primary bg-primary/10 glow-primary-sm'
                : 'border-border/50 bg-card/50 hover:border-muted-foreground/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🌐</span>
              <div>
                <span className="font-semibold text-sm">No Preference</span>
                <span className="block text-xs text-muted-foreground">We'll recommend based on fit, not brand</span>
              </div>
              {selectedBrands.length === 0 && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-auto w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </motion.div>
              )}
            </div>
          </motion.button>

          {/* Popular brands grid */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">
              {brandSearch ? `Results for "${brandSearch}"` : 'Popular brands — select one or more'}
            </p>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-3 sm:grid-cols-4 gap-2"
            >
              {filteredBrands.slice(0, 16).map(brand => {
                const isSelected = selectedBrands.includes(brand.toLowerCase());
                return (
                  <motion.button
                    key={brand}
                    variants={itemVariants}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toggleBrand(brand)}
                    className={`relative p-3 rounded-xl border transition-all text-center ${
                      isSelected
                        ? 'border-primary bg-primary/10 glow-primary-sm'
                        : 'border-border/50 bg-card/30 hover:border-muted-foreground/30 hover:bg-card/60'
                    }`}
                  >
                    {isSelected && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-primary-foreground" />
                      </motion.div>
                    )}
                    <span className="font-semibold text-xs md:text-sm">{brand}</span>
                  </motion.button>
                );
              })}
            </motion.div>
            {brandSearch && filteredBrands.length === 0 && (
              <div className="text-center mt-4 py-4 glass rounded-xl">
                <p className="text-sm text-muted-foreground">
                  No matches found — try a different search
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Options (single & multi) — premium responsive grid */}
      {(step.type === 'single' || step.type === 'multi') && step.options && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className={`grid gap-2.5 md:gap-3 ${
            step.options.length <= 4
              ? 'grid-cols-2'
              : step.options.length <= 6
                ? 'grid-cols-2 sm:grid-cols-3'
                : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3'
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
                    // Auto-advance after a beat so the user sees the selection animation
                    if (onAutoAdvance) {
                      setTimeout(() => onAutoAdvance(), 280);
                    }
                  }
                }}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className={`relative flex flex-col items-center justify-center text-center p-3 md:p-5 rounded-2xl border-2 transition-all group overflow-hidden min-h-[110px] md:min-h-[140px] ${
                  isSelected
                    ? 'border-primary bg-primary/10 glow-primary-sm shadow-lg shadow-primary/20'
                    : 'border-border/50 bg-card/40 hover:border-primary/40 hover:bg-card/70'
                }`}
              >
                {isSelected && <div className="absolute inset-0 shimmer pointer-events-none" />}

                {isSelected && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="absolute top-2 right-2 w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40 z-10"
                  >
                    <Check className="w-3 h-3 md:w-3.5 md:h-3.5 text-primary-foreground" strokeWidth={3} />
                  </motion.div>
                )}

                {option.icon && renderIcon(option.icon, isSelected)}
                <span className="font-bold text-xs md:text-sm leading-tight">{option.label}</span>
                {option.description && (
                  <span className="text-[10px] md:text-xs text-muted-foreground mt-1 leading-snug line-clamp-2">
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
