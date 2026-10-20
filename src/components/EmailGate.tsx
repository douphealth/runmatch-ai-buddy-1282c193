import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, CheckCircle2, Loader2, X, Sparkles, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getUTM } from '@/lib/utm';
import { track } from '@/lib/analytics';

interface EmailGateProps {
  open: boolean;
  /** The visitor closed the dialog (X, Escape, backdrop). In download mode the page still downloads the report. */
  onClose: () => void;
  /**
   * Called when the dialog is done: after a successful sign-up, or in download mode when the visitor downloads
   * without an email. `subscribed` says whether an address was saved.
   */
  onUnlock: (subscribed: boolean) => void;
  primaryShoe?: string;
  shoeCategory?: string;
  weeklyMileage?: number;
  injuries?: string[];
  source?: 'quiz_gate' | 'exit_popup' | 'inline_hero' | 'footer' | 'blog_inline';
  /**
   * 'download': the report is the point. One big button downloads it with no email; adding an email (and ticking the
   * box) also signs the visitor up for the tips. 'subscribe': an email is required (exit popup, post-download offer).
   */
  mode?: 'download' | 'subscribe';
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  /** Bullet list under the subtitle. */
  benefits?: string[];
}

const TIPS_BENEFITS = [
  'A free 7-day running tips email series',
  'Practical advice on shoes, training and recovery',
  'No spam. Unsubscribe in 1 click',
];

/** What the PDF really contains (see src/lib/pdf-generator.ts). */
const REPORT_BENEFITS = [
  'Your top 3 picks with Amazon photos and links',
  'Side-by-side comparison, shoe rotation plan and try-on guide',
  'A printable shoe log and gear that suits your running',
];

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EmailGate = ({
  open,
  onClose,
  onUnlock,
  primaryShoe,
  shoeCategory,
  weeklyMileage,
  injuries,
  source = 'quiz_gate',
  mode = 'subscribe',
  title,
  subtitle,
  ctaLabel,
  benefits,
}: EmailGateProps) => {
  const isDownload = mode === 'download';
  const heading = title ?? (isDownload ? 'Your report is ready' : 'Get the free 7-day running tips');
  const lead =
    subtitle ??
    (isDownload
      ? 'Download your personalized PDF now. No email needed.'
      : 'Short, practical emails to help you get the most from your new shoes, training and recovery. Free, unsubscribe in 1 click.');
  const bullets = benefits ?? (isDownload ? REPORT_BENEFITS : TIPS_BENEFITS);

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) { setDone(false); setLoading(false); }
  }, [open]);

  // Escape closes the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const wantsTips = email.trim().length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Download mode with an empty email is just a download: nothing is asked of the visitor.
    if (isDownload && !wantsTips) {
      onUnlock(false);
      return;
    }
    if (!email || !EMAIL_RE.test(email.trim())) {
      toast.error('Please enter a valid email');
      return;
    }
    if (!consent) {
      toast.error(isDownload ? 'Tick the box to get the tips, or clear the email to just download' : 'Please tick the box to receive the emails');
      return;
    }
    setLoading(true);
    try {
      // Loaded on demand: the Supabase client is ~100 KB and only needed at submit time.
      const { supabase } = await import('@/integrations/supabase/client');
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
      const apiError = (data as { error?: string } | null)?.error;
      if (error || apiError) throw new Error(apiError || error?.message || 'Failed');
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ email: email.trim().toLowerCase(), ts: Date.now() })); } catch { /* storage unavailable */ }
      // GA4 key event (mark email_capture as a key event in GA4 admin)
      track.emailCapture({ source, shoeCategory, marketingConsent: true });
      if (isDownload) {
        toast.success('You are on the list for the 7-day running tips.');
        onUnlock(true);
        return;
      }
      setDone(true);
      setTimeout(() => { onUnlock(true); }, 900);
    } catch (err) {
      console.error(err);
      if (isDownload) {
        // The report must never depend on the sign-up working.
        toast.error("We couldn't save your email, but your report is downloading.");
        onUnlock(false);
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const buttonLabel = isDownload
    ? wantsTips ? 'Download my PDF + send me the tips' : 'Download my PDF report'
    : ctaLabel ?? 'Send me the tips';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/85 backdrop-blur-md"
          onClick={onClose}
          data-testid="email-gate"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-gate-title"
            className="relative w-full max-h-[92vh] overflow-y-auto max-w-md glass rounded-2xl border border-primary/20 p-6 md:p-8 shadow-2xl shadow-primary/20"
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
                    {isDownload ? <Download className="w-6 h-6 text-primary-foreground" /> : <Sparkles className="w-6 h-6 text-primary-foreground" />}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                    {isDownload ? 'Free · instant' : 'Free · 1-click'}
                  </span>
                </div>

                <h2 id="email-gate-title" className="text-2xl md:text-[28px] font-bold uppercase leading-tight tracking-tight mb-2">
                  {heading}
                </h2>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{lead}</p>

                <ul className="space-y-2 mb-4 text-xs md:text-sm">
                  {bullets.map((t) => (
                    <li key={t} className="flex items-start gap-2 text-foreground/90">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>

                <form onSubmit={submit} className="space-y-3">
                  {isDownload && (
                    <Button
                      type="submit"
                      disabled={loading}
                      data-testid="gate-primary"
                      className="w-full h-12 bg-gradient-primary hover:opacity-90 font-bold uppercase tracking-[0.12em] glow-primary"
                    >
                      {loading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                      ) : (
                        <><Download className="w-4 h-4 mr-2" /> {buttonLabel}</>
                      )}
                    </Button>
                  )}

                  {isDownload && (
                    <p className="text-[11px] text-muted-foreground text-center pt-1 uppercase tracking-widest">
                      Optional: also get the free 7-day running tips
                    </p>
                  )}

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
                      required={!isDownload}
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
                      Send me the 7-day running tips series from GearUpToFit. I can unsubscribe at any time. By ticking I accept the{' '}
                      <a href="https://gearuptofit.com/privacy-policy/" target="_blank" rel="noopener" className="underline hover:text-primary">privacy policy</a>.
                    </span>
                  </label>

                  {!isDownload && (
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 bg-gradient-primary hover:opacity-90 font-bold uppercase tracking-[0.12em] glow-primary"
                    >
                      {loading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>
                      ) : (
                        <><Lock className="w-4 h-4 mr-2" /> {buttonLabel}</>
                      )}
                    </Button>
                  )}

                  <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground/80 uppercase tracking-widest pt-1">
                    <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Privacy policy linked</span>
                    <span aria-hidden>·</span>
                    <span>1-click unsubscribe</span>
                  </div>

                  {!isDownload && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition py-1"
                    >
                      No thanks
                    </button>
                  )}
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
                <h3 className="text-xl font-bold uppercase mb-2">You are in!</h3>
                <p className="text-sm text-muted-foreground">
                  The free 7-day running tips are on their way to your inbox.
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
