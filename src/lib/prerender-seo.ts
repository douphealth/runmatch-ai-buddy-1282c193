/**
 * Pure, dependency-free helpers used by the build-time pre-render script
 * (scripts/prerender.mjs) AND safe to import from browser code.
 *
 * Builds:
 *   - per-page <head> tags (title, description, canonical, OG, Twitter)
 *   - JSON-LD blocks (FAQ, Product, Breadcrumb)
 *   - a server-rendered SEO body block (visible HTML for crawlers + AI scrapers)
 *
 * Important: NO React, NO framer-motion, NO recharts, NO browser globals.
 * Anything imported here must also be Node-pure.
 */

import { QuizAnswers } from './quiz-data';
import { generateRecommendation, ShoeRecommendation } from './recommendation-engine';
import { scoreShoes, buildRotation } from './scoring-engine';
import { getDynamicFAQs } from './dynamic-faqs';
import { generateMetaTitle, generateMetaDescription, generateFAQSchema, generateProductSchema } from './seo';
import { resolveShoeImage } from './shoe-images';

const SITE_ORIGIN = 'https://runmatch-ai-buddy.lovable.app';
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
  const url = `${SITE_ORIGIN}/app/runmatch/${slug}`;
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
  const productSchema = generateProductSchema(recommendation, answers, primaryShoe);
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'GearUpToFit', item: 'https://gearuptofit.com' },
      { '@type': 'ListItem', position: 2, name: 'RunMatch AI', item: `${SITE_ORIGIN}/` },
      { '@type': 'ListItem', position: 3, name: recommendation.shoeProfile.category, item: url },
    ],
  };

  const ldBlocks = [faqSchema, productSchema, breadcrumbSchema]
    .map(s => `<script type="application/ld+json">${escapeJsonLd(JSON.stringify(s))}</script>`)
    .join('\n    ');

  // ----- Head tags -----
  const headTags = `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(url)}" />

    <meta property="og:type" content="product" />
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
  // This renders inside <div id="root"> in the static HTML. React then
  // hydrates and replaces the entire root with the full interactive UI on
  // the client. The visible block is hidden from sighted users via inline
  // style to avoid a flash before hydration — but Googlebot still indexes
  // it (visibility: hidden is treated as content by Google as long as the
  // text is in the DOM at render time and not behind a meaningful
  // interaction). We use position:absolute + clip to satisfy both.
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

  return `<div id="seo-content" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;">
    <h1>${escapeHtml(recommendation.shoeProfile.category)} for ${escapeHtml(answers.pronation)} ${escapeHtml(distanceLabel)} runners on ${escapeHtml(terrainLabel)}</h1>
    <p>${escapeHtml(recommendation.shoeProfile.summary)}</p>

    <h2>Recommended shoe profile</h2>
    <ul>
      <li><strong>Category:</strong> ${escapeHtml(recommendation.shoeProfile.category)}</li>
      <li><strong>Cushioning:</strong> ${escapeHtml(recommendation.shoeProfile.cushioning)}</li>
      <li><strong>Heel-to-toe drop:</strong> ${escapeHtml(recommendation.shoeProfile.dropRange)}</li>
      <li><strong>Support type:</strong> ${escapeHtml(recommendation.shoeProfile.supportType)}</li>
    </ul>

    <h2>Why this match works</h2>
    <p>${escapeHtml(recommendation.whyItWorks)}</p>

    <h2>Best shoe category explanation</h2>
    <p>${escapeHtml(recommendation.categoryExplanation)}</p>

    <h2>Top matching running shoes</h2>
    ${topShoesHtml}

    <h2>Recommended rotation</h2>
    ${rotationHtml}

    <h2>Training emphasis</h2>
    <ul>
      ${recommendation.trainingEmphasis.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
    </ul>

    <h2>Frequently asked questions</h2>
    ${faqsHtml}

    <h2>Read before you buy</h2>
    <ul>
      <li><a href="https://gearuptofit.com/running/how-to-choose-the-right-running-shoes/">How to choose the right running shoes</a></li>
      <li><a href="https://gearuptofit.com/review/running-shoes/">Running shoes reviews</a></li>
      <li><a href="https://gearuptofit.com/review/best-running-shoes-for-different-distances/">Best running shoes for different distances 2026</a></li>
    </ul>
  </div>`;
}

function renderTopShoes(shoes: ReturnType<typeof scoreShoes>): string {
  if (shoes.length === 0) return '<p>No shoes matched.</p>';
  const rows = shoes.map(s => `
    <tr>
      <td>${escapeHtml(s.shoe.brand)} ${escapeHtml(s.shoe.model)}</td>
      <td>${escapeHtml(String(s.matchPercent))}% match</td>
      <td>$${escapeHtml(String(s.shoe.priceUSD))}</td>
      <td>${escapeHtml(s.reasons.join('; ') || s.shoe.summary || '')}</td>
    </tr>`).join('');
  return `<table>
    <thead><tr><th>Shoe</th><th>Match</th><th>Price</th><th>Why it fits</th></tr></thead>
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
