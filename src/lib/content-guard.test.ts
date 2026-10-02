import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { EVIDENCE } from './evidence';

/**
 * Fails the build if claims we have removed on purpose creep back in.
 * Each rule exists because the pattern was found live in this codebase.
 */
const ROOT = 'src';
const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(p);
  }
};
walk(ROOT);

const read = (p: string) => readFileSync(p, 'utf8');

const FORBIDDEN: { why: string; pattern: RegExp; allow?: RegExp }[] = [
  { why: 'fabricated testimonial / review counts', pattern: /Verified subscriber|2,400\+ reviews|4\.9 ·|Marcus T\.|Sarah M\.|David K\.|Priya R\./ },
  { why: 'fake live-activity / usage counters', pattern: /just matched|runners matched|useLiveRunnerCount|Math\.random\(\) < 0\.4/ },
  { why: 'wrong or overstated rotation citation', pattern: /BJSM 2013|British Journal of Sports Medicine,? ?2015|Scand J Med Sci Sports, 2013|reduces? injury risk by (up to )?~?39%/ },
  { why: 'unverifiable retailer claims', pattern: /Free shipping|30-day returns|Verified retailer/i },
  { why: 'unverifiable quality badges', pattern: /Sports Science Backed|Expert Curated Database|2025\/2026 Models Only|AI-verified pick/ },
  { why: 'treatment prescriptions', pattern: /Calf raises 3|Eccentric heel drops|Tibialis raises|frozen bottle/ },
  { why: 'claiming prevention/treatment of injury', pattern: /prevent re-injury|reduce(s)? (your )?injury risk to|injury prevention exercises/i },
  { why: 'dead links to pages that do not exist', pattern: /gearuptofit\.com\/methodology\/|best-trail-running-shoes\// },
  { why: 'leaked developer note', pattern: /rechecked before publishing/ },
  { why: 'analytics that nothing reads', pattern: /event: 'lead_capture'/ },
];

describe('content guard', () => {
  for (const rule of FORBIDDEN) {
    it(`does not contain: ${rule.why}`, () => {
      const hits = files.filter((f) => rule.pattern.test(read(f)) && !(rule.allow && rule.allow.test(read(f)))).map((f) => relative('.', f));
      expect(hits).toEqual([]);
    });
  }

  it('affiliate links always carry rel="sponsored"', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = read(f);
      // Bare identifiers that hold an Amazon affiliate URL (not `article.url` / `s.url`, which are editorial links).
      const tags = src.match(/<a\b[^>]*href=\{(amazonUrl|rotationAmazonUrl|primaryAmazonUrl|url|aUrl|bUrl)\}[^>]*>/g) ?? [];
      for (const t of tags) if (!/sponsored/.test(t)) offenders.push(`${relative('.', f)}: ${t.slice(0, 80)}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe('evidence module', () => {
  it('links every study to a PubMed record and includes a DOI in its citation', () => {
    for (const e of EVIDENCE.filter((x) => x.type === 'study')) {
      expect(e.url, e.id).toMatch(/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$/);
      expect(e.citation, e.id).toMatch(/doi:10\.\d{4,}\//);
    }
  });

  it('describes observational evidence as an association, not proof', () => {
    const rotation = EVIDENCE.find((e) => e.id === 'rotation')!;
    expect(rotation.design).toMatch(/association, not proof/i);
    expect(rotation.design).toMatch(/observational/i);
  });
});
