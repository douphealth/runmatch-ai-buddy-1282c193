import { motion } from 'framer-motion';
import { ArrowRight, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import ShoeImage from '@/components/results/ShoeImage';
import AffiliateDisclosure from '@/components/results/AffiliateDisclosure';
import { getTopPicks } from '@/lib/top-picks';
import { getPriceTier } from '@/lib/price-tier';
import { track } from '@/lib/analytics';

/**
 * Landing-page shelf: six shoes people can buy today, one per kind of run, each with its photo and the
 * Buy button of the same verified Amazon listing. Most visitors arrive from search and never start the
 * quiz, so this is where they get something they can act on straight away.
 */
const TopPicks = () => {
  const picks = getTopPicks(6);
  if (picks.length === 0) return null;

  return (
    <section aria-labelledby="top-picks-heading" className="relative z-10 px-4 md:px-8 py-14 md:py-16 bg-background border-t border-border/40">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h2 id="top-picks-heading" className="text-2xl md:text-3xl font-display font-bold mb-1">Popular picks right now</h2>
            <p className="text-muted-foreground text-sm md:text-base">One strong option for each kind of run. For a match to your own feet and mileage, take the quiz.</p>
          </div>
          <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1">
            Find my match <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {picks.map((p, i) => {
            const tier = getPriceTier(p.shoe.priceUSD);
            return (
              <motion.article
                key={p.shoe.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 3) * 0.06 }}
                className="rounded-2xl border border-border/60 bg-card/40 p-4 flex flex-col"
              >
                <ShoeImage brand={p.shoe.brand} model={p.shoe.model} imageURL={p.shoe.imageURL} size="md" showSourceBadge={false} interactive={false} />
                <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-wider">
                  <span className="text-primary font-bold">{p.categoryLabel}</span>
                  <span className="text-muted-foreground">· {tier.label} ({tier.range})</span>
                </div>
                <h3 className="font-semibold text-lg leading-snug mt-1">{p.shoe.brand} {p.shoe.model}</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4 flex-1">
                  {p.shoe.cushioning}/10 cushion · {p.shoe.dropMM} mm drop · {p.shoe.weightGrams} g{p.shoe.highlights[0] ? ` · ${p.shoe.highlights[0]}` : ''}
                </p>
                <div className="flex gap-2">
                  <a
                    href={p.amazonUrl}
                    target="_blank"
                    rel="noopener noreferrer sponsored nofollow"
                    onClick={() => track.affiliateClick({ shoeId: p.shoe.id, brand: p.shoe.brand, model: p.shoe.model, placement: 'landing_top_picks', position: i + 1, category: p.shoe.category })}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition"
                  >
                    <ShoppingCart className="w-4 h-4" /> Check price on Amazon
                  </a>
                  <Link
                    to={`/shoes/${p.shoe.id}`}
                    className="inline-flex items-center justify-center h-10 px-3 rounded-lg border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition"
                  >
                    Details
                  </Link>
                </div>
              </motion.article>
            );
          })}
        </div>
        <div className="mt-4 max-w-3xl">
          <AffiliateDisclosure variant="footer" />
        </div>
      </div>
    </section>
  );
};

export default TopPicks;
