// cli - the 8bws command in the integrated terminal (out/8bws.js), and the
// npm package. It runs the repo's CLI (src/tools/8bws.ts) against toolchain
// packs it unpacks on demand: the base pack first, then verilog/extra only
// when a build or run needs them. The VS Code launcher (terminalcli.ts) runs
// it with VS Code's own Node and sets EIGHTBITWORKSHOP_TOOLCHAINS to the
// extension's cache; run directly, the cache is the user's (defaultCacheDir).

import * as fs from 'fs';
import * as path from 'path';
import { ASSET_URLS, AssetStore, defaultCacheDir } from '../../src/tools/assets';
import { AssetManifest, isPackable, packsForPlatform } from '../../src/tools/assetpacks';
import { UNREVIEWED_TOOLS, UNSUPPORTED_PLATFORMS } from '../../src/tools/exclusions';
import { setToolchainHost } from '../../src/tools/toolroot';
import { getRootBasePlatform } from '../../src/common/util';

/** The asset store: the packs next to this file (the extension), then the servers. */
function openStore(): AssetStore {
  var manifest: AssetManifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets.json'), 'utf-8'));
  var urls = ASSET_URLS.slice();
  var bundled = path.join(__dirname, 'assets');
  if (fs.existsSync(bundled)) urls.unshift(bundled);
  // a mirror, or a directory of packs for offline use
  if (process.env.EIGHTBITWORKSHOP_ASSETS) urls.unshift(process.env.EIGHTBITWORKSHOP_ASSETS);
  // stderr, so --json output stays clean
  return new AssetStore(defaultCacheDir(), manifest, urls, msg => process.stderr.write(msg + '\n'));
}

async function main() {
  // $EIGHTBITWORKSHOP_ROOT (a checkout, or toolchainPath) has every file already
  if (!process.env.EIGHTBITWORKSHOP_ROOT) {
    var store = openStore();
    process.env.EIGHTBITWORKSHOP_ROOT = await store.ensure(['base']);
    const supports = (platform: string) => !UNSUPPORTED_PLATFORMS.includes(getRootBasePlatform(platform));
    setToolchainHost({
      async ensure(platform, tool, source) {
        if (platform && !supports(platform)) {
          throw new Error(`Platform '${platform}' isn't in this install of 8bws. Use a full checkout (set EIGHTBITWORKSHOP_ROOT).`);
        }
        await store.ensure(packsForPlatform(platform, tool, source));
      },
      providesTool: (tool, wasm) => !(tool in UNREVIEWED_TOOLS) && (!wasm || isPackable(`src/worker/wasm/${wasm}.wasm`)),
      supportsPlatform: supports,
    });
  }
  // 8bws runs as it loads, so load it only once the root is set
  await import('../../src/tools/8bws');
}

main().catch(e => {
  process.stderr.write(`8bws: ${e && e.message || e}\n`);
  process.exit(1);
});
