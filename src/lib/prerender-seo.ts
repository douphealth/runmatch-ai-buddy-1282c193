/**
 * Pure, dependency-free helpers used by the build-time pre-render script
 * (scripts/prerender.mts). They turn the app's data + the shared PageSeo
 * objects into static HTML so crawlers and AI assistants that do not run
 * JavaScript receive complete, unique content.
 *
 * Important: NO React, NO framer-motion, NO recharts, NO browser globals.
 * Anything imported here must also be Node-pure.
 *
 * Every tag injected into <head> carries `data-prerender`; <SeoHead> removes
 * those when React takes over and re-creates identical tags via Helmet.
 */

import { QuizAnswers } from './quiz-data';
import { generateRecommendation } from './recommendation-engine';
import { scoreShoes, buildRotation, type ScoredShoe } from './scoring-engine';
import { getDynamicFAQs } from './dynamic-faqs';
import { generateResultH1 } from './seo';
import { getFitPriorities } from './fit-priorities';
import { getRecommendedArticles } from './article-links';
import { getSafetyNotice } from './safety';
import { getAmazonLinkForShoe } from './amazon-link';
import { getPriceTier, SHOE_DATABASE_LAST_UPDATED_LABEL } from './price-tier';
import { brandSeo, categorySeo, comparisonFaqs, comparisonSeo, shoeFaqs, shoeSeo, type PageSeo } from './entity-seo';
import { landingSeo } from './landing-seo';
import { methodologySeo, resultSeo } from './page-seo';
import { LANDING_FAQS, LANDING_H1, RELATED_GUIDES } from './landing-content';
import { BRANDS, getBrandShoes, type BrandDef } from './brands';
import { CATEGORIES, getCategoryShoes, type CategoryDef } from './categories';
import { getAllComparisons, compareSpecs, verdictFor, type ResolvedComparison } from './comparisons';
import { shoeDatabase, type Shoe } from './shoe-database';
import { getAlternatives, getRelatedComparisons, getSameBrand, describeUseCase, getShoeById } from './shoe-detail';
import { getManufacturerSourceURL } from './shoe-sources';
import { getNewerVersion, getWatchOuts } from './shoe-insights';
import { getMethodologySections, METHODOLOGY_LAST_REVIEWED, METHODOLOGY_TITLE, type Block } from './methodology-content';
import { EDITORIAL, bylineText } from './editorial';
import { ROTATION_STATEMENT } from './evidence';
import { BRAND_NAME, SITE_ORIGIN, TOOL_NAME, appUrl } from './site-config';

// HTML-escape user/data-derived strings before injecting into HTML/attributes.
export function escapeHtml(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
const e = escapeHtml;

// Escape a string so it is safe to embed inside <script type="application/ld+json">.
// Closing-tag injection is the realistic risk; quote escaping is handled by JSON.stringify.
export function escapeJsonLd(json: string): string {
  return json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export interface PrerenderedPage {
  /** Path below the app root, no slashes at the ends, '' for the landing page. */
  path: string;
  url: string;
  title: string;
  description: string;
  robots: string;
  indexable: boolean;
  headTags: string; // <title> + meta + link + JSON-LD scripts (goes in <head>)
  bodyHtml: string; // visible content block (goes inside #root)
}

/** Render every head tag for a page, each marked `data-prerender`. */
export function renderHeadTags(seo: PageSeo): string {
  const imageAlt = `${TOOL_NAME} by ${BRAND_NAME}`;
  const tags = [
    `<title data-prerender="1">${e(seo.title)}</title>`,
    `<meta data-prerender="1" name="description" content="${e(seo.description)}" />`,
    `<meta data-prerender="1" name="robots" content="${e(seo.robots)}" />`,
    `<link data-prerender="1" rel="canonical" href="${e(seo.canonical)}" />`,
    `<meta data-prerender="1" property="og:site_name" content="${e(BRAND_NAME)}" />`,
    `<meta data-prerender="1" property="og:locale" content="en_US" />`,
    `<meta data-prerender="1" property="og:type" content="${e(seo.ogType)}" />`,
    `<meta data-prerender="1" property="og:url" content="${e(seo.canonical)}" />`,
    `<meta data-prerender="1" property="og:title" content="${e(seo.title)}" />`,
    `<meta data-prerender="1" property="og:description" content="${e(seo.description)}" />`,
    `<meta data-prerender="1" property="og:image" content="${e(seo.ogImage)}" />`,
    `<meta data-prerender="1" property="og:image:alt" content="${e(imageAlt)}" />`,
    `<meta data-prerender="1" name="twitter:card" content="summary_large_image" />`,
    `<meta data-prerender="1" name="twitter:site" content="@GearUpToFit" />`,
    `<meta data-prerender="1" name="twitter:title" content="${e(seo.title)}" />`,
    `<meta data-prerender="1" name="twitter:description" content="${e(seo.description)}" />`,
    `<meta data-prerender="1" name="twitter:image" content="${e(seo.ogImage)}" />`,
    `<meta data-prerender="1" name="twitter:image:alt" content="${e(imageAlt)}" />`,
    ...seo.jsonLd.map((block) => `<script data-prerender="1" type="application/ld+json">${escapeJsonLd(JSON.stringify(block))}</script>`),
  ];
  return tags.join('\n    ');
}

// ---------------------------------------------------------------------------
// Shared HTML fragments
// ---------------------------------------------------------------------------

const MAIN_STYLE =
  'max-width:1120px;margin:0 auto;padding:32px 18px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#111827;background:#fff;';

const main = (inner: string) => `<main id="main-content" style="${MAIN_STYLE}">${inner}\n  </main>`;

const crumbs = (items: { name: string; href?: string }[]) =>
  `<nav aria-label="Breadcrumb">${items.map((i) => (i.href ? `<a href="${e(i.href)}">${e(i.name)}</a>` : e(i.name))).join(' › ')}</nav>`;

const homeCrumbs = [{ name: BRAND_NAME, href: `${SITE_ORIGIN}/` }, { name: `${TOOL_NAME} Shoe Finder`, href: appUrl() }];

const DISCLOSURE = `<h2>Affiliate disclosure</h2>
    <p>As an Amazon Associate, ${e(BRAND_NAME)} earns from qualifying purchases. Some links on this page are affiliate links and are marked as sponsored. They cost you nothing extra. Rankings come from the scoring engine and are not influenced by commission. See the <a href="${e(EDITORIAL.links.affiliateDisclosure)}">affiliate disclosure</a> and the <a href="${appUrl('methodology')}">methodology</a>.</p>`;

const MEDICAL = `<h2>Not medical advice</h2>
    <p>This tool is educational. It does not diagnose, treat or prevent injuries. If you have persistent pain, an injury or a medical foot condition, see a qualified professional before choosing shoes.</p>`;

const faqsHtml = (faqs: { question: string; answer: string }[]) =>
  faqs.map((f) => `\n    <section>\n      <h3>${e(f.question)}</h3>\n      <p>${e(f.answer)}</p>\n    </section>`).join('');

const quizCta = (text = 'Take the free 2-minute quiz for a personalised result') =>
  `<p><a href="${appUrl()}"><strong>${e(text)}</strong></a></p>`;

function amazonLink(shoe: Shoe): string {
  const url = getAmazonLinkForShoe(shoe.id, shoe.brand, shoe.model, shoe.amazonASIN);
  return url ? ` <a href="${e(url)}" rel="sponsored nofollow noopener" target="_blank">Check price on Amazon</a> (affiliate link)` : '';
}

const shoeLink = (s: Shoe) => `<a href="${appUrl(`shoes/${s.id}`)}">${e(s.brand)} ${e(s.model)}</a>`;

const specLine = (s: Shoe) =>
  `${s.cushioning}/10 cushioning · ${s.dropMM} mm drop · ${s.weightGrams} g · ${getPriceTier(s.priceUSD).label} (${getPriceTier(s.priceUSD).range})`;

function renderBlock(b: Block): string {
  switch (b.type) {
    case 'p':
      return `<p>${e(b.text)}</p>`;
    case 'ul':
      return `<ul>${b.items.map((i) => `<li>${e(i)}</li>`).join('')}</ul>`;
    case 'table':
      return `<table><thead><tr>${b.head.map((h) => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${b.rows
        .map((r) => `<tr>${r.map((c) => `<td>${e(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`;
    case 'links':
      return `<ul>${b.items
        .map((i) => `<li><a href="${e(i.href)}" rel="noopener">${e(i.label)}</a>${i.note ? ` — ${e(i.note)}` : ''}</li>`)
        .join('')}</ul>`;
  }
}

// ---------------------------------------------------------------------------
// Result pages  (/results/{slug}/)
// ---------------------------------------------------------------------------

function renderTopShoes(shoes: ScoredShoe[]): string {
  if (shoes.length === 0) return '<p>No shoes matched.</p>';
  const rows = shoes
    .map(
      (s, i) => `
      <tr>
        <td>${i + 1}. ${shoeLink(s.shoe)}${amazonLink(s.shoe) && i < 3 ? amazonLink(s.shoe) : ''}</td>
        <td>${e(s.matchPercent)}%</td>
        <td>${e(specLine(s.shoe))}</td>
        <td>${e(s.reasons.slice(0, 3).join('; ') || s.shoe.highlights.join('; '))}</td>
        <td>${e(s.watchOuts.slice(0, 2).join(' ') || 'Nothing notable in the specs we track.')}</td>
      </tr>`,
    )
    .join('');
  return `<table>
      <thead><tr><th>Shoe</th><th>Match</th><th>Specs</th><th>Why it fits</th><th>Watch out for</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderRotation(rotation: ReturnType<typeof buildRotation>): string {
  const items: string[] = [];
  if (rotation.primary) {
    items.push(`<li><strong>Daily trainer: ${shoeLink(rotation.primary.shoe)}.</strong> Your go-to for easy and moderate runs.</li>`);
  }
  if (rotation.speed) {
    items.push(`<li><strong>Speed work: ${shoeLink(rotation.speed.shoe)}.</strong> Lighter and more responsive for intervals and tempo runs.</li>`);
  }
  if (rotation.longRun) {
    items.push(`<li><strong>Long run: ${shoeLink(rotation.longRun.shoe)}.</strong> Extra cushioning for your longest efforts.</li>`);
  }
  return `<ul>${items.join('')}</ul>`;
}

export function buildPrerenderedPage(slug: string, answers: QuizAnswers): PrerenderedPage {
  const seo = resultSeo(slug, answers);
  const recommendation = generateRecommendation(answers);
  const rotation = buildRotation(answers);
  const topShoes = scoreShoes(answers).slice(0, 5);
  const faqs = getDynamicFAQs(answers);
  const safety = getSafetyNotice(answers);
  const articles = getRecommendedArticles(answers);
  const primary = topShoes[0];
  const h1 = generateResultH1(answers);

  const body = main(`
    ${crumbs([...homeCrumbs, { name: 'Result' }])}
    <h1>${e(h1)}</h1>
    <p>${e(recommendation.shoeProfile.summary)}</p>
    <p>${e(ROTATION_STATEMENT.split('.')[0])}.</p>
    ${quizCta()}
    ${safety ? `<h2>${e(safety.title)}</h2><p>${e(safety.summary)}</p>` : ''}

    <h2>Top 5 matches for this profile</h2>
    ${renderTopShoes(topShoes)}
    <p>Match percentages show how well each shoe fits these answers, not how good the shoe is. Specs are for a men's sample size; prices shown are launch MSRP tiers, not live prices. Shoe data last reviewed ${e(SHOE_DATABASE_LAST_UPDATED_LABEL)}.</p>

    <h2>Suggested rotation</h2>
    ${renderRotation(rotation)}

    <h2>Why this profile fits</h2>
    <p>${e(recommendation.whyItWorks)}</p>
    <p>${e(recommendation.categoryExplanation)}</p>

    <h2>What to check when you try them on</h2>
    <dl>${getFitPriorities(answers)
      .map((f) => `<dt>${e(f.label)}</dt><dd>${e(f.detail)}</dd>`)
      .join('')}</dl>

    ${
      primary
        ? `<h2>Who should think twice about the ${e(primary.shoe.brand)} ${e(primary.shoe.model)}</h2>
    <ul>${(primary.watchOuts.length ? primary.watchOuts : ['Nothing stands out in the specs we track, but fit is personal.']).map((w) => `<li>${e(w)}</li>`).join('')}</ul>`
        : ''
    }

    <h2>How the scoring works</h2>
    <p>Every shoe is scored on nine weighted factors. The same answers always give the same ranking. Read the full <a href="${appUrl('methodology')}">methodology, weights and sources</a>.</p>

    <h2>Read next</h2>
    <ul>${articles.map((a) => `<li><a href="${e(a.url)}">${e(a.title)}</a></li>`).join('')}</ul>

    <h2>Frequently asked questions</h2>
    ${faqsHtml(faqs)}

    ${DISCLOSURE}
    ${MEDICAL}
    <p>${e(bylineText())}</p>`);

  return {
    path: `results/${slug}`,
    url: seo.canonical,
    title: seo.title,
    description: seo.description,
    robots: seo.robots,
    indexable: seo.indexable,
    headTags: renderHeadTags(seo),
    bodyHtml: body,
  };
}

// ---------------------------------------------------------------------------
// Landing page (/)
// ---------------------------------------------------------------------------

export function buildLandingPage(): PrerenderedPage {
  const seo = landingSeo();
  const comparisons = getAllComparisons();

  const body = main(`
    ${crumbs([{ name: BRAND_NAME, href: `${SITE_ORIGIN}/` }, { name: `${TOOL_NAME} Shoe Finder` }])}
    <h1>${e(LANDING_H1)}</h1>
    <p>Answer a few questions about your running goal, weekly mileage, terrain, foot shape, cushioning preference, support needs, injury history and budget. RunMatch AI scores every shoe in its database against your answers and shows the reasons behind each pick, so you can compare neutral, stability, cushioned, trail and race-day shoes with less guesswork.</p>
    ${quizCta('Start the free shoe finder quiz')}

    <h2>How the running shoe finder works</h2>
    <ol>
      <li><strong>Answer nine short questions</strong> about foot shape, gait, weekly mileage, distance, terrain, pace, injury history, brand preference and budget. Optionally name a shoe you already know.</li>
      <li><strong>Get a ranked shortlist</strong> with a match percentage and the factors behind each score.</li>
      <li><strong>See what to watch out for</strong> with each shoe, plus a suggested 2–3 shoe rotation for daily, speed and long-run days.</li>
      <li><strong>Save, share or download</strong> your result as a link or PDF report.</li>
    </ol>

    <h2>What the tool considers</h2>
    <ul>
      <li><strong>Terrain:</strong> road, trail, track or mixed surfaces.</li>
      <li><strong>Race distance and weekly mileage:</strong> cushioning and durability needs.</li>
      <li><strong>Gait and foot shape:</strong> neutral or supportive shoes, flat feet, high arches, wide forefoot.</li>
      <li><strong>Pain or injury history:</strong> switches to a cautious, comfort-first shortlist and points you to a professional.</li>
      <li><strong>Budget and brand:</strong> used as tie-breakers, never guarantees.</li>
    </ul>
    <p>See the exact weights on the <a href="${appUrl('methodology')}">methodology page</a>.</p>

    <h2>Browse by category</h2>
    <ul>${CATEGORIES.map((c) => `<li><a href="${appUrl(`best-running-shoes/${c.slug}`)}">${e(c.h1)}</a></li>`).join('')}</ul>

    <h2>Shop by brand</h2>
    <ul>${BRANDS.map((b) => `<li><a href="${appUrl(`best-running-shoes/brand/${b.slug}`)}">${e(b.h1)}</a></li>`).join('')}</ul>

    <h2>Head-to-head comparisons</h2>
    <ul>${comparisons.map((c) => `<li><a href="${appUrl(`compare/${c.slug}`)}">${e(c.a.brand)} ${e(c.a.model)} vs ${e(c.b.brand)} ${e(c.b.model)}</a></li>`).join('')}</ul>

    <h2>Related guides on GearUpToFit</h2>
    <ul>${RELATED_GUIDES.map((g) => `<li><a href="${e(g.href)}">${e(g.label)}</a></li>`).join('')}</ul>

    <h2>Frequently asked questions</h2>
    ${faqsHtml(LANDING_FAQS)}

    ${DISCLOSURE}
    ${MEDICAL}
    <p>${e(bylineText())}</p>`);

  return {
    path: '',
    url: seo.canonical,
    title: seo.title,
    description: seo.description,
    robots: seo.robots,
    indexable: true,
    headTags: renderHeadTags(seo),
    bodyHtml: body,
  };
}

// ---------------------------------------------------------------------------
// Methodology (/methodology/)
// ---------------------------------------------------------------------------

export function buildMethodologyPage(): PrerenderedPage {
  const seo = methodologySeo();
  const sections = getMethodologySections();
  const body = main(`
    ${crumbs([{ name: TOOL_NAME, href: appUrl() }, { name: 'Methodology' }])}
    <h1>${e(METHODOLOGY_TITLE)}</h1>
    <p>${e(bylineText())} · Last reviewed ${e(METHODOLOGY_LAST_REVIEWED)}</p>
    ${sections.map((s) => `<h2 id="${e(s.id)}">${e(s.heading)}</h2>\n    ${s.blocks.map(renderBlock).join('\n    ')}`).join('\n\n    ')}
    ${quizCta()}`);
  return {
    path: 'methodology',
    url: seo.canonical,
    title: seo.title,
    description: seo.description,
    robots: seo.robots,
    indexable: true,
    headTags: renderHeadTags(seo),
    bodyHtml: body,
  };
}

// ---------------------------------------------------------------------------
// Brand, category, comparison and shoe pages
// ---------------------------------------------------------------------------

function renderShoeCards(shoes: Shoe[]): string {
  return `<ol>${shoes
    .map(
      (s) => `
      <li>
        <h3>${shoeLink(s)}</h3>
        <p>${e(describeUseCase(s))}. ${e(specLine(s))}.</p>
        <p>${e(s.highlights.join(' · '))}</p>
        ${getNewerVersion(s) ? `<p><em>Previous generation: a newer version is in our database.</em></p>` : ''}
        <p>${amazonLink(s).trim() || `<a href="${appUrl(`shoes/${s.id}`)}">View specs and who it suits</a>`}</p>
      </li>`,
    )
    .join('')}</ol>`;
}

export function buildBrandPage(brand: BrandDef): PrerenderedPage {
  const seo = brandSeo(brand);
  const shoes = getBrandShoes(brand, 8);
  const body = main(`
    ${crumbs([{ name: TOOL_NAME, href: appUrl() }, { name: brand.name }])}
    <h1>${e(brand.h1)}</h1>
    <p>${e(brand.intro)}</p>
    ${brand.signature ? `<p><strong>Signature tech:</strong> ${e(brand.signature)}</p>` : ''}
    ${quizCta()}
    <h2>${e(brand.name)} running shoes in our database (${shoes.length})</h2>
    ${renderShoeCards(shoes)}
    <h2>Frequently asked questions</h2>
    ${faqsHtml(brand.faqs)}
    ${DISCLOSURE}
    ${MEDICAL}`);
  return { path: `best-running-shoes/brand/${brand.slug}`, url: seo.canonical, title: seo.title, description: seo.description, robots: seo.robots, indexable: seo.indexable, headTags: renderHeadTags(seo), bodyHtml: body };
}

export function buildCategoryPage(cat: CategoryDef): PrerenderedPage {
  const seo = categorySeo(cat);
  const shoes = getCategoryShoes(cat, 8);
  const body = main(`
    ${crumbs([{ name: TOOL_NAME, href: appUrl() }, { name: cat.h1 }])}
    <h1>${e(cat.h1)}</h1>
    <p>${e(cat.intro)}</p>
    ${quizCta()}
    <h2>Top ${shoes.length} picks</h2>
    ${renderShoeCards(shoes)}
    <h2>${e(cat.howTo.name)}</h2>
    <p>${e(cat.howTo.description)}</p>
    <ol>${cat.howTo.steps.map((s) => `<li><strong>${e(s.name)}.</strong> ${e(s.text)}</li>`).join('')}</ol>
    <h2>Frequently asked questions</h2>
    ${faqsHtml(cat.faqs)}
    <h2>More categories</h2>
    <ul>${CATEGORIES.filter((c) => c.slug !== cat.slug).map((c) => `<li><a href="${appUrl(`best-running-shoes/${c.slug}`)}">${e(c.h1)}</a></li>`).join('')}</ul>
    ${DISCLOSURE}
    ${MEDICAL}`);
  return { path: `best-running-shoes/${cat.slug}`, url: seo.canonical, title: seo.title, description: seo.description, robots: seo.robots, indexable: seo.indexable, headTags: renderHeadTags(seo), bodyHtml: body };
}

export function buildComparisonPage(c: ResolvedComparison): PrerenderedPage {
  const seo = comparisonSeo(c);
  const { a, b } = c;
  const w = compareSpecs(a, b);
  const mark = (side: 'a' | 'b', win: 'a' | 'b' | null) => (win === side ? ' ✓' : '');
  const row = (label: string, av: string, bv: string, win: 'a' | 'b' | null = null) =>
    `<tr><th scope="row">${e(label)}</th><td>${e(av)}${mark('a', win)}</td><td>${e(bv)}${mark('b', win)}</td></tr>`;
  const body = main(`
    ${crumbs([{ name: TOOL_NAME, href: appUrl() }, { name: c.h1 }])}
    <h1>${e(a.brand)} ${e(a.model)} vs ${e(b.brand)} ${e(b.model)}</h1>
    ${c.pair.angle ? `<p>${e(c.pair.angle)}.</p>` : ''}
    ${quizCta('Find your match with the free quiz')}
    <h2>Spec-by-spec comparison</h2>
    <table>
      <thead><tr><th>Spec</th><th>${shoeLink(a)}</th><th>${shoeLink(b)}</th></tr></thead>
      <tbody>
        ${row("Weight (men's US 9)", `${a.weightGrams} g`, `${b.weightGrams} g`, w.weight)}
        ${row('Cushioning (our 1–10 scale)', `${a.cushioning}/10`, `${b.cushioning}/10`, w.cushioning)}
        ${row('Heel-to-toe drop', `${a.dropMM} mm`, `${b.dropMM} mm`)}
        ${row('MSRP', `$${a.priceUSD}`, `$${b.priceUSD}`, w.price)}
        ${row('Category', a.category, b.category)}
        ${row('Terrain', a.terrain.join(', '), b.terrain.join(', '))}
        ${row('Support listed for', a.pronation.join(', '), b.pronation.join(', '))}
        ${row('Wide widths', a.widthOptions ? 'Yes' : 'No', b.widthOptions ? 'Yes' : 'No')}
        ${row('Best distances', a.bestDistances.join(', '), b.bestDistances.join(', '))}
      </tbody>
    </table>
    <h2>The verdict</h2>
    <ul>${verdictFor(a, b).map((v) => `<li>${e(v)}</li>`).join('')}</ul>
    <h2>Who should think twice</h2>
    <h3>${e(a.brand)} ${e(a.model)}</h3>
    <ul>${(getWatchOuts(a, undefined, 3).length ? getWatchOuts(a, undefined, 3) : ['Nothing stands out in the specs we track.']).map((x) => `<li>${e(x)}</li>`).join('')}</ul>
    <h3>${e(b.brand)} ${e(b.model)}</h3>
    <ul>${(getWatchOuts(b, undefined, 3).length ? getWatchOuts(b, undefined, 3) : ['Nothing stands out in the specs we track.']).map((x) => `<li>${e(x)}</li>`).join('')}</ul>
    <p>${amazonLink(a).trim()} ${amazonLink(b).trim()}</p>
    <h2>Frequently asked questions</h2>
    ${faqsHtml(comparisonFaqs(c))}
    <h2>More comparisons</h2>
    <ul>${getAllComparisons().filter((o) => o.slug !== c.slug).slice(0, 6).map((o) => `<li><a href="${appUrl(`compare/${o.slug}`)}">${e(o.a.brand)} ${e(o.a.model)} vs ${e(o.b.brand)} ${e(o.b.model)}</a></li>`).join('')}</ul>
    ${DISCLOSURE}
    ${MEDICAL}`);
  return { path: `compare/${c.slug}`, url: seo.canonical, title: seo.title, description: seo.description, robots: seo.robots, indexable: seo.indexable, headTags: renderHeadTags(seo), bodyHtml: body };
}

export function buildShoePage(shoe: Shoe): PrerenderedPage {
  const useCase = describeUseCase(shoe);
  const seo = shoeSeo(shoe, useCase);
  const newer = getNewerVersion(shoe);
  const watch = getWatchOuts(shoe, undefined, 4);
  const alternatives = getAlternatives(shoe, 4);
  const sameBrand = getSameBrand(shoe, 4);
  const comparisons = getRelatedComparisons(shoe.id);
  const brandDef = BRANDS.find((b) => b.name.toLowerCase() === shoe.brand.toLowerCase());
  const source = shoe.sourceURL
    ? `<a href="${e(shoe.sourceURL)}" rel="noopener">${e(shoe.brand)} product page</a>`
    : `<a href="${e(getManufacturerSourceURL(shoe))}" rel="noopener">${e(shoe.brand)} website</a> (we have no direct product link recorded, so please confirm the specs there)`;
  const body = main(`
    ${crumbs([{ name: TOOL_NAME, href: appUrl() }, ...(brandDef ? [{ name: brandDef.name, href: appUrl(`best-running-shoes/brand/${brandDef.slug}`) }] : []), { name: shoe.model }])}
    <h1>${e(shoe.brand)} ${e(shoe.model)} (${shoe.year})</h1>
    <p>${e(useCase)}. ${e(shoe.highlights.join(' · '))}.</p>
    ${newer ? `<p><strong>Previous generation:</strong> a newer version, the <a href="${appUrl(`shoes/${newer.id}`)}">${e(newer.brand)} ${e(newer.model)}</a>, is in our database.</p>` : ''}
    <h2>Specs</h2>
    <ul>
      <li>Weight: ${shoe.weightGrams} g (men's sample)</li>
      <li>Heel-to-toe drop: ${shoe.dropMM} mm</li>
      <li>Cushioning: ${shoe.cushioning}/10 (our own scale)</li>
      <li>Terrain: ${e(shoe.terrain.join(', '))}</li>
      <li>Support listed for: ${e(shoe.pronation.join(', '))}</li>
      <li>Wide widths: ${shoe.widthOptions ? 'yes' : 'not listed'}</li>
      <li>Launch price: $${shoe.priceUSD} MSRP (${e(getPriceTier(shoe.priceUSD).label)})</li>
    </ul>
    <p>Spec source: ${source}. Shoe data last reviewed ${e(SHOE_DATABASE_LAST_UPDATED_LABEL)}.</p>
    <p>${amazonLink(shoe).trim()}</p>
    ${quizCta('See if it matches your answers')}
    <h2>Who should think twice</h2>
    <ul>${(watch.length ? watch : ['Nothing stands out in the specs we track, but fit is personal, so try it on if you can.']).map((w) => `<li>${e(w)}</li>`).join('')}</ul>
    ${alternatives.length ? `<h2>Similar shoes</h2><ul>${alternatives.map((s) => `<li>${shoeLink(s)}: ${e(specLine(s))}</li>`).join('')}</ul>` : ''}
    ${sameBrand.length ? `<h2>More from ${e(shoe.brand)}</h2><ul>${sameBrand.map((s) => `<li>${shoeLink(s)}</li>`).join('')}</ul>` : ''}
    ${comparisons.length ? `<h2>Comparisons</h2><ul>${comparisons.map((c) => { const other = getShoeById(c.otherId); return other ? `<li><a href="${appUrl(`compare/${c.slug}`)}">${e(shoe.brand)} ${e(shoe.model)} vs ${e(other.brand)} ${e(other.model)}</a></li>` : ''; }).join('')}</ul>` : ''}
    <h2>Frequently asked questions</h2>
    ${faqsHtml(shoeFaqs(shoe, useCase))}
    ${DISCLOSURE}
    ${MEDICAL}`);
  return { path: `shoes/${shoe.id}`, url: seo.canonical, title: seo.title, description: seo.description, robots: seo.robots, indexable: seo.indexable, headTags: renderHeadTags(seo), bodyHtml: body };
}

/** Every entity page (brand, category, comparison, shoe) plus the methodology page. */
export function buildAllEntityPages(): PrerenderedPage[] {
  return [
    buildMethodologyPage(),
    ...BRANDS.map(buildBrandPage),
    ...CATEGORIES.map(buildCategoryPage),
    ...getAllComparisons().map(buildComparisonPage),
    ...shoeDatabase.map(buildShoePage),
  ];
}
