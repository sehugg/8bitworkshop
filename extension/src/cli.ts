// cli - the 8bws command in the integrated terminal (out/8bws.js). The
// launcher script from terminalcli.ts runs it with VS Code's own Node. It
// unpacks the bundled toolchains if the extension hasn't yet, then runs the
// repo's CLI (src/tools/8bws.ts) against them.

import * as fs from 'fs';
import * as path from 'path';
import { ASSET_URLS, AssetStore } from './assets';
import type { AssetManifest } from './assetpacks';

/** The asset root: toolchainPath or a checkout, else the extension's store. */
async function toolchainRoot(): Promise<string> {
  var cache = process.env.EIGHTBITWORKSHOP_TOOLCHAINS;
  if (!cache) throw new Error('Set EIGHTBITWORKSHOP_ROOT or EIGHTBITWORKSHOP_TOOLCHAINS; the 8bws launcher from VS Code sets them.');
  var manifest: AssetManifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets.json'), 'utf-8'));
  var urls = [path.join(__dirname, 'assets')];
  if (process.env.EIGHTBITWORKSHOP_ASSET_URL) urls.push(process.env.EIGHTBITWORKSHOP_ASSET_URL);
  urls.push(...ASSET_URLS);
  // stderr, so --json output stays clean
  var store = new AssetStore(cache, manifest, urls, msg => process.stderr.write(msg + '\n'));
  return store.ensure(Object.keys(manifest.packs));
}

async function main() {
  if (!process.env.EIGHTBITWORKSHOP_ROOT) process.env.EIGHTBITWORKSHOP_ROOT = await toolchainRoot();
  // 8bws runs as it loads, so load it only once the root is set
  await import('../../src/tools/8bws');
}

main().catch(e => {
  process.stderr.write(`8bws: ${e && e.message || e}\n`);
  process.exit(1);
});
