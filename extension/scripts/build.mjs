// Bundles the extension with esbuild (from the repo's node_modules).
//
//   node scripts/build.mjs           # one build
//   node scripts/build.mjs --watch   # rebuild on change
//
// extension.js stays small; builds and emulation run in worker threads
// (buildworker.js, emuworker.js) that start on first use. 8bws.js is the
// command line tool for the integrated terminal (src/cli.ts). presetindex.js
// writes out/presets.json and syntaxes.js writes out/syntaxes/ (npm run
// build runs both).
import esbuild from 'esbuild';
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');

/** Evaluate a dependency-free TypeScript module (path relative to this script's directory) and return its exports. */
function loadTs(file) {
  const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), file);
  const out = esbuild.buildSync({ entryPoints: [entry], bundle: true, write: false, format: 'cjs', platform: 'node', logLevel: 'error' });
  const mod = { exports: {} };
  new Function('module', 'exports', out.outputFiles[0].text)(mod, mod.exports);
  return mod.exports;
}
const tests = readdirSync(path.join(root, 'test'))
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => [`test/${f.slice(0, -3)}`, `test/${f}`]);

// jsdom finds its sync-XHR worker script with require.resolve when it loads,
// which fails once bundled. Nothing uses jsdom's XHR (workerlib has its own),
// so drop the lookup.
const jsdomNoSyncXHR = {
  name: 'jsdom-no-sync-xhr',
  setup(build) {
    build.onLoad({ filter: /jsdom[\\/]lib[\\/]jsdom[\\/]living[\\/]xhr[\\/]XMLHttpRequest-impl\.js$/ }, args => {
      var src = readFileSync(args.path, 'utf-8');
      var out = src.replace('require.resolve ? require.resolve("./xhr-sync-worker.js") : null', 'null');
      if (out === src) throw new Error('jsdom-no-sync-xhr: pattern not found; check the jsdom version');
      return { contents: out, loader: 'js' };
    });
  },
};

// Emulators left out of the bundle (EXCLUDED_PLATFORM_MODULES in
// src/tools/exclusions.ts, which holds every exclusion). Each platform module
// is replaced with an empty one, so the emulator isn't compiled in; loading
// the platform then fails with the usual "Platform '<id>' not found".
const { EXCLUDED_PLATFORM_MODULES } = loadTs('../../src/tools/exclusions.ts');
const excludePlatforms = {
  name: 'exclude-platforms',
  setup(build) {
    const re = new RegExp('[\\\\/](' + EXCLUDED_PLATFORM_MODULES.join('|') + ')$');
    build.onResolve({ filter: re }, (args) => ({ path: args.path, namespace: 'exclude-platforms' }));
    build.onLoad({ filter: /.*/, namespace: 'exclude-platforms' }, () => ({ contents: 'module.exports = {};', loader: 'js' }));
  },
};

const ctx = await esbuild.context({
  absWorkingDir: root,
  entryPoints: {
    extension: 'src/extension.ts',
    buildworker: 'src/buildworker.ts',
    emuworker: 'src/emuworker.ts',
    '8bws': 'src/cli.ts',
    presetindex: 'scripts/presetindex.ts',
    assetpack: 'scripts/assetpack.ts',
    syntaxes: 'scripts/syntaxes.ts',
    clangcheck: 'scripts/clangcheck.ts',
    grammarsurvey: 'scripts/grammarsurvey.ts',
    ...Object.fromEntries(tests),
  },
  outdir: 'out',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
  // canvas is jsdom's optional native renderer (nodemock stubs the 2D
  // context instead). The TextMate packages are for tests only.
  external: ['vscode', 'canvas', 'vscode-textmate', 'vscode-oniguruma'],
  plugins: [jsdomNoSyncXHR, excludePlatforms],
  // binaryen (Verilog only, 7MB) loads from the asset root: see binaryen.js
  alias: { binaryen: './src/binaryen.js' },
  logLevel: 'warning',
});
// the debug views' page scripts run in webviews, not node
const webviewCtx = await esbuild.context({
  absWorkingDir: root,
  entryPoints: { waveformview: 'src/webview/waveformview.ts' },
  outdir: 'out',
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
  sourcemap: true,
  logLevel: 'warning',
});
if (watch) {
  await ctx.watch();
  await webviewCtx.watch();
  console.error('[esbuild] watching extension');
} else {
  await ctx.rebuild();
  await webviewCtx.rebuild();
  await ctx.dispose();
  await webviewCtx.dispose();
}
