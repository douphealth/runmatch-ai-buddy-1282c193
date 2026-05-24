import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Footprints, Mountain, Activity, Wallet, ShieldAlert, Heart, Ruler, Gauge, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics';

const CANONICAL = 'https://runmatch-ai-buddy.lovable.app/shoe-finder/';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Is the Running Shoe Finder free?',
    a: 'Yes. The Running Shoe Finder is free to use. No signup or email is required to see your recommendations. Some shoe links are Amazon affiliate links and GearUpToFit may earn a commission at no extra cost to you.',
  },
  {
    q: 'How long does the shoe finder quiz take?',
    a: 'About two minutes. You answer nine short questions about foot shape, pronation, weekly mileage, distance, terrain, pace goals, injury history, brand preferences, and budget.',
  },
  {
    q: 'How does the tool decide which shoes to recommend?',
    a: 'A deterministic scoring engine compares your answers against a manufacturer-verified shoe database. It weighs cushioning, drop, stack height, support type, weight, terrain and intended use. The same answers always produce the same recommendation.',
  },
  {
    q: 'Can the Running Shoe Finder replace a gait analysis?',
    a: 'No. It is an educational matching tool. It does not film your stride, measure your foot pressure, or diagnose biomechanical issues. For a clinical assessment, see a sports physiotherapist, podiatrist, or running-specialty store.',
  },
  {
    q: 'Is this tool good for beginners?',
    a: 'Yes. Beginners often benefit most because it explains categories like neutral daily trainer, stability shoe, max-cushion shoe, and trail shoe in plain language, and it filters by budget and comfort needs.',
  },
  {
    q: 'How often should I replace my running shoes?',
    a: 'Most running shoes last 500–800 km (300–500 miles). Replace sooner if the midsole feels flat, the outsole shows heavy wear, or you start noticing new aches after runs.',
  },
];

const ShoeFinder = () => {
  useEffect(() => {
    document.title = 'Running Shoe Finder — Find the Best Shoes for Your Feet and Training';

    const ensureMeta = (selector: string, create: () => HTMLElement) => {
      let el = document.head.querySelector(selector) as HTMLElement | null;
      if (!el) { el = create(); document.head.appendChild(el); }
      return el;
    };

    const desc = ensureMeta('meta[name="description"]', () => {
      const m = document.createElement('meta'); m.setAttribute('name', 'description'); return m;
    });
    desc.setAttribute('content', 'Free Running Shoe Finder. Answer 9 quick questions about foot shape, mileage, terrain, cushioning, support, injuries and budget to get matched with the right running shoes.');

    const canonical = ensureMeta('link[rel="canonical"]', () => {
      const l = document.createElement('link'); l.setAttribute('rel', 'canonical'); return l;
    });
    canonical.setAttribute('href', CANONICAL);

    const ogTags: Record<string, string> = {
      'og:title': 'Running Shoe Finder — Find the Best Shoes for Your Feet and Training',
      'og:description': 'Educational running shoe matching tool. Get a personalized shoe profile in under 2 minutes.',
      'og:url': CANONICAL,
      'og:type': 'website',
    };
    Object.entries(ogTags).forEach(([prop, val]) => {
      const m = ensureMeta(`meta[property="${prop}"]`, () => {
        const el = document.createElement('meta'); el.setAttribute('property', prop); return el;
      });
      m.setAttribute('content', val);
    });

    const faqLd = document.createElement('script');
    faqLd.type = 'application/ld+json';
    faqLd.setAttribute('data-page', 'shoe-finder-faq');
    faqLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });

    const breadcrumbLd = document.createElement('script');
    breadcrumbLd.type = 'application/ld+json';
    breadcrumbLd.setAttribute('data-page', 'shoe-finder-breadcrumb');
    breadcrumbLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://runmatch-ai-buddy.lovable.app/' },
        { '@type': 'ListItem', position: 2, name: 'Running Shoe Finder', item: CANONICAL },
      ],
    });

    document.head.appendChild(faqLd);
    document.head.appendChild(breadcrumbLd);

    return () => {
      faqLd.remove();
      breadcrumbLd.remove();
    };
  }, []);

  const onStartClick = (location: string) => track.ctaClick('shoe_finder_start', location);

  return (
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* 1. Hero */}
      <section className="relative px-4 md:px-8 pt-16 md:pt-24 pb-12 md:pb-16">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[420px] h-[420px] bg-primary/10 rounded-full blur-[140px]" />
          <div className="absolute bottom-0 left-0 w-[340px] h-[340px] bg-primary/5 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs uppercase tracking-wider text-primary font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5" /> Free educational tool
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight text-foreground">
            Running Shoe Finder — Find the Best Shoes for Your Feet and Training
          </h1>
          <p className="mt-5 md:mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Answer a few questions about your foot shape, mileage, terrain, cushioning preference,
            support needs, injury history, and budget to get better running shoe recommendations.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/" onClick={() => onStartClick('hero')}>
              <Button size="lg" className="bg-gradient-primary glow-primary text-base font-semibold px-8 h-12">
                Start the Shoe Finder <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <span className="text-xs text-muted-foreground">No signup. ~2 minutes. 9 questions.</span>
          </div>
        </div>
      </section>

      {/* 2. How it works */}
      <section className="px-4 md:px-8 py-12 md:py-16 border-t border-border/40">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">How the Running Shoe Finder works</h2>
          <p className="text-muted-foreground leading-relaxed mb-8 max-w-3xl">
            The Running Shoe Finder is an educational matching tool. It organizes your training profile and
            foot information into a structured recommendation. It does not film your stride or diagnose
            injuries — it helps you shortlist categories and models that are realistic for your training.
          </p>
          <ol className="grid md:grid-cols-3 gap-4">
            {[
              { n: '1', t: 'Answer 9 short questions', d: 'Foot shape, pronation, mileage, distance, terrain, pace, injuries, brand and budget.' },
              { n: '2', t: 'We score the shoe database', d: 'A deterministic engine compares your profile against manufacturer-verified shoe data.' },
              { n: '3', t: 'You get a matched shortlist', d: 'A primary match plus a 2–3 shoe rotation suggestion you can take to any retailer.' },
            ].map(s => (
              <li key={s.n} className="rounded-2xl border border-border/60 bg-card/40 p-5">
                <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold mb-3">{s.n}</div>
                <h3 className="font-semibold text-foreground mb-1.5">{s.t}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 3. What the tool considers */}
      <section className="px-4 md:px-8 py-12 md:py-16 border-t border-border/40 bg-card/20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-6">What the tool considers</h2>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-left text-sm border-collapse min-w-[520px]">
              <thead>
                <tr className="border-b border-border/60 text-foreground">
                  <th className="py-3 pr-4 font-semibold">Input</th>
                  <th className="py-3 font-semibold">What it helps estimate</th>
                </tr>
              </thead>
              <tbody className="[&_tr]:border-b [&_tr]:border-border/30">
                <tr><td className="py-3 pr-4 font-medium text-foreground">Foot shape & width</td><td className="py-3 text-muted-foreground">Whether to prioritize wide-fit lasts or standard-fit trainers.</td></tr>
                <tr><td className="py-3 pr-4 font-medium text-foreground">Pronation pattern</td><td className="py-3 text-muted-foreground">Whether a neutral or stability shoe category is more appropriate.</td></tr>
                <tr><td className="py-3 pr-4 font-medium text-foreground">Weekly mileage</td><td className="py-3 text-muted-foreground">Cushioning depth, durability, and whether a rotation makes sense.</td></tr>
                <tr><td className="py-3 pr-4 font-medium text-foreground">Typical distance</td><td className="py-3 text-muted-foreground">5K speed shoe, daily trainer, long-run or marathon racer.</td></tr>
                <tr><td className="py-3 pr-4 font-medium text-foreground">Terrain</td><td className="py-3 text-muted-foreground">Road, treadmill, gravel, trail, or mixed-surface outsole needs.</td></tr>
                <tr><td className="py-3 pr-4 font-medium text-foreground">Pace goals</td><td className="py-3 text-muted-foreground">Whether a plated, responsive, or cushioned ride fits your training.</td></tr>
                <tr><td className="py-3 pr-4 font-medium text-foreground">Injury history</td><td className="py-3 text-muted-foreground">Triggers educational caveats and a clinician referral when relevant.</td></tr>
                <tr><td className="py-3 pr-4 font-medium text-foreground">Brand preferences</td><td className="py-3 text-muted-foreground">Filters or boosts brands you already trust or want to avoid.</td></tr>
                <tr><td className="py-3 pr-4 font-medium text-foreground">Budget</td><td className="py-3 text-muted-foreground">Value picks, previous-generation models, or premium trainers.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 4. Shoe recommendation factors */}
      <section className="px-4 md:px-8 py-12 md:py-16 border-t border-border/40">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-6">Shoe recommendation factors</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Footprints, t: 'Support type', d: 'Neutral vs stability based on pronation, arch, and comfort signals.' },
              { icon: Activity, t: 'Cushioning level', d: 'Soft, balanced, responsive, or max-cushion based on mileage and joint comfort.' },
              { icon: Ruler, t: 'Heel-to-toe drop & stack', d: 'Lower drops for forefoot strikers, higher drops for heel strikers and longer runs.' },
              { icon: Gauge, t: 'Shoe weight', d: 'Lighter shoes for speed work, slightly heavier trainers for durability.' },
              { icon: Mountain, t: 'Terrain & outsole', d: 'Road rubber for pavement, lugged outsoles for trail and mixed surfaces.' },
              { icon: Wallet, t: 'Budget tier', d: 'Entry, mid-tier, or premium — including previous-generation value picks.' },
            ].map(f => (
              <div key={f.t} className="rounded-2xl border border-border/60 bg-card/40 p-5 flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{f.t}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Who this tool is best for */}
      <section className="px-4 md:px-8 py-12 md:py-16 border-t border-border/40 bg-card/20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-6">Who this tool is best for</h2>
          <ul className="grid md:grid-cols-2 gap-3">
            {[
              'Beginners choosing their first pair of real running shoes',
              'Runners returning after a break who want to avoid old mistakes',
              'Runners building a 2–3 shoe rotation for daily, speed, and long runs',
              'Wide-foot runners who need width-aware suggestions',
              'Heavier runners who need more cushioning and durability',
              'Trail-curious road runners exploring mixed-terrain options',
              'Walkers and recreational runners looking for comfortable daily shoes',
              'Anyone who wants a structured shortlist before visiting a retailer',
            ].map(item => (
              <li key={item} className="flex items-start gap-3 rounded-xl border border-border/40 bg-background/40 p-4">
                <Heart className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 6. Related guides */}
      <section className="px-4 md:px-8 py-12 md:py-16 border-t border-border/40">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-3">Related running shoe guides</h2>
          <p className="text-muted-foreground mb-6 max-w-3xl">
            In-depth, manually researched guides from GearUpToFit. Use these to validate the shortlist the tool gives you.
          </p>
          <ul className="grid sm:grid-cols-2 gap-3">
            {[
              { label: 'Best Running Shoes', href: 'https://gearuptofit.com/review/best-running-shoes/' },
              { label: 'Best Daily Running Shoes', href: 'https://gearuptofit.com/review/best-daily-running-shoes/' },
              { label: 'Best Running Shoes for Beginners', href: 'https://gearuptofit.com/review/best-running-shoes-for-beginners/' },
              { label: 'Best Running Shoes for Wide Feet', href: 'https://gearuptofit.com/review/best-running-shoes-for-wide-feet/' },
              { label: 'Best Walking Shoes', href: 'https://gearuptofit.com/review/best-walking-shoes/' },
              { label: 'How to Choose Running Shoes', href: 'https://gearuptofit.com/running/how-to-choose-the-right-running-shoes/' },
            ].map(link => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener"
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 hover:border-primary/40 hover:bg-card/60 transition-all p-4"
                >
                  <span className="font-medium text-foreground group-hover:text-primary transition">{link.label}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition flex-shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 7. Disclaimer */}
      <section className="px-4 md:px-8 py-10 md:py-12 border-t border-border/40">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border-2 border-warning/30 bg-warning/5 p-5 md:p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-foreground mb-2">Disclaimer</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This tool provides educational shoe guidance, not medical advice. If you have pain, injury,
                diabetes-related foot issues, or complex biomechanical needs, consult a qualified clinician or specialist.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FAQ */}
      <section className="px-4 md:px-8 py-12 md:py-16 border-t border-border/40 bg-card/20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-6">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQS.map(f => (
              <details key={f.q} className="group rounded-xl border border-border/60 bg-background/40 p-4 md:p-5 open:border-primary/40 transition">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-foreground text-sm md:text-base">{f.q}</h3>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform flex-shrink-0" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Final CTA */}
      <section className="px-4 md:px-8 py-14 md:py-20 border-t border-border/40">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-4xl font-display font-bold mb-4">
            Ready to find your next running shoes?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Take the free 2-minute Running Shoe Finder and get a personalized shortlist plus a smart rotation plan.
          </p>
          <Link to="/" onClick={() => onStartClick('final_cta')}>
            <Button size="lg" className="bg-gradient-primary glow-primary text-base font-semibold px-10 h-12">
              Start the Shoe Finder <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
          <p className="mt-4 text-xs text-muted-foreground">Free · No signup · ~2 minutes</p>
        </div>
      </section>
    </main>
  );
};

export default ShoeFinder;
