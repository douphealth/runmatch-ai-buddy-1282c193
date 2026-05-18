import { writeFileSync } from 'fs';
import { JSDOM } from 'jsdom';

// Polyfill browser globals for jsPDF
const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement;
globalThis.fetch = async () => { throw new Error('no fetch'); };
globalThis.FileReader = dom.window.FileReader;
globalThis.Blob = dom.window.Blob;

// Mock jspdf save
const { default: jsPDF } = await import('jspdf');
const origSave = jsPDF.prototype.save;
jsPDF.prototype.save = function(name) {
  const buf = Buffer.from(this.output('arraybuffer'));
  writeFileSync('/tmp/out.pdf', buf);
  console.log('saved', name, buf.length);
};

const { generateResultsPDF } = await import('/dev-server/src/lib/pdf-generator.ts');

const shoe = (id, brand, model) => ({
  shoe: { id, brand, model, priceUSD: 165, weightGrams: 258, dropMM: 8, cushioning: 8,
    terrain: ['road'], widthOptions: true, amazonASIN: 'B0XXX', imageURL: '', reviewURL: 'https://gearuptofit.com/r/'+id,
    highlights: ['Plush PEBA midsole for daily comfort and recovery runs', 'Engineered mesh upper breathes well in heat', 'Durable rubber outsole rated to 700+ km'] },
  matchPercent: 96,
  reasons: ['Matches your neutral pronation and 30 km/week training load perfectly', 'Drop and stack height align with your half-marathon road training goal'],
});

await generateResultsPDF({
  answers: { footType:'neutral', pronation:'neutral', weeklyMileage:30, distance:'half-marathon',
    terrain:'road', paceGoal:'moderate', injuries:['it-band'], brand:['nike','asics'], budget:['100-150','150-200'] },
  recommendation: {
    shoeProfile: { category: 'Daily Trainer', cushioning: 'Maximum', dropRange:'8–10mm', supportType:'Neutral',
      summary:'A maximum-cushioned neutral daily trainer with an 8–10mm heel-to-toe drop, optimized for road half-marathon training at 30 km per week with IT band history.' },
    categoryExplanation: 'Your neutral foot benefits from a balanced daily trainer.',
    rotation: [], trainingEmphasis: [
      'Include one tempo run (20–30 min at threshold pace) per week.',
      'Build your long run gradually to 18–20 km over 8–10 weeks.',
      'Add strides after easy runs to build leg turnover and economy.',
      'Incorporate strength training 2x/week focusing on hip and core stability.',
    ],
    whyItWorks:'Based on your neutral foot type and pronation pattern, neutral cushioned shoes provide a balanced ride. At 30 km/week targeting half-marathon distance on road, maximum cushioning protects your joints over repeated mileage while remaining responsive enough for tempo work and race-pace segments.',
    slug:'',
  },
  rotation: { primary: shoe('s1','Nike','Pegasus 41'), speed: shoe('s2','Saucony','Endorphin Speed 4'), longRun: shoe('s3','Hoka','Bondi 9') },
  radarData: [
    {axis:'Cushion',value:8},{axis:'Stability',value:6},{axis:'Speed',value:7},
    {axis:'Durability',value:8},{axis:'Comfort',value:9},{axis:'Value',value:7},
  ],
});
