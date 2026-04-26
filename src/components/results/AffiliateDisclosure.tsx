import { Info } from 'lucide-react';

interface AffiliateDisclosureProps {
  variant?: 'inline' | 'banner' | 'footer';
}

/**
 * FTC-compliant affiliate disclosure.
 * Required by 16 CFR Part 255 to appear "clearly and conspicuously" near
 * any affiliate link cluster — not buried in a footer.
 *
 * Variants:
 *  - banner: full-width call-out, used near the top CTA
 *  - inline: compact line, used inside cards next to Buy buttons
 *  - footer: small grey print at the page bottom
 */
const AffiliateDisclosure = ({ variant = 'inline' }: AffiliateDisclosureProps) => {
  if (variant === 'banner') {
    return (
      <div className="glass rounded-xl border border-primary/20 px-4 py-3 flex items-start gap-3 text-xs md:text-sm">
        <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Affiliate disclosure:</span>{' '}
          As an Amazon Associate, GearUpToFit earns from qualifying purchases.
          Some links on this page are affiliate links — we may earn a small commission
          if you buy through them, at no extra cost to you. Prices and availability
          shown on Amazon are live and may differ from the MSRP shown here.
        </p>
      </div>
    );
  }

  if (variant === 'footer') {
    return (
      <p className="text-[11px] text-muted-foreground leading-relaxed max-w-2xl mx-auto text-center">
        <span className="font-semibold">Affiliate disclosure:</span>{' '}
        As an Amazon Associate, GearUpToFit earns from qualifying purchases.
        Some links are affiliate links — at no extra cost to you. We never
        recommend a shoe based on commission; rankings are produced by our
        deterministic scoring engine.
      </p>
    );
  }

  return (
    <p className="text-[10px] text-muted-foreground leading-snug flex items-center gap-1">
      <Info className="w-3 h-3 flex-shrink-0" />
      Affiliate link — we may earn a commission at no cost to you.
    </p>
  );
};

export default AffiliateDisclosure;
