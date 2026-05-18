/**
 * Lightweight, typed analytics layer for RunMatch AI.
 *
 * Strategy:
 * - Pushes to GA4 dataLayer (gtag) when present on the parent site
 *   (gearuptofit.com embeds this app and ships GA4 on the page).
 * - No-ops in SSR / when dataLayer is missing — safe to call from anywhere.
 * - All event names are snake_case GA4 recommendations or custom equivalents.
 *
 * Funnel:
 *   quiz_view → quiz_start → quiz_step_complete (×9) → quiz_complete →
 *   result_view → email_capture → affiliate_click → pdf_download
 */

type AnalyticsParams = Record<string, string | number | boolean | string[] | undefined>;

const isBrowser = () => typeof window !== 'undefined';

function push(event: string, params: AnalyticsParams = {}) {
  if (!isBrowser()) return;
  try {
    const w = window as any;
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event, ...params, _source: 'runmatch_ai', _ts: Date.now() });
  } catch {
    /* never let analytics break the app */
  }
}

// ---- Funnel events ---------------------------------------------------------

export const track = {
  quizView: () => push('quiz_view'),
  quizStart: () => push('quiz_start'),
  quizStepComplete: (stepIndex: number, stepId: string, value?: string | number | string[]) =>
    push('quiz_step_complete', {
      step_index: stepIndex,
      step_id: stepId,
      value: Array.isArray(value) ? value.join(',') : value,
    }),
  quizAbandon: (stepIndex: number, stepId: string) =>
    push('quiz_abandon', { step_index: stepIndex, step_id: stepId }),
  quizComplete: (params: { slug: string; durationMs: number }) =>
    push('quiz_complete', params),
  resultView: (params: { slug: string; primaryShoe?: string; matchPercent?: number }) =>
    push('result_view', params),
  emailCapture: (params: { source: string; shoeCategory?: string }) =>
    push('lead_capture', params), // matches existing EmailGate event name
  affiliateClick: (params: { shoeId: string; brand: string; model: string; placement: string }) =>
    push('affiliate_click', params),
  pdfDownload: (params: { slug: string }) => push('pdf_download', params),
  ctaClick: (label: string, placement: string) =>
    push('cta_click', { label, placement }),
  exitIntent: () => push('exit_intent_shown'),
  error: (params: { message: string; source?: string; fatal?: boolean }) =>
    push('app_error', params),
};

export type Track = typeof track;
