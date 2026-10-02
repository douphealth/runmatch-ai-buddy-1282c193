/**
 * "Popular picks" for the landing page: one shoe per category that a visitor can actually buy today.
 * A shoe qualifies only when it has a photo we can show, a verified men's/unisex Amazon listing, and no
 * newer version in our database. The order of the categories is the order on the page.
 */
import { getCategory, getCategoryShoes } from './categories';
import { getAmazonLinkForShoe, getAmazonListingNote } from './amazon-link';
import { resolveShoePhoto } from './amazon-images';
import { getNewerVersion } from './shoe-insights';
import type { Shoe } from './shoe-database';

export const TOP_PICK_CATEGORIES: { slug: string; label: string }[] = [
  { slug: 'daily-trainer', label: 'Daily trainer' },
  { slug: 'max-cushion', label: 'Max cushion' },
  { slug: 'stability', label: 'Stability' },
  { slug: 'marathon', label: 'Race day' },
  { slug: 'trail', label: 'Trail' },
  { slug: 'budget', label: 'Best value' },
];

export interface TopPick {
  categorySlug: string;
  categoryLabel: string;
  shoe: Shoe;
  amazonUrl: string;
}

export function getTopPicks(limit = 6): TopPick[] {
  const used = new Set<string>();
  const picks: TopPick[] = [];
  for (const { slug, label } of TOP_PICK_CATEGORIES) {
    const cat = getCategory(slug);
    if (!cat) continue;
    for (const shoe of getCategoryShoes(cat, 20)) {
      if (used.has(shoe.id)) continue;
      const url = getAmazonLinkForShoe(shoe.id, shoe.brand, shoe.model, shoe.amazonASIN);
      if (!url || getAmazonListingNote(shoe.id)) continue; // verified, men's/unisex listing only
      if (!resolveShoePhoto(shoe)) continue;
      if (getNewerVersion(shoe)) continue;
      used.add(shoe.id);
      picks.push({ categorySlug: slug, categoryLabel: label, shoe, amazonUrl: url });
      break;
    }
    if (picks.length >= limit) break;
  }
  return picks;
}
