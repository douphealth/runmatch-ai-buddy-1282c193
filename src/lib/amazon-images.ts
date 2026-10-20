/**
 * Product photos from the Amazon listing each Buy button opens.
 *
 * `src/lib/amazon-image-cache.json` is written by `node scripts/amazon-catalog.mjs images --all`: for every
 * shoe with a verified Amazon listing it holds the Amazon-hosted image URL of THAT listing, so the picture
 * and the Buy button always show and point at the same product. The files stay on Amazon's servers; we only
 * keep the URL.
 *
 * An entry is used only while its ASIN is still the one in amazon-asin-cache.json, so a listing that
 * is later cleared or replaced can never leave a photo of the wrong shoe behind.
 *
 * Why Amazon first: the bundled photos in public/images/shoes were collected by a scrape and are only
 * checked for byte-duplicates, not for showing the right model, colourway or gender. The Amazon listing
 * photo is the one thing we know matches the product a visitor is sent to.
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
 * The photo to show for a shoe: the photo on its verified Amazon listing first (it is the product the Buy
 * button opens), otherwise our own bundled photo when it is known not to be a duplicate, otherwise null
 * (callers draw a labelled placeholder, never a different shoe).
 */
export function resolveShoePhoto(shoe: Pick<Shoe, 'brand' | 'model' | 'imageURL'>): ShoePhoto | null {
  const amazon = getAmazonListingImage(shoe);
  if (amazon) return { url: amazon.url, source: 'amazon' };
  if (hasVerifiedPhoto(shoe)) {
    const local = resolveShoeImage(shoe);
    return local.url ? { url: local.url, source: 'local' } : null;
  }
  return null;
}

/** True when some trustworthy photo exists (used by the indexability gates). */
export const hasShoePhoto = (shoe: Pick<Shoe, 'brand' | 'model' | 'imageURL'>): boolean => resolveShoePhoto(shoe) !== null;

/** Absolute URL of the shoe's photo for social cards and structured data, or null. */
export function shoePhotoAbsoluteUrl(
  shoe: Pick<Shoe, 'brand' | 'model' | 'imageURL'>,
  toAbsolute: (path: string) => string | null,
): string | null {
  const photo = resolveShoePhoto(shoe);
  if (!photo) return null;
  return /^https?:\/\//i.test(photo.url) ? photo.url : toAbsolute(photo.url);
}
