/**
 * Lightweight client-side error monitoring.
 *
 * - Captures uncaught errors + unhandled promise rejections.
 * - Forwards a redacted payload to GA4 dataLayer as `app_error`.
 * - In dev, also logs to the console for visibility.
 * - Zero external deps — safe substitute for Sentry until a paid tier is wired.
 */

import { track } from './analytics';

let initialized = false;

interface CapturedError {
  message: string;
  source?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  url: string;
  ua: string;
  ts: number;
}

const MAX_MESSAGE_LEN = 500;
const MAX_STACK_LEN = 2000;

function redact(s?: string, max = MAX_MESSAGE_LEN): string | undefined {
  if (!s) return undefined;
  // Strip query strings / tokens from URLs in messages and stacks.
  return s.replace(/([?&])(token|key|apikey|access_token|jwt)=[^&\s]+/gi, '$1$2=REDACTED').slice(0, max);
}

function report(err: CapturedError, fatal = false) {
  try {
    track.error({ message: err.message, source: err.source, fatal });
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[error-monitoring]', err);
    }
  } catch {
    /* never throw inside the error reporter */
  }
}

export function reportError(error: unknown, context?: { source?: string; fatal?: boolean }) {
  const e = error as Error | undefined;
  report(
    {
      message: redact(e?.message || String(error)) || 'Unknown error',
      source: context?.source,
      stack: redact(e?.stack, MAX_STACK_LEN),
      url: typeof window !== 'undefined' ? window.location.href : '',
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      ts: Date.now(),
    },
    context?.fatal ?? false,
  );
}

export function initErrorMonitoring() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('error', (event) => {
    report({
      message: redact(event.message) || 'window.onerror',
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: redact((event.error as Error | undefined)?.stack, MAX_STACK_LEN),
      url: window.location.href,
      ua: navigator.userAgent,
      ts: Date.now(),
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as Error | string | undefined;
    const message = typeof reason === 'string' ? reason : reason?.message || 'unhandledrejection';
    report({
      message: redact(message) || 'unhandledrejection',
      stack: redact((reason as Error | undefined)?.stack, MAX_STACK_LEN),
      url: window.location.href,
      ua: navigator.userAgent,
      ts: Date.now(),
    });
  });
}
