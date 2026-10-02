import { Link } from 'react-router-dom';
import { ArrowRight, Scale } from 'lucide-react';
import { SCORING_WEIGHTS, FACTOR_LABELS } from '@/lib/scoring-engine';
import { shoeDatabase } from '@/lib/shoe-database';
import { SHOE_DATABASE_LAST_UPDATED_LABEL } from '@/lib/price-tier';

/**
 * Replaces the old invented "testimonials" with something real: a short,
 * verifiable summary of how shoes are ranked, computed from the live engine
 * constants and database, with a link to the full methodology.
 */
const MethodologyTeaser = ({ className = '' }: { className?: string }) => {
  const top = (Object.keys(SCORING_WEIGHTS) as (keyof typeof SCORING_WEIGHTS)[])
    .sort((a, b) => SCORING_WEIGHTS[b] - SCORING_WEIGHTS[a])
    .slice(0, 3);

  return (
    <section className={`glass rounded-2xl p-5 md:p-8 ${className}`} aria-labelledby="methodology-teaser-title">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Scale className="w-5 h-5 text-primary" />
        </div>
        <h2 id="methodology-teaser-title" className="text-xl md:text-2xl font-bold tracking-tight">
          How these shoes are ranked
        </h2>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">
        Every one of our {shoeDatabase.length} shoes is scored on nine fixed factors. The biggest are{' '}
        {top.map((k, i) => (
          <span key={k}>
            {i > 0 && (i === top.length - 1 ? ' and ' : ', ')}
            <strong className="text-foreground">{FACTOR_LABELS[k].toLowerCase()}</strong> ({Math.round(SCORING_WEIGHTS[k] * 100)}%)
          </span>
        ))}
        . The same answers always give the same ranking, and commission never changes it. Shoe data last reviewed{' '}
        {SHOE_DATABASE_LAST_UPDATED_LABEL}.
      </p>
      <Link to="/methodology" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
        Read the full methodology <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </section>
  );
};

export default MethodologyTeaser;
