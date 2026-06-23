import { useEffect, useMemo } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  ArrowRight, ExternalLink, CheckCircle, ChevronRight, Sparkles,
  Gauge, Scale, Ruler, MapPin, Tag, Award, Footprints,
} from 'lucide-react';
import {
  getShoeById, getAlternatives, getSameBrand, getRelatedComparisons, describeUseCase,
} from '@/lib/shoe-detail';
import { getAmazonLinkForShoe } from '@/lib/amazon-link';
import ShoeImage from '@/components/results/ShoeImage';
import AffiliateDisclosure from '@/components/results/AffiliateDisclosure';
import TrustBar from '@/components/conversion/TrustBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { track } from '@/lib/analytics';

const SITE = 'https://gearuptofit.com';

const ShoeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const shoe = id ? getShoeById(id) : undefined;

  useEffect(() => {
    if (shoe) track.ctaClick('shoe_view', shoe.id);
    window.scrollTo(0, 0);
  }, [shoe]);

  const alternatives = useMemo(() => (shoe ? getAlternatives(shoe, 4) : []), [shoe]);
  const sameBrand = useMemo(() => (shoe ? getSameBrand(shoe, 4) : []), [shoe]);
  const comparisons = useMemo(() => (shoe ? getRelatedComparisons(shoe.id) : []), [shoe]);

  if (!shoe) return <Navigate to="/" replace />;

  const title = `${shoe.brand} ${shoe.model} Review & Specs (${shoe.year}) | RunMatch AI`;
  const useCase = describeUseCase(shoe);
  const description = `${shoe.brand} ${shoe.model} (${shoe.year}) — ${useCase}. ${shoe.weightGrams}g, ${shoe.dropMM}mm drop, ${shoe.cushioning}/10 cushioning. Structured specs with source links where available and a free AI quiz.`;
  const canonical = `${SITE}/shoe-finder/shoes/${shoe.id}/`;
  const amazonUrl = getAmazonLinkForShoe(shoe.id, shoe.brand, shoe.model, shoe.amazonASIN);

  const faqs = [
    { q: `Who is the ${shoe.brand} ${shoe.model} best for?`, a: `It is a ${useCase}. Best suited to runners who want ${shoe.highlights.join(', ').toLowerCase()}.` },
    { q: `How much does the ${shoe.brand} ${shoe.model} weigh?`, a: `The men's sample weighs approximately ${shoe.weightGrams}g (~${(shoe.weightGrams * 0.0353).toFixed(1)} oz).` },
    { q: `What is the heel-to-toe drop?`, a: `${shoe.dropMM}mm — ${shoe.dropMM >= 8 ? 'a traditional drop that suits heel strikers' : shoe.dropMM >= 4 ? 'a balanced low drop' : 'a low/zero drop that loads the calves and Achilles more'}.` },
    { q: `Is it suitable for ${shoe.terrain.includes('trail') ? 'trails' : 'roads'}?`, a: `Yes — the ${shoe.brand} ${shoe.model} is built for ${shoe.terrain.join(', ')} use.` },
    { q: `Does it come in wide sizes?`, a: shoe.widthOptions ? `Yes, wide widths are available on the ${shoe.model}.` : `No, the ${shoe.model} only ships in standard (D) width.` },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'RunMatch AI', item: `${SITE}/shoe-finder/` },
        { '@type': 'ListItem', position: 2, name: 'Shoes', item: `${SITE}/shoe-finder/shoes/` },
        { '@type': 'ListItem', position: 3, name: `${shoe.brand} ${shoe.model}`, item: canonical },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: `${shoe.brand} ${shoe.model}`,
      brand: { '@type': 'Brand', name: shoe.brand },
      category: 'Running Shoes',
      description,
      releaseDate: String(shoe.year),
      url: amazonUrl,
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'Weight', value: `${shoe.weightGrams}g` },
        { '@type': 'PropertyValue', name: 'Heel-to-toe drop', value: `${shoe.dropMM}mm` },
        { '@type': 'PropertyValue', name: 'Cushioning', value: `${shoe.cushioning}/10` },
        { '@type': 'PropertyValue', name: 'Terrain', value: shoe.terrain.join(', ') },
        { '@type': 'PropertyValue', name: 'Best distances', value: shoe.bestDistances.join(', ') },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ];

  const specs: { icon: typeof Gauge; label: string; value: string }[] = [
    { icon: Scale, label: 'Weight', value: `${shoe.weightGrams}g` },
    { icon: Ruler, label: 'Drop', value: `${shoe.dropMM}mm` },
    { icon: Gauge, label: 'Cushion', value: `${shoe.cushioning}/10` },
    { icon: MapPin, label: 'Terrain', value: shoe.terrain.join(' / ') },
    { icon: Tag, label: 'Price', value: `$${shoe.priceUSD}` },
    { icon: Footprints, label: 'Pronation', value: shoe.pronation.join(', ') },
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
        <meta property="og:type" content="product" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="container mx-auto px-4 pt-6 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link to="/" className="hover:text-foreground transition">RunMatch AI</Link></li>
          <ChevronRight className="w-3.5 h-3.5" />
          <li><Link to={`/shoe-finder/best-running-shoes/brand/${shoe.brand.toLowerCase().replace(/\s+/g, '-')}`} className="hover:text-foreground transition">{shoe.brand}</Link></li>
          <ChevronRight className="w-3.5 h-3.5" />
          <li className="text-foreground font-medium" aria-current="page">{shoe.model}</li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 pt-6 pb-12">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Badge className="mb-3 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              {shoe.year} · Verified Spec
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight mb-3">
              {shoe.brand} {shoe.model}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-5">
              {useCase}. {shoe.highlights.join(' · ')}.
            </p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {specs.map(s => (
                <div key={s.label} className="rounded-xl border border-border/60 bg-card/40 p-3">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    <s.icon className="w-3 h-3" /> {s.label}
                  </div>
                  <div className="text-sm font-semibold capitalize">{s.value}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mb-4">
              <a
                href={amazonUrl}
                target="_blank"
                rel="sponsored noopener noreferrer"
                onClick={() => track.affiliateClick({ shoeId: shoe.id, brand: shoe.brand, model: shoe.model, placement: `shoe-detail-hero` })}
              >
                <Button size="lg" className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                  Check price on Amazon <ExternalLink className="ml-2 w-4 h-4" />
                </Button>
              </a>
              <Link to="/">
                <Button size="lg" variant="outline">Find your perfect match <ArrowRight className="ml-2 w-4 h-4" /></Button>
              </Link>
            </div>
            <AffiliateDisclosure />
            <div className="mt-6"><TrustBar variant="compact" /></div>
          </motion.div>

          <div className="relative">
            <div className="rounded-3xl border border-border/60 bg-card/40 backdrop-blur p-6">
              <ShoeImage brand={shoe.brand} model={shoe.model} imageURL={shoe.imageURL} amazonASIN={shoe.amazonASIN} size="lg" interactive={false} />
            </div>
            {shoe.sourceURL && (
              <a
                href={shoe.sourceURL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition"
              >
                Verified spec source <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Highlights / who it's for */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-2 gap-6 max-w-5xl">
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><Award className="w-5 h-5 text-primary" /> Highlights</h2>
            <ul className="space-y-2">
              {shoe.highlights.map(h => (
                <li key={h} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /> <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <h2 className="text-xl font-bold mb-3">Who it's for</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><strong className="text-foreground">Best distances:</strong> {shoe.bestDistances.join(', ')}</li>
              <li><strong className="text-foreground">Use cases:</strong> {shoe.bestFor.join(', ')}</li>
              {shoe.injuryFriendly.length > 0 && (
                <li><strong className="text-foreground">May help with:</strong> {shoe.injuryFriendly.join(', ')}</li>
              )}
              <li><strong className="text-foreground">Width options:</strong> {shoe.widthOptions ? 'Standard + Wide' : 'Standard only'}</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Related comparisons */}
      {comparisons.length > 0 && (
        <section className="container mx-auto px-4 pb-16">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-5">Head-to-head comparisons</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {comparisons.map(c => {
              const other = getShoeById(c.otherId);
              if (!other) return null;
              return (
                <Link
                  key={c.slug}
                  to={`/shoe-finder/compare/${c.slug}`}
                  className="group rounded-xl p-4 bg-card/40 border border-border/60 hover:border-primary/40 hover:bg-card/60 transition-all"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="font-semibold text-sm group-hover:text-primary transition">
                      vs {other.brand} {other.model}
                    </h3>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition" />
                  </div>
                  {c.angle && <p className="text-xs text-muted-foreground">{c.angle}</p>}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <section className="container mx-auto px-4 pb-16">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-5">Alternatives to consider</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {alternatives.map(s => (
              <Link
                key={s.id}
                to={`/shoe-finder/shoes/${s.id}`}
                className="group rounded-2xl border border-border/60 bg-card/40 p-4 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all"
              >
                <ShoeImage brand={s.brand} model={s.model} imageURL={s.imageURL} amazonASIN={s.amazonASIN} size="sm" interactive={false} />
                <div className="mt-3 font-semibold group-hover:text-primary transition text-sm">{s.brand} {s.model}</div>
                <div className="text-xs text-muted-foreground">{s.weightGrams}g · {s.dropMM}mm · ${s.priceUSD}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* More from same brand */}
      {sameBrand.length > 0 && (
        <section className="container mx-auto px-4 pb-16">
          <h2 className="text-xl md:text-2xl font-display font-bold mb-4">More from {shoe.brand}</h2>
          <div className="flex flex-wrap gap-2">
            {sameBrand.map(s => (
              <Link
                key={s.id}
                to={`/shoe-finder/shoes/${s.id}`}
                className="px-4 py-2 rounded-full bg-card/40 border border-border/60 hover:border-primary/40 text-sm transition"
              >
                {s.model}
              </Link>
            ))}
            <Link
              to={`/shoe-finder/best-running-shoes/brand/${shoe.brand.toLowerCase().replace(/\s+/g, '-')}`}
              className="px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm hover:bg-primary/20 transition"
            >
              See all {shoe.brand} →
            </Link>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-6">{shoe.brand} {shoe.model} FAQ</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`q-${i}`} className="border border-border/60 rounded-lg px-4 bg-card/40">
                <AccordionTrigger className="text-left font-medium hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 pb-20">
        <div className="max-w-3xl mx-auto text-center rounded-3xl p-10 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">Is the {shoe.model} right for you?</h2>
          <p className="text-muted-foreground mb-6 text-lg">Take the free RunMatch AI quiz — 9 questions, 90 seconds, a personalized 3-shoe rotation.</p>
          <Link to="/">
            <Button size="lg" className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
              Find my perfect match <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default ShoeDetail;
