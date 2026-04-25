/**
 * Smart Amazon affiliate link builder.
 *
 * IMPORTANT: Most ASINs in our shoe database are unverified placeholders that
 * happen to match the `B0XXXXXXXX` shape. Linking to /dp/{ASIN} for those
 * results in 404s. To guarantee every link works, we default to a
 * brand-filtered search inside the Shoes department, which:
 *  - Never 404s.
 *  - Lands the user 1 click from the exact product.
 *  - Preserves full affiliate credit via the `papalex-20` tag.
 *
 * Only ASINs explicitly listed in `VERIFIED_ASINS` below are upgraded to
 * direct /dp/ product links. Add ASINs here only after manually confirming
 * they resolve to the correct live product on amazon.com.
 */

const AFFILIATE_TAG = 'papalex-20';

/**
 * Allowlist of human-verified ASINs.
 * Key: uppercase ASIN. Value: short note for maintainer reference.
 * Add entries ONLY after opening https://www.amazon.com/dp/{ASIN} and
 * confirming it shows the correct, in-stock product.
 */
const VERIFIED_ASINS: Record<string, string> = {
  // (empty — populate as ASINs are verified on amazon.com)
};

// Brands we trust to map to Amazon's `p_89` (Brand) refinement filter.
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

const isVerifiedAsin = (asin?: string | null): boolean => {
  if (!asin) return false;
  const a = asin.trim().toUpperCase();
  if (a === 'SEARCH' || a.length !== 10) return false;
  return Object.prototype.hasOwnProperty.call(VERIFIED_ASINS, a);
};

/**
 * Returns a guaranteed-working Amazon affiliate URL for the given shoe.
 * Uses a verified /dp/ASIN link if (and only if) the ASIN is in our
 * human-verified allowlist; otherwise falls back to a brand-filtered search
 * inside the Shoes department.
 */
export function getAmazonAffiliateLink(
  brand: string,
  model: string,
  asin?: string | null,
): string {
  if (isVerifiedAsin(asin)) {
    return `https://www.amazon.com/dp/${asin!.trim().toUpperCase()}/?tag=${AFFILIATE_TAG}`;
  }

  // Strip parenthetical qualifiers like "(Wide)" that hurt search relevance.
  const cleanModel = model.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  const query = encodeURIComponent(`${brand} ${cleanModel} running shoes`);
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
