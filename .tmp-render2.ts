import jsPDF from 'jspdf';
import fs from 'node:fs';
import path from 'node:path';
const PUBLIC = path.join(process.cwd(), 'public');
(globalThis as any).fetch = async (url: any) => {
  const rel = String(url).replace(/^\/+/, '');
  const fp = path.join(PUBLIC, rel);
  if (!fs.existsSync(fp)) { console.log('miss', rel); return { ok: false, status: 404, blob: async () => ({ size: 0, type: '' }) }; }
  const buf = fs.readFileSync(fp);
  const ext = path.extname(fp).toLowerCase();
  const type = ext === '.png' ? 'image/png' : 'image/jpeg';
  return { ok: true, status: 200, blob: async () => ({ size: buf.length, type, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) }) };
};
class FR { result: any = null; onloadend: any = null; onerror: any = null; readAsDataURL(blob: any) { Promise.resolve().then(() => blob.arrayBuffer()).then((ab: any) => { this.result = `data:${blob.type};base64,${Buffer.from(ab).toString('base64')}`; if (this.onloadend) this.onloadend(); }); } }
(globalThis as any).FileReader = FR;
let savedDoc: any = null;
const _save = (jsPDF as any).prototype.save;
(jsPDF as any).prototype.save = function(filename: string) { console.log('SAVE called'); savedDoc = this; };

console.log('importing...');
const m = await import('./src/lib/pdf-generator');
console.log('imported, generating...');

const answers: any = { footType: 'flat', pronation: 'overpronation', weeklyMileage: 30, distance: '10k', terrain: 'trail', paceGoal: 'moderate', injuries: ['shin-splints', 'it-band'], brand: ['nike', 'asics'], budget: ['100-150', '150-200'] };
const mkShoe = (id: string, brand: string, model: string): any => ({ id, brand, model, priceUSD: 145, weightGrams: 268, dropMM: 8, cushioning: 8, highlights: ['A','B','C'], reviewURL: 'https://x', imageURL: '' });
const rotation: any = { primary: { shoe: mkShoe('s1','Adidas','Adizero Boston 12'), matchPercent: 96, reasons: ['r1','r2'] }, speed: { shoe: mkShoe('s2','Adidas','Adios Pro 4'), matchPercent: 91, reasons: [] }, longRun: { shoe: mkShoe('s3','Adidas','Adizero Adios Pro 3'), matchPercent: 88, reasons: [] } };
const recommendation: any = { shoeProfile: { summary: 'sum', category: 'Stability', cushioning: 'Mod', dropRange: '6-10', supportType: 'Guided' }, whyItWorks: 'why', trainingEmphasis: ['t1','t2','t3','t4'] };
const radarData = [{axis:'A',value:5},{axis:'B',value:6},{axis:'C',value:7},{axis:'D',value:8},{axis:'E',value:7},{axis:'F',value:6}];

try {
  const r = m.generateResultsPDF({ answers, recommendation, rotation, radarData } as any);
  console.log('returned promise', r);
  await r;
  console.log('done awaited');
} catch(e) { console.error('ERR', e); }
await new Promise(r => setTimeout(r, 300));
console.log('savedDoc?', !!savedDoc);
if (savedDoc) {
  fs.writeFileSync('/tmp/pdf-qa/sample.pdf', Buffer.from(savedDoc.output('arraybuffer')));
  console.log('wrote');
}
