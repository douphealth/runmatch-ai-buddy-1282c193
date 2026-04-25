import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { QuizStep, QuizAnswers, popularBrands } from '@/lib/quiz-data';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Check, Search, X } from 'lucide-react';

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
      {/* Step Image */}
      {step.image && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 -mx-4 md:mx-0"
        >
          <div className="relative rounded-none md:rounded-2xl overflow-hidden h-[140px] md:h-[180px]">
            <img
              src={step.image}
              alt={step.title}
              className="w-full h-full object-cover"
              loading="lazy"
              width={800}
              height={512}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute bottom-3 left-4 md:left-5">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary/80">
                Step {(['footType','pronation','weeklyMileage','distance','terrain','paceGoal','injuries','brand','budget'].indexOf(step.id) + 1)} of 9
              </span>
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

      {/* Options (single & multi) */}
      {(step.type === 'single' || step.type === 'multi') && step.options && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className={`grid gap-3 ${
            step.options.length <= 4
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-2 sm:grid-cols-3'
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
                  }
                }}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className={`relative flex flex-col items-start p-4 md:p-5 rounded-2xl border-2 transition-all text-left group overflow-hidden ${
                  isSelected
                    ? 'border-primary bg-primary/10 glow-primary-sm'
                    : 'border-border/50 bg-card/40 hover:border-muted-foreground/30 hover:bg-card/70'
                }`}
              >
                {isSelected && <div className="absolute inset-0 shimmer pointer-events-none" />}

                {isSelected && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30"
                  >
                    <Check className="w-3.5 h-3.5 text-primary-foreground" />
                  </motion.div>
                )}

                {option.icon && (
                  <span className="text-2xl md:text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">
                    {option.icon}
                  </span>
                )}
                <span className="font-bold text-sm md:text-base">{option.label}</span>
                {option.description && (
                  <span className="text-[11px] md:text-xs text-muted-foreground mt-1 leading-relaxed">
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
