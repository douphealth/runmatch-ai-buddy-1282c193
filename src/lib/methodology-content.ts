/**
 * Content model for the methodology page. Rendered by the React page and by the
 * build-time prerenderer from this one structure, and computed from the real
 * engine constants and database, so the published explanation cannot drift from
 * how shoes are actually scored.
 */
import {
  FACTOR_LABELS,
  INJURY_RACE_PENALTY,
  INJURY_SPEED_PENALTY,
  PREVIOUS_GENERATION_PENALTY,
  SCORING_FAMILIARITY_WEIGHT,
  SCORING_WEIGHTS,
} from './scoring-engine';
import { shoeDatabase } from './shoe-database';
import { EVIDENCE } from './evidence';
import { EDITORIAL } from './editorial';
import { SHOE_DATABASE_LAST_UPDATED, SHOE_DATABASE_LAST_UPDATED_LABEL } from './price-tier';
import { getNewerVersion } from './shoe-insights';

export type Block =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'links'; items: { label: string; href: string; note?: string }[] };

export interface Section {
  id: string;
  heading: string;
  blocks: Block[];
}

export const METHODOLOGY_TITLE = 'How RunMatch Scores Running Shoes: Methodology, Weights and Sources';
export const METHODOLOGY_DESCRIPTION =
  'How RunMatch AI ranks running shoes: the nine scoring factors and weights, how injuries and older models are handled, where the data comes from, and the research used.';
export const METHODOLOGY_LAST_REVIEWED = SHOE_DATABASE_LAST_UPDATED;

const FACTOR_DESCRIPTIONS: Record<keyof typeof SCORING_WEIGHTS, string> = {
  terrain: 'Does the shoe list the surface you run on (road, trail or track)? Shoes built for a different surface get partial or no credit.',
  distance: 'Is the shoe listed as a good fit for your usual race distance?',
  pronation: 'Does the shoe list support for your gait (neutral, overpronation or underpronation)? "Not sure" favours versatile neutral shoes. We treat this as comfort and fit, not injury prevention.',
  footType: 'Flat feet, high arches or a wide forefoot: checks width options, support and cushioning against what you told us.',
  injury: 'Whether the shoe is listed as a comfort-friendly choice for the issues you selected. See "Pain and injuries" below.',
  budget: 'How close the shoe’s launch price (MSRP) is to the ranges you selected.',
  brand: 'A light tie-breaker for brands you prefer. No preference means no penalty.',
  pace: 'Matches the shoe’s role (daily trainer, speed shoe, race shoe) to your usual training intensity.',
  mileage: 'Higher weekly mileage favours more cushioning; lower mileage favours beginner-friendly shoes.',
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function getMethodologySections(): Section[] {
  const total = shoeDatabase.length;
  const brands = new Set(shoeDatabase.map((s) => s.brand.toLowerCase())).size;
  const withSource = shoeDatabase.filter((s) => !!s.sourceURL).length;
  const previousGen = shoeDatabase.filter((s) => getNewerVersion(s)).length;
  const familiarityShare = SCORING_FAMILIARITY_WEIGHT / (1 + SCORING_FAMILIARITY_WEIGHT);

  return [
    {
      id: 'what-it-does',
      heading: 'What RunMatch does',
      blocks: [
        { type: 'p', text: 'RunMatch AI is a scoring tool, not a black box and not a chatbot. You answer a short quiz; every shoe in our database is scored against your answers with the fixed rules below; the highest scores become your shortlist. The same answers always produce the same ranking, and every result shows which factors drove each score so you can disagree with it.' },
      ],
    },
    {
      id: 'scoring',
      heading: 'How a score is calculated',
      blocks: [
        { type: 'p', text: 'Each shoe gets a 0 to 100% fit on nine factors. Each fit is multiplied by the factor’s weight and the results are added up. That total is the match percentage you see.' },
        {
          type: 'table',
          head: ['Factor', 'Weight', 'What it checks'],
          rows: (Object.keys(SCORING_WEIGHTS) as (keyof typeof SCORING_WEIGHTS)[])
            .sort((a, b) => SCORING_WEIGHTS[b] - SCORING_WEIGHTS[a])
            .map((k) => [FACTOR_LABELS[k], pct(SCORING_WEIGHTS[k]), FACTOR_DESCRIPTIONS[k]]),
        },
        { type: 'p', text: `Optional tenth factor: if you name a shoe you already run in, "Feel of your current shoe" is added with about ${pct(familiarityShare)} of the total weight (the other nine are scaled down proportionally). It rewards shoes with similar cushioning, drop and weight, prefers a direct newer version of the same shoe, and uses what you dislike about your current shoe (too firm, too soft, too heavy, too narrow) to steer away from the same problem.` },
      ],
    },
    {
      id: 'adjustments',
      heading: 'Adjustments and tie-breaks',
      blocks: [
        {
          type: 'ul',
          items: [
            `Previous generation: a shoe that has a newer version of the same model in our database loses ${Math.round(PREVIOUS_GENERATION_PENALTY * 100)} points, so the current version ranks first. ${previousGen} of ${total} shoes are currently flagged this way.`,
            `Pain or injury reported: race-day shoes lose ${Math.round(INJURY_RACE_PENALTY * 100)} points and speed shoes lose ${Math.round(INJURY_SPEED_PENALTY * 100)} points, and race shoes are left out of the rotation.`,
            'Ties: the newer model year wins, then the lighter shoe.',
            'No paid placement: commission, sponsorship and affiliate status are not inputs to the score.',
          ],
        },
      ],
    },
    {
      id: 'injuries',
      heading: 'Pain and injuries',
      blocks: [
        { type: 'p', text: 'If you report pain or an injury, RunMatch stops presenting a confident "perfect match". It shows a notice that shoes cannot diagnose or treat an injury, recommends seeing a physiotherapist, sports-medicine doctor or podiatrist for current pain, and gives a cautious, comfort-first shortlist. It is educational information, never medical advice.' },
      ],
    },
    {
      id: 'data',
      heading: 'Where the shoe data comes from',
      blocks: [
        { type: 'p', text: `The database holds ${total} shoes from ${brands} brands. Each record lists weight, heel-to-toe drop, terrain, intended distances, widths, launch price (MSRP) and a cushioning rating from 1 to 10. The cushioning rating is our own editorial scale, not a lab measurement. Launch prices are shown as MSRP tiers only; we never display live retail prices.` },
        { type: 'p', text: `Last reviewed: ${SHOE_DATABASE_LAST_UPDATED_LABEL}. ${withSource} of ${total} records currently link to a manufacturer page so you can check the specs yourself; we label the rest as compiled from manufacturer listings and ask you to confirm on the brand site. New models are added as we review them, so the newest releases can lag.` },
      ],
    },
    {
      id: 'research',
      heading: 'What the research says',
      blocks: [
        { type: 'p', text: 'Where a note on this site rests on research, it comes from the studies below, described at the strength the study supports. Observational studies show associations, not proof of cause.' },
        {
          type: 'links',
          items: EVIDENCE.map((e) => ({ label: e.citation, href: e.url, note: `${e.claim} ${e.design}` })),
        },
      ],
    },
    {
      id: 'money',
      heading: 'How we make money',
      blocks: [
        { type: 'p', text: 'As an Amazon Associate, GearUpToFit earns from qualifying purchases. Affiliate links are marked "sponsored", and there is a disclosure next to them. Ranking is computed before any link is attached, so earning a commission cannot move a shoe up the list.' },
        { type: 'links', items: [{ label: 'Affiliate disclosure', href: EDITORIAL.links.affiliateDisclosure }, { label: 'Editorial policy', href: EDITORIAL.links.editorialPolicy }] },
      ],
    },
    {
      id: 'limits',
      heading: 'Limits',
      blocks: [
        {
          type: 'ul',
          items: [
            'Fit is personal. Try shoes on, walk and jog in them, and trust comfort over a percentage.',
            'Specs describe a men’s sample size and can change between versions.',
            'A match percentage is a measure of how well a shoe fits your answers, not of how good the shoe is.',
          ],
        },
      ],
    },
    {
      id: 'corrections',
      heading: 'Corrections and updates',
      blocks: [
        { type: 'p', text: 'Spotted an out-of-date spec or a wrong photo? Tell us and we will fix it.' },
        { type: 'links', items: [{ label: 'Contact GearUpToFit', href: EDITORIAL.links.contact }, { label: 'About GearUpToFit', href: EDITORIAL.links.about }] },
      ],
    },
  ];
}
