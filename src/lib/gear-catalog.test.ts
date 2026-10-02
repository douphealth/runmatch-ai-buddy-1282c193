import { describe, expect, it } from 'vitest';
import gearImages from './gear-image-cache.json';
import { GEAR, selectGear, selectGearForShoe, toGearCard } from './gear-catalog';
import { getTopPicks } from './top-picks';
import { getAmazonLinkForShoe, getAmazonListingNote } from './amazon-link';
import { shoeDatabase } from './shoe-database';
import type { QuizAnswers } from './quiz-data';

const base: QuizAnswers = {
  footType: 'neutral', pronation: 'neutral', weeklyMileage: 30, distance: '10k', terrain: 'road',
  paceGoal: 'moderate', injuries: ['none'], brand: [], budget: ['100-150'],
};
const images = gearImages as Record<string, { url: string; title: string }>;

describe('gear catalog', () => {
  it('has unique ASINs and ids', () => {
    expect(new Set(GEAR.map((g) => g.asin)).size).toBe(GEAR.length);
    expect(new Set(GEAR.map((g) => g.id)).size).toBe(GEAR.length);
    for (const g of GEAR) expect(g.asin, g.id).toMatch(/^[A-Z0-9]{10}$/);
  });

  it('shows every item with the photo of the listing it links to (title names the brand)', () => {
    for (const g of GEAR) {
      const img = images[g.asin];
      expect(img, `${g.id}: run node scripts/amazon-catalog.mjs gear`).toBeTruthy();
      expect(img.url).toMatch(/^https:\/\/m\.media-amazon\.com\/images\/I\//);
      expect(img.title.toLowerCase(), g.id).toContain(g.brand.toLowerCase());
      expect(toGearCard(g).url).toBe(`https://www.amazon.com/dp/${g.asin}/?tag=papalex-20`);
    }
  });

  it('makes no medical or performance promises', () => {
    const text = GEAR.map((g) => `${g.name} ${g.why}`).join(' ');
    expect(text).not.toMatch(/\b(cure|heal|treat|prevent|guarantee|faster|injur)/i);
  });
});

describe('selectGear', () => {
  it('always offers a watch and socks, never duplicates, and stays within the limit', () => {
    for (const distance of ['5k', '10k', 'half-marathon', 'marathon', 'ultra']) {
      for (const terrain of ['road', 'trail']) {
        const gear = selectGear({ ...base, distance, terrain });
        expect(gear.length).toBeGreaterThanOrEqual(4);
        expect(gear.length).toBeLessThanOrEqual(6);
        expect(gear.some((g) => g.category === 'watch'), `${distance}/${terrain}`).toBe(true);
        expect(gear.some((g) => g.category === 'socks')).toBe(true);
        expect(new Set(gear.map((g) => g.asin)).size).toBe(gear.length);
      }
    }
  });

  it('adds fuelling for long distances and light and hydration for trail', () => {
    expect(selectGear({ ...base, distance: 'marathon' }).some((g) => g.category === 'nutrition')).toBe(true);
    expect(selectGear({ ...base, distance: '5k' }).some((g) => g.category === 'nutrition')).toBe(false);
    const trail = selectGear({ ...base, terrain: 'trail', distance: 'ultra' });
    expect(trail.some((g) => g.category === 'light')).toBe(true);
    expect(trail.some((g) => g.id === 'salomon-advance-skin-12')).toBe(true);
  });

  it('picks the premium watch for a marathon runner with a big budget', () => {
    expect(selectGear({ ...base, distance: 'marathon', budget: ['200-plus'] })[0].id).toBe('garmin-forerunner-970');
    expect(selectGear({ ...base, distance: '10k', budget: ['under-100'] })[0].id).toBe('garmin-forerunner-165');
  });

  it('suggests gear for a shoe page', () => {
    const trailShoe = shoeDatabase.find((s) => s.category === 'trail')!;
    expect(selectGearForShoe(trailShoe).length).toBeGreaterThanOrEqual(3);
  });
});

describe('landing top picks', () => {
  it('are buyable today: verified men\'s/unisex listing, a photo, not outdated', () => {
    const picks = getTopPicks();
    expect(picks.length).toBeGreaterThanOrEqual(4);
    expect(new Set(picks.map((p) => p.shoe.id)).size).toBe(picks.length);
    for (const p of picks) {
      expect(p.amazonUrl).toBe(getAmazonLinkForShoe(p.shoe.id, p.shoe.brand, p.shoe.model, p.shoe.amazonASIN));
      expect(getAmazonListingNote(p.shoe.id), p.shoe.id).toBeNull();
    }
  });
});
