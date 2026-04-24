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
}

const brandAccent: Record<string, string> = {
  Nike: 'from-orange-500/30 via-red-500/20 to-transparent',
  Brooks: 'from-blue-500/30 via-cyan-500/20 to-transparent',
  ASICS: 'from-blue-600/30 via-indigo-500/20 to-transparent',
  Hoka: 'from-pink-500/30 via-orange-400/20 to-transparent',
  Saucony: 'from-yellow-500/30 via-orange-500/20 to-transparent',
  On: 'from-cyan-500/30 via-blue-400/20 to-transparent',
  Adidas: 'from-emerald-500/30 via-teal-400/20 to-transparent',
  Puma: 'from-red-500/30 via-pink-500/20 to-transparent',
  'New Balance': 'from-gray-400/30 via-slate-400/20 to-transparent',
  Salomon: 'from-red-600/30 via-orange-500/20 to-transparent',
  Altra: 'from-purple-500/30 via-pink-500/20 to-transparent',
  Mizuno: 'from-blue-700/30 via-indigo-600/20 to-transparent',
};

const sizeMap = {
  sm: { container: 'h-32', icon: 'w-10 h-10', brand: 'text-[10px]', model: 'text-xs', badge: 'text-[8px] px-1.5 py-0.5' },
  md: { container: 'h-44', icon: 'w-14 h-14', brand: 'text-xs', model: 'text-sm', badge: 'text-[9px] px-2 py-0.5' },
  lg: { container: 'h-56 md:h-64', icon: 'w-20 h-20', brand: 'text-sm', model: 'text-lg md:text-xl', badge: 'text-[10px] px-2 py-1' },
};

const ShoeImage = ({ brand, model, imageURL, amazonASIN: _asin, size = 'md', className = '', showSourceBadge = true }: ShoeImageProps) => {
  const resolved = resolveShoeImage({ brand, model, imageURL: imageURL || '' });
  const [imgError, setImgError] = useState(false);

  const accent = brandAccent[brand] || 'from-primary/30 via-primary/10 to-transparent';
  const s = sizeMap[size];

  // Falls back to studio frame if the scraped/local image fails to load
  const effectiveSource: ImageSource = imgError || !resolved.url ? 'studio-frame' : resolved.source;
  const showRealImage = resolved.url && !imgError;

  return (
    <div className={`relative w-full ${s.container} rounded-xl overflow-hidden bg-gradient-to-br from-card via-card to-secondary/30 border border-border/40 ${className}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-80`} />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {showRealImage ? (
        <img
          src={resolved.url!}
          alt={`${brand} ${model} running shoe`}
          loading="lazy"
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-contain p-3 drop-shadow-2xl"
        />
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

      {/* Image source badge */}
      {showSourceBadge && (
        <div
          className={`absolute top-2 right-2 ${s.badge} font-bold uppercase tracking-wider rounded-md backdrop-blur-md flex items-center gap-1 z-10 ${
            effectiveSource === 'studio-frame'
              ? 'bg-secondary/70 text-muted-foreground border border-border/40'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
          }`}
          title={effectiveSource === 'studio-frame' ? 'Branded studio frame fallback' : 'Real product photo from Amazon CDN'}
        >
          {effectiveSource === 'studio-frame' ? (
            <><Sparkles className="w-2.5 h-2.5" /> Studio</>
          ) : (
            <><Camera className="w-2.5 h-2.5" /> Real Photo</>
          )}
        </div>
      )}

      <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
    </div>
  );
};

export default ShoeImage;
