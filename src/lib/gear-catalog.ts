/**
 * Running gear we recommend next to the shoes ("Complete your kit").
 *
 * Every ASIN was checked against Amazon's own catalog (scripts/amazon-catalog.mjs gear): the product
 * title must contain `brand`, and the photo URL comes from the same listing, so the picture and the
 * Buy button always show and point at the same product. Gear is chosen from the runner's answers by
 * `selectGear`; none of it changes a shoe ranking.
 *
 * Wording is deliberately plain: what the product is and who it suits. No medical or performance promises.
 */
import type { QuizAnswers } from './quiz-data';
import type { Shoe } from './shoe-database';
import gearImages from './gear-image-cache.json';
import { amazonProductUrl } from './amazon-link';

export type GearCategory = 'watch' | 'heart-rate' | 'socks' | 'anti-chafe' | 'nutrition' | 'hydration' | 'light' | 'recovery';

export interface GearItem {
  id: string;
  asin: string;
  /** Short name shown on the card. */
  name: string;
  /** Brand name that must appear in the Amazon listing title. */
  brand: string;
  category: GearCategory;
  /** One plain sentence: what it is and who it suits. */
  why: string;
}

export const GEAR: GearItem[] = [
  { id: 'garmin-forerunner-165', asin: 'B0CT3SGHXL', name: 'Garmin Forerunner 165', brand: 'Garmin', category: 'watch', why: 'A GPS running watch for tracking pace, distance and heart rate. A good first serious watch.' },
  { id: 'garmin-forerunner-265', asin: 'B0BS1T9J4Y', name: 'Garmin Forerunner 265', brand: 'Garmin', category: 'watch', why: 'A step up in training features for runners working towards race goals.' },
  { id: 'garmin-forerunner-970', asin: 'B0F8QZ7233', name: 'Garmin Forerunner 970', brand: 'Garmin', category: 'watch', why: 'A premium multisport GPS watch for marathon and ultra training.' },
  { id: 'coros-pace-3', asin: 'B0CFQQ9FDL', name: 'COROS PACE 3', brand: 'COROS', category: 'watch', why: 'A lightweight GPS watch with long battery life at a friendlier price.' },
  { id: 'polar-h10', asin: 'B07PM54P4N', name: 'Polar H10 chest strap', brand: 'Polar', category: 'heart-rate', why: 'A chest-strap heart-rate sensor that pairs with most watches and apps.' },
  { id: 'balega-hidden-comfort', asin: 'B0C19RDWVF', name: 'Balega Hidden Comfort socks (3 pairs)', brand: 'Balega', category: 'socks', why: 'No-show running socks. Socks that fit well are the cheapest comfort upgrade there is.' },
  { id: 'body-glide', asin: 'B00288L2N6', name: 'Body Glide anti-chafe balm', brand: 'Body Glide', category: 'anti-chafe', why: 'An anti-chafe stick for long runs, warm days and tricky spots.' },
  { id: 'carbs-fuel-gel', asin: 'B0D94VYHR4', name: 'Carbs Fuel energy gels', brand: 'Carbs Fuel', category: 'nutrition', why: 'Carbohydrate gels to practise fuelling on long runs before race day.' },
  { id: 'ultima-electrolytes', asin: 'B08XQZX9K3', name: 'Ultima electrolyte packets', brand: 'Ultima', category: 'nutrition', why: 'Electrolyte drink mix for hot or long sessions.' },
  { id: 'nathan-speeddraw', asin: 'B07Y5L8Q9R', name: 'Nathan SpeedDraw Plus flask', brand: 'Nathan', category: 'hydration', why: 'An insulated handheld flask so you can carry water on long runs.' },
  { id: 'flipbelt-classic', asin: 'B00JF9EAHQ', name: 'FlipBelt running belt', brand: 'FlipBelt', category: 'hydration', why: 'A slim belt for your phone, keys and gels without a bouncing pocket.' },
  { id: 'petzl-actik-core', asin: 'B07RNMQC9Y', name: 'Petzl ACTIK CORE headlamp', brand: 'Petzl', category: 'light', why: 'A rechargeable headlamp for dawn, dusk and trail runs.' },
  { id: 'salomon-advance-skin-12', asin: 'B0GJV8D1FL', name: 'Salomon Advance Skin 12 vest', brand: 'Salomon', category: 'hydration', why: 'A hydration vest for long days on the trail.' },
  { id: 'triggerpoint-grid', asin: 'B0040EGNIU', name: 'TriggerPoint GRID foam roller', brand: 'TriggerPoint', category: 'recovery', why: 'A foam roller for easing off tight legs after a run.' },
];

interface GearImage {
  url: string;
  title: string;
  fetchedAt: string;
}
const IMAGES = gearImages as Record<string, GearImage>;

export interface GearCard extends GearItem {
  url: string;
  image: string | null;
}

const BY_ID = new Map(GEAR.map((g) => [g.id, g]));
const pick = (...ids: string[]) => ids.map((id) => BY_ID.get(id)).filter((g): g is GearItem => !!g);

/** Gear that suits this runner, most useful first, at most `limit`. */
export function selectGear(answers: QuizAnswers, limit = 6): GearItem[] {
  const longRunner = ['half-marathon', 'marathon', 'ultra'].includes(answers.distance) || answers.weeklyMileage >= 45;
  const rich = answers.budget.includes('200-plus') || answers.budget.includes('150-200');
  const trail = answers.terrain === 'trail' || answers.distance === 'ultra';
  const out: GearItem[] = [];

  if (answers.distance === 'marathon' || answers.distance === 'ultra') out.push(...pick(rich ? 'garmin-forerunner-970' : 'garmin-forerunner-265'));
  else if (answers.distance === 'half-marathon') out.push(...pick('garmin-forerunner-265'));
  else out.push(...pick(rich ? 'garmin-forerunner-265' : 'garmin-forerunner-165'));

  out.push(...pick('balega-hidden-comfort'));
  if (trail) out.push(...pick('petzl-actik-core', answers.distance === 'ultra' ? 'salomon-advance-skin-12' : 'nathan-speeddraw'));
  if (longRunner) out.push(...pick('carbs-fuel-gel', 'ultima-electrolytes', 'body-glide'));
  else out.push(...pick('body-glide'));
  if (!trail && longRunner) out.push(...pick('flipbelt-classic'));
  out.push(...pick('triggerpoint-grid'));
  if (answers.weeklyMileage >= 40 && !out.some((g) => g.category === 'heart-rate')) out.push(...pick('polar-h10'));

  // Fill up to a full grid (3 x 2 on desktop, 2 x 3 on a phone) with the most broadly useful items left.
  out.push(...pick('flipbelt-classic', 'polar-h10', 'triggerpoint-grid', 'nathan-speeddraw', 'ultima-electrolytes', 'body-glide', 'carbs-fuel-gel'));

  const seen = new Set<string>();
  return out.filter((g) => (seen.has(g.asin) ? false : (seen.add(g.asin), true))).slice(0, limit);
}

/** Gear for a shoe's own page: what a runner who buys this shoe is likely to need. */
export function selectGearForShoe(shoe: Pick<Shoe, 'category' | 'terrain' | 'bestDistances'>, limit = 4): GearItem[] {
  const distance = shoe.bestDistances.includes('ultra') ? 'ultra' : shoe.bestDistances.includes('marathon') ? 'marathon' : shoe.bestDistances.includes('half-marathon') ? 'half-marathon' : '10k';
  return selectGear(
    {
      footType: 'neutral', pronation: 'neutral', weeklyMileage: distance === '10k' ? 25 : 45, distance,
      terrain: shoe.category === 'trail' || shoe.terrain.includes('trail') ? 'trail' : 'road',
      paceGoal: 'moderate', injuries: ['none'], brand: [], budget: [],
    },
    limit,
  );
}

/** A gear item with its Amazon link and the photo from the same listing. */
export function toGearCard(item: GearItem): GearCard {
  return { ...item, url: amazonProductUrl(item.asin), image: IMAGES[item.asin]?.url ?? null };
}
