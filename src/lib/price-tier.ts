/**
 * Compliance helper: convert raw priceUSD into a budget tier label.
 *
 * We do NOT display hard-coded prices anywhere in the UI or PDF because:
 *  1. Amazon Operating Agreement § 5.h forbids displaying prices that are not
 *     pulled live from the Product Advertising API.
 *  2. Stale prices erode trust the moment a retailer changes them.
 *
 * Instead we surface the MSRP tier the shoe was launched at, which is stable
 * and informational rather than a price claim.
 */
export type PriceTier = 'budget' | 'mid' | 'premium' | 'super-premium';

export interface PriceTierMeta {
  tier: PriceTier;
  label: string; // e.g. "Mid-range"
  range: string; // e.g. "$130–$160 MSRP"
  short: string; // e.g. "$$"
}

export const getPriceTier = (priceUSD: number): PriceTierMeta => {
  if (priceUSD < 110) {
    return { tier: 'budget', label: 'Budget', range: 'Under $110 MSRP', short: '$' };
  }
  if (priceUSD < 160) {
    return { tier: 'mid', label: 'Mid-range', range: '$110–$160 MSRP', short: '$$' };
  }
  if (priceUSD < 220) {
    return { tier: 'premium', label: 'Premium', range: '$160–$220 MSRP', short: '$$$' };
  }
  return { tier: 'super-premium', label: 'Super-premium', range: '$220+ MSRP', short: '$$$$' };
};

/**
 * Single source of truth for the database freshness stamp shown across the
 * UI and PDF. Bump this whenever shoeDatabase entries are updated.
 */
export const SHOE_DATABASE_LAST_UPDATED = '2026-04-26';
export const SHOE_DATABASE_LAST_UPDATED_LABEL = 'April 2026';
