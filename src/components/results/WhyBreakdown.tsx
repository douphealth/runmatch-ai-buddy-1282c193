import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import type { ScoredShoe } from '@/lib/scoring-engine';

interface WhyBreakdownProps {
  scored: ScoredShoe;
  /** Open by default (used for the #1 pick). */
  defaultOpen?: boolean;
}

/**
 * Transparent reasoning for one recommendation: how well the shoe fits on each
 * factor, how much that factor counts, and honest reasons it might not suit
 * the runner. Uses native <details> so it needs no JavaScript and is fully
 * keyboard and screen-reader accessible.
 */
const WhyBreakdown = ({ scored, defaultOpen = false }: WhyBreakdownProps) => {
  const { factors, watchOuts, matchPercent, shoe, newerVersion } = scored;

  return (
    <details className="group rounded-xl border border-border/60 bg-card/30 open:bg-card/50" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold marker:hidden">
        <span>
          Why it scored {matchPercent}%
          {watchOuts.length > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">· {watchOuts.length} thing{watchOuts.length === 1 ? '' : 's'} to check</span>}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>

      <div className="space-y-5 px-4 pb-4">
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">How well it fits each factor</p>
          <ul className="space-y-2">
            {factors.map((f) => {
              const fit = Math.round(f.value * 100);
              return (
                <li key={f.key} className="text-xs">
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="font-medium text-foreground">{f.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {fit}% fit · counts {Math.round(f.weight * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary/50" role="img" aria-label={`${f.label}: ${fit}% fit`}>
                    <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${fit}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Fit times weight, added up, gives the score. <Link to="/methodology" className="underline hover:text-primary">See the methodology</Link>.
          </p>
        </div>

        <div>
          <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Who should think twice about the {shoe.model}</p>
          {watchOuts.length > 0 ? (
            <ul className="space-y-1.5">
              {watchOuts.map((w) => (
                <li key={w} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warning" aria-hidden />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Nothing stands out in the specs we track, but fit is personal, so try it on if you can.</p>
          )}
          {newerVersion && (
            <p className="mt-2 text-xs text-muted-foreground">
              Newer version: <Link className="underline hover:text-primary" to={`/shoes/${newerVersion.id}`}>{newerVersion.brand} {newerVersion.model}</Link>.
            </p>
          )}
        </div>
      </div>
    </details>
  );
};

export default WhyBreakdown;
