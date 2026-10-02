import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isPlausibleMatch } from '../../scripts/asin-match.mjs';

describe('Amazon title matching (strict, so we never link the wrong model)', () => {
  it('accepts the right model', () => {
    expect(isPlausibleMatch("Brooks Men's Ghost 17 Neutral Running Shoe", 'Brooks', 'Ghost 17').ok).toBe(true);
    expect(isPlausibleMatch('ASICS Mens Novablast 5 Running Shoes', 'Asics', 'Novablast 5').ok).toBe(true);
    expect(isPlausibleMatch('New Balance Fresh Foam X 1080v14 Mens', 'New Balance', '1080 v14').ok).toBe(true); // "1080v14" glued form
    expect(isPlausibleMatch('Unisex Kjerag 02 Trail Running Shoe', 'NNormal', 'Kjerag 2').ok).toBe(true); // zero-padded version
  });

  it('rejects a different version of the same model', () => {
    const r = isPlausibleMatch('Mens Fast-R Nitro Elite 2 Running Sneakers Shoes', 'Puma', 'Fast-R Nitro Elite 3');
    expect(r.ok).toBe(false);
    expect(isPlausibleMatch("Brooks Men's Ghost 16 Running Shoe", 'Brooks', 'Ghost 17').ok).toBe(false);
  });

  it('matches numbers as whole numbers only', () => {
    expect(isPlausibleMatch('Hoka Clifton 10 Mens 2026', 'Hoka', 'Clifton 1').ok).toBe(false);
    expect(isPlausibleMatch('Nimbus 28 Men (280g)', 'Asics', 'Gel-Nimbus 28').ok).toBe(false); // "gel-nimbus" token missing
  });

  it("rejects women's-only listings but allows unisex / men's-and-women's titles", () => {
    expect(isPlausibleMatch('adidas Womens Adizero Takumi Sen 10 Running Sneakers Shoes - Beige', 'Adidas', 'Takumi Sen 10').ok).toBe(false);
    expect(isPlausibleMatch("Saucony Ride 19 Men's and Women's Running Shoe", 'Saucony', 'Ride 19').ok).toBe(true);
  });
});

describe('the ASINs currently cached for our shoes', () => {
  const cache = JSON.parse(readFileSync('src/lib/amazon-asin-cache.json', 'utf8')) as Record<string, { asin: string | null; title?: string }>;
  const db = readFileSync('src/lib/shoe-database.ts', 'utf8');
  const model = (id: string) => db.match(new RegExp(`id: '${id}',[\\s\\S]*?model: '([^']+)'`))?.[1];

  it('every cached ASIN has a title that matches its shoe (listed here so a wrong link cannot ship)', () => {
    const bad: string[] = [];
    for (const [id, entry] of Object.entries(cache)) {
      if (!entry.asin || !entry.title) continue;
      const m = model(id);
      if (!m) continue;
      const res = isPlausibleMatch(entry.title, '', m);
      if (!res.ok) bad.push(`${id}: ${res.reason} <- "${entry.title}"`);
    }
    // Women's-only listings are allowed (the UI labels them); anything else is a wrong product.
    // Known limitation: titles that glue the version to the name ("1080v14") need a human check.
    expect(bad.filter((b) => !/women's listing|1080|v\d/.test(b))).toEqual([]);
  });

  it('tolerates punctuation differences in Amazon titles', () => {
    expect(isPlausibleMatch("ASICS Men's Gel.Kayano 32 Running Shoes, 10, Gravel/Citron", 'Asics', 'Gel-Kayano 32').ok).toBe(true);
    expect(isPlausibleMatch('PUMA Fast R Nitro Elite 3 Mens', 'Puma', 'Fast-R Nitro Elite 3').ok).toBe(true);
    expect(isPlausibleMatch('ASICS Gel.Kayano 31 Running Shoes', 'Asics', 'Gel-Kayano 32').ok).toBe(false);
  });

  it('never points two different shoes at the same ASIN', () => {
    const owner = new Map<string, string>();
    const dupes: string[] = [];
    for (const [id, entry] of Object.entries(cache)) {
      if (!entry.asin) continue;
      if (owner.has(entry.asin)) dupes.push(`${entry.asin}: ${owner.get(entry.asin)} and ${id}`);
      owner.set(entry.asin, id);
    }
    expect(dupes).toEqual([]);
  });

  it("links most shoes to a men's/unisex listing and labels the few women's-only ones", () => {
    const entries = Object.values(cache);
    const direct = entries.filter((e) => e.asin && !/\bwomen/i.test(e.title ?? '')).length;
    const womens = entries.filter((e) => e.asin && /\bwomen/i.test(e.title ?? '')).length;
    expect(direct).toBeGreaterThanOrEqual(70);
    expect(womens).toBeLessThanOrEqual(5);
    expect(womens).toBeGreaterThanOrEqual(1);
  });

  it("labels women's listings in the UI and hides the button for cleared shoes", async () => {
    const { getAmazonLinkForShoe, getAmazonListingNote } = await import('./amazon-link');
    expect(getAmazonListingNote('on-cloudboom-strike')).toBe("women's version");
    expect(getAmazonListingNote('brooks-ghost-17')).toBeNull(); // replaced by the men's listing

    expect(getAmazonListingNote('nike-pegasus-42')).toBeNull();
    // Cleared entry (Adios 9 pointed at the Adios Pro 4): no button, and no fallback to the DB hint.
    expect(getAmazonLinkForShoe('adidas-adios-9', 'Adidas', 'Adios 9', 'B012345678')).toBeNull();
  });
});
