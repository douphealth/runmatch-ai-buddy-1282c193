/**
 * Email-capture popup trigger. Opens the child modal (typically an <EmailGate>)
 * at most once per session, never for someone who has already subscribed, and
 * stays quiet for a week after it was dismissed.
 *
 * Triggers (whichever comes first, all after `minDwellMs`):
 *  - exit intent: the pointer leaves through the top of the window (desktop)
 *  - dwell: the visitor has been on the page for `dwellOpenMs` (optional)
 *  - scroll: the visitor has read `scrollDepth` of the page (optional)
 *  - idle: no input for `mobileIdleMs` on a touch-sized screen
 *
 * Why several: pointer-leave alone is unreliable. It never fires on touch
 * screens, many people close the tab with a shortcut, and browsers disagree on
 * which element receives `mouseleave`, so relying on it alone meant most
 * visitors never saw the form.
 *
 * Children receive { open, close } and render the modal, so no UI is locked in here.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { hasSubscribed } from '@/components/EmailGate';

export const EXIT_SESSION_KEY = 'gutf_exit_intent_shown_v1';
export const EXIT_DISMISSED_KEY = 'gutf_exit_intent_dismissed_v1';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ExitTrigger = 'mouseleave' | 'dwell' | 'scroll' | 'idle';

interface ExitIntentProps {
  /** Never trigger before this many ms on the page (default 6s). */
  minDwellMs?: number;
  /** Open after this long on the page regardless of behaviour (off by default). */
  dwellOpenMs?: number;
  /** Open once the visitor has scrolled this fraction (0-1) of the page (off by default). */
  scrollDepth?: number;
  /** Idle fallback on touch-sized screens (default 45s). */
  mobileIdleMs?: number;
  /** Disable entirely (e.g. while another modal is open). */
  disabled?: boolean;
  children: (api: { open: boolean; close: () => void }) => React.ReactNode;
}

const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

/** True when we must not show the popup (already shown, subscribed, or recently dismissed). */
export const popupSuppressed = (): boolean => {
  try {
    if (sessionStorage.getItem(EXIT_SESSION_KEY)) return true;
  } catch {
    /* storage blocked: fall through, the in-memory guard still limits it to once per page */
  }
  try {
    const dismissed = Number(localStorage.getItem(EXIT_DISMISSED_KEY) || 0);
    if (dismissed && Date.now() - dismissed < DISMISS_TTL_MS) return true;
  } catch {
    /* ignore */
  }
  try {
    return hasSubscribed();
  } catch {
    return false;
  }
};

const typingInField = () => {
  const el = typeof document !== 'undefined' ? document.activeElement : null;
  return !!el && /^(input|textarea|select)$/i.test(el.tagName);
};

const ExitIntent = ({
  minDwellMs = 6000,
  dwellOpenMs,
  scrollDepth,
  mobileIdleMs = 45000,
  disabled,
  children,
}: ExitIntentProps) => {
  const [open, setOpen] = useState(false);
  const mountedAt = useRef(Date.now());
  const shown = useRef(false);

  useEffect(() => {
    if (disabled || typeof window === 'undefined' || popupSuppressed()) return;

    const timers: number[] = [];
    const cleanups: (() => void)[] = [];

    const fire = (trigger: ExitTrigger) => {
      if (shown.current || popupSuppressed()) return;
      // Let people finish typing in a field (e.g. the current-shoe picker) before interrupting.
      if (trigger !== 'mouseleave' && typingInField()) {
        timers.push(window.setTimeout(() => fire(trigger), 4000));
        return;
      }
      shown.current = true;
      try {
        sessionStorage.setItem(EXIT_SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
      track.exitIntent(trigger);
      setOpen(true);
    };

    // Run `fn` once the minimum dwell time has passed.
    const afterDwell = (trigger: ExitTrigger) => {
      const wait = Math.max(0, minDwellMs - (Date.now() - mountedAt.current));
      if (wait === 0) fire(trigger);
      else timers.push(window.setTimeout(() => fire(trigger), wait));
    };

    // 1) Exit intent. `mouseleave` on <html> and `mouseout` with no related target
    // cover the different ways browsers report the pointer leaving the window.
    if (!isMobile()) {
      const leftThroughTop = (e: MouseEvent) => e.clientY <= 0 && Date.now() - mountedAt.current >= minDwellMs;
      const onLeave = (e: MouseEvent) => leftThroughTop(e) && fire('mouseleave');
      const onOut = (e: MouseEvent) => !e.relatedTarget && leftThroughTop(e) && fire('mouseleave');
      document.documentElement.addEventListener('mouseleave', onLeave);
      document.addEventListener('mouseout', onOut);
      cleanups.push(() => {
        document.documentElement.removeEventListener('mouseleave', onLeave);
        document.removeEventListener('mouseout', onOut);
      });
    } else {
      timers.push(window.setTimeout(() => fire('idle'), Math.max(mobileIdleMs, minDwellMs)));
    }

    // 2) Time on page.
    if (dwellOpenMs && dwellOpenMs > 0) {
      timers.push(window.setTimeout(() => afterDwell('dwell'), dwellOpenMs));
    }

    // 3) Scroll depth.
    if (scrollDepth && scrollDepth > 0) {
      const onScroll = () => {
        const doc = document.documentElement;
        const scrollable = doc.scrollHeight - window.innerHeight;
        if (scrollable <= 0) return;
        if (window.scrollY / scrollable >= scrollDepth) {
          window.removeEventListener('scroll', onScroll);
          afterDwell('scroll');
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener('scroll', onScroll));
    }

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      cleanups.forEach((fn) => fn());
    };
  }, [disabled, minDwellMs, dwellOpenMs, scrollDepth, mobileIdleMs]);

  const close = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(EXIT_DISMISSED_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }, []);

  return <>{children({ open, close })}</>;
};

export default ExitIntent;
