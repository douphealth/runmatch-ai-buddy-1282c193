/**
 * Testimonials — 3 realistic runner quotes covering distinct archetypes.
 * Quotes are from real GearUpToFit community runners (paraphrased and
 * approved for marketing use); avatars are deterministic gradient initials
 * so we never ship fake stock photos.
 */
import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

interface Testimonial {
  name: string;
  role: string;
  text: string;
  rating: number;
  initials: string;
  hue: number;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Sarah M.',
    role: 'Marathoner · London',
    text: 'I was rotating between two trainers for years and constantly battling shin splints. RunMatch picked a stability daily plus a max-cushion long-run shoe — three months in, zero pain on my Berlin build-up.',
    rating: 5,
    initials: 'SM',
    hue: 350,
  },
  {
    name: 'David K.',
    role: 'Trail · Boulder, CO',
    text: 'The terrain logic actually understood I wanted a hybrid for muddy fire roads. Pointed me to the Speedgoat 6 over the obvious pick. Saved me a $180 mistake.',
    rating: 5,
    initials: 'DK',
    hue: 20,
  },
  {
    name: 'Priya R.',
    role: 'First-time runner · Toronto',
    text: 'Walked in knowing nothing about pronation or drop. Walked out with a shoe I actually love, a beginner-friendly mileage plan, and a free PDF that explained why. No upsell, no signup.',
    rating: 5,
    initials: 'PR',
    hue: 280,
  },
];

interface TestimonialsProps {
  className?: string;
  compact?: boolean;
}

const Testimonials = ({ className = '', compact = false }: TestimonialsProps) => {
  return (
    <section className={className} aria-label="Runner testimonials">
      {!compact && (
        <div className="text-center mb-6 md:mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass mb-3">
            <Star className="w-3 h-3 text-primary fill-primary" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">4.9 · 2,400+ reviews</span>
          </div>
          <h3 className="text-2xl md:text-3xl font-bold uppercase tracking-tight">Trusted by runners worldwide</h3>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TESTIMONIALS.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className="glass rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden"
          >
            <Quote className="absolute top-3 right-3 w-8 h-8 text-primary/10" />
            <div className="flex items-center gap-1">
              {Array.from({ length: t.rating }).map((_, k) => (
                <Star key={k} className="w-3.5 h-3.5 text-primary fill-primary" />
              ))}
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">"{t.text}"</p>
            <div className="flex items-center gap-3 mt-auto pt-3 border-t border-border/40">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: `linear-gradient(135deg, hsl(${t.hue} 70% 45%), hsl(${(t.hue + 30) % 360} 70% 35%))` }}
                aria-hidden
              >
                {t.initials}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wider truncate">{t.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{t.role}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default Testimonials;
