import type { Shoe } from './shoe-database';

/**
 * Best-effort manufacturer source URL when a shoe entry doesn't have an
 * explicit `sourceURL`. Used by the verification chip so every shoe links
 * out to a first-party page where specs can be cross-checked.
 */
export const getManufacturerSourceURL = (shoe: Pick<Shoe, 'brand' | 'model' | 'sourceURL'>): string => {
  if (shoe.sourceURL) return shoe.sourceURL;
  const brand = shoe.brand.toLowerCase();
  const q = encodeURIComponent(`${shoe.brand} ${shoe.model}`);
  // Brand domain shortcuts where their on-site search reliably surfaces the model page
  const brandHosts: Record<string, string> = {
    'nike': 'https://www.nike.com',
    'adidas': 'https://www.adidas.com',
    'asics': 'https://www.asics.com',
    'brooks': 'https://www.brooksrunning.com',
    'hoka': 'https://www.hoka.com',
    'saucony': 'https://www.saucony.com',
    'new balance': 'https://www.newbalance.com',
    'mizuno': 'https://www.mizunousa.com',
    'on': 'https://www.on.com',
    'on running': 'https://www.on.com',
    'altra': 'https://www.altrarunning.com',
    'salomon': 'https://www.salomon.com',
    'nnormal': 'https://www.nnormal.com',
    'puma': 'https://us.puma.com',
    'under armour': 'https://www.underarmour.com',
    'topo': 'https://www.topoathletic.com',
    'topo athletic': 'https://www.topoathletic.com',
    'merrell': 'https://www.merrell.com',
    'la sportiva': 'https://www.lasportiva.com',
    'inov-8': 'https://www.inov-8.com',
  };
  const host = brandHosts[brand];
  if (host) return `${host}/search?q=${q}`;
  // Generic fallback: Google search scoped to the brand name + "running shoe"
  return `https://www.google.com/search?q=${q}+running+shoe+specs`;
};

/**
 * Whether the shoe's specs are considered "fresh" (verified within the
 * last 180 days). Returns true when the date is missing — we don't want
 * to red-flag every shoe in the absence of explicit verification yet,
 * since the database itself was bulk-verified at the SHOE_DATABASE_LAST_UPDATED stamp.
 */
export const isShoeFresh = (shoe: Pick<Shoe, 'lastVerified'>): boolean => {
  if (!shoe.lastVerified) return true;
  const verified = new Date(shoe.lastVerified).getTime();
  if (Number.isNaN(verified)) return true;
  const ageDays = (Date.now() - verified) / (1000 * 60 * 60 * 24);
  return ageDays <= 180;
};
