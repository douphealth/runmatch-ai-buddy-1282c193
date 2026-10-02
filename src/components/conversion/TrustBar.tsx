/**
 * Trust strip — only facts that are true and verifiable.
 *
 * Replaces the previous version, which showed a "live runner count" driven by
 * Math.random() and a hard-coded 18,420+ figure. Invented usage numbers are a
 * legal and policy risk (FTC rules on false social proof, Amazon Associates
 * terms), so this shows real properties of the tool instead, computed from the
 * database and engine.
 */
import { motion } from 'framer-motion';
import { Database, Scale, ShieldCheck, Lock } from 'lucide-react';
import { shoeDatabase } from '@/lib/shoe-database';
import { SHOE_DATABASE_LAST_UPDATED_LABEL } from '@/lib/price-tier';

interface TrustBarProps {
  variant?: 'hero' | 'compact';
  className?: string;
}

const brandCount = new Set(shoeDatabase.map((s) => s.brand.toLowerCase())).size;

const facts = [
  { icon: Database, text: `${shoeDatabase.length} shoes · ${brandCount} brands` },
  { icon: Scale, text: '9 weighted factors, fully explained' },
  { icon: ShieldCheck, text: `Data reviewed ${SHOE_DATABASE_LAST_UPDATED_LABEL}` },
  { icon: Lock, text: 'Free · no signup' },
];

const TrustBar = ({ variant = 'hero', className = '' }: TrustBarProps) => {
  if (variant === 'compact') {
    return (
      <div className={`flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground ${className}`}>
        {facts.slice(0, 3).map(({ icon: Icon, text }) => (
          <span key={text} className="flex items-center gap-1.5"><Icon className="w-3 h-3 text-primary" /> {text}</span>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className={`glass rounded-2xl px-4 py-3 md:px-6 md:py-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 ${className}`}
    >
      {facts.map(({ icon: Icon, text }) => (
        <div key={text} className="flex items-center gap-1.5 text-[10px] md:text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          <Icon className="w-3.5 h-3.5 text-primary" /> {text}
        </div>
      ))}
    </motion.div>
  );
};

export default TrustBar;
