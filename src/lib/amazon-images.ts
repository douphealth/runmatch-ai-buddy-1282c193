/**
 * Product photos from Amazon listings, for shoes that have no photo of their own.
 *
 * `src/lib/amazon-image-cache.json` is written by `node scripts/amazon-catalog.mjs images`: for every
 * shoe whose bundled photo is not trustworthy (see shoe-image-audit.ts) it holds the Amazon-hosted
 * image URL of the listing we already link to, so the picture and the Buy button always show and
 * point at the same verified product. The files stay on Amazon's servers; we only keep the URL.
 *
 * An entry is used only while its ASIN is still the one in amazon-asin-cache.json, so a listing that
 * is later cleared or replaced can never leave a photo of the wrong shoe behind.
 */
import imageCache from './amazon-image-cache.json';
import { getAmazonLinkForShoe } from './amazon-link';
import { hasVerifiedPhoto, resolveShoeImage, shoeImageSlug } from './shoe-images';
import type { Shoe } from './shoe-database';

interface AmazonImageEntry {
  shoeId: string;
  asin: string;
  url: string;
  title: string;
  fetchedAt: string;
}

const CACHE = imageCache as Record<string, AmazonImageEntry>;

/** The cached Amazon listing photo for a shoe, or null when there is none or it is stale. */
export function getAmazonListingImage(shoe: Pick<Shoe, 'brand' | 'model'>): AmazonImageEntry | null {
  const entry = CACHE[shoeImageSlug(shoe.brand, shoe.model)];
  if (!entry?.url || !entry.asin) return null;
  const link = getAmazonLinkForShoe(entry.shoeId, shoe.brand, shoe.model);
  return link && link.includes(`/dp/${entry.asin}/`) ? entry : null;
}

export type ShoePhotoSource = 'local' | 'amazon';

export interface ShoePhoto {
  url: string;
  source: ShoePhotoSource;
}

/**
 * The photo to show for a shoe: our own verified photo first, otherwise the photo on its verified
 * Amazon listing, otherwise null (callers draw a labelled placeholder, never a different shoe).
 */
export function resolveShoePhoto(shoe: Pick<Shoe, 'brand' | 'model' | 'imageURL'>): ShoePhoto | null {
  if (hasVerifiedPhoto(shoe)) {
    const local = resolveShoeImage(shoe);
    return local.url ? { url: local.url, source: 'local' } : null;
  }
  const amazon = getAmazonListingImage(shoe);
  return amazon ? { url: amazon.url, source: 'amazon' } : null;
}
