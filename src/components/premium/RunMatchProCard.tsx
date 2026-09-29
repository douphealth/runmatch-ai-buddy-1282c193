import { useCallback, useEffect, useState } from 'react';
import { Crown, Download, Loader2, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  cleanupCheckoutParams,
  getRunMatchProProduct,
  RunMatchProEntitlement,
  RunMatchProProduct,
  startRunMatchProCheckout,
  verifyRunMatchPro,
} from '@/lib/runmatch-pro';
import { track } from '@/lib/analytics';

type Props = {
  slug: string;
  onDownloadPro: () => void;
};

const FREE_ENTITLEMENT: RunMatchProEntitlement = {
  active: false,
  status: 'free',
  mode: null,
  currentPeriodEnd: null,
};

export default function RunMatchProCard({ slug, onDownloadPro }: Props) {
  const [product, setProduct] = useState<RunMatchProProduct | null>(null);
  const [entitlement, setEntitlement] = useState<RunMatchProEntitlement>(FREE_ENTITLEMENT);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const url = new URL(window.location.href);
      const checkoutState = url.searchParams.get('checkout');
      const sessionId = url.searchParams.get('session_id');

      try {
        const [productResult, entitlementResult] = await Promise.all([
          getRunMatchProProduct(),
          verifyRunMatchPro(checkoutState === 'success' ? sessionId : undefined).catch(() => FREE_ENTITLEMENT),
        ]);

        if (cancelled) return;
        setProduct(productResult);
        setEntitlement(entitlementResult);

        if (checkoutState === 'success') {
          if (entitlementResult.active) {
            track.proCheckoutSuccess({ slug, mode: entitlementResult.mode || 'payment' });
            toast.success('RunMatch Pro is unlocked on this browser.');
          } else {
            toast.info('Payment received. Access is still being verified; refresh in a moment.');
          }
        } else if (checkoutState === 'cancelled') {
          toast.info('Checkout cancelled. Your free RunMatch result is unchanged.');
        }
      } catch (error) {
        console.error('RunMatch Pro status check failed', error);
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (checkoutState === 'success' || checkoutState === 'cancelled') {
        const next = cleanupCheckoutParams(url.searchParams);
        const query = next.toString();
        window.history.replaceState({}, '', `${url.pathname}${query ? `?${query}` : ''}${url.hash}`);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const startCheckout = useCallback(async () => {
    setCheckoutLoading(true);
    track.proCheckoutStart({ slug, mode: product?.mode || 'payment' });
    try {
      await startRunMatchProCheckout(slug);
    } catch (error) {
      console.error('RunMatch Pro checkout failed', error);
      toast.error(error instanceof Error ? error.message : 'Unable to start secure checkout');
      setCheckoutLoading(false);
    }
  }, [product?.mode, slug]);

  const download = useCallback(async () => {
    try {
      const verified = await verifyRunMatchPro();
      setEntitlement(verified);
      if (!verified.active) {
        toast.error('RunMatch Pro access could not be verified. Paid content remains locked.');
        return;
      }
      track.proPackDownload({ slug });
      onDownloadPro();
    } catch (error) {
      console.error('RunMatch Pro entitlement re-check failed', error);
      toast.error('Could not verify RunMatch Pro. Please try again.');
    }
  }, [onDownloadPro, slug]);

  if (loading) {
    return (
      <div className="glass rounded-2xl p-5 md:p-7 border border-primary/20 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <div>
          <p className="font-semibold">Checking RunMatch Pro access</p>
          <p className="text-xs text-muted-foreground">Secure entitlement verification</p>
        </div>
      </div>
    );
  }

  // Stripe is deliberately fail-open for the free app. If the product/secrets
  // are not deployed yet, no broken upgrade CTA is shown.
  if (!product && !entitlement.active) return null;

  if (entitlement.active) {
    return (
      <section className="glass rounded-2xl p-5 md:p-8 border border-primary/30" aria-labelledby="runmatch-pro-heading">
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Crown className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 id="runmatch-pro-heading" className="text-xl md:text-2xl font-bold uppercase tracking-tight">
                RunMatch Pro Unlocked
              </h2>
              <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/20">
                Verified
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Download your buyer-focused decision pack with the Top-5 matrix, rotation plan, and structured try-on protocol.
            </p>
          </div>
          <Button onClick={download} className="bg-gradient-primary glow-primary font-bold gap-2 md:min-w-48">
            <Download className="w-4 h-4" />
            Download Pro Pack
          </Button>
        </div>
      </section>
    );
  }

  if (!product) return null;

  const billingText = product.mode === 'subscription' && product.interval
    ? `${product.priceLabel || 'Paid'} / ${product.interval}`
    : product.priceLabel || 'Secure checkout';

  return (
    <section className="glass rounded-2xl p-5 md:p-8 border border-primary/25 relative overflow-hidden" aria-labelledby="runmatch-pro-heading">
      <div className="absolute -top-20 -right-20 w-56 h-56 bg-primary/10 rounded-full blur-[90px] pointer-events-none" />
      <div className="relative grid md:grid-cols-[1fr_auto] gap-6 items-center">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-primary font-bold">Optional paid add-on</p>
              <h2 id="runmatch-pro-heading" className="text-xl md:text-2xl font-bold uppercase tracking-tight">
                {product.name || 'RunMatch Pro'}
              </h2>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mb-4">
            {product.description || 'Turn your free recommendation into a compact buyer decision pack you can use in-store or at home.'}
          </p>
          <ul className="grid sm:grid-cols-3 gap-2 text-xs">
            {[
              'Top-5 decision matrix',
              'Role-based shoe rotation',
              'Structured try-on protocol',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2 rounded-lg bg-card/40 border border-border/50 px-3 py-2">
                <ShieldCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Your quiz, recommendation, Top-5 comparison, and standard PDF remain free.
          </p>
        </div>

        <div className="md:text-right md:min-w-52">
          <div className="font-bold text-2xl mb-1">{billingText}</div>
          <p className="text-[11px] text-muted-foreground mb-3">
            Payment handled securely by Stripe.
          </p>
          <Button
            onClick={startCheckout}
            disabled={checkoutLoading}
            className="w-full bg-gradient-primary glow-primary font-bold gap-2"
          >
            {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LockKeyhole className="w-4 h-4" />}
            {checkoutLoading ? 'Opening Checkout…' : 'Unlock RunMatch Pro'}
          </Button>
        </div>
      </div>
    </section>
  );
}
