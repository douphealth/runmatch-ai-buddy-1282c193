/**
 * Live activity toast — rotates through realistic recent-match notifications
 * to add subtle social proof / FOMO on the hero and results pages.
 *
 * Uses sonner so it fits the existing toast system. Each toast auto-dismisses
 * after 5s; we show 3 over the page lifetime to stay tasteful, never spammy.
 */
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Activity } from 'lucide-react';

interface ActivityItem {
  name: string;
  city: string;
  shoe: string;
  minutesAgo: number;
}

const POOL: ActivityItem[] = [
  { name: 'Marcus', city: 'Berlin', shoe: 'Nike Pegasus 41', minutesAgo: 2 },
  { name: 'Aoife', city: 'Dublin', shoe: 'Hoka Clifton 9', minutesAgo: 4 },
  { name: 'Kenji', city: 'Tokyo', shoe: 'Asics Novablast 4', minutesAgo: 6 },
  { name: 'Lucia', city: 'Madrid', shoe: 'Brooks Ghost 16', minutesAgo: 3 },
  { name: 'Owen', city: 'Cape Town', shoe: 'Saucony Endorphin Speed 4', minutesAgo: 8 },
  { name: 'Yara', city: 'São Paulo', shoe: 'New Balance 1080v14', minutesAgo: 5 },
  { name: 'Tom', city: 'Melbourne', shoe: 'Hoka Speedgoat 6', minutesAgo: 7 },
  { name: 'Elena', city: 'Milan', shoe: 'Asics Gel-Kayano 31', minutesAgo: 9 },
];

interface LiveActivityProps {
  /** First toast appears after this many ms (default 8s). */
  initialDelayMs?: number;
  /** Gap between toasts (default 25s). */
  intervalMs?: number;
  /** Max toasts to show in the session (default 3). */
  maxShown?: number;
  /** Disable entirely. */
  disabled?: boolean;
}

const SESSION_COUNT_KEY = 'gutf_live_activity_count_v1';

const LiveActivity = ({
  initialDelayMs = 8000,
  intervalMs = 25_000,
  maxShown = 3,
  disabled,
}: LiveActivityProps) => {
  const shownRef = useRef(0);

  useEffect(() => {
    if (disabled || typeof window === 'undefined') return;
    let alreadyShown = 0;
    try { alreadyShown = parseInt(sessionStorage.getItem(SESSION_COUNT_KEY) || '0', 10); } catch {}
    if (alreadyShown >= maxShown) return;
    shownRef.current = alreadyShown;

    const pickNext = () => POOL[Math.floor(Math.random() * POOL.length)];

    const fire = () => {
      if (shownRef.current >= maxShown) return;
      const item = pickNext();
      toast.message(
        `${item.name} from ${item.city} just matched`,
        {
          description: `Recommended: ${item.shoe} · ${item.minutesAgo} min ago`,
          icon: <Activity className="w-4 h-4 text-primary" />,
          duration: 5000,
        },
      );
      shownRef.current += 1;
      try { sessionStorage.setItem(SESSION_COUNT_KEY, String(shownRef.current)); } catch {}
    };

    const first = window.setTimeout(() => {
      fire();
      const iv = window.setInterval(() => {
        if (shownRef.current >= maxShown) {
          window.clearInterval(iv);
          return;
        }
        fire();
      }, intervalMs);
      // store on window for cleanup
      (first as any)._iv = iv;
    }, initialDelayMs);

    return () => {
      window.clearTimeout(first);
      const iv = (first as any)._iv;
      if (iv) window.clearInterval(iv);
    };
  }, [disabled, initialDelayMs, intervalMs, maxShown]);

  return null;
};

export default LiveActivity;
