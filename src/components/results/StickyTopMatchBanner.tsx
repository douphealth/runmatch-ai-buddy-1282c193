/**
 * Sticky bottom-of-viewport banner promoting the #1 matched shoe.
 *
 * SOTA presentation: full studio-quality shoe showcase on the left
 * (proper 4:3 frame so ShoeImage renders the real photo at full fidelity
 * with its brand-tinted glow and floor shadow), gradient glass body,
 * animated accent line, primary Amazon CTA, dismiss.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, ExternalLink, X, Trophy, ShieldCheck, Truck, RotateCcw } from 'lucide-react';
import ShoeImage from './ShoeImage';
import type { ScoredShoe } from '@/lib/scoring-engine';
import { track } from '@/lib/analytics';

const DISMISS_KEY = 'gutf_sticky_match_dismissed_v1';

interface Props {
  scored: ScoredShoe;
  amazonUrl: string;
}

const StickyTopMatchBanner = ({ scored, amazonUrl }: Props) => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return !!sessionStorage.getItem(DISMISS_KEY); } catch { return false; }
  });

  useEffect(() => {
    if (dismissed) return;
    const onScroll = () => setVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [dismissed]);

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setDismissed(true);
  };

  const onBuy = () => {
    track.affiliateClick({
      shoeId: scored.shoe.id,
      brand: scored.shoe.brand,
      model: scored.shoe.model,
      placement: 'sticky_bottom_banner',
    });
  };

  const show = visible && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 240, damping: 28 }}
          className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 md:px-4 md:pb-4 pointer-events-none"
          role="complementary"
          aria-label="Your #1 matched running shoe"
        >
          <div className="pointer-events-auto max-w-5xl mx-auto">
            <div className="relative rounded-2xl md:rounded-3xl border border-primary/40 overflow-hidden backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(229,57,53,0.35)]">
              {/* Layered background: deep glass + brand glow */}
              <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/85 to-background/95" />
              <div aria-hidden className="absolute -left-24 -top-24 w-80 h-80 bg-primary/25 rounded-full blur-[120px]" />
              <div aria-hidden className="absolute -right-24 -bottom-24 w-80 h-80 bg-primary/15 rounded-full blur-[120px]" />

              {/* Animated top accent */}
              <motion.div
                aria-hidden
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-primary origin-left"
              />
              {/* Subtle running shimmer */}
              <motion.div
                aria-hidden
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{ duration: 3.5, ease: 'easeInOut', repeat: Infinity, repeatDelay: 2 }}
                className="absolute top-0 h-[2px] w-1/3 bg-gradient-to-r from-transparent via-white/80 to-transparent"
              />

              <div className="relative flex items-center gap-3 md:gap-5 p-2.5 md:p-3 pr-3 md:pr-5">
                {/* SOTA shoe showcase — gives ShoeImage room to render at full quality */}
                <div className="relative flex-shrink-0 w-[110px] sm:w-[140px] md:w-[170px]">
                  <motion.div
                    initial={{ opacity: 0, x: -20, rotate: -4 }}
                    animate={{ opacity: 1, x: 0, rotate: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                  >
                    <ShoeImage
                      brand={scored.shoe.brand}
                      model={scored.shoe.model}
                      imageURL={scored.shoe.imageURL}
                      amazonASIN={scored.shoe.amazonASIN}
                      size="sm"
                      showSourceBadge={false}
                      interactive={false}
                      className="!rounded-xl shadow-lg shadow-black/40"
                    />
                  </motion.div>
                  {/* Match % crest overlay */}
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.3 }}
                    className="absolute -top-2 -left-2 w-11 h-11 md:w-12 md:h-12 rounded-full bg-gradient-primary glow-primary border-2 border-background flex flex-col items-center justify-center text-primary-foreground"
                  >
                    <span className="text-[10px] md:text-xs font-extrabold leading-none">{scored.matchPercent}%</span>
                    <span className="text-[7px] md:text-[8px] uppercase tracking-widest opacity-90 leading-none mt-0.5">Match</span>
                  </motion.div>
                </div>

                {/* Title block */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 border border-primary/40 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                      <Trophy className="w-3 h-3" /> #1 Match
                    </span>
                    <span className="hidden md:inline text-[10px] uppercase tracking-widest text-muted-foreground">
                      AI-verified pick
                    </span>
                  </div>
                  <p className="font-bold text-base md:text-xl leading-tight tracking-tight truncate">
                    {scored.shoe.brand} {scored.shoe.model}
                  </p>
                  <div className="hidden md:flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-primary/80" /> Verified retailer</span>
                    <span className="inline-flex items-center gap-1"><Truck className="w-3 h-3 text-primary/80" /> Free shipping</span>
                    <span className="inline-flex items-center gap-1"><RotateCcw className="w-3 h-3 text-primary/80" /> 30-day returns</span>
                  </div>
                  <div className="md:hidden text-[10px] text-muted-foreground truncate mt-0.5">
                    Verified · Free shipping · 30-day returns
                  </div>
                </div>

                {/* CTA */}
                <a
                  href={amazonUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow sponsored"
                  onClick={onBuy}
                  className="group relative inline-flex items-center gap-2 bg-gradient-primary glow-primary text-primary-foreground font-bold uppercase tracking-[0.12em] text-xs md:text-sm px-4 md:px-6 h-11 md:h-12 rounded-xl whitespace-nowrap hover:scale-[1.03] active:scale-[0.98] transition-transform"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span className="hidden sm:inline">Buy on Amazon</span>
                  <span className="sm:hidden">Buy</span>
                  <ExternalLink className="w-3 h-3 opacity-80 group-hover:translate-x-0.5 transition-transform" />
                </a>

                <button
                  onClick={dismiss}
                  aria-label="Dismiss"
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StickyTopMatchBanner;
