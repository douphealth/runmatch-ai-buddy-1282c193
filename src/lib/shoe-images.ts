import { Shoe } from './shoe-database';
import { assetPath } from './asset-path';
import { UNVERIFIED_SHOE_IMAGE_SLUGS } from './shoe-image-audit';

/**
 * Compute a deterministic, filesystem-safe slug from brand + model.
 * Matches the slug format used by scripts/scrape-shoe-images.mjs so the
 * resolver always finds the locally cached real product photo.
 */
export function shoeImageSlug(brand: string, model: string): string {
  return `${brand}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export type ImageSource = 'real-scraped' | 'real-local' | 'studio-frame';

export interface ResolvedShoeImage {
  url: string | null;
  source: ImageSource;
  label: string;
}

/** True when the bundled photo for this shoe is not known to show a different model. */
export function hasVerifiedPhoto(shoe: Pick<Shoe, 'brand' | 'model'>): boolean {
  return !UNVERIFIED_SHOE_IMAGE_SLUGS.has(shoeImageSlug(shoe.brand, shoe.model));
}

/**
 * Resolve the best available image for a shoe.
 *
 * Priority:
 *   1. Locally bundled real product photo at /images/shoes/{slug}.jpg, unless
 *      the audit (scripts/audit-shoe-images.mjs) found that the same file is
 *      used for a different shoe, in which case the photo cannot be trusted.
 *   2. Studio frame fallback (rendered in-component, never a wrong shoe).
 *
 * The slug-based path is checked first because it is deterministic and the
 * scraper covers every shoe in the catalog. <ShoeImage> additionally falls back
 * to the studio frame on <img onError>.
 */
export function resolveShoeImage(
  shoe: Pick<Shoe, 'brand' | 'model' | 'imageURL'>,
): ResolvedShoeImage {
  if (!hasVerifiedPhoto(shoe)) {
    return { url: null, source: 'studio-frame', label: 'Studio frame' };
  }
  const slug = shoeImageSlug(shoe.brand, shoe.model);
  return {
    url: assetPath(`/images/shoes/${slug}.jpg`),
    source: 'real-scraped',
    label: 'Real Photo',
  };
}
