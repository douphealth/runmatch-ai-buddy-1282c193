import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { shoeDatabase, type Shoe } from '@/lib/shoe-database';
import { CURRENT_SHOE_ISSUES, getNewerVersion } from '@/lib/shoe-insights';
import type { QuizAnswers } from '@/lib/quiz-data';

interface CurrentShoePickerProps {
  answers: QuizAnswers;
  setAnswer: (key: string, value: string | number | string[]) => void;
}

const label = (s: Shoe) => `${s.brand} ${s.model}`;

/** Newest first, then alphabetical, so popular current-gen shoes surface before search. */
const SORTED = [...shoeDatabase].sort((a, b) => b.year - a.year || label(a).localeCompare(label(b)));

/**
 * Optional quiz step: "a shoe you already know". Selecting one adds a
 * "rides like my current shoe" factor and, together with what the runner
 * dislikes about it, reshapes the ranking. Skipping leaves scoring unchanged.
 */
const CurrentShoePicker = ({ answers, setAnswer }: CurrentShoePickerProps) => {
  const [query, setQuery] = useState('');
  const selected = answers.currentShoe ? shoeDatabase.find((s) => s.id === answers.currentShoe) : undefined;
  const issues = answers.currentShoeIssues ?? [];

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? SORTED.filter((s) => label(s).toLowerCase().includes(q) || s.model.toLowerCase().includes(q))
      : SORTED;
    return list.slice(0, 8);
  }, [query]);

  const toggleIssue = (value: string) => {
    if (value === 'none') {
      setAnswer('currentShoeIssues', issues.includes('none') ? [] : ['none']);
      return;
    }
    const without = issues.filter((i) => i !== 'none');
    setAnswer('currentShoeIssues', without.includes(value) ? without.filter((i) => i !== value) : [...without, value]);
  };

  const newer = selected ? getNewerVersion(selected) : undefined;

  return (
    <div className="space-y-5">
      {selected ? (
        <div className="glass rounded-2xl p-4 flex items-center justify-between gap-3 border border-primary/30">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Your current shoe</p>
            <p className="font-bold truncate">{label(selected)}</p>
            {newer && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Note: a newer version, the {label(newer)}, is in our database and will be considered.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setAnswer('currentShoe', '');
              setAnswer('currentShoeIssues', []);
            }}
            className="shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border/50 rounded-full px-3 py-1.5"
            aria-label={`Remove ${label(selected)}`}
          >
            <X className="w-3 h-3" /> Change
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${shoeDatabase.length} shoes, e.g. "Pegasus" or "Ghost"`}
              aria-label="Search running shoes"
              className="pl-11 h-12 md:h-14 text-base bg-card/50 border-border/50 rounded-xl focus:border-primary"
            />
          </div>
          <ul className="grid gap-2" role="listbox" aria-label="Matching shoes">
            {matches.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => setAnswer('currentShoe', s.id)}
                  className="w-full flex items-center justify-between gap-3 text-left p-3 rounded-xl border border-border/50 bg-card/30 hover:border-primary/40 hover:bg-card/60 transition-all"
                >
                  <span className="font-semibold text-sm truncate">{label(s)}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{s.year}</span>
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="text-center text-sm text-muted-foreground py-4 glass rounded-xl">
                No match. You can skip this step.
              </li>
            )}
          </ul>
          <p className="text-xs text-muted-foreground text-center">
            Don&rsquo;t see yours, or starting from scratch? Just continue. This step is optional.
          </p>
        </>
      )}

      {selected && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-medium">
            Anything you&rsquo;d change about it? (optional)
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CURRENT_SHOE_ISSUES.map((opt) => {
              const on = issues.includes(opt.value);
              return (
                <motion.button
                  key={opt.value}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => toggleIssue(opt.value)}
                  aria-pressed={on}
                  className={`relative text-left p-3 rounded-xl border-2 text-sm transition-all ${
                    on ? 'border-primary bg-primary/10' : 'border-border/50 bg-card/40 hover:border-primary/40'
                  }`}
                >
                  {opt.label}
                  {on && <Check className="absolute top-2.5 right-2.5 w-4 h-4 text-primary" />}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CurrentShoePicker;
