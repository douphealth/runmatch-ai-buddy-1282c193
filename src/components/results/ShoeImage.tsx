import { useState } from 'react';
import { motion } from 'framer-motion';
import { Footprints, Camera, Sparkles } from 'lucide-react';
import { resolveShoeImage, type ImageSource } from '@/lib/shoe-images';

interface ShoeImageProps {
  brand: string;
  model: string;
  imageURL?: string;
  amazonASIN?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showSourceBadge?: boolean;
  /** Disable hover/parallax interactions (useful inside dense grids/tables) */
  interactive?: boolean;
}

/**
 * Brand-tinted radial glow rendered behind the shoe to give a high-end
 * "studio capture" feel. Tuned for the dark theme — colors are kept soft so
 * they read as ambient light rather than a flat wash.
 */
const brandAccent: Record<string, string> = {
  Nike: 'from-orange-500/25 via-red-500/15 to-transparent',
  Brooks: 'from-blue-500/25 via-cyan-500/15 to-transparent',
  ASICS: 'from-blue-600/25 via-indigo-500/15 to-transparent',
  Hoka: 'from-pink-500/25 via-orange-400/15 to-transparent',
  Saucony: 'from-yellow-500/25 via-orange-500/15 to-transparent',
  On: 'from-cyan-500/25 via-blue-400/15 to-transparent',
  Adidas: 'from-emerald-500/25 via-teal-400/15 to-transparent',
  Puma: 'from-red-500/25 via-pink-500/15 to-transparent',
  'New Balance': 'from-gray-400/25 via-slate-400/15 to-transparent',
  Salomon: 'from-red-600/25 via-orange-500/15 to-transparent',
  Altra: 'from-purple-500/25 via-pink-500/15 to-transparent',
  Mizuno: 'from-blue-700/25 via-indigo-600/15 to-transparent',
};

/**
 * Mobile-first sizing. Each tier defines:
 *  - container: aspect-ratio driven height that scales between mobile and md+
 *  - icon/brand/model: fallback frame typography
 *  - badge: corner pill scale
 *  - pad: image padding so the shoe never kisses the frame edges
 */
const sizeMap = {
  sm: {
    container: 'aspect-[4/3] min-h-[120px]',
    icon: 'w-10 h-10',
    brand: 'text-[10px]',
    model: 'text-xs',
    badge: 'text-[8px] px-1.5 py-0.5',
    pad: 'p-2.5',
  },
  md: {
    container: 'aspect-[4/3] min-h-[180px]',
    icon: 'w-14 h-14',
    brand: 'text-xs',
    model: 'text-sm',
    badge: 'text-[9px] px-2 py-0.5',
    pad: 'p-4',
  },
  lg: {
    container: 'aspect-[4/3] min-h-[240px] md:min-h-[300px]',
    icon: 'w-20 h-20',
    brand: 'text-sm',
    model: 'text-lg md:text-xl',
    badge: 'text-[10px] px-2.5 py-1',
    pad: 'p-5 md:p-7',
  },
} as const;

const ShoeImage = ({
  brand,
  model,
  imageURL,
  amazonASIN: _asin,
  size = 'md',
  className = '',
  showSourceBadge = true,
  interactive = true,
}: ShoeImageProps) => {
  const resolved = resolveShoeImage({ brand, model, imageURL: imageURL || '' });
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const accent = brandAccent[brand] || 'from-primary/25 via-primary/10 to-transparent';
  const s = sizeMap[size];

  const effectiveSource: ImageSource = imgError || !resolved.url ? 'studio-frame' : resolved.source;
  const showRealImage = resolved.url && !imgError;

  return (
    <motion.div
      whileHover={interactive ? { scale: 1.015 } : undefined}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={`group relative w-full ${s.container} rounded-2xl overflow-hidden border border-border/40 ${className}`}
      style={{
        background:
          'radial-gradient(ellipse at 50% 30%, #ffffff 0%, #f4f6fa 55%, #dde2ec 100%)',
        boxShadow:
          '0 1px 0 hsla(0,0%,100%,0.6) inset, 0 12px 30px -16px rgba(0,0,0,0.45)',
      }}
    >
      {/* Brand-colored ambient glow */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-50 pointer-events-none transition-opacity duration-500 group-hover:opacity-70`}
      />

      {/* Soft studio vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 110%, rgba(0,0,0,0.18) 0%, transparent 55%)',
        }}
      />

      {/* Floor contact shadow under the shoe */}
      <div className="absolute inset-x-[12%] bottom-[8%] h-3 bg-black/30 blur-2xl rounded-full" />

      {showRealImage ? (
        <>
          {/* Skeleton shimmer until the image is decoded */}
          {!imgLoaded && (
            <div className="absolute inset-0 shimmer bg-gradient-to-br from-slate-200/40 to-slate-300/40" />
          )}
          <motion.img
            src={resolved.url!}
            alt={`${brand} ${model} running shoe`}
            loading="lazy"
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            initial={{ opacity: 0, scale: 0.94, y: 6 }}
            animate={imgLoaded ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.94, y: 6 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            whileHover={interactive ? { scale: 1.05, rotate: -1.5, y: -4 } : undefined}
            className={`absolute inset-0 w-full h-full object-contain ${s.pad} drop-shadow-[0_18px_22px_rgba(0,0,0,0.28)] will-change-transform`}
            style={{
              filter: 'contrast(1.06) saturate(1.12) brightness(1.02)',
              transition: 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className={`${s.icon} rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-2 backdrop-blur-sm`}
          >
            <Footprints className="w-1/2 h-1/2 text-primary" strokeWidth={1.5} />
          </motion.div>
          <div className={`${s.brand} font-bold uppercase tracking-[0.2em] text-primary/90`}>{brand}</div>
          <div className={`${s.model} font-bold text-foreground leading-tight max-w-full px-2`}>{model}</div>
        </div>
      )}

      {/* Premium top sheen */}
      <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/[0.5] via-white/[0.08] to-transparent pointer-events-none mix-blend-overlay" />

      {/* Inner border highlight */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none ring-1 ring-inset ring-white/10" />

      {/* Source badge */}
      {showSourceBadge && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className={`absolute top-2 right-2 ${s.badge} font-bold uppercase tracking-wider rounded-md backdrop-blur-md flex items-center gap-1 z-10 shadow-sm ${
            effectiveSource === 'studio-frame'
              ? 'bg-secondary/80 text-muted-foreground border border-border/40'
              : 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
          }`}
          title={effectiveSource === 'studio-frame' ? 'Branded studio frame fallback' : 'Real product photo'}
        >
          {effectiveSource === 'studio-frame' ? (
            <><Sparkles className="w-2.5 h-2.5" /> Studio</>
          ) : (
            <><Camera className="w-2.5 h-2.5" /> Real Photo</>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};

export default ShoeImage;
