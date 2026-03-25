import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { decodeAnswers, QuizAnswers } from '@/lib/quiz-data';
import { generateRecommendation } from '@/lib/recommendation-engine';
import { generateFAQSchema, generateProductSchema, generateMetaTitle, generateMetaDescription } from '@/lib/seo';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ExternalLink, BookOpen, Star, RotateCcw, Target, CheckCircle, Share2, Zap, ArrowRight, Shield } from 'lucide-react';
import resultHero from '@/assets/result-hero.jpg';

const GEARUP_LINKS = {
  choose: { url: 'https://gearuptofit.com/running/how-to-choose-the-right-running-shoes/', label: 'How to Choose the Right Running Shoes', icon: '📖', desc: 'Expert guide to finding your perfect fit' },
  reviews: { url: 'https://gearuptofit.com/review/running-shoes/', label: 'Running Shoes Reviews', icon: '👟', desc: 'In-depth reviews of top models' },
  distances: { url: 'https://gearuptofit.com/review/best-running-shoes-for-different-distances/', label: 'Best Shoes for Different Distances 2026', icon: '🏃', desc: 'Distance-specific recommendations' },
  about: { url: 'https://gearuptofit.com/about-us/', label: 'About GearUpToFit', icon: '🔗', desc: 'Our mission and expertise' },
};

const faqs = [
  {
    question: 'How does RunMatch AI determine my shoe recommendation?',
    answer: 'RunMatch AI analyzes your foot type, pronation pattern, weekly mileage, preferred distance, terrain, pace goals, injury history, brand preference, and budget to generate a personalized shoe profile. Our algorithm cross-references biomechanical research with real-world runner data. For a deeper understanding, read our guide on how to choose the right running shoes at GearUpToFit.',
  },
  {
    question: 'What is a shoe rotation and why do I need one?',
    answer: 'A shoe rotation means alternating between 2-3 different pairs of running shoes. Research shows this reduces injury risk by up to 39% because each shoe loads your muscles and joints differently. Your rotation should typically include a daily trainer, a speed shoe, and possibly a long-run shoe. Check out our running shoes reviews for specific model recommendations.',
  },
  {
    question: 'How often should I replace my running shoes?',
    answer: 'Most running shoes last 500-800 km depending on your weight, stride, and the shoe construction. Signs of worn shoes include visible midsole compression, uneven outsole wear, or new aches and pains. Review our guide on best running shoes for different distances to find durable options for your mileage level.',
  },
  {
    question: 'What if I am unsure about my pronation type?',
    answer: 'If you selected "unsure" for pronation, our algorithm defaults to neutral recommendations with moderate support — a safe starting point for most runners. For a definitive assessment, visit a specialty running store for a gait analysis. Learn more about pronation and shoe selection in our comprehensive guide at GearUpToFit.',
  },
  {
    question: 'Can I share my RunMatch results?',
    answer: 'Yes! Every RunMatch result has a unique shareable URL. Simply copy the page URL from your browser and send it to running partners, coaches, or friends. You can also bookmark it for future reference when you are ready to purchase.',
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
};

const RunMatchResult = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();

  const answers: QuizAnswers | null = useMemo(() => {
    const encoded = searchParams.get('d');
    if (encoded) return decodeAnswers(encoded);
    return null;
  }, [searchParams]);

  const recommendation = useMemo(() => {
    if (!answers) return null;
    return generateRecommendation(answers);
  }, [answers]);

  useEffect(() => {
    if (!recommendation || !answers) return;
    document.title = generateMetaTitle(answers);
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', generateMetaDescription(recommendation));

    const faqSchema = document.createElement('script');
    faqSchema.type = 'application/ld+json';
    faqSchema.textContent = JSON.stringify(generateFAQSchema(faqs));
    document.head.appendChild(faqSchema);

    const productSchema = document.createElement('script');
    productSchema.type = 'application/ld+json';
    productSchema.textContent = JSON.stringify(generateProductSchema(recommendation, answers));
    document.head.appendChild(productSchema);

    return () => {
      faqSchema.remove();
      productSchema.remove();
    };
  }, [recommendation, answers]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {}
  };

  if (!answers || !recommendation) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Zap className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold uppercase">No Results Found</h1>
          <p className="text-muted-foreground">Take the quiz to get your personalized shoe match.</p>
          <Link to="/">
            <Button className="bg-gradient-primary glow-primary font-bold uppercase tracking-wider px-8 h-12">
              Take the Quiz
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const rec = recommendation;

  return (
    <div className="min-h-screen pb-16 bg-gradient-dark">
      {/* Header */}
      <header className="sticky top-0 z-20 glass-strong px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">New Match</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">RunMatch AI</span>
            <Button variant="ghost" size="icon" onClick={handleShare} title="Copy link" className="hover:bg-primary/10">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative">
        <div className="absolute inset-0 h-[400px] md:h-[500px]">
          <img
            src={resultHero}
            alt="Runner in action"
            className="w-full h-full object-cover"
            width={1920}
            height={800}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
        </div>

        <div className="relative z-10 pt-12 md:pt-20 pb-8 px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-4xl mx-auto text-center"
          >
            <Badge className="mb-4 bg-primary/20 text-primary border-primary/30 text-xs uppercase tracking-[0.15em] px-4 py-1.5">
              ✨ Your Personalized Match
            </Badge>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold uppercase tracking-tight mb-4 leading-[0.9]">
              {rec.shoeProfile.category}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {rec.shoeProfile.summary}
            </p>
          </motion.div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6 md:space-y-8">
        {/* Stats Row */}
        <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Category', value: rec.shoeProfile.category, icon: '👟' },
              { label: 'Cushioning', value: rec.shoeProfile.cushioning, icon: '☁️' },
              { label: 'Drop', value: rec.shoeProfile.dropRange, icon: '📐' },
              { label: 'Support', value: rec.shoeProfile.supportType, icon: '🛡️' },
            ].map(item => (
              <div key={item.label} className="glass rounded-2xl p-4 md:p-5 text-center group hover:border-primary/30 transition-all">
                <span className="text-2xl mb-2 block">{item.icon}</span>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{item.label}</div>
                <div className="font-bold text-sm md:text-base">{item.value}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Inline CTA Link */}
        <motion.a
          {...fadeUp}
          transition={{ delay: 0.25 }}
          href={GEARUP_LINKS.choose.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 glass rounded-2xl hover:border-primary/30 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm group-hover:text-primary transition-colors">Learn how to choose the right shoe</div>
            <div className="text-xs text-muted-foreground">Expert guide on GearUpToFit →</div>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
        </motion.a>

        {/* Why This Category */}
        <motion.div {...fadeUp} transition={{ delay: 0.3 }}>
          <div className="glass rounded-2xl p-5 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight">Why This Category</h2>
            </div>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{rec.categoryExplanation}</p>
            <a
              href={GEARUP_LINKS.reviews.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-5 text-sm text-primary hover:underline font-medium"
            >
              Browse full running shoe reviews <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>

        {/* Rotation */}
        <motion.div {...fadeUp} transition={{ delay: 0.4 }}>
          <div className="glass rounded-2xl p-5 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight">Shoe Rotation</h2>
                <p className="text-xs text-muted-foreground">Your recommended multi-shoe strategy</p>
              </div>
            </div>
            <div className="space-y-3">
              {rec.rotation.map((shoe, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-4 p-4 rounded-xl bg-card/50 border border-border/50 hover:border-primary/20 transition-all"
                >
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{shoe.purpose}</div>
                    <div className="text-xs text-primary font-medium mb-1">{shoe.shoeType}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">{shoe.description}</div>
                  </div>
                </motion.div>
              ))}
            </div>
            <a
              href={GEARUP_LINKS.distances.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-5 text-sm text-primary hover:underline font-medium"
            >
              Best shoes for different distances 2026 <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>

        {/* Training Emphasis */}
        <motion.div {...fadeUp} transition={{ delay: 0.5 }}>
          <div className="glass rounded-2xl p-5 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight">Training Emphasis</h2>
            </div>
            <ul className="space-y-4">
              {rec.trainingEmphasis.map((tip, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex gap-4 text-sm"
                >
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground leading-relaxed pt-1">{tip}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>

        {/* Why It Works */}
        <motion.div {...fadeUp} transition={{ delay: 0.55 }}>
          <div className="glass rounded-2xl p-5 md:p-8 border-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Star className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight">Why This Match Works</h2>
            </div>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{rec.whyItWorks}</p>
          </div>
        </motion.div>

        {/* Read Before You Buy */}
        <motion.div {...fadeUp} transition={{ delay: 0.6 }}>
          <div className="glass rounded-2xl p-5 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight">Read Before You Buy</h2>
                <p className="text-xs text-muted-foreground">Expert resources from GearUpToFit</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.values(GEARUP_LINKS).map(link => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-4 rounded-xl bg-card/50 border border-border/50 hover:border-primary/20 transition-all group"
                >
                  <span className="text-2xl">{link.icon}</span>
                  <div className="min-w-0">
                    <span className="font-semibold text-sm group-hover:text-primary transition-colors block">{link.label}</span>
                    <span className="text-xs text-muted-foreground">{link.desc}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-1 group-hover:translate-x-0.5 transition-all" />
                </a>
              ))}
            </div>
          </div>
        </motion.div>

        {/* FAQ */}
        <motion.div {...fadeUp} transition={{ delay: 0.65 }}>
          <div className="glass rounded-2xl p-5 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight">FAQ</h2>
            </div>
            <Accordion type="single" collapsible className="space-y-2">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border border-border/50 rounded-xl px-4 bg-card/30">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </motion.div>

        {/* Footer CTA */}
        <motion.div {...fadeUp} transition={{ delay: 0.7 }}>
          <div className="text-center pt-8 space-y-6">
            <Link to="/">
              <Button className="bg-gradient-primary glow-primary font-bold uppercase tracking-[0.15em] px-10 h-14 text-base rounded-2xl group">
                Take the Quiz Again
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground">
              Built by{' '}
              <a href={GEARUP_LINKS.about.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                GearUpToFit
              </a>{' '}
              — Gear Up. Show Up. Level Up.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default RunMatchResult;
