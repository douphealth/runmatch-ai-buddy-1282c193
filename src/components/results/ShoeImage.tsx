import { useState } from 'react';
import { motion } from 'framer-motion';
import { Footprints } from 'lucide-react';

interface ShoeImageProps {
  brand: string;
  model: string;
  imageURL?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Brand-specific accent colors (HSL, themed)
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
  sm: { container: 'h-32', icon: 'w-10 h-10', brand: 'text-[10px]', model: 'text-xs' },
  md: { container: 'h-44', icon: 'w-14 h-14', brand: 'text-xs', model: 'text-sm' },
  lg: { container: 'h-56 md:h-64', icon: 'w-20 h-20', brand: 'text-sm', model: 'text-lg md:text-xl' },
};

const ShoeImage = ({ brand, model, imageURL, size = 'md', className = '' }: ShoeImageProps) => {
  const [imgError, setImgError] = useState(false);
  const accent = brandAccent[brand] || 'from-primary/30 via-primary/10 to-transparent';
  const s = sizeMap[size];

  const showRealImage = imageURL && !imgError;

  return (
    <div className={`relative w-full ${s.container} rounded-xl overflow-hidden bg-gradient-to-br from-card via-card to-secondary/30 border border-border/40 ${className}`}>
      {/* Brand-tinted radial glow */}
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-80`} />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {showRealImage ? (
        <img
          src={imageURL}
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

      {/* Glossy top sheen */}
      <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />
      {/* Bottom shadow */}
      <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
    </div>
  );
};

export default ShoeImage;
