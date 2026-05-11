/**
 * Visible SEO/AEO content section that renders below the hero on the landing page.
 * Provides crawlable explanatory content, internal links, FAQ, and disclaimer.
 * Intentionally low-visual-weight so it does not distort the hero experience.
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
            RunMatch AI does not diagnose injuries or prescribe medical footwear. It organizes
            your answers into a practical running shoe profile. The tool considers your running
            surface, distance, support needs, cushioning preference, foot comfort signals,
            injury history, and budget. It then suggests the type of shoe category to compare,
            such as neutral daily trainer, stability shoe, max-cushion shoe, trail shoe, race
            shoe, or walking-friendly running shoe.
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
            <li><a className="text-primary hover:underline" href="https://gearuptofit.com/review/best-running-shoes/" target="_blank" rel="noopener">Best running shoes</a></li>
            <li><a className="text-primary hover:underline" href="https://gearuptofit.com/review/best-daily-running-shoes/" target="_blank" rel="noopener">Best daily running shoes</a></li>
            <li><a className="text-primary hover:underline" href="https://gearuptofit.com/review/best-running-shoes-for-beginners/" target="_blank" rel="noopener">Best beginner running shoes</a></li>
            <li><a className="text-primary hover:underline" href="https://gearuptofit.com/running/how-to-choose-the-right-running-shoes/" target="_blank" rel="noopener">How to choose running shoes</a></li>
            <li><a className="text-primary hover:underline" href="https://gearuptofit.com/running/zone-2-running-calculator/" target="_blank" rel="noopener">Zone 2 running calculator</a></li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl md:text-2xl font-bold text-foreground">Frequently asked questions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-foreground">Is RunMatch AI a medical tool?</h3>
              <p>No. It is an educational running shoe finder that helps organize your preferences and training needs. It does not diagnose injuries or prescribe treatment.</p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Can this tool tell me the exact shoe model to buy?</h3>
              <p>It can help narrow your shoe category and comparison list, but fit is personal. Try shoes on when possible and prioritize comfort, secure heel lockdown, and enough toe room.</p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Should beginners use neutral or stability shoes?</h3>
              <p>Many beginners do well in comfortable neutral daily trainers, but some runners prefer or need added stability. The best choice depends on comfort, support needs, gait, injury history, and professional guidance when pain is present.</p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">How should running shoes fit?</h3>
              <p>Most runners need a secure heel, comfortable midfoot hold, and roughly a thumb-width of space in front of the longest toe. Shoes should feel stable and comfortable while walking or jogging.</p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Does terrain matter?</h3>
              <p>Yes. Road and treadmill shoes prioritize smooth cushioning and transition, while trail shoes need grip, protection, and stability on uneven ground.</p>
            </div>
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
