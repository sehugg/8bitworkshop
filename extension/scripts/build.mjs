// Bundles the extension with esbuild (from the repo's node_modules).
//
//   node scripts/build.mjs           # one build
//   node scripts/build.mjs --watch   # rebuild on change
//
// extension.js stays small; builds and emulation run in worker threads
// (buildworker.js, emuworker.js) that start on first use.
import esbuild from 'esbuild';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');
const tests = readdirSync(path.join(root, 'test'))
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => [`test/${f.slice(0, -3)}`, `test/${f}`]);

const ctx = await esbuild.context({
  absWorkingDir: root,
  entryPoints: {
    extension: 'src/extension.ts',
    buildworker: 'src/buildworker.ts',
    emuworker: 'src/emuworker.ts',
    ...Object.fromEntries(tests),
  },
  outdir: 'out',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
  // These resolve from the repo's node_modules at runtime: jsdom (for
  // installNodeMocks) doesn't bundle, and binaryen (verilog) is 51MB.
  external: ['vscode', 'jsdom', 'canvas', 'binaryen'],
  logLevel: 'warning',
});
if (watch) {
  await ctx.watch();
  console.error('[esbuild] watching extension');
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
