import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { decodeAnswers, QuizAnswers } from '@/lib/quiz-data';
import { generateRecommendation } from '@/lib/recommendation-engine';
import { generateFAQSchema, generateProductSchema, generateMetaTitle, generateMetaDescription } from '@/lib/seo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ExternalLink, BookOpen, Star, RotateCcw, Target, CheckCircle, Share2 } from 'lucide-react';

const GEARUP_LINKS = {
  choose: { url: 'https://gearuptofit.com/running/how-to-choose-the-right-running-shoes/', label: 'How to Choose the Right Running Shoes', icon: '📖' },
  reviews: { url: 'https://gearuptofit.com/review/running-shoes/', label: 'Running Shoes Reviews', icon: '👟' },
  distances: { url: 'https://gearuptofit.com/review/best-running-shoes-for-different-distances/', label: 'Best Running Shoes for Different Distances 2026', icon: '🏃' },
  about: { url: 'https://gearuptofit.com/about-us/', label: 'About GearUpToFit', icon: '🔗' },
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

    // Inject JSON-LD
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
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold uppercase">No Results Found</h1>
          <p className="text-muted-foreground">Take the quiz to get your personalized shoe match.</p>
          <Link to="/">
            <Button className="bg-primary hover:bg-primary/90">Take the Quiz</Button>
          </Link>
        </div>
      </div>
    );
  }

  const rec = recommendation;
  const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">New Match</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">RunMatch AI</span>
            <Button variant="ghost" size="icon" onClick={handleShare} title="Copy link">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Hero Result */}
        <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-4 text-xs uppercase tracking-wider">Your Personalized Match</Badge>
            <h1 className="text-3xl md:text-5xl font-bold uppercase tracking-tight mb-2">
              {rec.shoeProfile.category}
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">{rec.shoeProfile.summary}</p>
          </div>
        </motion.div>

        {/* Shoe Profile Card */}
        <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
          <Card className="border-primary/20 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl uppercase">
                <Star className="w-5 h-5 text-primary" />
                Best Shoe Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Category', value: rec.shoeProfile.category },
                  { label: 'Cushioning', value: rec.shoeProfile.cushioning },
                  { label: 'Drop', value: rec.shoeProfile.dropRange },
                  { label: 'Support', value: rec.shoeProfile.supportType },
                ].map(item => (
                  <div key={item.label} className="bg-secondary/50 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{item.label}</div>
                    <div className="font-semibold text-sm">{item.value}</div>
                  </div>
                ))}
              </div>
              <a
                href={GEARUP_LINKS.choose.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-4 text-sm text-primary hover:underline"
              >
                Learn how to choose the right running shoes <ExternalLink className="w-3 h-3" />
              </a>
            </CardContent>
          </Card>
        </motion.div>

        {/* Category Explanation */}
        <motion.div {...fadeUp} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl uppercase">
                <Target className="w-5 h-5 text-primary" />
                Why This Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{rec.categoryExplanation}</p>
              <a
                href={GEARUP_LINKS.reviews.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-4 text-sm text-primary hover:underline"
              >
                Browse full running shoe reviews <ExternalLink className="w-3 h-3" />
              </a>
            </CardContent>
          </Card>
        </motion.div>

        {/* Rotation */}
        <motion.div {...fadeUp} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl uppercase">
                <RotateCcw className="w-5 h-5 text-primary" />
                Rotation Recommendation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rec.rotation.map((shoe, i) => (
                  <div key={i} className="flex gap-4 p-4 bg-secondary/30 rounded-lg">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{shoe.purpose}</div>
                      <div className="text-xs text-primary mb-1">{shoe.shoeType}</div>
                      <div className="text-xs text-muted-foreground">{shoe.description}</div>
                    </div>
                  </div>
                ))}
              </div>
              <a
                href={GEARUP_LINKS.distances.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-4 text-sm text-primary hover:underline"
              >
                Best shoes for different distances in 2026 <ExternalLink className="w-3 h-3" />
              </a>
            </CardContent>
          </Card>
        </motion.div>

        {/* Training Emphasis */}
        <motion.div {...fadeUp} transition={{ delay: 0.5 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl uppercase">
                <CheckCircle className="w-5 h-5 text-primary" />
                Training Emphasis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {rec.trainingEmphasis.map((tip, i) => (
                  <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">{i + 1}</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        {/* Why It Works */}
        <motion.div {...fadeUp} transition={{ delay: 0.6 }}>
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl uppercase">Why This Match Works</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{rec.whyItWorks}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Read Before You Buy */}
        <motion.div {...fadeUp} transition={{ delay: 0.7 }}>
          <Card className="bg-secondary/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl uppercase">
                <BookOpen className="w-5 h-5 text-primary" />
                Read Before You Buy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.values(GEARUP_LINKS).filter(l => l.icon !== '🔗').map(link => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg bg-card hover:bg-card/80 transition-colors group"
                  >
                    <span className="text-xl">{link.icon}</span>
                    <span className="font-medium text-sm group-hover:text-primary transition-colors">{link.label}</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-auto text-muted-foreground group-hover:text-primary" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* FAQ */}
        <motion.div {...fadeUp} transition={{ delay: 0.8 }}>
          <div>
            <h2 className="text-2xl font-bold uppercase tracking-tight mb-4">Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="space-y-2">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-lg px-4 bg-card">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div {...fadeUp} transition={{ delay: 0.9 }}>
          <div className="text-center pt-8 border-t border-border space-y-4">
            <Link to="/">
              <Button className="bg-primary hover:bg-primary/90 font-semibold uppercase tracking-wider">
                Take the Quiz Again
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground">
              Built by{' '}
              <a href={GEARUP_LINKS.about.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
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
