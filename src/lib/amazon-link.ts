/**
 * Smart Amazon affiliate link builder.
 *
 * Strategy: brand-filtered search inside the Shoes department.
 *  - Always resolves (never 404), unlike unverified /dp/{ASIN}/ links.
 *  - Lands the user 1 click from the exact product.
 *  - Preserves full affiliate credit via the `papalex-20` tag.
 *
 * If/when verified ASINs are supplied (length 10, starts with "B0", not "SEARCH"),
 * we upgrade to a direct product link automatically.
 */

const AFFILIATE_TAG = 'papalex-20';

// Brands we trust to map to Amazon's `p_89` (Brand) refinement filter.
// Amazon's brand filter uses URL-encoded brand names verbatim.
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

const isLikelyRealAsin = (asin?: string | null): boolean => {
  if (!asin) return false;
  const a = asin.trim().toUpperCase();
  if (a === 'SEARCH' || a.length !== 10) return false;
  // Must be alphanumeric, typically begins with B0
  return /^B0[A-Z0-9]{8}$/.test(a);
};

/**
 * Returns a guaranteed-working Amazon affiliate URL for the given shoe.
 * Prefers a verified /dp/ASIN link when available, otherwise falls back to a
 * brand-filtered search inside the Shoes department.
 */
export function getAmazonAffiliateLink(
  brand: string,
  model: string,
  asin?: string | null,
): string {
  if (isLikelyRealAsin(asin)) {
    return `https://www.amazon.com/dp/${asin!.trim().toUpperCase()}/?tag=${AFFILIATE_TAG}`;
  }

  const query = encodeURIComponent(`${brand} ${model} running shoes`);
  const brandKey = brand.trim().toLowerCase();
  const brandFilter = BRAND_FILTER[brandKey];

  // Department: shoes (i=shoes). Brand refinement: rh=p_89:{Brand}.
  const params = [
    `k=${query}`,
    `i=shoes`,
    brandFilter ? `rh=${encodeURIComponent(`p_89:${brandFilter}`)}` : '',
    `tag=${AFFILIATE_TAG}`,
  ].filter(Boolean);

  return `https://www.amazon.com/s?${params.join('&')}`;
}
