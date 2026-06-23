import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { shoeDatabase, getShoeQualityState } from '../src/lib/shoe-database.ts';

const ROOT = resolve(import.meta.dirname, '..');
const HARD_STALE_DAYS = 430;
const MIN_WEIGHT = 130;
const MAX_WEIGHT = 420;
const MIN_DROP = 0;
const MAX_DROP = 14;
const VALID_PRONATION = new Set(['neutral', 'overpronation', 'underpronation']);
const VALID_TERRAIN = new Set(['road', 'trail', 'track']);
const VALID_CATEGORY = new Set(['daily', 'speed', 'race', 'trail', 'max-cushion', 'stability', 'hybrid']);
const now = new Date();
const errors = [];
const warnings = [];
const seen = new Set();
const genericReview = 'https://gearuptofit.com/review/best-running-shoes/';

function ageDays(date) {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return Infinity;
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}
function note(level, shoe, msg) {
  const line = `${shoe?.id || 'unknown'}: ${msg}`;
  (level === 'error' ? errors : warnings).push(line);
}

for (const shoe of shoeDatabase) {
  if (!shoe.id) note('error', shoe, 'missing id');
  if (seen.has(shoe.id)) note('error', shoe, 'duplicate shoe id');
  seen.add(shoe.id);
  if (!shoe.brand) note('error', shoe, 'missing brand');
  if (!shoe.model) note('error', shoe, 'missing model');
  if (!shoe.category) note('error', shoe, 'missing category');
  if (!Array.isArray(shoe.terrain) || shoe.terrain.length === 0) note('error', shoe, 'missing terrain');
  if (!Array.isArray(shoe.bestFor) || shoe.bestFor.length === 0) note('error', shoe, 'missing bestFor');
  if (typeof shoe.widthOptions !== 'boolean') note('error', shoe, 'missing widthOptions boolean');
  if (!shoe.imageURL) note('error', shoe, 'missing imageURL');

  if (typeof shoe.weightGrams !== 'number' || shoe.weightGrams < MIN_WEIGHT || shoe.weightGrams > MAX_WEIGHT) {
    note('error', shoe, `weightGrams outside plausible range ${MIN_WEIGHT}-${MAX_WEIGHT}`);
  }
  if (typeof shoe.dropMM !== 'number' || shoe.dropMM < MIN_DROP || shoe.dropMM > MAX_DROP) {
    note('error', shoe, `dropMM outside plausible range ${MIN_DROP}-${MAX_DROP}`);
  }
  if (typeof shoe.cushioning !== 'number' || shoe.cushioning < 1 || shoe.cushioning > 10) {
    note('error', shoe, 'cushioning must be 1-10');
  }
  if (typeof shoe.priceUSD !== 'number' || shoe.priceUSD <= 0) {
    note('error', shoe, 'priceUSD must be positive');
  }
  if (shoe.category && !VALID_CATEGORY.has(shoe.category)) note('error', shoe, `invalid category: ${shoe.category}`);
  if (Array.isArray(shoe.terrain)) {
    for (const t of shoe.terrain) if (!VALID_TERRAIN.has(t)) note('error', shoe, `invalid terrain: ${t}`);
  }
  if (Array.isArray(shoe.pronation)) {
    for (const p of shoe.pronation) if (!VALID_PRONATION.has(p)) note('error', shoe, `invalid pronation: ${p}`);
  }

  if (shoe.imageURL?.startsWith('/')) {
    const localPath = resolve(ROOT, 'public', shoe.imageURL.replace(/^\//, ''));
    if (!existsSync(localPath)) note('error', shoe, `missing local image file: ${shoe.imageURL}`);
  }

  const q = getShoeQualityState(shoe);
  const placeholder = !shoe.imageURL || shoe.imageURL.includes('placeholder');
  const isGenericReview = !shoe.reviewURL || shoe.reviewURL === genericReview || /\/review\/best-running-shoes\/?$/.test(shoe.reviewURL);
  const stale = ageDays(shoe.lastVerified) > HARD_STALE_DAYS;

  if (q.isIndexable) {
    if (placeholder) note('error', shoe, 'isIndexable true with placeholder image');
    if (!shoe.sourceURL) note('error', shoe, 'isIndexable true with missing sourceURL');
    if (isGenericReview) note('error', shoe, 'isIndexable true with generic reviewURL only');
    if (stale) note('error', shoe, 'isIndexable true with stale lastVerified');
    if (shoe.amazonASIN === 'SEARCH') note('error', shoe, 'isIndexable true with amazonASIN SEARCH');
  }

  if (shoe.amazonASIN === 'SEARCH') note('warning', shoe, 'amazonASIN SEARCH fallback; not affiliate-ready for indexable product pages');
  if (isGenericReview) note('warning', shoe, 'generic review URL; use a specific GearUpToFit review before indexation');
  if (placeholder) note('warning', shoe, 'placeholder image; recommendation-only unless replaced');
  if (!shoe.amazonASIN) note('warning', shoe, 'missing affiliate URL/ASIN');
  if (!shoe.reviewURL) note('warning', shoe, 'missing review URL');
  if (!shoe.sourceURL) note('warning', shoe, 'sourceURL not from authoritative source or missing');
  if (shoe.year && shoe.year < now.getUTCFullYear() - 2) note('warning', shoe, 'older model year; verify still relevant');
}

console.log(`[validate:shoes] checked ${shoeDatabase.length} shoes`);
if (warnings.length) {
  console.warn(`[validate:shoes] warnings (${warnings.length})`);
  for (const w of warnings.slice(0, 120)) console.warn(`  - ${w}`);
  if (warnings.length > 120) console.warn(`  ... ${warnings.length - 120} more warnings`);
}
if (errors.length) {
  console.error(`[validate:shoes] hard errors (${errors.length})`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('[validate:shoes] passed hard quality gates');
