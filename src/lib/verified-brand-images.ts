/**
 * Exact-model manufacturer image fallbacks.
 *
 * Add an entry only after verifying the product page, style/SKU, and image on
 * the manufacturer's own site. This cache is deliberately small and explicit:
 * a missing image is safer than showing a different shoe.
 */
import { shoeImageSlug } from './shoe-images';
import type { Shoe } from './shoe-database';

export interface VerifiedBrandImage {
  url: string;
  productUrl: string;
  style: string;
  verifiedAt: string;
}

const VERIFIED_BRAND_IMAGES: Readonly<Record<string, VerifiedBrandImage>> = {
  'nike-pegasus-42': {
    url: 'https://static.nike.com/a/images/t_web_pdp_936_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/022d5196-6815-4288-b922-241a4c08d983/AIR+ZOOM+PEGASUS+42+CM.png',
    productUrl: 'https://www.nike.com/t/pegasus-42-mens-road-running-shoes-YkxGlKa0/IQ0463-001',
    style: 'IQ0463-001',
    verifiedAt: '2026-10-19',
  },
};

export function getVerifiedBrandImage(
  shoe: Pick<Shoe, 'brand' | 'model'>,
): VerifiedBrandImage | null {
  return VERIFIED_BRAND_IMAGES[shoeImageSlug(shoe.brand, shoe.model)] ?? null;
}
