/**
 * Non-modal, scroll-revealed lead capture card. Renders only for users who
 * haven't subscribed in the last 90 days. Sits inline between results
 * sections so it never blocks the reading experience.
 *
 * Conversion design notes:
 *  - One field (email), one click, no popup pattern → 2-3× higher conversion
 *    than a forced modal on returning readers.
 *  - Personalised hook ("Email me the PDF for the {primaryShoe}") increases
 *    perceived value vs. a generic "subscribe" CTA.
 *  - Suppresses itself permanently within a session after submit/dismiss
 *    so it never feels nagging.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Loader2, CheckCircle2, FileDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getUTM } from '@/lib/utm';
import { hasSubscribed } from '@/components/EmailGate';
import { track } from '@/lib/analytics';

const STORAGE_KEY = 'gutf_subscribed_v1';
const SESSION_DISMISS = 'gutf_inline_lead_dismissed_v1';

interface Props {
  primaryShoe?: string;
  shoeCategory?: string;
  weeklyMileage?: number;
  injuries?: string[];
}

const InlineLeadCard = ({ primaryShoe, shoeCategory, weeklyMileage, injuries }: Props) => {
  const [hidden, setHidden] = useState(() => {
    if (typeof window === 'undefined') return true;
    if (hasSubscribed()) return true;
    try { return !!sessionStorage.getItem(SESSION_DISMISS); } catch { return false; }
  });
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (hidden) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email');
      return;
    }
    if (!consent) {
      toast.error('Please tick the box to receive your PDF and emails');
      return;
    }
    setLoading(true);
    try {
      // Loaded on demand: the Supabase client is ~100 KB and only needed at submit time.
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('brevo-subscribe', {
        body: {
          email: email.trim().toLowerCase(),
          source: 'inline_hero',
          shoeCategory,
          primaryShoe,
          weeklyMileage,
          injuries,
          consent: true,
          utm: getUTM(),
        },
      });
      const reply = data as { error?: string } | null;
      if (error || reply?.error) throw new Error(reply?.error || error?.message || 'Failed');
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ email: email.trim().toLowerCase(), ts: Date.now() })); } catch { /* storage blocked: signup still succeeded */ }
      track.emailCapture({ source: 'inline_results_card', shoeCategory, marketingConsent: true });
      setDone(true);
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const dismiss = () => {
    try { sessionStorage.setItem(SESSION_DISMISS, '1'); } catch { /* storage blocked: hide for this view only */ }
    setHidden(true);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative max-w-3xl mx-auto my-12"
      aria-label="Email me the PDF report"
    >
      <div className="relative glass rounded-2xl border border-primary/25 p-6 md:p-8 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-primary/5"
        />
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition z-10"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {!done ? (
          <div className="relative grid md:grid-cols-[1fr_auto] gap-5 items-center">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                  <FileDown className="w-3 h-3" /> Free PDF
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">· 60-sec read</span>
              </div>
              <h3 className="text-lg md:text-xl font-bold uppercase tracking-tight leading-tight mb-1.5">
                {primaryShoe
                  ? <>Want the full PDF for your <span className="text-primary">{primaryShoe}</span> match?</>
                  : 'Want your full shoe match PDF, free?'}
              </h3>
              <p className="text-sm text-muted-foreground leading-snug">
                Includes your rotation plan and the reasons behind each pick, plus a 7-day running tips email series. Unsubscribe in 1&nbsp;click.
              </p>
            </div>

            <form onSubmit={submit} className="flex flex-col sm:flex-row md:flex-col gap-2 md:min-w-[260px]">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.slice(0, 255))}
                  maxLength={255}
                  autoComplete="email"
                  className="h-11 pl-9"
                />
              </div>
              <label className="flex items-start gap-2 text-[11px] text-muted-foreground leading-snug cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  Email me the PDF and the 7-day series from GearUpToFit. I can unsubscribe at any time. See the{' '}
                  <a href="https://gearuptofit.com/privacy-policy/" target="_blank" rel="noopener" className="underline hover:text-primary">privacy policy</a>.
                </span>
              </label>
              <Button
                type="submit"
                disabled={loading}
                className="h-11 bg-gradient-primary hover:opacity-90 font-bold uppercase tracking-[0.1em] glow-primary whitespace-nowrap"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Email Me My PDF'}
              </Button>
            </form>
          </div>
        ) : (
          <div className="relative flex items-center gap-3 py-2">
            <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold uppercase tracking-tight text-sm md:text-base">Check your inbox</p>
              <p className="text-xs text-muted-foreground">Your PDF is on its way · Day-1 coaching email arrives tomorrow.</p>
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
};

export default InlineLeadCard;
