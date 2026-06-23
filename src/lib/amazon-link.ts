/**
 * Smart Amazon affiliate link builder.
 *
 * Source of truth: `src/lib/amazon-asin-cache.json`, populated by
 * `scripts/resolve-amazon-asins.mjs` which queries SerpAPI's Amazon engine
 * and validates each result title against the brand + model tokens.
 *
 * Lookup is keyed by SHOE ID (not the unreliable `amazonASIN` field on the
 * shoe record, which historically held placeholder values). When a verified
 * ASIN exists for a given shoe id, we link directly to /dp/{ASIN}.
 * If no verified ASIN exists, we return null. Never send users to Amazon
 * search pages from product CTAs.
 *
 * Affiliate tag `papalex-20` is preserved on every Amazon URL.
 */
import asinCache from './amazon-asin-cache.json';

const AFFILIATE_TAG = 'papalex-20';

type CacheEntry = { asin: string | null; title?: string; url?: string };
const CACHE = asinCache as Record<string, CacheEntry>;
const ASIN_RE = /^[A-Z0-9]{10}$/;

const directAmazonUrl = (asin: string): string =>
  `https://www.amazon.com/dp/${asin.toUpperCase()}/?tag=${AFFILIATE_TAG}`;

/**
 * Returns a verified direct /dp/ link for a shoe, or null when we cannot
 * confidently produce a direct product page.
 *
 * `shoeId` is the canonical lookup key — it must match an entry in
 * `amazon-asin-cache.json`. The legacy `asinHint` (the `amazonASIN` field on
 * the shoe record) is used only if it is a valid ASIN, never for placeholders
 * such as `SEARCH`.
 */
export function getAmazonLinkForShoe(
  shoeId: string,
  _brand: string,
  _model: string,
  asinHint?: string | null,
): string | null {
  const cached = CACHE[shoeId];
  if (cached?.asin && ASIN_RE.test(cached.asin.toUpperCase())) {
    return directAmazonUrl(cached.asin);
  }
  if (asinHint && ASIN_RE.test(asinHint.toUpperCase())) {
    return directAmazonUrl(asinHint);
  }
  return null;
}

/**
 * @deprecated Use `getAmazonLinkForShoe(shoeId, brand, model)` instead.
 */
export function getAmazonAffiliateLink(
  brand: string,
  model: string,
  asin?: string | null,
): string | null {
  return getAmazonLinkForShoe(`${brand}-${model}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'), brand, model, asin);
}
