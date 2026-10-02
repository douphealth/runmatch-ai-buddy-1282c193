/**
 * Verified research statements used anywhere the app makes a claim about
 * running-shoe science. Every entry below was checked against the primary
 * record (PubMed / Europe PMC) — title, authors, journal, year, PMID and the
 * quoted effect sizes all come from the published abstract.
 *
 * Rules for using this module:
 *  - Never restate a number from here in a different file; import it.
 *  - Keep the wording at the strength of the evidence (observational studies
 *    show associations; they do not prove that a shoe choice prevents injury).
 */

export interface EvidenceSource {
  id: 'rotation' | 'drop' | 'pronation-cohort' | 'arch-rct' | 'super-shoe' | 'replacement';
  /** Plain-language claim, phrased at the strength the study supports. */
  claim: string;
  /** Full bibliographic citation. */
  citation: string;
  /** Design / sample, shown so readers can judge the strength themselves. */
  design: string;
  url: string;
  type: 'study' | 'guideline';
}

export const EVIDENCE: readonly EvidenceSource[] = [
  {
    id: 'rotation',
    claim:
      'Runners who used more than one pair of running shoes had a lower risk of running-related injury than runners who used one pair.',
    citation:
      'Malisoux L, Ramesh J, Mann R, Seil R, Urhausen A, Theisen D. Can parallel use of different running shoes decrease running-related injury risk? Scand J Med Sci Sports. 2015;25(1):110–115. doi:10.1111/sms.12154',
    design:
      '22-week prospective observational study, 264 recreational runners. Hazard ratio 0.61 (95% CI 0.39–0.97). An association, not proof that rotating shoes prevents injury.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/24286345/',
    type: 'study',
  },
  {
    id: 'pronation-cohort',
    claim:
      'Moderate foot pronation was not associated with a higher injury risk in novice runners who wore a neutral shoe.',
    citation:
      'Nielsen RO, Buist I, Parner ET, et al. Foot pronation is not associated with increased injury risk in novice runners wearing a neutral shoe: a 1-year prospective cohort study. Br J Sports Med. 2014;48(6):440–447. doi:10.1136/bjsports-2013-092202',
    design: '1-year prospective cohort, 927 novice runners (1,854 feet).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/23766439/',
    type: 'study',
  },
  {
    id: 'arch-rct',
    claim:
      'Choosing running shoes to match foot-arch shape made little difference to injury rates in military basic training.',
    citation:
      'Knapik JJ, Trone DW, Tchandja J, Jones BH. Injury-reduction effectiveness of prescribing running shoes on the basis of foot arch height: summary of military investigations. J Orthop Sports Phys Ther. 2014;44(10):805–812. doi:10.2519/jospt.2014.5342',
    design:
      'Secondary analysis of 3 randomized controlled trials (US Army, Air Force, Marine Corps recruits). Pooled injury rate ratio 0.97 (95% CI 0.88–1.06 men, 0.85–1.08 women).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/25155917/',
    type: 'study',
  },
  {
    id: 'drop',
    claim:
      'Heel-to-toe drop changes how a runner lands, and the effect is not the same on a treadmill as on the road.',
    citation:
      'Chambon N, Delattre N, Guéguen N, Berton E, Rao G. Shoe drop has opposite influence on running pattern when running overground or on a treadmill. Eur J Appl Physiol. 2015;115(5):911–918. doi:10.1007/s00421-014-3072-x',
    design: 'Laboratory study, 12 healthy men, shoes with 0, 4 and 8 mm drop.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/25501676/',
    type: 'study',
  },
  {
    id: 'super-shoe',
    claim:
      'A prototype carbon-plated marathon shoe lowered the energy cost of running by about 4% compared with two established racing shoes.',
    citation:
      'Hoogkamer W, Kipp S, Frank JH, Farina EM, Luo G, Kram R. A comparison of the energetic cost of running in marathon racing shoes. Sports Med. 2018;48(4):1009–1019. doi:10.1007/s40279-017-0811-2',
    design:
      'Laboratory study, 18 runners, three speeds. Applies to that prototype versus the two comparison shoes, not to every carbon-plated shoe.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29143929/',
    type: 'study',
  },
  {
    id: 'replacement',
    claim: 'Running shoes are commonly replaced somewhere between roughly 500 and 800 km (300–500 miles).',
    citation: 'Manufacturer guidance: Nike, "How often should you replace running shoes?"',
    design:
      'Rule of thumb from a manufacturer guide, not a controlled study. Real lifespan depends on body weight, surface, foam and how you run.',
    url: 'https://www.nike.com/a/how-often-to-replace-running-shoes',
    type: 'guideline',
  },
];

export const getEvidence = (id: EvidenceSource['id']): EvidenceSource => {
  const found = EVIDENCE.find((e) => e.id === id);
  if (!found) throw new Error(`Unknown evidence id: ${id}`);
  return found;
};

/** One-sentence, accurately hedged rotation statement for FAQs, schema and copy. */
export const ROTATION_STATEMENT =
  'In a 22-week observational study of 264 recreational runners, using more than one pair of running shoes was associated with a lower risk of running-related injury (hazard ratio 0.61, 95% CI 0.39–0.97; Malisoux et al., Scand J Med Sci Sports, 2015). It is an association, not proof that rotating shoes prevents injury.';

/** Very short form for tight UI (badges, list items). */
export const ROTATION_STATEMENT_SHORT =
  'Multi-shoe use was linked to lower injury risk in an observational study (Malisoux et al., 2015)';

/** Used wherever the app discusses carbon-plated "super shoes". */
export const SUPER_SHOE_STATEMENT =
  'In a laboratory study of 18 runners, a prototype carbon-plated Nike marathon shoe lowered the energy cost of running by about 4% compared with two established racing shoes (Hoogkamer et al., Sports Med, 2018). Real-world gains vary by runner and by shoe, and they do not apply to every carbon-plated model.';

/** Used wherever the app discusses gait/pronation-based shoe choice. */
export const PRONATION_STATEMENT =
  'Research is mixed on whether matching shoes to pronation prevents injuries (Nielsen 2014; Knapik 2014), so RunMatch treats support as a comfort and fit preference, not an injury-prevention guarantee.';

/** Average shoe-replacement guidance shared by FAQs. */
export const REPLACEMENT_STATEMENT =
  'Many running shoes are replaced after roughly 500–800 km (300–500 miles), depending on your weight, surface and the foam. Replace sooner if the midsole feels flat or you notice new aches.';
