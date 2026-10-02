import { ExternalLink } from 'lucide-react';
import { getBrandBuyLink } from '@/lib/shoe-sources';
import { track } from '@/lib/analytics';
import type { Shoe } from '@/lib/shoe-database';

interface BrandBuyButtonProps {
  shoe: Pick<Shoe, 'id' | 'brand' | 'model' | 'sourceURL'>;
  /** Where the button sits, for analytics (e.g. `brand-asics`, `shoe-detail-hero`). */
  placement: string;
  className?: string;
}

/**
 * Buy path for a shoe that has no verified Amazon listing: the maker's own site.
 * Not an affiliate link, so no `sponsored`. Renders nothing when we have no maker link to offer.
 */
const BrandBuyButton = ({ shoe, placement, className = '' }: BrandBuyButtonProps) => {
  const link = getBrandBuyLink(shoe);
  if (!link) return null;
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track.ctaClick(`brand_site_${shoe.id}`, placement)}
      className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition ${className}`}
    >
      {link.label} <ExternalLink className="w-3.5 h-3.5" />
    </a>
  );
};

export default BrandBuyButton;
