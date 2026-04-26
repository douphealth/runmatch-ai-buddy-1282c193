import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { decodeAnswers, QuizAnswers } from '@/lib/quiz-data';
import { generateRecommendation } from '@/lib/recommendation-engine';
import { scoreShoes, buildRotation } from '@/lib/scoring-engine';
import { getRecommendedArticles, getInjuryArticles, getToolLinks, getKitLinks } from '@/lib/article-links';
import { getDynamicFAQs } from '@/lib/dynamic-faqs';
import { generateFAQSchema, generateProductSchema, generateMetaTitle, generateMetaDescription, applyOpenGraphImage } from '@/lib/seo';
import { generateResultsPDF } from '@/lib/pdf-generator';
import ResultsLoadingScreen from '@/components/results/ResultsLoadingScreen';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import ShoeComparisonTable from '@/components/results/ShoeComparisonTable';
import AnimatedCounter from '@/components/results/AnimatedCounter';
import MatchScoreBadge from '@/components/results/MatchScoreBadge';
import ShoeImage from '@/components/results/ShoeImage';
import {
  ArrowLeft, ExternalLink, BookOpen, Star, RotateCcw, Target, Share2, Zap,
  ArrowRight, Shield, ShoppingCart, Award, TrendingUp, Heart, Wrench,
  MessageCircle, CheckCircle, Copy, Twitter, Facebook, Download, BarChart3,
  Gauge, Activity, Timer
} from 'lucide-react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts';
import { toast } from 'sonner';

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
};

import { getAmazonLinkForShoe } from '@/lib/amazon-link';

// Resolves a verified direct /dp/ASIN Amazon link via SerpAPI cache,
// keyed by the canonical shoe id. Falls back to brand-filtered search
// only when no verified ASIN is available.
const getAmazonProductLink = (id: string, brand: string, model: string, asin?: string) =>
  getAmazonLinkForShoe(id, brand, model, asin);

const RunMatchResult = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const answers: QuizAnswers | null = useMemo(() => {
    const encoded = searchParams.get('d');
    if (encoded) return decodeAnswers(encoded);
    return null;
  }, [searchParams]);

  const recommendation = useMemo(() => {
    if (!answers) return null;
    return generateRecommendation(answers);
  }, [answers]);

  const rotation = useMemo(() => {
    if (!answers) return null;
    return buildRotation(answers);
  }, [answers]);

  const topShoes = useMemo(() => {
    if (!answers) return [];
    return scoreShoes(answers).slice(0, 5);
  }, [answers]);

  const recommendedArticles = useMemo(() => answers ? getRecommendedArticles(answers) : [], [answers]);
  const injuryArticles = useMemo(() => answers ? getInjuryArticles(answers.injuries) : [], [answers]);
  const toolLinks = useMemo(() => answers ? getToolLinks(answers) : [], [answers]);
  const kitLinks = useMemo(() => getKitLinks(), []);
  const faqs = useMemo(() => answers ? getDynamicFAQs(answers) : [], [answers]);

  const radarData = useMemo(() => {
    if (!answers) return [];
    const cushionNeed = answers.weeklyMileage > 60 || ['marathon', 'ultra'].includes(answers.distance) ? 9 : answers.weeklyMileage > 30 ? 7 : 5;
    const speedFocus = ['race', 'tempo'].includes(answers.paceGoal) ? 9 : answers.paceGoal === 'moderate' ? 6 : 3;
    const distanceLevel = { '5k': 3, '10k': 5, 'half-marathon': 7, 'marathon': 9, 'ultra': 10, 'mixed': 6 }[answers.distance] || 5;
    const stabilityNeed = answers.pronation === 'overpronation' || answers.footType === 'flat' ? 9 : answers.pronation === 'underpronation' ? 4 : 3;
    const trailReady = answers.terrain === 'trail' ? 9 : answers.terrain === 'mixed' ? 6 : 2;
    const recoveryNeed = answers.injuries.length > 0 && !answers.injuries.includes('none') ? 8 : answers.weeklyMileage > 50 ? 6 : 3;
    return [
      { axis: 'Cushioning', value: cushionNeed },
      { axis: 'Speed', value: speedFocus },
      { axis: 'Distance', value: distanceLevel },
      { axis: 'Stability', value: stabilityNeed },
      { axis: 'Trail', value: trailReady },
      { axis: 'Recovery', value: recoveryNeed },
    ];
  }, [answers]);

  useEffect(() => {
    if (!recommendation || !answers) return;
    const title = generateMetaTitle(answers);
    const description = generateMetaDescription(recommendation);
    document.title = title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', description);

    const recommendedShoe = rotation?.primary?.shoe;
    const cleanupOG = recommendedShoe ? applyOpenGraphImage(recommendedShoe, title, description) : () => {};

    const faqSchema = document.createElement('script');
    faqSchema.type = 'application/ld+json';
    faqSchema.textContent = JSON.stringify(generateFAQSchema(faqs));
    document.head.appendChild(faqSchema);

    const productSchema = document.createElement('script');
    productSchema.type = 'application/ld+json';
    productSchema.textContent = JSON.stringify(generateProductSchema(recommendation, answers, recommendedShoe));
    document.head.appendChild(productSchema);

    const breadcrumbSchema = document.createElement('script');
    breadcrumbSchema.type = 'application/ld+json';
    breadcrumbSchema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'GearUpToFit', item: 'https://gearuptofit.com' },
        { '@type': 'ListItem', position: 2, name: 'RunMatch AI', item: 'https://runmatch-ai-buddy.lovable.app/' },
        { '@type': 'ListItem', position: 3, name: 'Your Result' },
      ],
    });
    document.head.appendChild(breadcrumbSchema);

    return () => { faqSchema.remove(); productSchema.remove(); breadcrumbSchema.remove(); cleanupOG(); };
  }, [recommendation, answers, faqs, rotation]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleDownloadPDF = async () => {
    if (!answers || !recommendation || !rotation) return;
    toast.info('Generating your report...');
    await generateResultsPDF({ answers, recommendation, rotation, radarData });
    toast.success('Your RunMatch Report has been downloaded!');
  };

  const shareOnTwitter = () => {
    const text = `I just found my perfect running shoe match! 🏃‍♂️ Take the free RunMatch AI quiz by @GearUpToFit:`;
    const quizUrl = 'https://runmatch-ai-buddy.lovable.app/';
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(quizUrl)}`, '_blank');
  };

  const shareOnFacebook = () => {
    const quizUrl = 'https://runmatch-ai-buddy.lovable.app/';
    window.open(`https://www.facebook.com/dialog/share?app_id=966242223397117&href=${encodeURIComponent(quizUrl)}&quote=${encodeURIComponent('I just found my perfect running shoe match! 🏃‍♂️ Take the free RunMatch AI quiz by GearUpToFit!')}`, '_blank');
  };

  const handleLoadingComplete = useCallback(() => setIsLoading(false), []);

  if (!answers || !recommendation) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-dark">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Zap className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold uppercase">No Results Found</h1>
          <p className="text-muted-foreground">Take the quiz to get your personalized shoe match.</p>
          <Link to="/">
            <Button className="bg-gradient-primary glow-primary font-bold uppercase tracking-wider px-8 h-12">Take the Quiz</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <ResultsLoadingScreen onComplete={handleLoadingComplete} />;
  }

  const rec = recommendation;
  const primary = rotation?.primary;
  const shoesAnalyzed = topShoes.length > 0 ? 40 : 0;
  const dataPoints = 9;

  return (
    <div className="min-h-screen pb-16 bg-gradient-dark">
      {/* Header */}
      <header className="sticky top-0 z-20 glass-strong px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">New Match</span>
          </Link>
          <div className="flex items-center gap-2">
            <img
              src="https://gearuptofit.com/wp-content/uploads/2023/03/cropped-Grey-Black-Illustration-Gym-Fitness-Logo.png"
              alt="GearUpToFit"
              className="w-6 h-6 rounded object-contain"
            />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">RunMatch AI</span>
            <Button variant="ghost" size="icon" onClick={handleShare} title="Copy link" className="hover:bg-primary/10">
              {copied ? <CheckCircle className="w-4 h-4 text-primary" /> : <Share2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* SECTION 1: Runner Profile Hero */}
      <div className="relative pt-8 md:pt-16 pb-8 px-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[200px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/3 rounded-full blur-[150px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-5xl mx-auto relative z-10"
        >
          <div className="text-center mb-8">
            <Badge className="mb-4 bg-primary/20 text-primary border-primary/30 text-xs uppercase tracking-[0.15em] px-4 py-1.5">
              AI-Powered Analysis Complete
            </Badge>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold uppercase tracking-tight mb-4 leading-[0.9]">
              {rec.shoeProfile.category}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {rec.shoeProfile.summary}
            </p>
          </div>

          {/* Runner Profile: Radar + Stats */}
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            <motion.div {...fadeUp} className="glass rounded-2xl p-5 md:p-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Your Runner Profile</h3>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="hsl(220 15% 25%)" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: 'hsl(220 10% 55%)', fontSize: 11 }} />
                  <Radar name="Profile" dataKey="value" stroke="hsl(1 76% 56%)" fill="hsl(1 76% 56%)" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div {...fadeUp} className="grid grid-cols-2 gap-3">
              {[
                { label: 'Category', value: rec.shoeProfile.category, icon: '👟' },
                { label: 'Cushioning', value: rec.shoeProfile.cushioning, icon: '☁️' },
                { label: 'Drop', value: rec.shoeProfile.dropRange, icon: '📐' },
                { label: 'Support', value: rec.shoeProfile.supportType, icon: '🛡️' },
                { label: 'Mileage', value: `${answers.weeklyMileage} km/wk`, icon: '📊' },
                { label: 'Terrain', value: answers.terrain.charAt(0).toUpperCase() + answers.terrain.slice(1), icon: '🌍' },
              ].map(item => (
                <div key={item.label} className="glass rounded-2xl p-4 text-center group hover:border-primary/30 transition-all">
                  <span className="text-xl mb-1.5 block">{item.icon}</span>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">{item.label}</div>
                  <div className="font-bold text-xs md:text-sm">{item.value}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6 md:space-y-8">

        {/* SECTION 2: #1 Shoe Recommendation (Hero Card) */}
        {primary && (
          <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
            <div className="glass rounded-2xl p-5 md:p-8 border-primary/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[60px]" />
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center glow-primary-sm">
                  <Award className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight">#1 Match</h2>
                  <p className="text-xs text-muted-foreground">Your best shoe match out of {shoesAnalyzed} analyzed</p>
                </div>
                <MatchScoreBadge percent={primary.matchPercent} size="lg" />
              </div>

              <div className="md:flex md:gap-6 md:items-start">
                <div className="md:w-2/5 mb-5 md:mb-0">
                  <ShoeImage
                    brand={primary.shoe.brand}
                    model={primary.shoe.model}
                    imageURL={primary.shoe.imageURL}
                    amazonASIN={primary.shoe.amazonASIN}
                    size="lg"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl md:text-4xl font-bold mb-1">{primary.shoe.brand} {primary.shoe.model}</h3>
                  <p className="text-primary font-semibold text-lg mb-3">${primary.shoe.priceUSD}</p>

                  {/* Shoe spec pills */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="secondary" className="text-xs gap-1"><Gauge className="w-3 h-3" /> {primary.shoe.cushioning}/10 Cushion</Badge>
                    <Badge variant="secondary" className="text-xs gap-1"><Activity className="w-3 h-3" /> {primary.shoe.dropMM}mm Drop</Badge>
                    <Badge variant="secondary" className="text-xs gap-1"><Timer className="w-3 h-3" /> {primary.shoe.weightGrams}g</Badge>
                    {primary.shoe.widthOptions && <Badge variant="secondary" className="text-xs">Wide Fit Available</Badge>}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {primary.shoe.highlights.map(h => (
                      <Badge key={h} className="bg-primary/10 text-primary border-primary/20 text-xs">{h}</Badge>
                    ))}
                  </div>

                  <ul className="space-y-2 mb-5">
                    {primary.reasons.slice(0, 4).map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        {r}
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href={getAmazonProductLink(primary.shoe.id, primary.shoe.brand, primary.shoe.model, primary.shoe.amazonASIN)}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center justify-center gap-2 bg-gradient-primary glow-primary text-primary-foreground font-bold uppercase tracking-wider px-6 h-12 rounded-xl hover:opacity-90 transition-all text-sm"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Buy on Amazon — ${primary.shoe.priceUSD}
                    </a>
                    <a
                      href={primary.shoe.reviewURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 border border-primary/30 text-primary font-semibold px-6 h-12 rounded-xl hover:bg-primary/10 transition-all text-sm"
                    >
                      <BookOpen className="w-4 h-4" />
                      Read Full Review
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* SECTION 3: Shoe Rotation */}
        {rotation && (
          <motion.div {...fadeUp} transition={{ delay: 0.3 }}>
            <div className="glass rounded-2xl p-5 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight">Your Shoe Rotation</h2>
                  <p className="text-xs text-muted-foreground">Multi-shoe strategy reduces injury risk by up to 39% (Br J Sports Med, 2015)</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { role: '🏃 Daily Trainer', shoe: rotation.primary, desc: 'Easy runs & recovery' },
                  rotation.speed ? { role: '⚡ Speed Work', shoe: rotation.speed, desc: 'Tempo, intervals & race day' } : null,
                  rotation.longRun ? { role: '🛣️ Long Run', shoe: rotation.longRun, desc: 'Weekly long run (15K+)' } : null,
                ].filter(Boolean).map((item, i) => {
                  const s = item!;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="glass rounded-xl p-5 hover:border-primary/20 transition-all group relative overflow-hidden"
                    >
                      {i === 0 && <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-primary" />}
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-primary">{s.role}</div>
                        <MatchScoreBadge percent={s.shoe.matchPercent} size="sm" />
                      </div>
                      <ShoeImage
                        brand={s.shoe.shoe.brand}
                        model={s.shoe.shoe.model}
                        imageURL={s.shoe.shoe.imageURL}
                        amazonASIN={s.shoe.shoe.amazonASIN}
                        size="md"
                        className="mb-3"
                      />
                      <h4 className="font-bold text-lg mb-1">{s.shoe.shoe.brand} {s.shoe.shoe.model}</h4>
                      <p className="text-xs text-muted-foreground mb-2">{s.desc}</p>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <span className="text-[10px] bg-secondary/50 px-2 py-0.5 rounded-full">{s.shoe.shoe.cushioning}/10 Cushion</span>
                        <span className="text-[10px] bg-secondary/50 px-2 py-0.5 rounded-full">{s.shoe.shoe.dropMM}mm</span>
                        <span className="text-[10px] bg-secondary/50 px-2 py-0.5 rounded-full">{s.shoe.shoe.weightGrams}g</span>
                      </div>
                      <p className="text-primary font-semibold text-sm mb-3">${s.shoe.shoe.priceUSD}</p>
                      <div className="flex gap-2">
                        <a
                          href={getAmazonProductLink(s.shoe.shoe.id, s.shoe.shoe.brand, s.shoe.shoe.model, s.shoe.shoe.amazonASIN)}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="flex-1 flex items-center justify-center gap-1.5 bg-primary/10 text-primary font-semibold text-xs px-3 h-9 rounded-lg hover:bg-primary/20 transition-all"
                        >
                          <ShoppingCart className="w-3 h-3" /> Amazon
                        </a>
                        <a
                          href={s.shoe.shoe.reviewURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 border border-border/50 text-muted-foreground text-xs px-3 h-9 rounded-lg hover:border-primary/30 hover:text-primary transition-all"
                        >
                          <BookOpen className="w-3 h-3" /> Review
                        </a>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <a
                href="https://gearuptofit.com/review/best-running-shoes-for-different-distances/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-5 text-sm text-primary hover:underline font-medium"
              >
                Best shoes for different distances 2026 <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </motion.div>
        )}

        {/* SECTION 4: Head-to-Head Comparison */}
        {topShoes.length >= 3 && (
          <motion.div {...fadeUp} transition={{ delay: 0.35 }}>
            <div className="glass rounded-2xl p-5 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight">Head-to-Head Comparison</h2>
                  <p className="text-xs text-muted-foreground">Your top {Math.min(topShoes.length, 5)} matches side by side</p>
                </div>
              </div>
              <ShoeComparisonTable shoes={topShoes} getAmazonLink={getAmazonProductLink} />
            </div>
          </motion.div>
        )}

        {/* SECTION 5: Why This Match Works */}
        <motion.div {...fadeUp} transition={{ delay: 0.4 }}>
          <div className="glass rounded-2xl p-5 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight">Why This Match Works</h2>
            </div>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-4">{rec.whyItWorks}</p>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{rec.categoryExplanation}</p>
            
            {/* Credibility badges */}
            <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-border/20">
              {[
                { label: 'Sports Science Backed', icon: '🔬' },
                { label: 'Biomechanics Analysis', icon: '🦿' },
                { label: 'Expert Curated Database', icon: '📚' },
                { label: '2025/2026 Models Only', icon: '✨' },
              ].map(badge => (
                <div key={badge.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-secondary/30 px-3 py-1.5 rounded-full">
                  <span>{badge.icon}</span>
                  <span className="font-medium">{badge.label}</span>
                </div>
              ))}
            </div>
            
            <a
              href="https://gearuptofit.com/running/how-to-choose-the-right-running-shoes/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-5 text-sm text-primary hover:underline font-medium"
            >
              Learn how to choose the right shoe <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>

        {/* SECTION 6: Injury Prevention (conditional) */}
        {injuryArticles.length > 0 && (
          <motion.div {...fadeUp} transition={{ delay: 0.45 }}>
            <div className="glass rounded-2xl p-5 md:p-8 border-destructive/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight">Injury Prevention</h2>
                  <p className="text-xs text-muted-foreground">Resources based on your injury history</p>
                </div>
              </div>

              <div className="space-y-4 mb-5">
                {rec.trainingEmphasis.filter(t => t.toLowerCase().includes('injury') || t.toLowerCase().includes('strength') || t.toLowerCase().includes('warm')).map((tip, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive text-xs font-bold">!</span>
                    <span className="text-muted-foreground leading-relaxed">{tip}</span>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {injuryArticles.map(article => (
                  <a
                    key={article.url}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 rounded-xl bg-card/50 border border-border/50 hover:border-primary/20 transition-all group"
                  >
                    <span className="text-xl">{article.icon}</span>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs group-hover:text-primary transition-colors block">{article.title}</span>
                      <span className="text-[10px] text-muted-foreground">{article.category}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* SECTION 7: Training Emphasis */}
        <motion.div {...fadeUp} transition={{ delay: 0.5 }}>
          <div className="glass rounded-2xl p-5 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
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

        {/* SECTION 8: Recommended Reading */}
        <motion.div {...fadeUp} transition={{ delay: 0.55 }}>
          <div className="glass rounded-2xl p-5 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight">Recommended Reading</h2>
                <p className="text-xs text-muted-foreground">Curated articles based on your runner profile</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recommendedArticles.map(article => (
                <a
                  key={article.url}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-4 rounded-xl bg-card/50 border border-border/50 hover:border-primary/20 transition-all group"
                >
                  <span className="text-2xl flex-shrink-0">{article.icon}</span>
                  <div className="min-w-0">
                    <Badge variant="secondary" className="text-[9px] mb-1.5">{article.category}</Badge>
                    <span className="font-semibold text-sm group-hover:text-primary transition-colors block leading-tight">{article.title}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-1 group-hover:translate-x-0.5 transition-all" />
                </a>
              ))}
            </div>
          </div>
        </motion.div>

        {/* SECTION 9: Useful Tools */}
        <motion.div {...fadeUp} transition={{ delay: 0.6 }}>
          <div className="glass rounded-2xl p-5 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight">Useful Tools</h2>
                <p className="text-xs text-muted-foreground">Free calculators & planners on GearUpToFit</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {toolLinks.map(tool => (
                <a
                  key={tool.url}
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-4 rounded-xl bg-card/50 border border-border/50 hover:border-primary/20 transition-all group"
                >
                  <span className="text-2xl flex-shrink-0">{tool.icon}</span>
                  <div className="min-w-0">
                    <span className="font-semibold text-sm group-hover:text-primary transition-colors block">{tool.title}</span>
                    <span className="text-xs text-muted-foreground">{tool.description}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-1" />
                </a>
              ))}
            </div>
          </div>
        </motion.div>

        {/* SECTION 10: Complete Your Kit */}
        <motion.div {...fadeUp} transition={{ delay: 0.65 }}>
          <div className="glass rounded-2xl p-5 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight">Complete Your Kit</h2>
                <p className="text-xs text-muted-foreground">Essential gear to complement your new shoes</p>
              </div>
            </div>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              {kitLinks.map(item => (
                <a
                  key={item.url}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border/50 hover:border-primary/20 transition-all group text-center"
                >
                  <span className="text-3xl">{item.icon}</span>
                  <span className="font-semibold text-xs group-hover:text-primary transition-colors">{item.title}</span>
                  <span className="text-[10px] text-muted-foreground">{item.category}</span>
                </a>
              ))}
            </div>
          </div>
        </motion.div>

        {/* SECTION 11: FAQ */}
        <motion.div {...fadeUp} transition={{ delay: 0.7 }}>
          <div className="glass rounded-2xl p-5 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight">Frequently Asked Questions</h2>
            </div>
            <Accordion type="single" collapsible className="space-y-2">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border border-border/50 rounded-xl px-4 bg-card/30">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline text-left">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </motion.div>

        {/* SECTION 12: Download PDF + Share & Retake */}
        <motion.div {...fadeUp} transition={{ delay: 0.75 }}>
          <div className="text-center pt-8 space-y-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <div className="glass rounded-2xl p-6 md:p-8 border border-primary/20 max-w-lg mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-gradient-primary mx-auto flex items-center justify-center mb-4 glow-primary">
                  <Download className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="text-xl md:text-2xl font-bold uppercase tracking-tight mb-2">Download Your Report</h3>
                <p className="text-sm text-muted-foreground mb-5">Get a beautiful PDF with your full running profile, shoe matches, and personalized resources.</p>
                <Button
                  onClick={handleDownloadPDF}
                  className="bg-gradient-primary glow-primary font-bold uppercase tracking-wider px-8 h-12 rounded-xl text-sm group w-full sm:w-auto"
                >
                  <Download className="w-4 h-4 mr-2 group-hover:animate-bounce" />
                  Download PDF Report
                </Button>
              </div>
            </motion.div>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleShare} className="gap-2 rounded-xl">
                <Copy className="w-4 h-4" /> Copy Link
              </Button>
              <Button variant="outline" size="sm" onClick={shareOnTwitter} className="gap-2 rounded-xl">
                <Twitter className="w-4 h-4" /> Twitter
              </Button>
              <Button variant="outline" size="sm" onClick={shareOnFacebook} className="gap-2 rounded-xl">
                <Facebook className="w-4 h-4" /> Facebook
              </Button>
            </div>

            <Link to="/">
              <Button className="bg-gradient-primary glow-primary font-bold uppercase tracking-[0.15em] px-10 h-14 text-base rounded-2xl group mt-4">
                <RotateCcw className="w-5 h-5 mr-2" />
                Retake Quiz
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>

            <p className="text-xs text-muted-foreground">
              Built by{' '}
              <a href="https://gearuptofit.com/about-us/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
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
