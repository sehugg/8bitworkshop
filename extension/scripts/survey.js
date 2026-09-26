// Starts each platform in out/emuworker.js and reports whether frames arrive.
// usage: node scripts/survey.js [platform...]   (after npm run build)
const { Worker } = require('worker_threads');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const OUT = ROOT + '/extension/out';
function rpcWorker(file) {
  const w = new Worker(path.join(OUT, file), { workerData: { rootDir: ROOT }, stdout: true, stderr: true });
  let id = 1; const pending = new Map(); const events = [];
  w.on('message', m => {
    if (m.t === 'result') { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.value); }
    else if (m.t === 'event') events.push(m);
  });
  w.on('error', e => { for (const p of pending.values()) p.rej(e); });
  return { w, events, call: (method, ...args) => new Promise((res, rej) => { const i = id++; pending.set(i, { res, rej }); w.postMessage({ t: 'call', id: i, method, args }); }) };
}
function romFor(id) {
  for (const d of [id, id.split('-')[0], id.split('.')[0]]) {
    const dir = path.join(ROOT, 'test/roms', d);
    if (fs.existsSync(dir)) { const f = fs.readdirSync(dir).filter(f => /\.rom$|\.bin$/.test(f))[0]; if (f) return { rom: new Uint8Array(fs.readFileSync(path.join(dir, f))), name: d + '/' + f }; }
  }
  return { rom: new Uint8Array(+(process.env.ROMSIZE || 0x8000)), name: 'zeros' };
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
(async () => {
  const b = rpcWorker('buildworker.js');
  const ids = process.argv[2] ? process.argv.slice(2) : await b.call('listPlatforms');
  await b.w.terminate();
  for (const id of ids) {
    const { rom, name } = romFor(id);
    const e = rpcWorker('emuworker.js');
    let result;
    try {
      await withTimeout(e.call('start', id, rom), 8000);
      await new Promise(r => setTimeout(r, 1500));
      const frames = e.events.filter(x => x.name === 'frame');
      const halted = e.events.find(x => x.name === 'status' && x.data?.state === 'halted');
      if (halted) result = 'HALTED: ' + halted.data.message;
      else if (!frames.length) result = 'NO FRAMES';
      else {
        const px = new Uint32Array(frames[frames.length-1].data.pixels);
        result = `ok ${frames.length} frames ${frames[0].data.width}x${frames[0].data.height}` + (px.some(p => p !== px[0]) ? '' : ' (blank)');
      }
    } catch (err) { result = 'FAIL: ' + String(err.message).split('\n')[0].slice(0, 140); }
    console.log(`${id}\t${name}\t${result}`);
    await e.w.terminate().catch(() => {});
  }
  process.exit(0);
})();
