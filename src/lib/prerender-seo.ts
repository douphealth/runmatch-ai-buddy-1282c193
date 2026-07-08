/**
 * Pure, dependency-free helpers used by the build-time pre-render script
 * (scripts/prerender.mjs) AND safe to import from browser code.
 *
 * Builds:
 *   - per-page <head> tags (title, description, canonical, OG, Twitter)
 *   - JSON-LD blocks (FAQ, Breadcrumb, WebApplication)
 *   - a server-rendered SEO body block (visible HTML for crawlers + AI scrapers)
 *
 * Important: NO React, NO framer-motion, NO recharts, NO browser globals.
 * Anything imported here must also be Node-pure.
 */

import { QuizAnswers } from './quiz-data';
import { generateRecommendation, ShoeRecommendation } from './recommendation-engine';
import { scoreShoes, buildRotation } from './scoring-engine';
import { getDynamicFAQs } from './dynamic-faqs';
import { generateMetaTitle, generateMetaDescription, generateFAQSchema } from './seo';
import { resolveShoeImage } from './shoe-images';

const SITE_ORIGIN = 'https://gearuptofit.com/shoe-finder';
const FALLBACK_OG_IMAGE = 'https://gearuptofit.com/wp-content/uploads/2023/03/cropped-Grey-Black-Illustration-Gym-Fitness-Logo.png';

// HTML-escape user/data-derived strings before injecting into HTML/attributes.
export function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Escape a string so it is safe to embed inside <script type="application/ld+json">.
// Closing-tag injection is the realistic risk; quote escaping is handled by JSON.stringify.
function escapeJsonLd(json: string): string {
  return json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export interface PrerenderedPage {
  slug: string;
  url: string;
  title: string;
  description: string;
  headTags: string;   // <title> + meta + link + JSON-LD scripts (goes in <head>)
  bodyHtml: string;   // visible SEO content block (goes inside #root)
}

export function buildPrerenderedPage(slug: string, answers: QuizAnswers): PrerenderedPage {
  const url = `${SITE_ORIGIN}/results/${slug}/`;
  const recommendation = generateRecommendation(answers);
  const rotation = buildRotation(answers);
  const topShoes = scoreShoes(answers).slice(0, 5);
  const faqs = getDynamicFAQs(answers);

  const title = generateMetaTitle(answers);
  const description = generateMetaDescription(recommendation);

  const primaryShoe = rotation.primary?.shoe;
  const ogImage = primaryShoe
    ? `${SITE_ORIGIN}${resolveShoeImage(primaryShoe).url}`
    : FALLBACK_OG_IMAGE;

  // ----- JSON-LD blocks -----
  const faqSchema = generateFAQSchema(faqs);
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'GearUpToFit', item: 'https://gearuptofit.com' },
      { '@type': 'ListItem', position: 2, name: 'RunMatch AI', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 3, name: recommendation.shoeProfile.category, item: url },
    ],
  };

  const ldBlocks = [faqSchema, breadcrumbSchema]
    .map(s => `<script type="application/ld+json">${escapeJsonLd(JSON.stringify(s))}</script>`)
    .join('\n    ');

  // ----- Head tags -----
  const headTags = `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(url)}" />

    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    ${primaryShoe ? `<meta property="og:image:alt" content="${escapeHtml(`${primaryShoe.brand} ${primaryShoe.model} running shoe`)}" />` : ''}

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@GearUpToFit" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />

    ${ldBlocks}`.trim();

  // ----- Visible SEO body block (for crawlers and AI scrapers) -----
  // This renders inside <div id="root"> in the static HTML at the
  // PRERENDER_ROOT marker. It is intentionally visible/equivalent content,
  // not crawler-only hidden text.
  const bodyHtml = renderSeoBody({
    slug,
    answers,
    recommendation,
    rotationHtml: renderRotation(rotation),
    topShoesHtml: renderTopShoes(topShoes),
    faqsHtml: renderFaqs(faqs),
  });

  return { slug, url, title, description, headTags, bodyHtml };
}

// --- Body section renderers (plain HTML strings) ---

function renderSeoBody(args: {
  slug: string;
  answers: QuizAnswers;
  recommendation: ShoeRecommendation;
  rotationHtml: string;
  topShoesHtml: string;
  faqsHtml: string;
}): string {
  const { answers, recommendation, rotationHtml, topShoesHtml, faqsHtml } = args;
  const distanceLabel = answers.distance.replace('-', ' ');
  const terrainLabel = answers.terrain;

  return `<main id="seo-content" style="max-width:1120px;margin:0 auto;padding:32px 18px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#111827;background:#fff;">
    <nav aria-label="Breadcrumb"><a href="https://gearuptofit.com/">GearUpToFit</a> › <a href="${SITE_ORIGIN}/">Running Shoe Finder</a> › Results</nav>
    <h1>Free Running Shoe Finder: Match Your Mileage, Terrain, Cushioning and Budget</h1>
    <p>This free running shoe finder matches your quiz answers to shoe categories and product attributes so you can compare practical options before reading a full GearUpToFit review or checking current prices.</p>

    <h2>Your personalized running shoe match</h2>
    <p><strong>Recommended profile:</strong> ${escapeHtml(recommendation.shoeProfile.category)} for ${escapeHtml(answers.pronation)} ${escapeHtml(distanceLabel)} runners on ${escapeHtml(terrainLabel)}.</p>
    <p>${escapeHtml(recommendation.shoeProfile.summary)}</p>

    <h2>How the matching works</h2>
    <p>The matching engine weighs terrain, distance, pronation/support preference, foot type, cushioning preference, budget, brand preference, pace goal, weekly mileage, and width/fit needs. It favors shoes with enough data quality for recommendations and avoids treating incomplete product records as indexable product pages.</p>

    <h2>Factors used in the quiz</h2>
    <ul>
      <li><strong>Terrain:</strong> road, trail, treadmill, or mixed surfaces.</li>
      <li><strong>Distance and mileage:</strong> everyday runs through marathon training.</li>
      <li><strong>Support preference:</strong> neutral, stability, or uncertain pronation needs.</li>
      <li><strong>Fit:</strong> standard, wide, flat feet, or high arches.</li>
      <li><strong>Budget and brand preferences:</strong> used as tie-breakers, not hard guarantees.</li>
    </ul>

    <h2>Running shoe category comparison</h2>
    ${topShoesHtml}

    <h2>Why this match works</h2>
    <p>${escapeHtml(recommendation.whyItWorks)}</p>
    <p>${escapeHtml(recommendation.categoryExplanation)}</p>

    <h2>Recommended rotation</h2>
    ${rotationHtml}

    <h2>Editorial methodology</h2>
    <p>GearUpToFit combines quiz inputs, shoe specifications, category fit, buyer intent, and editorial review context. Product data should be rechecked before publishing indexable product pages, especially images, source URLs, current merchant URLs, price, and availability.</p>

    <h2>Affiliate disclosure</h2>
    <p>GearUpToFit may earn a commission when you buy through links on this page. This does not change your price. Recommendations are based on quiz inputs, product attributes, and editorial criteria.</p>

    <h2>Author and reviewer note</h2>
    <p>Prepared by GearUpToFit editors for runners comparing shoe categories. This tool is educational and should be reviewed periodically as shoe models and availability change.</p>

    <h2>Not medical advice</h2>
    <p>This tool is educational. It does not diagnose, treat, or prevent injuries. If you have persistent pain or a medical condition, consult a qualified professional.</p>

    <h2>Read before you buy</h2>
    <ul>
      <li><a href="https://gearuptofit.com/review/best-running-shoes/">Best running shoes</a></li>
      <li><a href="https://gearuptofit.com/review/best-running-shoes-for-beginners/">Best running shoes for beginners</a></li>
      <li><a href="https://gearuptofit.com/review/best-trail-running-shoes/">Best trail running shoes</a></li>
      <li><a href="https://gearuptofit.com/review/best-running-shoes-for-flat-feet/">Best running shoes for flat feet</a></li>
      <li><a href="https://gearuptofit.com/review/best-running-shoes-for-wide-feet/">Best running shoes for wide feet</a></li>
    </ul>

    <h2>Frequently asked questions</h2>
    ${faqsHtml}
  </main>`;
}

function renderTopShoes(shoes: ReturnType<typeof scoreShoes>): string {
  if (shoes.length === 0) return '<p>No shoes matched.</p>';
  const tier = (p: number) =>
    p < 110 ? 'Budget' : p < 160 ? 'Mid-range' : p < 220 ? 'Premium' : 'Super-premium';
  const rows = shoes.map(s => `
    <tr>
      <td>${escapeHtml(s.shoe.brand)} ${escapeHtml(s.shoe.model)}</td>
      <td>${escapeHtml(String(s.matchPercent))}% match</td>
      <td>${escapeHtml(tier(s.shoe.priceUSD))} MSRP tier</td>
      <td>${escapeHtml(s.reasons.join('; ') || (s.shoe.highlights?.join('; ') ?? ''))}</td>
    </tr>`).join('');
  return `<table>
    <thead><tr><th>Shoe</th><th>Match</th><th>MSRP Tier</th><th>Why it fits</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderRotation(rotation: ReturnType<typeof buildRotation>): string {
  const items: string[] = [];
  if (rotation.primary) {
    items.push(`<li><strong>Daily Trainer — ${escapeHtml(rotation.primary.shoe.brand)} ${escapeHtml(rotation.primary.shoe.model)}:</strong> your go-to for easy and moderate runs.</li>`);
  }
  if (rotation.speed) {
    items.push(`<li><strong>Speed Work — ${escapeHtml(rotation.speed.shoe.brand)} ${escapeHtml(rotation.speed.shoe.model)}:</strong> lighter and more responsive for intervals and tempo runs.</li>`);
  }
  if (rotation.longRun) {
    items.push(`<li><strong>Long Run — ${escapeHtml(rotation.longRun.shoe.brand)} ${escapeHtml(rotation.longRun.shoe.model)}:</strong> max cushioning to keep legs fresh on long efforts.</li>`);
  }
  return `<ul>${items.join('')}</ul>`;
}

function renderFaqs(faqs: ReturnType<typeof getDynamicFAQs>): string {
  return faqs.map(f => `
    <section>
      <h3>${escapeHtml(f.question)}</h3>
      <p>${escapeHtml(f.answer)}</p>
    </section>`).join('');
}

/**
 * Build-time pre-render for the LANDING page (/shoe-finder/).
 * Returns head tags + a visible SEO body block for crawlers and AI scrapers.
 * React `createRoot().render()` will replace the body block on hydration for
 * real users — this content is only what non-JS crawlers see. No fake claims.
 */
export function buildLandingPage(): { headTags: string; bodyHtml: string } {
  const url = `${SITE_ORIGIN}/`;
  const title = 'Running Shoe Finder Quiz — Find the Right Running Shoes for Your Feet, Mileage & Terrain | RunMatch AI';
  const description = 'Free running shoe finder quiz. Match the right shoes to your foot shape, weekly mileage, terrain, cushioning preference, support needs, injury history and budget in 2 minutes. By GearUpToFit.';

  const faqs = [
    { question: 'Is RunMatch AI a medical tool?', answer: 'No. It is an educational running shoe finder that helps organize your preferences and training needs. It does not diagnose injuries or prescribe treatment.' },
    { question: 'Can this tool tell me the exact shoe model to buy?', answer: 'It helps narrow your shoe category and comparison list, but fit is personal. Try shoes on when possible and prioritize comfort, secure heel lockdown, and enough toe room.' },
    { question: 'Should beginners use neutral or stability shoes?', answer: 'Many beginners do well in comfortable neutral daily trainers, but some runners prefer or need added stability. The best choice depends on comfort, support needs, gait, injury history, and professional guidance when pain is present.' },
    { question: 'How should running shoes fit?', answer: 'Most runners need a secure heel, comfortable midfoot hold, and roughly a thumb-width of space in front of the longest toe. Shoes should feel stable and comfortable while walking or jogging.' },
    { question: 'Does terrain matter?', answer: 'Yes. Road and treadmill shoes prioritize smooth cushioning and transition, while trail shoes need grip, protection, and stability on uneven ground.' },
    { question: 'How long does the shoe finder quiz take?', answer: 'About two minutes. The quiz has nine short questions covering your running goal, weekly mileage, terrain, foot shape, cushioning preference, support needs, injury history and budget.' },
  ];

  const faqSchema = generateFAQSchema(faqs);
  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to find the right running shoes with RunMatch AI',
    description: 'A free, nine-question quiz that matches you to a running shoe category and shortlist based on your feet, mileage, terrain and budget.',
    totalTime: 'PT2M',
    step: [
      { '@type': 'HowToStep', position: 1, name: 'Answer the quiz', text: 'Answer nine short questions about your running goal, weekly mileage, terrain, foot shape, cushioning preference, support needs, injury history and budget.' },
      { '@type': 'HowToStep', position: 2, name: 'Get your shoe profile', text: 'RunMatch AI generates a personalized shoe profile: category, cushioning level, terrain fit, mileage range and support type.' },
      { '@type': 'HowToStep', position: 3, name: 'Compare a shortlist', text: 'Review a curated shortlist of running shoes matched to your profile with a suggested rotation for daily, speed and long-run days.' },
      { '@type': 'HowToStep', position: 4, name: 'Save, share or refine', text: 'Save your match, share the link, download a PDF report or retake the quiz to explore other profiles.' },
    ],
  };
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'RunMatch AI Running Shoe Finder',
    url: `${SITE_ORIGIN}/`,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_ORIGIN}/results/{search_term_string}/`,
      'query-input': 'required name=search_term_string',
    },
  };

  const ldBlocks = [faqSchema, howToSchema, websiteSchema]
    .map(s => `<script type="application/ld+json">${escapeJsonLd(JSON.stringify(s))}</script>`)
    .join('\n    ');

  const headTags = `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(url)}" />

    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />

    ${ldBlocks}`.trim();

  const faqsHtml = faqs.map(f => `
      <section>
        <h3>${escapeHtml(f.question)}</h3>
        <p>${escapeHtml(f.answer)}</p>
      </section>`).join('');

  const bodyHtml = `<main id="seo-landing" style="max-width:1120px;margin:0 auto;padding:32px 18px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#111827;background:#fff;">
    <nav aria-label="Breadcrumb"><a href="https://gearuptofit.com/">GearUpToFit</a> › Running Shoe Finder</nav>

    <h1>Running Shoe Finder Quiz: Find the Right Running Shoes for Your Feet, Mileage, Terrain and Budget</h1>
    <p>Answer a few questions about your running goal, weekly mileage, terrain, foot shape, cushioning preference, support needs, injury history and budget. RunMatch AI gives you a practical running shoe profile so you can compare neutral, stability, cushioned, trail, race-day and walking-friendly shoes with less guesswork.</p>
    <p><a href="${SITE_ORIGIN}/#runmatch-quiz">Start the free shoe finder</a> · <a href="${SITE_ORIGIN}/#how-it-works">How it works</a></p>

    <h2>Who should use this running shoe finder?</h2>
    <ul>
      <li>Beginner runners choosing their first real running shoes.</li>
      <li>Road runners comparing neutral, stability, max-cushion and tempo shoes.</li>
      <li>Walkers and runners who want one comfortable daily shoe.</li>
      <li>Runners with wide feet, heel slip, toe pressure, arch discomfort or recurring blisters.</li>
      <li>Trail, gravel and mixed-surface runners choosing between road and trail shoes.</li>
      <li>Runners who feel overwhelmed by brand hype, influencer lists and confusing shoe categories.</li>
    </ul>

    <h2>How the running shoe finder works</h2>
    <ol>
      <li><strong>Answer nine short questions</strong> — running goal, weekly mileage, terrain, foot shape, cushioning preference, support needs, injury history and budget.</li>
      <li><strong>Get a personalized shoe profile</strong> — category (neutral daily trainer, stability, max-cushion, trail, race-day or walking-friendly), cushioning level, terrain fit and mileage range.</li>
      <li><strong>Compare a curated shortlist</strong> with a suggested 2–3 shoe rotation for daily, speed and long-run days.</li>
      <li><strong>Save, share or download</strong> your match as a PDF report or shareable link.</li>
    </ol>

    <h2>What the tool considers</h2>
    <ul>
      <li><strong>Running goal</strong> — daily trainer, race shoe, trail shoe, walking-friendly shoe, or all-around option.</li>
      <li><strong>Weekly mileage</strong> — cushioning, durability and rotation needs.</li>
      <li><strong>Terrain</strong> — road, treadmill, gravel, trail or mixed-surface outsole needs.</li>
      <li><strong>Support needs</strong> — neutral vs stability orientation.</li>
      <li><strong>Cushioning preference</strong> — soft, balanced, responsive or max-cushion ride feel.</li>
      <li><strong>Injury or pain history</strong> — surfaces safety caveats and encourages professional assessment.</li>
      <li><strong>Budget</strong> — value shoes, previous-generation models or premium trainers.</li>
    </ul>

    <h2>Related guides on GearUpToFit</h2>
    <ul>
      <li><a href="https://gearuptofit.com/review/best-running-shoes/">Best running shoes</a></li>
      <li><a href="https://gearuptofit.com/review/best-daily-running-shoes/">Best daily running shoes</a></li>
      <li><a href="https://gearuptofit.com/review/best-running-shoes-for-beginners/">Best beginner running shoes</a></li>
      <li><a href="https://gearuptofit.com/running/how-to-choose-the-right-running-shoes/">How to choose running shoes</a></li>
      <li><a href="https://gearuptofit.com/running/zone-2-running-calculator/">Zone 2 running calculator</a></li>
    </ul>

    <h2>Frequently asked questions</h2>
    ${faqsHtml}

    <h2>Editorial disclaimer</h2>
    <p>RunMatch AI provides educational shoe guidance, not medical advice. If you have pain, injury, diabetes-related foot issues, or complex biomechanical needs, consult a qualified clinician or specialist.</p>
  </main>`;

  return { headTags, bodyHtml };
}

