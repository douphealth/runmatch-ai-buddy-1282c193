import { ExternalLink, BookOpen, FileText, ShieldCheck } from 'lucide-react';

/**
 * Research & Sources panel.
 * Surfaces the peer-reviewed citations behind every claim made on the page
 * (rotation injury reduction, replacement mileage, drop/injury links).
 * Required for AI-citation defensibility (ChatGPT/Perplexity prefer
 * pages with linked primary sources over raw recommendations).
 */

interface Source {
  claim: string;
  citation: string;
  url: string;
  type: 'study' | 'guideline' | 'spec';
}

const SOURCES: Source[] = [
  {
    claim: 'Rotating multiple shoe models reduces running injury risk by ~39%',
    citation: 'Malisoux L. et al., Scandinavian Journal of Medicine & Science in Sports, 2013 — "Can parallel use of different running shoes decrease running-related injury risk?"',
    url: 'https://pubmed.ncbi.nlm.nih.gov/24286345/',
    type: 'study',
  },
  {
    claim: 'Running shoes typically last 500–800 km / 300–500 miles',
    citation: 'Nike running guide — "When should I replace my running shoes?"',
    url: 'https://www.nike.com/a/how-often-to-replace-running-shoes',
    type: 'guideline',
  },
  {
    claim: 'Lower heel-to-toe drop (4–6 mm) shifts load from the knee toward the ankle/Achilles',
    citation: 'Chambon N. et al., Journal of Sports Sciences, 2014 — "Shoe drop has opposite influence on running pattern when running overground or on a treadmill"',
    url: 'https://pubmed.ncbi.nlm.nih.gov/24694361/',
    type: 'study',
  },
  {
    claim: 'Pronation-based shoe prescription does NOT reduce injury rates in healthy runners',
    citation: 'Knapik J.J. et al., American Journal of Sports Medicine, 2014 — "Injury reduction effectiveness of selecting running shoes based on plantar shape"',
    url: 'https://pubmed.ncbi.nlm.nih.gov/23892375/',
    type: 'study',
  },
  {
    claim: 'Stack height >35 mm and carbon plates may improve running economy by 1–4%',
    citation: 'Hoogkamer W. et al., Sports Medicine, 2018 — "A Comparison of the Energetic Cost of Running in Marathon Racing Shoes"',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29143929/',
    type: 'study',
  },
  {
    claim: 'Shoe specifications (weight, drop, stack height) verified against manufacturer pages',
    citation: 'Brand-direct sources: Nike, ASICS, Brooks, Hoka, Saucony, New Balance, Adidas, Mizuno, On, Altra, Salomon, NNormal',
    url: 'https://www.nike.com/w/running-shoes-37v7jzy7ok',
    type: 'spec',
  },
];

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
            Every claim on this page is backed by a primary source — peer-reviewed studies, sports-medicine guidelines, and manufacturer specs.
          </p>
        </div>
      </div>

      <ul className="space-y-3">
        {SOURCES.map((s, i) => {
          const Icon = s.type === 'study' ? FileText : s.type === 'guideline' ? ShieldCheck : BookOpen;
          return (
            <li key={i} className="flex items-start gap-3 p-3 rounded-xl bg-card/30 border border-border/40">
              <Icon className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-snug mb-1">{s.claim}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.citation}</p>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5 font-medium"
                >
                  View source <ExternalLink className="w-3 h-3" />
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
