import { useEffect, useMemo } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ArrowRight, ExternalLink, CheckCircle, Star, ChevronRight, Sparkles, Award } from 'lucide-react';
import { getCategory, getCategoryShoes, CATEGORIES } from '@/lib/categories';
import { getAmazonLinkForShoe } from '@/lib/amazon-link';
import ShoeImage from '@/components/results/ShoeImage';
import AffiliateDisclosure from '@/components/results/AffiliateDisclosure';
import TrustBar from '@/components/conversion/TrustBar';
import Testimonials from '@/components/conversion/Testimonials';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { track } from '@/lib/analytics';

const SITE = 'https://gearuptofit.com';
const CategoryLanding = () => {
  const { slug } = useParams<{ slug: string }>();
  const cat = slug ? getCategory(slug) : undefined;

  useEffect(() => {
    if (cat) trackEvent('category_view', { category: cat.slug });
    window.scrollTo(0, 0);
  }, [cat]);

  const shoes = useMemo(() => (cat ? getCategoryShoes(cat, 8) : []), [cat]);

  if (!cat) return <Navigate to="/" replace />;

  const canonical = `${SITE}/shoe-match/best-running-shoes/${cat.slug}/`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'RunMatch AI', item: `${SITE}/shoe-match/` },
        { '@type': 'ListItem', position: 2, name: 'Best Running Shoes', item: `${SITE}/shoe-match/best-running-shoes/` },
        { '@type': 'ListItem', position: 3, name: cat.h1, item: canonical },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: cat.faqs.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: cat.howTo.name,
      description: cat.howTo.description,
      step: cat.howTo.steps.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: s.name,
        text: s.text,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: cat.h1,
      itemListElement: shoes.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
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
        },
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{cat.title}</title>
        <meta name="description" content={cat.description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={cat.title} />
        <meta property="og:description" content={cat.description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="article" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="container mx-auto px-4 pt-6 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link to="/" className="hover:text-foreground transition">RunMatch AI</Link></li>
          <ChevronRight className="w-3.5 h-3.5" />
          <li><span className="text-muted-foreground/70">Best Running Shoes</span></li>
          <ChevronRight className="w-3.5 h-3.5" />
          <li className="text-foreground font-medium" aria-current="page">{cat.h1}</li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 pt-8 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Updated 2026 · Verified Specs
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight mb-5">
            {cat.h1}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6">{cat.intro}</p>
          <div className="flex flex-wrap gap-3">
            <Link to="/">
              <Button size="lg" className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                Take the free AI quiz <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <a href="#picks">
              <Button size="lg" variant="outline">See top picks ↓</Button>
            </a>
          </div>
        </motion.div>
        <div className="mt-8"><TrustBar variant="compact" /></div>
        <div className="mt-4"><AffiliateDisclosure /></div>
      </section>

      {/* Picks */}
      <section id="picks" className="container mx-auto px-4 pb-16">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-6">
          Our {shoes.length} Top Picks
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {shoes.map((s, i) => {
            const url = getAmazonLinkForShoe(s.id, s.brand, s.model, s.amazonASIN);
            return (
              <motion.article
                key={s.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.04 }}
                className="group rounded-2xl border border-border/60 bg-card/40 backdrop-blur p-5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <Badge variant="outline" className="text-xs">#{i + 1} {cat.h1.split(' ')[1]}</Badge>
                  <span className="text-sm font-semibold text-primary">${s.priceUSD}</span>
                </div>
                <ShoeImage brand={s.brand} model={s.model} imageURL={s.imageURL} amazonASIN={s.amazonASIN} size="md" interactive={false} />
                <h3 className="mt-4 text-lg font-bold leading-tight">{s.brand} {s.model}</h3>
                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">{s.category} · {s.weightGrams}g · {s.dropMM}mm drop</p>
                <ul className="mt-3 space-y-1.5">
                  {s.highlights.slice(0, 3).map(h => (
                    <li key={h} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={url}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  onClick={() => trackEvent('affiliate_click', { shoe_id: s.id, source: 'category', category: cat.slug })}
                  className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
                >
                  Check price on Amazon <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </motion.article>
            );
          })}
        </div>
      </section>

      {/* HowTo */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-2 flex items-center gap-2">
            <Award className="w-7 h-7 text-primary" />
            {cat.howTo.name}
          </h2>
          <p className="text-muted-foreground mb-6">{cat.howTo.description}</p>
          <ol className="space-y-4">
            {cat.howTo.steps.map((s, i) => (
              <li key={i} className="flex gap-4 p-5 rounded-xl bg-card/40 border border-border/60">
                <span className="flex-shrink-0 w-9 h-9 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center">{i + 1}</span>
                <div>
                  <h3 className="font-semibold mb-1">{s.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container mx-auto px-4 pb-16">
        <Testimonials />
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-6">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {cat.faqs.map((f, i) => (
              <AccordionItem key={i} value={`q-${i}`} className="border border-border/60 rounded-lg px-4 bg-card/40">
                <AccordionTrigger className="text-left font-medium hover:no-underline">{f.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">{f.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 pb-20">
        <div className="max-w-3xl mx-auto text-center rounded-3xl p-10 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20">
          <Star className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">Find your perfect rotation</h2>
          <p className="text-muted-foreground mb-6 text-lg">Take the free RunMatch AI quiz and get a personalized 3-shoe rotation in 90 seconds.</p>
          <Link to="/">
            <Button size="lg" className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
              Start the quiz <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Related categories */}
      <section className="container mx-auto px-4 pb-16">
        <h2 className="text-xl font-semibold mb-4">Explore more categories</h2>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.filter(c => c.slug !== cat.slug).map(c => (
            <Link key={c.slug} to={`/best-running-shoes/${c.slug}`} className="px-4 py-2 rounded-full bg-card/40 border border-border/60 hover:border-primary/40 text-sm transition">
              {c.h1.replace(' (2026)', '').replace('Best ', '')}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CategoryLanding;
