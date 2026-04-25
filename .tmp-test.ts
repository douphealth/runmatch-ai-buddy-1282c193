class FR {
  result: any = null; onloadend: any = null; onerror: any = null;
  readAsDataURL(blob: any) {
    Promise.resolve().then(() => blob.arrayBuffer()).then((ab: any) => {
      const buf = Buffer.from(ab);
      this.result = `data:${blob.type};base64,${buf.toString('base64')}`;
      if (this.onloadend) this.onloadend();
    });
  }
}
const fr = new FR();
const p = new Promise<string>((resolve) => {
  fr.onloadend = () => resolve(fr.result);
  const fakeBlob = { type: 'image/png', arrayBuffer: async () => new ArrayBuffer(4) };
  fr.readAsDataURL(fakeBlob);
});
console.log('await:', (await p).slice(0, 50));
