/**
 * Exit-intent detector — fires once per session when the cursor leaves
 * through the top of the viewport (desktop) or the user has been idle on
 * the page for 45s on mobile (no mouseleave on touch).
 *
 * Children receive { open, close } and render the actual modal (typically
 * an <EmailGate>) so we don't lock a specific UI here.
 */
import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';

const SESSION_KEY = 'gutf_exit_intent_shown_v1';
const SUBSCRIBED_KEY = 'gutf_subscribed_v1';

interface ExitIntentProps {
  /** Don't trigger before this many ms on page (default 6s). */
  minDwellMs?: number;
  /** Mobile idle fallback (default 45s). */
  mobileIdleMs?: number;
  /** Disable entirely (e.g. when another modal is open). */
  disabled?: boolean;
  children: (api: { open: boolean; close: () => void }) => React.ReactNode;
}

const isMobile = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

const alreadySubscribed = () => {
  try { return !!sessionStorage.getItem(SESSION_KEY) || !!localStorage.getItem(SUBSCRIBED_KEY); }
  catch { return false; }
};

const ExitIntent = ({ minDwellMs = 6000, mobileIdleMs = 45000, disabled, children }: ExitIntentProps) => {
  const [open, setOpen] = useState(false);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (disabled || typeof window === 'undefined' || alreadySubscribed()) return;

    const fire = (reason: 'mouseleave' | 'idle' | 'visibility') => {
      if (alreadySubscribed()) return;
      if (Date.now() - mountedAt.current < minDwellMs) return;
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
      track.exitIntent();
      setOpen(true);
    };

    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) fire('mouseleave');
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Don't actually trigger here — only mark intent so next mouse-leave
        // shows immediately. Visibility hidden alone isn't reliable.
      }
    };

    let idleTimer: number | undefined;
    if (isMobile()) {
      idleTimer = window.setTimeout(() => fire('idle'), mobileIdleMs);
    } else {
      document.addEventListener('mouseleave', onMouseLeave);
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      if (idleTimer) window.clearTimeout(idleTimer);
    };
  }, [disabled, minDwellMs, mobileIdleMs]);

  return <>{children({ open, close: () => setOpen(false) })}</>;
};

export default ExitIntent;
