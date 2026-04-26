#!/usr/bin/env node
/**
 * Shoe database validation script.
 *
 * Run via:  bun run scripts/validate-shoe-database.mjs
 *
 * Catches bad data BEFORE it ships:
 *  1. Required fields missing or empty
 *  2. Numeric specs out of plausible range (weight, drop, cushioning)
 *  3. Stale entries (lastVerified > 180 days ago)
 *  4. Invalid pronation/terrain/distance enums
 *  5. Duplicate IDs
 *
 * Exits with non-zero status if any errors found, so it can gate CI/build.
 */
import { shoeDatabase } from '../src/lib/shoe-database.ts';

const STALE_DAYS = 180;
const MIN_WEIGHT = 130; // racing flat lower bound
const MAX_WEIGHT = 420; // max-cushion trail upper bound
const MAX_DROP = 14;
const MIN_DROP = 0;

const VALID_PRONATION = new Set(['neutral', 'overpronation', 'underpronation']);
const VALID_TERRAIN = new Set(['road', 'trail', 'track']);
const VALID_CATEGORY = new Set(['daily', 'speed', 'race', 'trail', 'max-cushion', 'stability', 'hybrid']);

const errors = [];
const warnings = [];
const seenIds = new Set();

for (const shoe of shoeDatabase) {
  const ctx = `${shoe.brand} ${shoe.model} (${shoe.id})`;

  // Required fields
  for (const field of ['id', 'brand', 'model', 'category', 'amazonASIN', 'reviewURL']) {
    if (!shoe[field] || String(shoe[field]).trim() === '') {
      errors.push(`${ctx}: missing required field "${field}"`);
    }
  }

  // Duplicate IDs
  if (seenIds.has(shoe.id)) {
    errors.push(`${ctx}: duplicate id "${shoe.id}"`);
  }
  seenIds.add(shoe.id);

  // Numeric ranges
  if (shoe.weightGrams < MIN_WEIGHT || shoe.weightGrams > MAX_WEIGHT) {
    errors.push(`${ctx}: weightGrams ${shoe.weightGrams}g outside plausible range ${MIN_WEIGHT}–${MAX_WEIGHT}`);
  }
  if (shoe.dropMM < MIN_DROP || shoe.dropMM > MAX_DROP) {
    errors.push(`${ctx}: dropMM ${shoe.dropMM} outside plausible range ${MIN_DROP}–${MAX_DROP}`);
  }
  if (shoe.cushioning < 1 || shoe.cushioning > 10) {
    errors.push(`${ctx}: cushioning ${shoe.cushioning} must be 1–10`);
  }
  if (shoe.priceUSD <= 0) {
    errors.push(`${ctx}: priceUSD must be positive (got ${shoe.priceUSD})`);
  }

  // Enum validation
  if (!VALID_CATEGORY.has(shoe.category)) {
    errors.push(`${ctx}: invalid category "${shoe.category}"`);
  }
  for (const p of shoe.pronation) {
    if (!VALID_PRONATION.has(p)) errors.push(`${ctx}: invalid pronation "${p}"`);
  }
  for (const t of shoe.terrain) {
    if (!VALID_TERRAIN.has(t)) errors.push(`${ctx}: invalid terrain "${t}"`);
  }

  // Freshness check (warning only — not all entries have lastVerified yet)
  if (shoe.lastVerified) {
    const verified = new Date(shoe.lastVerified).getTime();
    if (Number.isNaN(verified)) {
      errors.push(`${ctx}: lastVerified "${shoe.lastVerified}" is not a valid date`);
    } else {
      const ageDays = Math.floor((Date.now() - verified) / (1000 * 60 * 60 * 24));
      if (ageDays > STALE_DAYS) {
        warnings.push(`${ctx}: specs last verified ${ageDays} days ago (>${STALE_DAYS} day threshold)`);
      }
    }
  }

  // Source URL sanity
  if (shoe.sourceURL && !/^https?:\/\//i.test(shoe.sourceURL)) {
    errors.push(`${ctx}: sourceURL must be an absolute http(s) URL`);
  }
  if (shoe.reviewURL && !/^https?:\/\//i.test(shoe.reviewURL)) {
    errors.push(`${ctx}: reviewURL must be an absolute http(s) URL`);
  }
}

// Coverage stats
const total = shoeDatabase.length;
const verified = shoeDatabase.filter(s => s.lastVerified).length;
const sourced = shoeDatabase.filter(s => s.sourceURL).length;

console.log('');
console.log('━━━ Shoe Database Validation ━━━');
console.log(`Total shoes:         ${total}`);
console.log(`With lastVerified:   ${verified} (${Math.round(verified / total * 100)}%)`);
console.log(`With sourceURL:      ${sourced} (${Math.round(sourced / total * 100)}%)`);
console.log('');

if (warnings.length) {
  console.log(`⚠  ${warnings.length} warning(s):`);
  warnings.forEach(w => console.log('   ' + w));
  console.log('');
}

if (errors.length) {
  console.error(`✗  ${errors.length} error(s):`);
  errors.forEach(e => console.error('   ' + e));
  console.error('');
  process.exit(1);
}

console.log('✓  All shoe records pass validation.');
process.exit(0);
