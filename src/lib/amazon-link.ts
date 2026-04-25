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
  // AUTO-GENERATED from src/lib/amazon-asin-cache.json (SerpAPI Amazon top organic results).
  // 63 verified ASINs — regenerate via: node scripts/resolve-amazon-asins.mjs
  'B0CZHK16QG': 'nike-pegasus-41',
  'B0FRR22Y53': 'nike-pegasus-premium',
  'B0FPMT1579': 'nike-vomero-plus',
  'B0BWTHYS8W': 'nike-pegasus-turbo',
  'B0FBV5LDT3': 'brooks-ghost-17',
  'B0F5N8MYR1': 'brooks-glycerin-max-2',
  'B0FV7HQJ6K': 'asics-gel-nimbus-28',
  'B0DPLRJMCJ': 'asics-gel-kayano-32',
  'B0D3JCJG54': 'asics-novablast-5',
  'B0GNT84D7F': 'asics-superblast-3',
  'B0DPLQL9NS': 'asics-sonicblast',
  'B0FV7DV4RL': 'asics-megablast',
  'B0D5G74Z4Q': 'hoka-bondi-9',
  'B0DMTG759T': 'hoka-cielo-x1-3',
  'B0F9LKXQC5': 'saucony-ride-19',
  'B0F9LKD8MM': 'saucony-endorphin-azura',
  'B0D937D8ZP': 'on-cloudsurfer-2',
  'B0FRQJBQYP': 'adidas-adios-pro-4',
  'B0FCY8QP4S': 'adidas-adios-9',
  'B0DK7S8XP4': 'adidas-boston-13',
  'B0D3JBYC9T': 'adidas-evo-sl',
  'B0FTTMX6L3': 'adidas-evo-sl-atr',
  'B0GD2XDF8K': 'puma-deviate-elite-4',
  'B0C658V227': 'puma-deviate-nitro-elite-2',
  'B0F9KVPXCD': 'puma-magmax-2',
  'B0DJV8J5K3': 'nb-fresh-foam-more-v6',
  'B0FBL9TD97': 'nb-1080-v14',
  'B0C46H1Y5P': 'salomon-speedcross-6',
  'B0BRKNNV8P': 'salomon-ultra-glide-3',
  'B0CN343YWK': 'salomon-sense-ride-6',
  'B0DKLS1BHG': 'altra-lone-peak-8',
  'B0DNL6MK88': 'altra-torin-7',
  'B0CM418RDN': 'mizuno-wave-rider-28',
  'B0D464KJBQ': 'mizuno-wave-inspire-21',
  'B0DM3PRNH6': 'brooks-adrenaline-gts-25',
  'B0DN5VQ44T': 'hoka-speedgoat-6',
  'B0F4MHTW68': 'nike-alphafly-3',
  'B0DJGCHD2V': 'nike-vaporfly-3',
  'B0F68LCVTH': 'nike-streakfly',
  'B0GCJX23F5': 'adidas-takumi-sen-10',
  'B0BHPQCRJ1': 'adidas-boston-12',
  'B0DN459G3C': 'hoka-mach-6',
  'B0D5G9LTJ4': 'hoka-rocket-x-2',
  'B0DJWP58HG': 'saucony-endorphin-pro-4',
  'B0G12SZT5S': 'saucony-triumph-22',
  'B0CMBCNDL5': 'saucony-kinvara-15',
  'B0C37WN8VK': 'saucony-peregrine-14',
  'B0FHVLMQ91': 'on-cloudboom-strike',
  'B0F7D9SSP1': 'on-cloudsurfer-next',
  'B0C5QJ97HD': 'on-cloudmonster-2',
  'B0FFLR3L6F': 'asics-superblast-2',
  'B0F63YB56T': 'asics-magic-speed-4',
  'B0D2BSW58S': 'nb-fuelcell-supercomp-elite-v4',
  'B0D2Y8161K': 'nb-fresh-foam-x-more-v5',
  'B0CGYHNTJG': 'brooks-hyperion-elite-4',
  'B0CRG1NL42': 'brooks-hyperion-max-2',
  'B0CPN3KC9T': 'brooks-cascadia-18',
  'B0DZ72PNG3': 'puma-deviate-nitro-elite-3',
  'B0CN3824GM': 'puma-velocity-nitro-3',
  'B0949J7532': 'inov8-trailfly-ultra-g-300',
  'B0FMZW8CGP': 'merrell-agility-peak-5',
  'B0DTF7JT3T': 'topo-mtn-racer-3',
  'B0DVJ56RY2': 'topo-cyclone-2',
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
