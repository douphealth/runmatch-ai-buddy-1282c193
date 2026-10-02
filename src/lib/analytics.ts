/**
 * Typed GA4 analytics layer for RunMatch AI.
 *
 * Why this exists: the app is served from gearuptofit.com/shoe-finder/ but its
 * HTML comes from a separate build, so the GA4/GTM tag on the WordPress site is
 * NOT present here. Earlier versions only pushed to `window.dataLayer`, which
 * nothing was reading — no funnel data was ever recorded. This module loads
 * gtag.js itself (production, gearuptofit.com only) and sends real GA4 events.
 *
 * Funnel (snake_case, GA4 conventions):
 *   quiz_view -> quiz_start -> quiz_step (xN) -> quiz_complete -> result_view
 *     -> email_capture | affiliate_click | pdf_download
 *
 * Privacy rules enforced here (not optional):
 *   - Injury / pain answers are never sent, only whether any were reported.
 *   - The `?d=` answers payload is stripped from every page_location.
 *   - Nothing is sent when Global Privacy Control or Do Not Track is on.
 *   - Nothing is sent from previews, pages.dev, localhost or test runs.
 *   - All calls are safe to make anywhere: they never throw.
 */
import { ANALYTICS_HOSTS, GA_MEASUREMENT_ID } from './site-config';

type Primitive = string | number | boolean | null | undefined;
export type AnalyticsParams = Record<string, Primitive | Primitive[]>;
type CleanParams = Record<string, string | number | boolean>;

type GtagFn = (...args: unknown[]) => void;
interface AnalyticsWindow {
  dataLayer?: unknown[];
  gtag?: GtagFn;
  __gutfAnalyticsReady?: boolean;
}

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';
const win = () => window as unknown as AnalyticsWindow & Window;

const toSnake = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/**
 * GA4 limits: names <= 40 chars, values <= 100 chars, <= 25 params. Keys are
 * normalised to snake_case, arrays are comma-joined, empties are dropped.
 */
export function serializeParams(params: AnalyticsParams = {}): CleanParams {
  const out: CleanParams = {};
  for (const [rawKey, rawValue] of Object.entries(params)) {
    if (Object.keys(out).length >= 25) break;
    const key = toSnake(rawKey).slice(0, 40);
    let value: Primitive | Primitive[] = rawValue;
    if (Array.isArray(value)) value = value.filter((v) => v !== undefined && v !== null && v !== '').join(',');
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'number') {
      if (Number.isFinite(value)) out[key] = value;
    } else if (typeof value === 'boolean') {
      out[key] = value;
    } else {
      out[key] = String(value).slice(0, 100);
    }
  }
  return out;
}

/** The current URL without the `?d=` payload (it encodes injury history). */
export function safePageLocation(href?: string): string {
  try {
    const url = new URL(href ?? window.location.href);
    url.searchParams.delete('d');
    return url.toString();
  } catch {
    return '';
  }
}

function analyticsAllowed(): boolean {
  if (!isBrowser()) return false;
  const env = (import.meta as { env?: { PROD?: boolean } }).env;
  if (!env?.PROD) return false;
  if (!ANALYTICS_HOSTS.includes(window.location.hostname)) return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.globalPrivacyControl === true) return false;
  if (nav.doNotTrack === '1') return false;
  return true;
}

/** Loads gtag.js once. Safe to call repeatedly and from anywhere. */
export function initAnalytics(): void {
  if (!analyticsAllowed()) return;
  const w = win();
  if (w.__gutfAnalyticsReady) return;
  w.__gutfAnalyticsReady = true;
  try {
    w.dataLayer = w.dataLayer || [];
    if (!w.gtag) {
      w.gtag = function gtag() {
        // gtag.js only understands the `arguments` object, not an array.
        // eslint-disable-next-line prefer-rest-params
        (w.dataLayer as unknown[]).push(arguments);
      };
    }
    w.gtag('js', new Date());
    // Page views are sent manually (single-page app) with the ?d= payload stripped.
    w.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false, page_location: safePageLocation() });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);
  } catch {
    /* analytics must never break the app */
  }
}

function send(event: string, params: AnalyticsParams = {}): void {
  if (!isBrowser()) return;
  try {
    const clean = serializeParams(params);
    const w = win();
    // Mirror to dataLayer for any GTM container that may be attached later.
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event, ...clean, _source: 'runmatch_ai' });
    if (w.__gutfAnalyticsReady && typeof w.gtag === 'function') {
      w.gtag('event', event, { ...clean, page_location: safePageLocation() });
    }
  } catch {
    /* never let analytics break the app */
  }
}

// ---------------------------------------------------------------------------
// Affiliate click helpers
// ---------------------------------------------------------------------------

export interface AffiliateClickInput {
  /** Shoe id in our database (also used to build `shoe` when not given). */
  shoeId?: string;
  shoe?: string;
  brand?: string;
  model?: string;
  /** Merchant that receives the click. Defaults to 'amazon' (the only one wired today). */
  merchant?: string;
  /** 1-based rank of the link inside its list (primary = 1, rotation slot = 1..3, table row = rank). */
  position?: number;
  /** UI slot, e.g. result_primary_cta, rotation_strategy_card, sticky_top_match. */
  placement?: string;
  [extra: string]: Primitive | Primitive[];
}

export function buildAffiliateClickParams(input: AffiliateClickInput): AnalyticsParams {
  const shoe = input.shoe ?? ([input.brand, input.model].filter(Boolean).join(' ') || undefined);
  return {
    ...input,
    shoe,
    merchant: input.merchant ?? 'amazon',
    position: input.position ?? 1,
    link_type: 'affiliate',
  };
}

// ---------------------------------------------------------------------------
// Funnel events
// ---------------------------------------------------------------------------

export const track = {
  pageView: (path?: string, title?: string) =>
    send('page_view', {
      page_path: path ?? (isBrowser() ? window.location.pathname : undefined),
      page_title: title ?? (isBrowser() ? document.title : undefined),
    }),

  quizView: () => send('quiz_view'),
  quizStart: () => send('quiz_start'),

  /** One event per answered step. Injury answers are reduced to reported / none. */
  quizStep: (stepIndex: number, stepId: string, value?: string | number | string[]) => {
    let safeValue: Primitive | Primitive[] = value;
    if (stepId === 'injuries') {
      const list = Array.isArray(value) ? value : value ? [String(value)] : [];
      safeValue = list.some((v) => v !== 'none') ? 'reported' : 'none';
    }
    send('quiz_step', { step_index: stepIndex, step_number: stepIndex + 1, step_id: stepId, value: safeValue });
  },
  /** @deprecated kept for older call sites; emits the same `quiz_step` event. */
  quizStepComplete: (stepIndex: number, stepId: string, value?: string | number | string[]) =>
    track.quizStep(stepIndex, stepId, value),

  quizAbandon: (stepIndex: number, stepId: string) =>
    send('quiz_abandon', { step_index: stepIndex, step_id: stepId }),
  quizComplete: (params: { slug: string; durationMs: number; usedCurrentShoe?: boolean }) =>
    send('quiz_complete', params),

  resultView: (params: {
    slug: string;
    primaryShoe?: string;
    matchPercent?: number;
    category?: string;
    personalized?: boolean;
    hasInjuryNotice?: boolean;
  }) => send('result_view', params),

  /** Lead capture. `source` is where the form lived (modal, inline card, exit popup). */
  emailCapture: (params: { source: string; shoeCategory?: string; resultSlug?: string; matchPercent?: number; marketingConsent?: boolean }) => {
    send('email_capture', params);
    if (params.marketingConsent) send('marketing_opt_in', params);
  },

  reviewClick: (params: AnalyticsParams) => send('review_click', params),
  affiliateClick: (input: AffiliateClickInput) => send('affiliate_click', buildAffiliateClickParams(input)),
  pdfDownload: (params: { slug: string; category?: string }) => send('pdf_download', params),
  ctaClick: (label: string, placement: string) => send('cta_click', { label, placement }),
  /** The email popup opened. 	rigger is mouseleave | dwell | scroll | idle. */
  exitIntent: (trigger?: string) => send('exit_intent_shown', trigger ? { trigger } : {}),
  error: (params: { message: string; source?: string; fatal?: boolean }) => send('app_error', params),
};

export type Track = typeof track;
