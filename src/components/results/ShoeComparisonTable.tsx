import { motion } from 'framer-motion';
import { ScoredShoe } from '@/lib/scoring-engine';
import { Badge } from '@/components/ui/badge';
import ShoeImage from './ShoeImage';
import { ShoppingCart, Star, CheckCircle } from 'lucide-react';

interface ShoeComparisonTableProps {
  shoes: ScoredShoe[];
  getAmazonLink: (brand: string, model: string) => string;
}

const ShoeComparisonTable = ({ shoes, getAmazonLink }: ShoeComparisonTableProps) => {
  const specs = [
    { key: 'cushioning', label: 'Cushioning', format: (s: ScoredShoe) => `${s.shoe.cushioning}/10` },
    { key: 'drop', label: 'Drop', format: (s: ScoredShoe) => `${s.shoe.dropMM}mm` },
    { key: 'weight', label: 'Weight', format: (s: ScoredShoe) => `${s.shoe.weightGrams}g` },
    { key: 'price', label: 'Price', format: (s: ScoredShoe) => `$${s.shoe.priceUSD}` },
    { key: 'terrain', label: 'Terrain', format: (s: ScoredShoe) => s.shoe.terrain.join(', ') },
    { key: 'width', label: 'Wide Fit', format: (s: ScoredShoe) => s.shoe.widthOptions ? 'Yes' : 'No' },
  ];

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-xs md:text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-border/30">
            <th className="text-left py-3 px-2 text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Spec</th>
            {shoes.slice(0, 5).map((s, i) => (
              <th key={s.shoe.id} className="text-center py-3 px-2">
                <div className="flex flex-col items-center gap-1">
                  {i === 0 && (
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-[8px] px-1.5">#1</Badge>
                  )}
                  <span className="font-bold text-[11px] leading-tight">{s.shoe.brand}</span>
                  <span className="text-muted-foreground text-[10px]">{s.shoe.model}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border/20">
            <td className="py-3 px-2 font-medium text-muted-foreground">Match</td>
            {shoes.slice(0, 5).map((s, i) => (
              <td key={s.shoe.id} className="text-center py-3 px-2">
                <motion.span
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, type: 'spring' }}
                  className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-xs ${
                    i === 0 ? 'bg-primary/20 text-primary' : 'bg-secondary/50 text-foreground'
                  }`}
                >
                  {s.matchPercent}%
                </motion.span>
              </td>
            ))}
          </tr>
          {specs.map(spec => (
            <tr key={spec.key} className="border-b border-border/10 hover:bg-card/30 transition-colors">
              <td className="py-2.5 px-2 font-medium text-muted-foreground">{spec.label}</td>
              {shoes.slice(0, 5).map((s, i) => {
                const val = spec.format(s);
                const isHighlight = 
                  (spec.key === 'cushioning' && s.shoe.cushioning >= 8) ||
                  (spec.key === 'width' && s.shoe.widthOptions) ||
                  (spec.key === 'weight' && s.shoe.weightGrams < 240);
                return (
                  <td key={s.shoe.id} className={`text-center py-2.5 px-2 ${isHighlight ? 'text-primary font-semibold' : ''}`}>
                    {isHighlight && <CheckCircle className="w-3 h-3 inline mr-0.5 mb-0.5" />}
                    {val}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <td className="py-3 px-2"></td>
            {shoes.slice(0, 5).map(s => (
              <td key={s.shoe.id} className="text-center py-3 px-2">
                <a
                  href={getAmazonLink(s.shoe.brand, s.shoe.model)}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary hover:underline"
                >
                  <ShoppingCart className="w-3 h-3" /> Buy
                </a>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ShoeComparisonTable;
