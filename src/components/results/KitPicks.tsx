import { ShoppingCart } from 'lucide-react';
import { motion } from 'framer-motion';
import { track } from '@/lib/analytics';
import { toGearCard, type GearItem } from '@/lib/gear-catalog';
import AffiliateDisclosure from './AffiliateDisclosure';

interface KitPicksProps {
  items: GearItem[];
  /** Where the block sits, for analytics (e.g. `result_kit`, `shoe_detail_kit`). */
  placement: string;
  resultSlug?: string;
  title?: string;
  subtitle?: string;
}

/**
 * "Complete your kit": gear that suits the runner, each with the photo and the Buy button of the same
 * Amazon listing. Amazon-hosted photos, affiliate links marked `sponsored`, disclosure next to them.
 */
const KitPicks = ({
  items,
  placement,
  resultSlug,
  title = 'Complete your kit',
  subtitle = 'Gear that suits your running. Chosen from your answers; it never changes the shoe ranking.',
}: KitPicksProps) => {
  if (items.length === 0) return null;
  const cards = items.map(toGearCard);

  return (
    <section aria-labelledby={`${placement}-heading`} className="glass rounded-2xl p-5 md:p-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShoppingCart className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 id={`${placement}-heading`} className="text-xl md:text-2xl font-bold uppercase tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {cards.map((g, i) => (
          <motion.article
            key={g.id}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: Math.min(i, 3) * 0.05 }}
            className="rounded-xl border border-border/50 bg-card/40 p-3 md:p-4 flex flex-col"
          >
            <div className="rounded-lg bg-white aspect-square flex items-center justify-center overflow-hidden mb-3">
              {g.image ? (
                <img
                  src={g.image}
                  alt={g.name}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <ShoppingCart className="w-8 h-8 text-muted-foreground/50" />
              )}
            </div>
            <h3 className="font-semibold text-sm leading-snug mb-1">{g.name}</h3>
            <p className="text-xs text-muted-foreground leading-snug mb-3 flex-1">{g.why}</p>
            <a
              href={g.url}
              target="_blank"
              rel="noopener noreferrer sponsored nofollow"
              onClick={() =>
                track.affiliateClick({
                  shoe: g.name,
                  brand: g.brand,
                  placement,
                  position: i + 1,
                  category: g.category,
                  asin: g.asin,
                  resultSlug,
                })
              }
              className="inline-flex items-center justify-center gap-1.5 w-full h-10 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all"
            >
              <ShoppingCart className="w-3.5 h-3.5" /> Check price on Amazon
            </a>
          </motion.article>
        ))}
      </div>
      <div className="mt-4">
        <AffiliateDisclosure />
      </div>
    </section>
  );
};

export default KitPicks;
