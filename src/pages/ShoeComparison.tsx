import { useEffect, useMemo } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ArrowRight, ExternalLink, Trophy, Sparkles, ChevronRight, Scale } from 'lucide-react';
import { getComparison, compareSpecs, getAllComparisons } from '@/lib/comparisons';
import { getAmazonLinkForShoe } from '@/lib/amazon-link';
import ShoeImage from '@/components/results/ShoeImage';
import AffiliateDisclosure from '@/components/results/AffiliateDisclosure';
import TrustBar from '@/components/conversion/TrustBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import type { Shoe } from '@/lib/shoe-database';

const SITE = 'https://gearuptofit.com';

const tier = (p: number) => (p < 110 ? 'Budget' : p < 160 ? 'Mid-range' : p < 220 ? 'Premium' : 'Super-premium');

const verdictFor = (a: Shoe, b: Shoe) => {
  const points: string[] = [];
  if (a.weightGrams < b.weightGrams - 10) points.push(`${a.brand} ${a.model} is noticeably lighter — better for tempo and race-day.`);
  else if (b.weightGrams < a.weightGrams - 10) points.push(`${b.brand} ${b.model} is noticeably lighter — better for tempo and race-day.`);
  if (a.cushioning > b.cushioning + 1) points.push(`${a.brand} ${a.model} offers more cushioning — better for recovery and long runs.`);
  else if (b.cushioning > a.cushioning + 1) points.push(`${b.brand} ${b.model} offers more cushioning — better for recovery and long runs.`);
  if (a.priceUSD < b.priceUSD - 20) points.push(`${a.brand} ${a.model} costs $${b.priceUSD - a.priceUSD} less.`);
  else if (b.priceUSD < a.priceUSD - 20) points.push(`${b.brand} ${b.model} costs $${a.priceUSD - b.priceUSD} less.`);
  if (a.pronation.includes('overpronation') && !b.pronation.includes('overpronation')) points.push(`${a.brand} ${a.model} is better suited for overpronators.`);
  else if (b.pronation.includes('overpronation') && !a.pronation.includes('overpronation')) points.push(`${b.brand} ${b.model} is better suited for overpronators.`);
  if (points.length === 0) points.push('Both shoes are close on paper — the right pick comes down to fit and ride feel.');
  return points;
};

const ShoeComparison = () => {
  const { slug } = useParams<{ slug: string }>();
  const data = slug ? getComparison(slug) : null;

  useEffect(() => {
    if (data) track.ctaClick('comparison_view', data.slug);
    window.scrollTo(0, 0);
  }, [data]);

  const otherComparisons = useMemo(() => getAllComparisons().filter(c => c.slug !== data?.slug).slice(0, 6), [data]);

  if (!data) return <Navigate to="/" replace />;
  const { a, b, h1, title, description } = data;
  const winners = compareSpecs(a, b);
  const canonical = `${SITE}/shoe-finder/compare/${data.slug}/`;
  const aUrl = getAmazonLinkForShoe(a.id, a.brand, a.model, a.amazonASIN);
  const bUrl = getAmazonLinkForShoe(b.id, b.brand, b.model, b.amazonASIN);
  const verdict = verdictFor(a, b);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'RunMatch AI', item: `${SITE}/shoe-finder/` },
        { '@type': 'ListItem', position: 2, name: 'Compare', item: `${SITE}/shoe-finder/compare/` },
        { '@type': 'ListItem', position: 3, name: h1, item: canonical },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: `Which is better: ${a.brand} ${a.model} or ${b.brand} ${b.model}?`,
          acceptedAnswer: { '@type': 'Answer', text: verdict.join(' ') },
        },
        {
          '@type': 'Question',
          name: `How much does the ${a.brand} ${a.model} cost vs the ${b.brand} ${b.model}?`,
          acceptedAnswer: { '@type': 'Answer', text: `The ${a.brand} ${a.model} retails for $${a.priceUSD} USD and the ${b.brand} ${b.model} for $${b.priceUSD} USD.` },
        },
        {
          '@type': 'Question',
          name: `What is the weight difference between the ${a.brand} ${a.model} and ${b.brand} ${b.model}?`,
          acceptedAnswer: { '@type': 'Answer', text: `The ${a.brand} ${a.model} weighs ${a.weightGrams}g and the ${b.brand} ${b.model} weighs ${b.weightGrams}g (men's US 9 reference).` },
        },
      ],
    },
    [a, b].map(s => ({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: `${s.brand} ${s.model}`,
      brand: { '@type': 'Brand', name: s.brand },
      category: 'Running Shoes',
      offers: {
        '@type': 'Offer',
        price: String(s.priceUSD),
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: getAmazonLinkForShoe(s.id, s.brand, s.model, s.amazonASIN),
      },
    })),
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="article" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="container mx-auto px-4 pt-6 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link to="/" className="hover:text-foreground transition">RunMatch AI</Link></li>
          <ChevronRight className="w-3.5 h-3.5" />
          <li><span>Compare</span></li>
          <ChevronRight className="w-3.5 h-3.5" />
          <li className="text-foreground font-medium" aria-current="page">{a.brand} {a.model} vs {b.brand} {b.model}</li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 pt-8 pb-10">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
            <Scale className="w-3.5 h-3.5 mr-1.5" /> Side-by-side · 2026
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight mb-4">
            {a.brand} {a.model} <span className="text-primary">vs</span> {b.brand} {b.model}
          </h1>
          {data.pair.angle && (
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6">{data.pair.angle}.</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Link to="/">
              <Button size="lg" className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                Find your match <Sparkles className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <a href="#table"><Button size="lg" variant="outline">Jump to table ↓</Button></a>
          </div>
        </motion.div>
        <div className="mt-8"><TrustBar variant="compact" /></div>
        <div className="mt-4"><AffiliateDisclosure /></div>
      </section>

      {/* Cards */}
      <section className="container mx-auto px-4 pb-12">
        <div className="grid md:grid-cols-2 gap-5">
          {[a, b].map((s, idx) => {
            const url = idx === 0 ? aUrl : bUrl;
            return (
              <motion.article
                key={s.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-6 hover:border-primary/40 transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <Badge variant="outline" className="text-xs uppercase">{s.category}</Badge>
                  <span className="text-sm font-semibold text-primary">${s.priceUSD}</span>
                </div>
                <ShoeImage brand={s.brand} model={s.model} imageURL={s.imageURL} amazonASIN={s.amazonASIN} size="lg" interactive={false} />
                <h2 className="mt-4 text-2xl font-display font-bold leading-tight">{s.brand} {s.model}</h2>
                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">{tier(s.priceUSD)} · {s.weightGrams}g · {s.dropMM}mm drop</p>
                <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  {s.highlights.slice(0, 3).map(h => <li key={h}>• {h}</li>)}
                </ul>
                <a
                  href={url}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  onClick={() => track.affiliateClick({ shoeId: s.id, brand: s.brand, model: s.model, placement: `comparison-${data.slug}` })}
                  className="mt-5 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
                >
                  Check price on Amazon <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </motion.article>
            );
          })}
        </div>
      </section>

      {/* Spec table */}
      <section id="table" className="container mx-auto px-4 pb-14">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-6">Spec-by-spec comparison</h2>
        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-4 font-semibold">Spec</th>
                <th className="p-4 font-semibold">{a.brand} {a.model}</th>
                <th className="p-4 font-semibold">{b.brand} {b.model}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <SpecRow label="Weight (men's US 9)" aVal={`${a.weightGrams} g`} bVal={`${b.weightGrams} g`} winner={winners.weight} />
              <SpecRow label="Cushioning (1–10)" aVal={`${a.cushioning}/10`} bVal={`${b.cushioning}/10`} winner={winners.cushioning} />
              <SpecRow label="Heel-to-toe drop" aVal={`${a.dropMM} mm`} bVal={`${b.dropMM} mm`} winner={null} />
              <SpecRow label="MSRP" aVal={`$${a.priceUSD}`} bVal={`$${b.priceUSD}`} winner={winners.price} />
              <SpecRow label="Category" aVal={a.category} bVal={b.category} winner={null} />
              <SpecRow label="Terrain" aVal={a.terrain.join(', ')} bVal={b.terrain.join(', ')} winner={null} />
              <SpecRow label="Pronation support" aVal={a.pronation.join(', ')} bVal={b.pronation.join(', ')} winner={null} />
              <SpecRow label="Wide widths" aVal={a.widthOptions ? 'Yes' : 'No'} bVal={b.widthOptions ? 'Yes' : 'No'} winner={null} />
              <SpecRow label="Best distances" aVal={a.bestDistances.join(', ')} bVal={b.bestDistances.join(', ')} winner={null} />
            </tbody>
          </table>
        </div>
      </section>

      {/* Verdict */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-4 flex items-center gap-2">
            <Trophy className="w-7 h-7 text-primary" /> The verdict
          </h2>
          <ul className="space-y-3">
            {verdict.map((v, i) => (
              <li key={i} className="p-4 rounded-xl bg-card/40 border border-border/60 text-muted-foreground leading-relaxed">{v}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 pb-20">
        <div className="max-w-3xl mx-auto text-center rounded-3xl p-10 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20">
          <Sparkles className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">Still not sure?</h2>
          <p className="text-muted-foreground mb-6 text-lg">Take the free RunMatch AI quiz and get a personalized 3-shoe rotation calibrated to your stride in 90 seconds.</p>
          <Link to="/">
            <Button size="lg" className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
              Start the quiz <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* More comparisons */}
      <section className="container mx-auto px-4 pb-16">
        <h2 className="text-xl font-semibold mb-4">More head-to-head comparisons</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {otherComparisons.map(c => (
            <Link key={c.slug} to={`/compare/${c.slug}`} className="p-4 rounded-xl bg-card/40 border border-border/60 hover:border-primary/40 transition text-sm">
              <span className="font-medium">{c.a.brand} {c.a.model}</span>
              <span className="text-muted-foreground"> vs </span>
              <span className="font-medium">{c.b.brand} {c.b.model}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

const SpecRow = ({ label, aVal, bVal, winner }: { label: string; aVal: string; bVal: string; winner: 'a' | 'b' | null }) => (
  <tr>
    <td className="p-4 font-medium">{label}</td>
    <td className={cn('p-4', winner === 'a' && 'text-primary font-semibold')}>{aVal}{winner === 'a' && ' ✓'}</td>
    <td className={cn('p-4', winner === 'b' && 'text-primary font-semibold')}>{bVal}{winner === 'b' && ' ✓'}</td>
  </tr>
);

export default ShoeComparison;
