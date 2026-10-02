import { ExternalLink, BookOpen, FileText, ShieldCheck } from 'lucide-react';
import { EVIDENCE } from '@/lib/evidence';

/**
 * Research & Sources panel.
 * Lists the studies behind the research notes on the page, each described at
 * the strength the study supports (design, sample size, effect size) and linked
 * to the primary record. Every entry comes from src/lib/evidence.ts, where the
 * citation details were checked against PubMed / Europe PMC.
 *
 * (The previous version linked two of its four studies to unrelated papers, an
 * inguinal-hernia paper and a poultry-pathology paper, and stated a causal
 * injury claim the study does not support.)
 */
const ResearchSources = () => {
  return (
    <div className="glass rounded-2xl p-5 md:p-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight">Research & Sources</h2>
          <p className="text-xs text-muted-foreground">
            The studies behind the research notes on this page, with their design and sample size so you can judge the strength yourself.
          </p>
        </div>
      </div>

      <ul className="space-y-3">
        {EVIDENCE.map((s) => {
          const Icon = s.type === 'study' ? FileText : ShieldCheck;
          return (
            <li key={s.id} className="flex items-start gap-3 p-3 rounded-xl bg-card/30 border border-border/40">
              <Icon className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-snug mb-1">{s.claim}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mb-1">{s.design}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.citation}</p>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5 font-medium"
                >
                  {s.type === 'study' ? 'View on PubMed' : 'View source'} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ResearchSources;
