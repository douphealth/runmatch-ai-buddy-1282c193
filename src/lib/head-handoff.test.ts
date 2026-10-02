import { beforeEach, describe, expect, it } from 'vitest';
import { clearPrerenderedHead } from './head-handoff';
import { generateRecommendation } from './recommendation-engine';
import { defaultAnswers } from './quiz-data';

describe('head handoff from pre-rendered HTML to React', () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <title data-prerender="1">Static title</title>
      <meta data-prerender="1" name="description" content="static" />
      <link data-prerender="1" rel="canonical" href="https://example.com/a/" />
      <script data-prerender="1" type="application/ld+json">{}</script>
      <meta name="viewport" content="width=device-width" />`;
  });

  it('removes duplicated tags but keeps the <title> element (Helmet edits it in place)', () => {
    clearPrerenderedHead();
    expect(document.querySelectorAll('[data-prerender]').length).toBe(0);
    expect(document.querySelector('link[rel=canonical]')).toBeNull();
    expect(document.querySelector('meta[name=description]')).toBeNull();
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
    expect(document.querySelectorAll('title').length).toBe(1);
    expect(document.querySelector('meta[name=viewport]')).not.toBeNull(); // untouched
  });

  it('a later document.title update (what Helmet does) lands on the surviving element', () => {
    clearPrerenderedHead();
    document.title = 'Set by Helmet';
    expect(document.title).toBe('Set by Helmet');
    expect(document.querySelectorAll('title').length).toBe(1);
  });
});

describe('injured runners get a comfort-first profile, not a racing flat', () => {
  it('replaces the race/speed category and raises light cushioning', () => {
    const base = { ...defaultAnswers, footType: 'neutral', pronation: 'neutral', distance: '5k', terrain: 'road', paceGoal: 'race', weeklyMileage: 30 };
    expect(generateRecommendation({ ...base, injuries: [] }).shoeProfile.category).toBe('Racing Flat / Speed Trainer');
    const hurt = generateRecommendation({ ...base, injuries: ['achilles'] });
    expect(hurt.shoeProfile.category).toBe('Cushioned Daily Trainer');
    expect(hurt.shoeProfile.cushioning).not.toBe('Light to Moderate');
  });
});
