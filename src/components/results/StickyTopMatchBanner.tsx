/**
 * Sticky bottom-of-viewport banner promoting the #1 matched shoe.
 *
 * Conversion design:
 *  - Always-visible Amazon CTA → highest-intent moment is "I'm reading the
 *    analysis"; keeping the buy button one tap away lifts affiliate CTR
 *    significantly vs a single in-content button.
 *  - Slides up after 600px scroll so it never overlaps the hero, and can be
 *    dismissed (per-session) so it never feels naggy.
 *  - Matches the dark glassmorphism system (no custom colors), red primary
 *    CTA, and is fully responsive — mobile shows compact label, desktop
 *    shows match badge + subtitle.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, ExternalLink, X, Trophy } from 'lucide-react';
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
    const onScroll = () => setVisible(window.scrollY > 600);
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
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pointer-events-none"
          role="complementary"
          aria-label="Your #1 matched running shoe"
        >
          <div className="pointer-events-auto max-w-5xl mx-auto">
            <div className="relative glass-strong rounded-2xl border border-primary/40 shadow-2xl shadow-primary/10 overflow-hidden">
              {/* Ambient gradient sheen */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/15"
              />
              {/* Animated accent bar */}
              <motion.div
                aria-hidden
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-primary origin-left"
              />

              <div className="relative flex items-center gap-3 md:gap-4 p-3 md:p-4">
                {/* Shoe thumb */}
                <div className="w-14 h-14 md:w-16 md:h-16 flex-shrink-0 rounded-xl overflow-hidden bg-secondary/40 border border-border/50">
                  <ShoeImage
                    brand={scored.shoe.brand}
                    model={scored.shoe.model}
                    imageURL={scored.shoe.imageURL}
                    amazonASIN={scored.shoe.amazonASIN}
                    size="sm"
                    showSourceBadge={false}
                    interactive={false}
                  />
                </div>

                {/* Title + match */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="inline-flex items-center gap-1 text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                      <Trophy className="w-3 h-3" /> #1 Match
                    </span>
                    <span className="text-[9px] md:text-[10px] uppercase tracking-widest text-muted-foreground">
                      · {scored.matchPercent}%
                    </span>
                  </div>
                  <p className="font-bold text-sm md:text-base leading-tight truncate">
                    {scored.shoe.brand} {scored.shoe.model}
                  </p>
                  <p className="hidden md:block text-[11px] text-muted-foreground truncate mt-0.5">
                    Verified pick · Free shipping on Amazon · 30-day returns
                  </p>
                </div>

                {/* CTA */}
                <a
                  href={amazonUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow sponsored"
                  onClick={onBuy}
                  className="inline-flex items-center gap-2 bg-gradient-primary glow-primary text-primary-foreground font-bold uppercase tracking-[0.1em] text-xs md:text-sm px-4 md:px-6 h-11 md:h-12 rounded-xl whitespace-nowrap hover:opacity-95 transition-opacity"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span className="hidden sm:inline">Buy on Amazon</span>
                  <span className="sm:hidden">Buy</span>
                  <ExternalLink className="w-3 h-3 opacity-80" />
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
