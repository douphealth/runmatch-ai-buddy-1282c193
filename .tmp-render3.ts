import jsPDF from 'jspdf';
import fs from 'node:fs';
import path from 'node:path';
const PUBLIC = path.join(process.cwd(), 'public');
(globalThis as any).fetch = async (url: any) => {
  const rel = String(url).replace(/^\/+/, '');
  const fp = path.join(PUBLIC, rel);
  if (!fs.existsSync(fp)) return { ok: false, status: 404, blob: async () => ({ size: 0, type: '' }) };
  const buf = fs.readFileSync(fp);
  const ext = path.extname(fp).toLowerCase();
  const type = ext === '.png' ? 'image/png' : 'image/jpeg';
  return { ok: true, status: 200, blob: async () => ({ size: buf.length, type, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) }) };
};
class FR { result: any = null; onloadend: any = null; onerror: any = null; readAsDataURL(blob: any) { Promise.resolve().then(() => blob.arrayBuffer()).then((ab: any) => { this.result = `data:${blob.type};base64,${Buffer.from(ab).toString('base64')}`; if (this.onloadend) this.onloadend(); }); } }
(globalThis as any).FileReader = FR;

// Wrap constructor to intercept save on every instance
const lastDocs: any[] = [];
const Orig: any = jsPDF;
const Wrapped: any = function(...args: any[]) {
  const inst = new Orig(...args);
  lastDocs.push(inst);
  inst.save = function() { /* intercepted */ };
  return inst;
};
Wrapped.prototype = Orig.prototype;
// Replace named export by mutating module isn't trivial; instead monkey-patch via prototype-not-applicable. Simplest: patch each new doc by hooking Object.assign in module via... actually patch the addPage path won't work. Use a require hook approach — we'll just spy on jsPDF default by replacing its setProperty in the module namespace.

import * as jsPdfMod from 'jspdf';
console.log('mod keys', Object.keys(jsPdfMod));
