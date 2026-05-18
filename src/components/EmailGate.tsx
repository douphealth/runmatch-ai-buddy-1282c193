import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, CheckCircle2, Loader2, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getUTM } from '@/lib/utm';

interface EmailGateProps {
  open: boolean;
  onClose: () => void;
  onUnlock: () => void; // called after successful subscribe (or skip)
  primaryShoe?: string;
  shoeCategory?: string;
  weeklyMileage?: number;
  injuries?: string[];
  source?: 'quiz_gate' | 'exit_popup' | 'inline_hero' | 'footer' | 'blog_inline';
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
}

const STORAGE_KEY = 'gutf_subscribed_v1';
// Re-prompt returning runners after 90 days so they can grab a fresh PDF / updated rotation.
const SUBSCRIBED_TTL_MS = 90 * 24 * 60 * 60 * 1000;

type SubscribedRecord = { email: string; ts: number };

const readRecord = (): SubscribedRecord | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // Legacy value was a plain email string with no timestamp.
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.email === 'string' && typeof parsed.ts === 'number') return parsed;
      return null;
    }
    return { email: raw, ts: 0 };
  } catch { return null; }
};

export const hasSubscribed = () => {
  const rec = readRecord();
  if (!rec) return false;
  if (!rec.ts) return false; // legacy → treat as expired, re-prompt once with TTL
  return Date.now() - rec.ts < SUBSCRIBED_TTL_MS;
};

export const getSubscribedEmail = () => readRecord()?.email;

const EmailGate = ({
  open,
  onClose,
  onUnlock,
  primaryShoe,
  shoeCategory,
  weeklyMileage,
  injuries,
  source = 'quiz_gate',
  title = 'Unlock Your Personalized Shoe Report',
  subtitle = 'Get your full PDF report, 3-shoe rotation plan, and a free 7-day running coach series — straight to your inbox.',
  ctaLabel = 'Email Me My Report',
}: EmailGateProps) => {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [consent, setConsent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) { setDone(false); setLoading(false); }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email');
      return;
    }
    if (!consent) {
      toast.error('Please accept to receive your report');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('brevo-subscribe', {
        body: {
          email: email.trim().toLowerCase(),
          firstName: firstName.trim() || undefined,
          source,
          shoeCategory,
          primaryShoe,
          weeklyMileage,
          injuries,
          consent: true,
          utm: getUTM(),
        },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || 'Failed');
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ email: email.trim().toLowerCase(), ts: Date.now() })); } catch {}
      // GA4 conversion event
      try {
        (window as any).dataLayer?.push({
          event: 'lead_capture',
          source,
          shoe_category: shoeCategory,
        });
      } catch {}
      setDone(true);
      setTimeout(() => { onUnlock(); }, 900);
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/85 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md glass rounded-2xl border border-primary/20 p-6 md:p-8 shadow-2xl shadow-primary/20"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition"
            >
              <X className="w-4 h-4" />
            </button>

            {!done ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center glow-primary">
                    <Sparkles className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Free · 1-click</span>
                </div>

                <h2 className="text-2xl md:text-[28px] font-bold uppercase leading-tight tracking-tight mb-2">
                  {title}
                </h2>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{subtitle}</p>

                <ul className="space-y-2 mb-5 text-xs md:text-sm">
                  {[
                    'Full PDF report with your top 3 shoes',
                    '3-shoe rotation plan (39% lower injury risk)',
                    '7-day running coach email series',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2 text-foreground/90">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>

                <form onSubmit={submit} className="space-y-3">
                  <Input
                    type="text"
                    placeholder="First name (optional)"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value.slice(0, 60))}
                    maxLength={60}
                    autoComplete="given-name"
                    className="h-11"
                  />
                  <div className="relative">
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
                      Yes, send me my report and the free running coach series. I can unsubscribe anytime. By
                      continuing I accept the{' '}
                      <a href="https://gearuptofit.com/privacy-policy/" target="_blank" rel="noopener" className="underline hover:text-primary">privacy policy</a>.
                    </span>
                  </label>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-gradient-primary hover:opacity-90 font-bold uppercase tracking-[0.12em] glow-primary"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>
                    ) : (
                      <><Lock className="w-4 h-4 mr-2" /> {ctaLabel}</>
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition py-1"
                  >
                    No thanks, just show my results
                  </button>
                </form>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6"
              >
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/15 border-2 border-primary flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold uppercase mb-2">Check your inbox!</h3>
                <p className="text-sm text-muted-foreground">
                  Your personalized report is on its way. Unlocking your results…
                </p>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EmailGate;
