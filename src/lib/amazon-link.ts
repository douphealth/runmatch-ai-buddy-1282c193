/**
 * Smart Amazon affiliate link builder.
 *
 * Source of truth: `src/lib/amazon-asin-cache.json`, populated by
 * `scripts/resolve-amazon-asins.mjs` which queries SerpAPI's Amazon engine
 * and validates each result title against the brand + model tokens.
 *
 * Lookup is keyed by SHOE ID (not the unreliable `amazonASIN` field on the
 * shoe record, which historically held placeholder values). When a verified
 * ASIN exists for a given shoe id, we link directly to /dp/{ASIN}. Otherwise
 * we fall back to a brand-filtered Amazon search inside the Shoes department,
 * which is guaranteed not to 404.
 *
 * Affiliate tag `papalex-20` is preserved on every URL.
 */
import asinCache from './amazon-asin-cache.json';

const AFFILIATE_TAG = 'papalex-20';

type CacheEntry = { asin: string | null; title?: string; url?: string };
const CACHE = asinCache as Record<string, CacheEntry>;

const BRAND_FILTER: Record<string, string> = {
  nike: 'Nike',
  adidas: 'adidas',
  asics: 'ASICS',
  hoka: 'HOKA',
  brooks: 'Brooks',
  saucony: 'Saucony',
  'new balance': 'New Balance',
  on: 'On',
  puma: 'PUMA',
  mizuno: 'Mizuno',
  altra: 'Altra',
  salomon: 'Salomon',
  merrell: 'Merrell',
  'topo athletic': 'Topo Athletic',
  'inov-8': 'Inov-8',
};

function buildSearchFallback(brand: string, model: string): string {
  const cleanModel = model.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  const query = encodeURIComponent(`${brand} ${cleanModel} running shoes`);
  const brandFilter = BRAND_FILTER[brand.trim().toLowerCase()];
  const params = [
    `k=${query}`,
    `i=shoes`,
    brandFilter ? `rh=${encodeURIComponent(`p_89:${brandFilter}`)}` : '',
    `tag=${AFFILIATE_TAG}`,
  ].filter(Boolean);
  return `https://www.amazon.com/s?${params.join('&')}`;
}

/**
 * Returns the verified direct /dp/ link for a shoe, falling back to a
 * brand-filtered search if no verified ASIN exists.
 *
 * `shoeId` is the canonical lookup key — it must match an entry in
 * `amazon-asin-cache.json`. The legacy `asinHint` (the `amazonASIN` field on
 * the shoe record) is accepted for backward compatibility but is NEVER used
 * unless it appears as a value in the verified cache.
 */
export function getAmazonLinkForShoe(
  shoeId: string,
  brand: string,
  model: string,
  asinHint?: string | null,
): string {
  const cached = CACHE[shoeId];
  if (cached?.asin && /^[A-Z0-9]{10}$/.test(cached.asin)) {
    return `https://www.amazon.com/dp/${cached.asin}/?tag=${AFFILIATE_TAG}`;
  }
  // Last-ditch: if the asinHint itself matches a cache entry, trust it.
  if (asinHint && /^[A-Z0-9]{10}$/i.test(asinHint)) {
    const upper = asinHint.toUpperCase();
    const verified = Object.values(CACHE).some(c => c.asin?.toUpperCase() === upper);
    if (verified) {
      return `https://www.amazon.com/dp/${upper}/?tag=${AFFILIATE_TAG}`;
    }
  }
  return buildSearchFallback(brand, model);
}

/**
 * @deprecated Use `getAmazonLinkForShoe(shoeId, brand, model)` instead — the
 * `amazonASIN` field on shoe records is unreliable. Kept only so old callers
 * still compile; routes everything through the search fallback.
 */
export function getAmazonAffiliateLink(
  brand: string,
  model: string,
  _asin?: string | null,
): string {
  return buildSearchFallback(brand, model);
}
