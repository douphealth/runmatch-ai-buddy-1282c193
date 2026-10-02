import { describe, expect, it, vi } from 'vitest';
import imageCache from './amazon-image-cache.json';
import asinCache from './amazon-asin-cache.json';
import { getAmazonListingImage, resolveShoePhoto } from './amazon-images';
import { hasVerifiedPhoto } from './shoe-images';
import { shoeDatabase } from './shoe-database';

type ImageEntry = { shoeId: string; asin: string; url: string; title: string };
const images = imageCache as Record<string, ImageEntry>;
const asins = asinCache as Record<string, { asin: string | null }>;
const byId = (id: string) => shoeDatabase.find((s) => s.id === id)!;

describe('Amazon listing photos', () => {
  it('are Amazon-hosted URLs for the same ASIN we link to', () => {
    for (const [slug, e] of Object.entries(images)) {
      expect(e.url, slug).toMatch(/^https:\/\/m\.media-amazon\.com\/images\/I\/[\w%+.-]+\.jpg$/);
      expect(asins[e.shoeId]?.asin, `${slug}: photo is for ${e.asin} but the Buy button goes elsewhere`).toBe(e.asin);
    }
  });

  it('fill the gap for shoes whose own photo cannot be trusted', () => {
    const shoe = byId('mizuno-wave-inspire-21');
    expect(hasVerifiedPhoto(shoe)).toBe(false);
    const photo = resolveShoePhoto(shoe);
    expect(photo?.source).toBe('amazon');
    expect(photo?.url).toContain('m.media-amazon.com');
  });

  it('never replace a verified local photo', () => {
    const photo = resolveShoePhoto(byId('brooks-ghost-17'));
    expect(photo?.source).toBe('local');
    expect(photo?.url).toContain('/images/shoes/brooks-ghost-17.jpg');
  });

  it('are not invented for shoes Amazon does not list', () => {
    const none = shoeDatabase.filter((s) => !hasVerifiedPhoto(s) && !asins[s.id]?.asin);
    expect(none.length).toBeGreaterThan(0);
    for (const s of none) expect(resolveShoePhoto(s), s.id).toBeNull();
  });

  it('are ignored once the ASIN behind them changes', async () => {
    vi.resetModules();
    vi.doMock('./amazon-link', () => ({ getAmazonLinkForShoe: () => 'https://www.amazon.com/dp/B000000000/?tag=x' }));
    const mod = await import('./amazon-images');
    expect(mod.getAmazonListingImage(byId('mizuno-wave-inspire-21'))).toBeNull();
    vi.doUnmock('./amazon-link');
    vi.resetModules();
    expect(getAmazonListingImage(byId('mizuno-wave-inspire-21'))).not.toBeNull();
  });
});
