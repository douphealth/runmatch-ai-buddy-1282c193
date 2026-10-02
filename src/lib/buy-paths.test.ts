import { describe, expect, it } from 'vitest';
import { shoeDatabase } from './shoe-database';
import { getAmazonLinkForShoe } from './amazon-link';
import { getBrandBuyLink } from './shoe-sources';

describe('every shoe has an honest way to buy it', () => {
  it('links to its verified Amazon listing or, failing that, to the maker', () => {
    const none: string[] = [];
    for (const s of shoeDatabase) {
      const amazon = getAmazonLinkForShoe(s.id, s.brand, s.model, s.amazonASIN);
      const brand = getBrandBuyLink(s);
      if (!amazon && !brand) none.push(s.id);
      if (amazon) expect(amazon, s.id).toMatch(/^https:\/\/www\.amazon\.com\/dp\/[A-Z0-9]{10}\/\?tag=papalex-20$/);
      if (!amazon && brand) {
        expect(brand.url, s.id).toMatch(/^https:\/\//);
        expect(brand.url, s.id).not.toMatch(/google\.|amazon\./);
      }
    }
    expect(none).toEqual([]);
  });

  it('labels the maker link by what it is', () => {
    const asics = getBrandBuyLink({ brand: 'Asics', model: 'Gel-Nimbus 29', sourceURL: undefined });
    expect(asics?.label).toBe('Find on Asics.com');
    expect(asics?.precise).toBe(false);
    const product = getBrandBuyLink({ brand: 'Nike', model: 'Pegasus 41', sourceURL: 'https://www.nike.com/t/pegasus-41' });
    expect(product).toMatchObject({ label: 'Buy from Nike', precise: true });
    expect(getBrandBuyLink({ brand: 'Li-Ning', model: 'Feidian 6 Elite', sourceURL: undefined })).toBeNull();
  });
});
