import { Link } from 'react-router-dom';
import { ChevronRight, ArrowRight } from 'lucide-react';
import SeoHead from '@/components/SeoHead';
import { Button } from '@/components/ui/button';
import { methodologySeo } from '@/lib/page-seo';
import { getMethodologySections, METHODOLOGY_LAST_REVIEWED, METHODOLOGY_TITLE, type Block } from '@/lib/methodology-content';
import { bylineText } from '@/lib/editorial';
import AffiliateDisclosure from '@/components/results/AffiliateDisclosure';
import MedicalDisclaimer from '@/components/results/MedicalDisclaimer';

const renderBlock = (b: Block, i: number) => {
  switch (b.type) {
    case 'p':
      return <p key={i} className="text-muted-foreground leading-relaxed">{b.text}</p>;
    case 'ul':
      return (
        <ul key={i} className="list-disc pl-5 space-y-2 text-muted-foreground leading-relaxed">
          {b.items.map((it) => <li key={it}>{it}</li>)}
        </ul>
      );
    case 'table':
      return (
        <div key={i} className="overflow-x-auto rounded-xl border border-border/60 bg-card/40">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/40">
              <tr>{b.head.map((h) => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {b.rows.map((r) => (
                <tr key={r[0]}>
                  {r.map((c, ci) => <td key={ci} className={`p-3 align-top ${ci === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'links':
      return (
        <ul key={i} className="space-y-3">
          {b.items.map((it) => (
            <li key={it.href} className="text-sm text-muted-foreground leading-relaxed">
              <a href={it.href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">{it.label}</a>
              {it.note && <span> — {it.note}</span>}
            </li>
          ))}
        </ul>
      );
  }
};

const Methodology = () => {
  const sections = getMethodologySections();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SeoHead seo={methodologySeo()} />

      <nav aria-label="Breadcrumb" className="container mx-auto px-4 pt-6 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link to="/" className="hover:text-foreground transition">RunMatch AI</Link></li>
          <ChevronRight className="w-3.5 h-3.5" />
          <li className="text-foreground font-medium" aria-current="page">Methodology</li>
        </ol>
      </nav>

      <main id="main-content" className="container mx-auto px-4 pt-8 pb-16 max-w-3xl">
        <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight mb-3">{METHODOLOGY_TITLE}</h1>
        <p className="text-sm text-muted-foreground mb-8">{bylineText()} · Last reviewed {METHODOLOGY_LAST_REVIEWED}</p>

        <div className="space-y-10">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="space-y-4">
              <h2 className="text-xl md:text-2xl font-bold">{s.heading}</h2>
              {s.blocks.map(renderBlock)}
            </section>
          ))}
        </div>

        <div className="mt-12 space-y-4">
          <AffiliateDisclosure variant="footer" />
          <MedicalDisclaimer variant="inline" />
          <Link to="/">
            <Button size="lg" className="mt-2 bg-primary hover:bg-primary/90">
              Take the free quiz <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Methodology;
