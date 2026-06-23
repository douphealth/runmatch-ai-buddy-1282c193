import { describe, expect, it } from 'vitest';
import { getAmazonLinkForShoe } from './amazon-link';

describe('getAmazonLinkForShoe', () => {
  it('returns a direct /dp/ URL with affiliate tag for verified cached ASINs', () => {
    expect(getAmazonLinkForShoe('nike-pegasus-41', 'Nike', 'Pegasus 41')).toBe(
      'https://www.amazon.com/dp/B0CZHK16QG/?tag=papalex-20',
    );
  });

  it('uses a valid ASIN hint only as a direct product URL', () => {
    expect(getAmazonLinkForShoe('uncached-shoe', 'Test', 'Model', 'b012345678')).toBe(
      'https://www.amazon.com/dp/B012345678/?tag=papalex-20',
    );
  });

  it('suppresses Amazon CTAs instead of emitting search URLs for missing or placeholder ASINs', () => {
    expect(getAmazonLinkForShoe('uncached-shoe', 'Test', 'Model')).toBeNull();
    expect(getAmazonLinkForShoe('uncached-shoe', 'Test', 'Model', 'SEARCH')).toBeNull();
    expect(getAmazonLinkForShoe('uncached-shoe', 'Test', 'Model', '')).toBeNull();
  });
});
