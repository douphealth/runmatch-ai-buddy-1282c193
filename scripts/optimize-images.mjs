#!/usr/bin/env node
/**
 * One-off / repeatable image optimiser. Keeps every file name and format, so no
 * code references change; it only makes the files smaller.
 *
 *   quiz step images  public/images/step-*.webp   -> max 1200px wide, WebP q72
 *   shoe photos       public/images/shoes/*.jpg   -> max 900px on the long side, JPEG q78 (mozjpeg)
 *   hero              public/images/hero-shoes.jpg -> max 1600px wide, JPEG q72
 *
 * A file is only replaced when the result is at least 10% smaller, so running
 * the script again is a no-op. It also (re)generates the 1200x630 social
 * preview image public/images/og-default.jpg from the hero photo.
 *
 * sharp is deliberately NOT a dependency (it is a native module and only needed
 * here). Install it temporarily:   npm i --no-save sharp
 *
 *   node scripts/optimize-images.mjs            # optimise in place
 *   node scripts/optimize-images.mjs --dry-run  # report only
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('[optimize-images] sharp is not installed. Run: npm i --no-save sharp');
  process.exit(1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMAGES = resolve(ROOT, 'public/images');
const DRY = process.argv.includes('--dry-run');

let before = 0;
let after = 0;

async function optimise(file, pipeline) {
  const input = await readFile(file);
  const output = await pipeline(sharp(input)).toBuffer();
  before += input.length;
  const saved = 1 - output.length / input.length;
  if (saved >= 0.1) {
    after += output.length;
    if (!DRY) await writeFile(file, output);
    console.log(`  ${file.replace(ROOT, '.').replace(/\\/g, '/').padEnd(58)} ${(input.length / 1024).toFixed(0).padStart(6)} KB -> ${(output.length / 1024).toFixed(0).padStart(5)} KB`);
  } else {
    after += input.length;
  }
}

const listed = async (dir, test) => (await readdir(dir)).filter(test).map((f) => join(dir, f));

console.log(DRY ? '[optimize-images] dry run' : '[optimize-images] optimising');

for (const f of await listed(IMAGES, (n) => /^step-.*\.webp$/.test(n))) {
  await optimise(f, (img) => img.resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 72, effort: 5 }));
}
for (const f of await listed(resolve(IMAGES, 'shoes'), (n) => /\.jpg$/.test(n) && n !== 'placeholder.jpg')) {
  await optimise(f, (img) =>
    img.resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }),
  );
}
await optimise(resolve(IMAGES, 'hero-shoes.jpg'), (img) =>
  img.resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 72, mozjpeg: true }),
);

console.log(`[optimize-images] ${(before / 1024 / 1024).toFixed(1)} MB -> ${(after / 1024 / 1024).toFixed(1)} MB`);

// Social preview image (1200x630): the hero photo, darkened at the bottom, with a title.
if (!DRY) {
  const W = 1200;
  const H = 630;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0F1217" stop-opacity="0.25"/><stop offset="0.55" stop-color="#0F1217" stop-opacity="0.78"/><stop offset="1" stop-color="#0F1217" stop-opacity="0.96"/>
    </linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <text x="64" y="420" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="76" fill="#ffffff">RunMatch AI</text>
    <text x="64" y="492" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="40" fill="#ffffff">Free running shoe finder quiz</text>
    <text x="64" y="546" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#e5e7eb">Matched to your feet, mileage and terrain · by GearUpToFit</text>
  </svg>`;
  const og = await sharp(await readFile(resolve(IMAGES, 'hero-shoes.jpg')))
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .composite([{ input: Buffer.from(svg) }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  await writeFile(resolve(IMAGES, 'og-default.jpg'), og);
  const s = await stat(resolve(IMAGES, 'og-default.jpg'));
  console.log(`[optimize-images] og-default.jpg ${W}x${H} (${(s.size / 1024).toFixed(0)} KB)`);
}
