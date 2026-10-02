import { LANDING_FAQS, RELATED_GUIDES } from '@/lib/landing-content';

/**
 * Visible SEO/AEO content section that renders below the hero on the landing page.
 * Provides crawlable explanatory content, internal links, FAQ, and disclaimer.
 * Intentionally low-visual-weight so it does not distort the hero experience.
 * The FAQ text comes from landing-content.ts, the same source as the FAQPage JSON-LD.
 */
const SEOContent = () => {
  return (
    <section className="relative z-10 bg-background border-t border-border/40 px-4 py-12 md:py-16">
      <div className="max-w-3xl mx-auto space-y-10 text-sm md:text-base text-muted-foreground leading-relaxed">
        <header className="space-y-3">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            How RunMatch AI works
          </h2>
          <p>
            RunMatch AI does not diagnose injuries or prescribe medical footwear. It scores every
            shoe in its database against your answers (running surface, distance, support needs,
            cushioning preference, foot comfort signals, injury history and budget) and shows
            which factors drove each score. The weights are published on the{' '}
            <a className="text-primary hover:underline" href="/shoe-finder/methodology/">methodology page</a>.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-bold text-foreground">What the tool considers</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-foreground">
                  <th className="py-2 pr-4 font-semibold">Input</th>
                  <th className="py-2 font-semibold">What it helps estimate</th>
                </tr>
              </thead>
              <tbody className="[&_tr]:border-b [&_tr]:border-border/30">
                <tr><td className="py-2 pr-4 font-medium text-foreground">Running goal</td><td className="py-2">Whether you need a daily trainer, race shoe, trail shoe, walking-friendly shoe, or all-around option.</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-foreground">Weekly mileage</td><td className="py-2">How much cushioning, durability, and rotation support may matter.</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-foreground">Terrain</td><td className="py-2">Road, treadmill, gravel, trail, or mixed-surface outsole needs.</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-foreground">Support needs</td><td className="py-2">Whether a neutral or stability-oriented shoe may be more appropriate.</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-foreground">Cushioning preference</td><td className="py-2">Soft, balanced, responsive, or max-cushion ride feel.</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-foreground">Injury or pain history</td><td className="py-2">Whether to show safety caveats and encourage professional assessment.</td></tr>
                <tr><td className="py-2 pr-4 font-medium text-foreground">Budget</td><td className="py-2">Whether to prioritize value shoes, previous-generation models, or premium trainers.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl md:text-2xl font-bold text-foreground">When to get professional help</h2>
          <p>
            RunMatch AI is an educational tool, not a medical diagnosis or prescription. If you
            have persistent pain, diabetes, neuropathy, severe overpronation symptoms, recent
            injury, numbness, swelling, or a medical foot condition, consult a qualified
            clinician, podiatrist, or physical therapist before choosing footwear for training.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl md:text-2xl font-bold text-foreground">Related guides on GearUpToFit</h2>
          <ul className="space-y-2 list-disc pl-5">
            {RELATED_GUIDES.map((g) => (
              <li key={g.href}><a className="text-primary hover:underline" href={g.href} target="_blank" rel="noopener">{g.label}</a></li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-bold text-foreground">Frequently asked questions</h2>
          <div className="space-y-4">
            {LANDING_FAQS.map((f) => (
              <div key={f.question}>
                <h3 className="font-semibold text-foreground">{f.question}</h3>
                <p>{f.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="text-xs italic text-muted-foreground/80">
          Editorial disclaimer: RunMatch AI is provided for educational purposes only by
          GearUpToFit and is not a substitute for advice from a qualified clinician.
        </p>
      </div>
    </section>
  );
};

export default SEOContent;
