// binaryen - build.mjs aliases the binaryen package to this module, which
// loads it from the asset root: the repo's node_modules in development, or the
// downloaded verilog pack. Only the Verilog platform imports it, when it loads.
// Normally that happens in a worker thread (workerData.rootDir); a main-thread
// consumer like presetindex leaves the root in a global (see installNodeMocks).
const path = require('path');
const { workerData } = require('worker_threads');

const rootDir = (workerData && workerData.rootDir) || globalThis.__8bitworkshopAssetRoot;
if (!rootDir) throw new Error('binaryen: no asset root (load the Verilog platform in a worker)');
module.exports = require(path.join(rootDir, 'node_modules', 'binaryen', 'index.js'));
