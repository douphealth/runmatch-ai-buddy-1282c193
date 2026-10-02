import { beforeEach, describe, expect, it } from 'vitest';
import { buildAffiliateClickParams, safePageLocation, serializeParams, track } from './analytics';

type DL = Record<string, unknown>[];
const dataLayer = () => (window as unknown as { dataLayer: DL }).dataLayer;
const last = () => dataLayer()[dataLayer().length - 1];

beforeEach(() => {
  (window as unknown as { dataLayer: DL }).dataLayer = [];
});

describe('serializeParams (GA4 limits and naming)', () => {
  it('snake_cases keys, joins arrays, drops empties and truncates long values', () => {
    const out = serializeParams({ shoeId: 'a', resultSlug: 'x', list: ['a', 'b', ''], empty: '', nothing: undefined, none: null, n: 3, ok: true, long: 'x'.repeat(300) });
    expect(out).toMatchObject({ shoe_id: 'a', result_slug: 'x', list: 'a,b', n: 3, ok: true });
    expect(out).not.toHaveProperty('empty');
    expect(out).not.toHaveProperty('nothing');
    expect((out.long as string).length).toBe(100);
  });

  it('never emits more than 25 parameters', () => {
    const many = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`p${i}`, i]));
    expect(Object.keys(serializeParams(many)).length).toBe(25);
  });
});

describe('privacy', () => {
  it('strips the ?d= answers payload (it encodes injury history) from page locations', () => {
    const url = safePageLocation('https://gearuptofit.com/shoe-finder/results/neutral-10k-road-neutral?d=eyJpbmp1cmllcyI6WyJrbmVlIl19&utm_source=x');
    expect(url).not.toContain('d=');
    expect(url).toContain('utm_source=x');
  });

  it('reduces injury answers to reported / none and never sends the names', () => {
    track.quizStep(6, 'injuries', ['knee-pain', 'achilles']);
    expect(last()).toMatchObject({ event: 'quiz_step', step_id: 'injuries', value: 'reported', step_number: 7 });
    expect(JSON.stringify(last())).not.toMatch(/knee|achilles/);
    track.quizStep(6, 'injuries', ['none']);
    expect(last()).toMatchObject({ value: 'none' });
  });

  it('result_view carries no injury details', () => {
    track.resultView({ slug: 's', primaryShoe: 'Nike Pegasus 41', hasInjuryNotice: true });
    expect(JSON.stringify(last())).not.toMatch(/knee|plantar|achilles|shin|it-band/);
    expect(last()).toMatchObject({ event: 'result_view', has_injury_notice: true });
  });
});

describe('funnel event names match the GA4 plan', () => {
  it('emits quiz_start, quiz_step, quiz_complete, result_view, email_capture, pdf_download', () => {
    track.quizStart();
    track.quizStep(0, 'footType', 'flat');
    track.quizComplete({ slug: 's', durationMs: 1000 });
    track.resultView({ slug: 's' });
    track.emailCapture({ source: 'quiz_gate', marketingConsent: true });
    track.pdfDownload({ slug: 's' });
    const names = dataLayer().map((e) => e.event);
    expect(names).toEqual(['quiz_start', 'quiz_step', 'quiz_complete', 'result_view', 'email_capture', 'marketing_opt_in', 'pdf_download']);
  });

  it('keeps the legacy quizStepComplete alias but emits the new event name', () => {
    track.quizStepComplete(1, 'pronation', 'neutral');
    expect(last()).toMatchObject({ event: 'quiz_step', step_id: 'pronation' });
  });
});

describe('affiliate_click carries shoe, merchant and position', () => {
  it('defaults merchant to amazon and position to 1, and derives the shoe name', () => {
    const p = buildAffiliateClickParams({ shoeId: 'nike-pegasus-41', brand: 'Nike', model: 'Pegasus 41', placement: 'result_primary_cta' });
    expect(p).toMatchObject({ shoe: 'Nike Pegasus 41', merchant: 'amazon', position: 1, link_type: 'affiliate' });
  });

  it('passes an explicit merchant and position through to the event', () => {
    track.affiliateClick({ shoeId: 'x', brand: 'A', model: 'B', merchant: 'runningwarehouse', position: 3, placement: 'comparison_table' });
    expect(last()).toMatchObject({ event: 'affiliate_click', shoe: 'A B', shoe_id: 'x', merchant: 'runningwarehouse', position: 3, placement: 'comparison_table' });
  });
});

describe('safety', () => {
  it('never throws, even with odd input', () => {
    expect(() => track.error({ message: 'x'.repeat(1000) })).not.toThrow();
    expect(() => track.affiliateClick({} as never)).not.toThrow();
  });
});
